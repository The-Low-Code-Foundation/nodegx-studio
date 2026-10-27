/**
 * P127 BKO-005 — a backend's workflows and triggers, in a person's words and laid out to draw. Pure: no DOM, no fetch.
 *
 * BKO-001 put them in the project (`nodegx.automations.json`: `{ version, workflows, triggers }`, the backend's write
 * shapes with their ids). The project's files are the truth (ruling R1), so Studio draws the file's entries, and says of
 * each whether the backend it runs on agrees.
 *
 *   triggerHead(t, words)        "Every day at 09:00", "When a Task is created", "When a webhook arrives at /hooks/…"
 *   targetOf(t)                  what a fire starts: { kind: 'function' | 'workflow', name, key }
 *   scheduleTime(cron)           { hour, minute } for a cron this can change the time of, else null
 *   atTime(cron, hour, minute)   that cron at another time of day
 *   workflowLayout(wf)           its steps in columns from the entry, every next / route / error route a wire
 *   stepsOfRun(record)           an execution record's steps by step id: how each one went
 *
 * The cron's words are never made here: the backend says them (`scheduleWords` on `GET /admin/triggers`, from its one
 * gloss, `triggers/cronWords.ts`), because a wrong sentence about when something runs is read as the truth.
 */
export const AUTOMATIONS_FILE = 'nodegx.automations.json';
export const CLOUD_PREFIX = '__cloud__/';

/** The file's text read as automations, or a sentence saying why it can't be. Null text: the project has none. */
export function readAutomations(text) {
  if (text == null) return { workflows: [], triggers: [] };
  try {
    const j = JSON.parse(text);
    return { workflows: Array.isArray(j.workflows) ? j.workflows : [], triggers: Array.isArray(j.triggers) ? j.triggers : [] };
  } catch (e) {
    return { workflows: [], triggers: [], error: `${AUTOMATIONS_FILE} is not readable JSON (${e.message})` };
  }
}

const ACTION_WORDS = { create: 'created', update: 'changed', delete: 'deleted' };
const orList = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

/**
 * The head of a trigger's flow, as a person says what starts it. `words`: the backend's sentence for a schedule's cron
 * (null when the backend has none for its shape, undefined when no backend answered): the cron itself is said then.
 */
export function triggerHead(t, words) {
  if (t.type === 'schedule') {
    if (words) return words;
    return `On a schedule: ${t.schedule?.cron ?? '(no time set)'}`;
  }
  if (t.type === 'db-change') {
    const acts = (t.dbChange?.actions ?? []).map((a) => ACTION_WORDS[a] ?? a);
    const table = t.dbChange?.collection ?? 'a row';
    return `When a ${table} is ${acts.length ? orList(acts) : 'changed'}`;
  }
  if (t.type === 'webhook') return `When a webhook arrives at /hooks/…/${t.webhook?.slug ?? t.id}`;
  return `When ${t.type ?? 'something'} happens`;
}

/** What a fire starts. A function's key is the component Studio opens (BKO-004); a workflow's is its id. */
export function targetOf(t) {
  const kind = t.target?.kind === 'workflow' ? 'workflow' : 'function';
  const name = t.target?.name ?? '';
  return { kind, name, key: kind === 'function' ? CLOUD_PREFIX + name : name };
}

const INT = /^\d{1,2}$/;
/**
 * The time of day of a cron Studio can move: five fields, a plain minute and hour, and any day fields. A step, a list
 * or a range in the minute or hour is a schedule that runs more than once a day: its time is the agent's to change.
 */
export function scheduleTime(cron) {
  const f = String(cron ?? '').trim().split(/\s+/);
  if (f.length !== 5 || !INT.test(f[0]) || !INT.test(f[1])) return null;
  const minute = Number(f[0]), hour = Number(f[1]);
  return minute < 60 && hour < 24 ? { hour, minute } : null;
}

/** The same cron at another time of day; only for a cron `scheduleTime` reads. */
export function atTime(cron, hour, minute) {
  const f = String(cron).trim().split(/\s+/);
  if (!scheduleTime(cron)) throw new Error(`"${cron}" runs more than once a day: its time can't be moved here`);
  if (!(Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60)) throw new Error(`${hour}:${minute} is not a time of day`);
  return [String(minute), String(hour), ...f.slice(2)].join(' ');
}

export const hhmm = ({ hour, minute }) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * Every wire out of a step: `then` for `next`, `route` for a named route (a branch's ontrue, a switch's case), `fail`
 * for `onError`. A route named like a failure (`failed`, `error`) is a failure too.
 */
export function stepWires(step) {
  const out = [];
  for (const to of step.next ?? []) out.push({ from: step.id, to, kind: 'then', label: '' });
  for (const [label, tos] of Object.entries(step.routes ?? {})) for (const to of tos ?? []) out.push({ from: step.id, to, kind: /^(fail|failed|error|onerror)$/i.test(label) ? 'fail' : 'route', label });
  for (const to of step.onError ?? []) out.push({ from: step.id, to, kind: 'fail', label: 'if it fails' });
  return out;
}

/**
 * A workflow's steps in columns, left to right: the entry first, every other step one column after the furthest step
 * that leads to it (so a step two paths reach sits after both). A step no path from the entry reaches is `loose`, in a
 * last column of its own. A wire to an id the workflow lacks is `dangling`, said rather than drawn.
 */
export function workflowLayout(wf) {
  const steps = wf.steps ?? [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const all = steps.flatMap(stepWires);
  const wires = all.filter((w) => byId.has(w.to));
  const dangling = all.filter((w) => !byId.has(w.to));
  const depth = new Map();
  if (byId.has(wf.entry)) {
    // longest path from the entry, by relaxing until nothing deepens (a cycle would be refused by the backend; the cap ends one anyway)
    depth.set(wf.entry, 0);
    for (let round = 0, changed = true; changed && round <= steps.length; round++) {
      changed = false;
      for (const w of wires) {
        if (!depth.has(w.from) || w.to === wf.entry) continue;
        const d = depth.get(w.from) + 1;
        if (!depth.has(w.to) || depth.get(w.to) < d) { depth.set(w.to, Math.min(d, steps.length)); changed = true; }
      }
    }
  }
  const columns = [];
  for (const s of steps) if (depth.has(s.id)) (columns[depth.get(s.id)] ??= []).push(s.id);
  const loose = steps.filter((s) => !depth.has(s.id)).map((s) => s.id);
  const packed = columns.filter(Boolean);
  if (loose.length) packed.push(loose);
  return { columns: packed, wires, loose, dangling };
}

/**
 * Whether the project's entry and the backend's copy do the same thing: the fields that decide what runs and when.
 * The full comparison is the agent's (`get_project_info` says the drift, BKO-001 AC6); this is what a person sees.
 */
export function agrees(kind, file, backend) {
  if (!file || !backend) return false;
  const said = kind === 'trigger'
    ? (t) => JSON.stringify([t.type, t.enabled !== false, t.target?.kind, t.target?.name, t.schedule?.cron ?? null, t.dbChange?.collection ?? null, [...(t.dbChange?.actions ?? [])].sort(), t.webhook?.slug ?? null])
    : (w) => JSON.stringify([w.entry, (w.steps ?? []).map((s) => [s.id, s.kind, s.ref ?? null, s.next ?? [], s.routes ?? {}, s.onError ?? [], s.params ?? {}])]);
  return said(file) === said(backend);
}

/** A run's steps by step id, from `GET /executions/:id` (the engine records each step under its id). The last one recorded wins. */
export function stepsOfRun(record) {
  const out = new Map();
  for (const s of [...(record?.steps ?? [])].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))) {
    out.set(s.nodeId, { status: s.status, durationMs: s.durationMs ?? (s.completedAt && s.startedAt ? s.completedAt - s.startedAt : undefined), error: s.errorMessage, index: s.stepIndex });
  }
  return out;
}

/** The run in a line: when, how it ended, and where it stopped when it failed. `nameOf(stepId)` says a step. */
export function runLine(record, nameOf = (id) => id) {
  if (!record) return 'Not run on this backend yet.';
  const when = new Date(record.startedAt).toLocaleString();
  const ms = record.durationMs != null ? ` · ${record.durationMs} ms` : '';
  if (record.status === 'running') return `● Running since ${when}`;
  if (record.status === 'success') return `● Last run ${when} · finished${ms}`;
  const steps = stepsOfRun(record);
  const failed = [...steps.entries()].filter(([, s]) => s.status === 'error').sort((a, b) => a[1].index - b[1].index)[0];
  const where = failed ? ` at step ${failed[1].index + 1}, ${nameOf(failed[0])}` : '';
  return `● Last run ${when} · failed${where}${record.errorMessage || failed?.[1].error ? `: ${failed?.[1].error || record.errorMessage}` : ''}${ms}`;
}
