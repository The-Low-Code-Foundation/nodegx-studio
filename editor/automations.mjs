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

/** A run's steps by step id, from `GET /executions/:id` (the engine records each step under its id). The last one recorded wins. A function's run records an outcome per node, never its values. */
export function stepsOfRun(record) {
  const out = new Map();
  for (const s of [...(record?.steps ?? [])].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))) {
    // STU-092: what went in (the payload, the step's params as resolved, `previous`) and what came out, as the backend recorded them
    out.set(s.nodeId, { status: s.status, durationMs: s.durationMs ?? (s.completedAt && s.startedAt ? s.completedAt - s.startedAt : undefined), error: s.errorMessage, index: s.stepIndex, input: s.inputData, output: s.outputData });
  }
  return out;
}

/** The run in a line: when, how it ended, and where it stopped when it failed. `nameOf(stepId)` says a step. */
export function runLine(record, nameOf = (id) => id) {
  if (!record) return 'Not run on this backend yet.';
  const when = new Date(record.startedAt).toLocaleString();
  const ms = record.durationMs != null ? ` · ${record.durationMs} ms` : '';
  if (record.status === 'running') return `● Running since ${when}`;
  // P132 BWF-002: a test on a sample says so, and where it was asked to stop
  const what = record.metadata?.test ? 'Tested' : 'Last run', stopped = record.metadata?.stoppedAfter;
  const steps = stepsOfRun(record);
  if (record.status === 'success') return stopped ? `● ${what} ${when} · stopped after step ${(steps.get(stopped)?.index ?? 0) + 1}, ${nameOf(stopped)}${ms}` : `● ${what} ${when} · finished${ms}`;
  const failed = [...steps.entries()].filter(([, s]) => s.status === 'error').sort((a, b) => a[1].index - b[1].index)[0];
  const where = failed ? ` at step ${failed[1].index + 1}, ${nameOf(failed[0])}` : '';
  return `● ${what} ${when} · failed${where}${record.errorMessage || failed?.[1].error ? `: ${failed?.[1].error || record.errorMessage}` : ''}${ms}`;
}

/* ---- STU-092: a backend workflow edited in Studio. Pure: each takes a workflow and answers a new one (the input is not
   touched), or throws a sentence saying why it can't. What the backend refuses beyond these (a param's shape) it says. ---- */
const clone = (wf) => JSON.parse(JSON.stringify(wf));
/** Every wire into `id`: [step, where ('next' | 'onError' | a route's name)]. */
const into = (wf, id) => (wf.steps ?? []).flatMap((s) => [
  ...((s.next ?? []).includes(id) ? [[s, 'next']] : []),
  ...((s.onError ?? []).includes(id) ? [[s, 'onError']] : []),
  ...Object.entries(s.routes ?? {}).filter(([, tos]) => (tos ?? []).includes(id)).map(([r]) => [s, r])]);
const listAt = (s, where) => (where === 'next' || where === 'onError' ? (s[where] ??= []) : ((s.routes ??= {})[where] ??= []));

/** An id for a new step of `kind`, unused in `wf`: the kind's name, then -2, -3… */
export function newStepId(wf, kind) {
  const used = new Set((wf.steps ?? []).map((s) => s.id));
  const base = String(kind).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^[^a-zA-Z0-9]+/, '') || 'step';
  for (let i = 1; ; i++) { const id = i === 1 ? base : `${base}-${i}`; if (!used.has(id)) return id; }
}

/**
 * `step` added after `afterId`, on its `where` ('next', or a route's name: a branch's ontrue). What came after there now
 * comes after the new step, so nothing is cut off; on a route, the new step goes first on it. `afterId` null: the new
 * step is the workflow's first, the old first after it.
 */
const ENDS = new Set(['return', 'stop']);
/** What came after goes on after `fresh`: down its first side when it leads on by routes (a branch), else its next. A
    branch is never given a `next`: the engine follows `next` whatever the If says (P132-BRANCHNEXT). */
function leadOn(fresh, list) {
  if (!list.length) return;
  if (fresh.routes) { const r = Object.keys(fresh.routes)[0] ?? 'ontrue'; fresh.routes[r] = [...list]; } else fresh.next = [...list];
}
export function addStepAfter(wf, afterId, where, step) {
  const out = clone(wf);
  if ((out.steps ?? []).some((s) => s.id === step.id)) throw new Error(`The workflow already has a step called ${step.id}`);
  const fresh = { ...clone(step) };
  if (afterId == null) {
    if (out.entry && ENDS.has(fresh.kind)) throw new Error(`A ${fresh.kind === 'return' ? 'Return' : 'Stop'} ends the workflow, so it goes at the end of a line of steps, not at the start.`);
    if (out.entry) leadOn(fresh, [out.entry]);
    out.steps = [fresh, ...(out.steps ?? [])]; out.entry = fresh.id;
    return out;
  }
  const after = out.steps.find((s) => s.id === afterId);
  if (!after) throw new Error(`The workflow has no step ${afterId}`);
  if (ENDS.has(after.kind) && where === 'next') throw new Error(`Nothing runs after a ${after.kind === 'return' ? 'Return' : 'Stop'}: it ends the workflow.`);
  const list = listAt(after, where);
  if (ENDS.has(fresh.kind) && list.length) throw new Error(`A ${fresh.kind === 'return' ? 'Return' : 'Stop'} ends the workflow, so it goes at the end of a line of steps, not in the middle.`);
  // a step that leads on by routes (a branch) carries on down its first side what came after
  leadOn(fresh, list);
  list.splice(0, list.length, fresh.id);
  out.steps.push(fresh);
  return out;
}

/**
 * P132 BWF-001: `step` put on the one wire from `fromId` (on `where`) to `toId`, the "+" on that wire: the wire goes
 * to the new step and the new step on to `toId`. The other wires on that list are left where they go.
 */
export function insertBetween(wf, fromId, where, toId, step) {
  const out = clone(wf);
  if ((out.steps ?? []).some((s) => s.id === step.id)) throw new Error(`The workflow already has a step called ${step.id}`);
  const from = out.steps.find((s) => s.id === fromId);
  const list = from ? listAt(from, where) : [];
  if (!list.includes(toId)) throw new Error(`No wire from ${fromId} to ${toId}`);
  const fresh = { ...clone(step) };
  if (ENDS.has(fresh.kind)) throw new Error(`A ${fresh.kind === 'return' ? 'Return' : 'Stop'} ends the workflow, so it goes at the end of a line of steps, not in the middle.`);
  leadOn(fresh, [toId]);
  list[list.indexOf(toId)] = fresh.id;
  out.steps.push(fresh);
  return out;
}

/**
 * Step `id` taken out. Each wire into it goes on to what it went to next (its `next`), so the steps after it still run;
 * a step that leads on by routes (a branch) is deleted only when nothing hangs off its routes. The first step deleted
 * makes its next the first. The last step is not deleted: a workflow has at least one (delete the workflow instead).
 */
export function deleteStep(wf, id) {
  const out = clone(wf);
  const s = out.steps.find((x) => x.id === id);
  if (!s) throw new Error(`The workflow has no step ${id}`);
  if (out.steps.length === 1) throw new Error('It is the workflow’s only step: delete the workflow instead.');
  if (Object.values(s.routes ?? {}).some((tos) => tos?.length)) throw new Error('Steps hang off its sides: delete those first, or the workflow would lose them.');
  const then = s.next ?? [];
  if (out.entry === id) {
    if (then.length !== 1) throw new Error('It is the first step and does not lead to exactly one other: there would be no first step.');
    out.entry = then[0];
  }
  for (const [p, where] of into(out, id)) { const list = listAt(p, where); list.splice(list.indexOf(id), 1, ...then.filter((t) => !list.includes(t))); }
  out.steps = out.steps.filter((x) => x.id !== id);
  // a wire list left empty goes; a route left empty stays (a branch needs one of its sides named, even with nothing on it)
  for (const x of out.steps) { if (x.next && !x.next.length) delete x.next; if (x.onError && !x.onError.length) delete x.onError; }
  return out;
}

/** Whether `a` → `b` is a plain link two steps can swap places on: a's only way on is b, b's only way in is a, neither branches. */
function swappable(wf, a, b) {
  const plain = (s) => !Object.keys(s.routes ?? {}).length && !(s.onError ?? []).length;
  return !!a && !!b && plain(a) && plain(b) && (a.next ?? []).length === 1 && a.next[0] === b.id && into(wf, b.id).length === 1 && (b.next ?? []).length <= 1;
}
/** Where step `id` can move: { earlier, later } (each a boolean). */
export function canMove(wf, id) {
  const s = (wf.steps ?? []).find((x) => x.id === id);
  const prev = into(wf, id).length === 1 ? into(wf, id)[0][0] : null;
  const next = (s?.next ?? []).length === 1 ? wf.steps.find((x) => x.id === s.next[0]) : null;
  return { earlier: swappable(wf, prev, s), later: swappable(wf, s, next) };
}
/** Step `id` one place earlier (`dir` -1) or later (+1) on a plain run of steps: it and its neighbour swap places. */
export function moveStep(wf, id, dir) {
  const out = clone(wf);
  const s = out.steps.find((x) => x.id === id);
  const [a, b] = dir < 0 ? [into(out, id)[0]?.[0], s] : [s, out.steps.find((x) => x.id === s?.next?.[0])];
  if (!swappable(out, a, b)) throw new Error(dir < 0 ? 'It can’t go earlier: the step before it branches, or more than one leads to it.' : 'It can’t go later: the step after it branches, or more than one leads to it.');
  for (const [p, where] of into(out, a.id)) { const list = listAt(p, where); list[list.indexOf(a.id)] = b.id; }
  if (out.entry === a.id) out.entry = b.id;
  const after = b.next ?? [];
  b.next = [a.id];
  if (after.length) a.next = [...after]; else delete a.next;
  return out;
}

/* ---- P132 BWF-001: where a step leads on, drawn. Each way on is a port on the card's right edge, named in words: a
   branch's Yes and No, a switch's cases and Anything else, a list's none and some; then a plain `next`, which on a step
   that branches is "Always, as well" (the engine follows it whatever the route: P132-BRANCHNEXT); then the error route. ---- */
export const ROUTE_WORDS = { ontrue: 'Yes', onfalse: 'No', empty: 'If there are none', nonempty: 'If there are some', done: 'When the time comes', skipped: 'If it was already past', default: 'Anything else', onError: 'If it fails' };
export const ALWAYS_WORDS = 'Always, as well';
const FAILISH = /^(fail|failed|error|onerror)$/i;
/** `routeNames`: the kind's own routes (the catalog's, a switch's case labels); routes the step carries are added. */
export function stepPorts(step, routeNames = []) {
  const routes = [...new Set([...routeNames, ...Object.keys(step.routes ?? {})])];
  const ports = routes.map((r) => ({ where: r, label: ROUTE_WORDS[r] ?? r, kind: r === 'ontrue' ? 'yes' : r === 'onfalse' ? 'no' : FAILISH.test(r) ? 'fail' : 'route', tos: step.routes?.[r] ?? [] }));
  if ((step.next ?? []).length || !routes.length) ports.push({ where: 'next', label: routes.length ? ALWAYS_WORDS : '', kind: routes.length ? 'always' : 'then', tos: step.next ?? [] });
  if ((step.onError ?? []).length) ports.push({ where: 'onError', label: ROUTE_WORDS.onError, kind: 'fail', tos: step.onError });
  return ports;
}
/** A step's plain `next` moved onto one of its routes: what an agent or an older Studio left on a branch, put on a side. */
export function nextOntoRoute(wf, id, route) {
  const out = clone(wf);
  const s = out.steps.find((x) => x.id === id);
  if (!s || !(s.next ?? []).length) throw new Error(`Step ${id} has no plain next to move`);
  const list = listAt(s, route);
  for (const to of s.next) if (!list.includes(to)) list.push(to);
  delete s.next;
  return out;
}

/** A param's value as Studio's control shows it: `{ from: path }` for a value read from the run, else `{ typed: value }`. */
export const valueForm = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.$path === 'string' && Object.keys(v).length === 1) return { from: v.$path };
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.$fn === 'string') return { fn: v.$fn, args: Array.isArray(v.args) ? v.args : [] }; // P132 BWF-004
  return { typed: v };
};

/* ---- P132 BWF-002: a workflow tested on a sample. A sample stands for what starts the workflow: a row change, a
   webhook's call, a schedule's fire, or nothing (a run asked for). It is kept per machine (serve.mjs's
   `.nodegx/workflow-samples.json`, never in git: it can hold a person's row), and sent as the run route's envelope
   (nodegx-backend `POST /admin/workflow-defs/:id/run`: `payload`, `as`, `stopAfter`), so the test starts the way the
   trigger would. ---- */
export const SAMPLE_KINDS = { 'db-change': 'A change to a table', webhook: 'A call from outside', schedule: 'A time', manual: 'Nothing: a run asked for' };
export const CHANGE_WORDS = { create: 'made', update: 'changed', delete: 'deleted' };
/** The sample a workflow starts with when it has none: the kind of the first trigger that starts it, its table and change. */
export function sampleFor(triggers = []) {
  const t = triggers[0];
  if (t?.type === 'db-change') return { kind: 'db-change', table: t.dbChange?.collection ?? '', action: t.dbChange?.actions?.[0] ?? 'create', body: {} };
  if (t?.type === 'webhook') return { kind: 'webhook', body: {} };
  if (t?.type === 'schedule') return { kind: 'schedule', body: t.schedule?.payload ?? {} };
  return { kind: 'manual', body: {} };
}
/** The run route's envelope for a test on `sample`, up to `stopAfter` when given. */
export function sampleRun(sample, stopAfter) {
  const s = sample ?? { kind: 'manual', body: {} };
  const as = s.kind === 'db-change' ? { type: 'db-change', collection: s.table, action: s.action || 'create', ...(s.rowId ? { recordId: s.rowId } : {}) }
    : s.kind === 'webhook' || s.kind === 'schedule' ? { type: s.kind } : { type: 'manual' };
  return { payload: s.body ?? {}, as, test: true, ...(stopAfter ? { stopAfter } : {}) };
}
/** The sample in the panel's words: "Sample: Watering Monstera, made". */
export function sampleWords(sample) {
  if (!sample) return 'No sample yet';
  if (sample.kind === 'db-change') {
    const row = sample.rowId ? `${sample.table} ${sample.label || sample.rowId}` : `a ${sample.table || 'row'} you typed`;
    return `Sample: ${row}, ${CHANGE_WORDS[sample.action] ?? sample.action}`;
  }
  const n = Object.keys(sample.body ?? {}).length;
  const with_ = n ? `, with ${n} value${n === 1 ? '' : 's'}` : ', with nothing in it';
  return sample.kind === 'webhook' ? `Sample: a call from outside${with_}` : sample.kind === 'schedule' ? `Sample: the schedule's fire${with_}` : `Sample: a run asked for${with_}`;
}
/**
 * Why a test may not run here, in words, or null. A test is a real run: a step that writes really writes. So it runs on
 * the development backend only, and never on one that is the app's live backend under another name.
 * `dev` / `live`: the project's two bindings (`{ endpoint, instanceId }`); `name`: the development backend's own name.
 */
export function testRefusal({ env, dev, live, name } = {}) {
  const LIVE = 'A test runs on your development backend only, never on live: the rows it makes would be real ones your app’s people see.';
  if (env === 'live') return LIVE;
  const same = (a, b) => !!a && !!b && String(a).replace(/\/$/, '') === String(b).replace(/\/$/, '');
  if (same(dev?.endpoint, live?.endpoint) || same(dev?.instanceId, live?.instanceId) || / live backend$/i.test(name ?? '')) return `This project’s development backend is its live one. ${LIVE}`;
  return null;
}

/* ---- P132 BWF-003: a value picked from what came before. A step reads what started it (`body`), how (`trigger`), and
   `upstream.<id>` of every step with a path to it over next, routes and onError: the backend's own rule (nodegx-backend
   WorkflowEngine `ancestorsOf`, the NodeGX editor's workflowScope.ts), so a value picked here is one a write accepts.
   Each source's fields are the newest run's, else the test's sample, else the shape: the catalog's words for the kind,
   a function's Response, the trigger's table. ---- */

/** The steps that can have run before `id`, in the file's order (never `id` itself). */
export function upstreamOf(wf, id) {
  const into = new Map();
  for (const s of wf.steps ?? []) for (const w of stepWires(s)) { if (!into.has(w.to)) into.set(w.to, []); into.get(w.to).push(s.id); }
  const seen = new Set(), stack = [...(into.get(id) ?? [])];
  while (stack.length) { const x = stack.pop(); if (x === id || seen.has(x)) continue; seen.add(x); stack.push(...(into.get(x) ?? [])); }
  return (wf.steps ?? []).filter((s) => seen.has(s.id));
}
/** The names a catalog `output` gives, from its first `{ … }` ("`{ result: boolean, isfalse: boolean }` — …"); [] when it names none. */
export function shapeFields(prose) {
  const m = /`\{([^`]*)\}`/.exec(String(prose ?? ''));
  if (!m) return [];
  const out = []; let depth = 0, part = '';
  for (const ch of `${m[1]},`) {
    if ('{[('.includes(ch)) depth++; else if ('}])'.includes(ch)) depth--;
    if (ch !== ',' || depth > 0) { part += ch; continue; }
    const name = /^\s*([A-Za-z_$][\w$]*)\s*(:|$)/.exec(part)?.[1];
    if (name) out.push(name);
    part = '';
  }
  return out;
}
const blank = (names) => Object.fromEntries(names.map((n) => [n, null]));
const dig = (v, path) => path.reduce((x, k) => (x != null && typeof x === 'object' ? x[k] : undefined), v);
/** What started the workflow, in words: "the Watering that was made", "the call that started it". */
export function startWords(starts = []) {
  const t = starts[0];
  if (t?.type === 'db-change') return `the ${t.dbChange?.collection ?? 'row'} that was ${(t.dbChange?.actions ?? ['create']).map((a) => CHANGE_WORDS[a] ?? a).join(' or ')}`;
  if (t?.type === 'webhook') return 'the call that started it';
  if (t?.type === 'schedule') return 'the schedule that started it';
  return 'what it was given';
}
/**
 * What step `stepId` can read, a source each: `{ root, words, from: 'run' | 'sample' | 'shape', value, note? }`. A shape's
 * value holds its field names, each null. `have`:
 *   run         stepsOfRun(record) of the run lit, or null      sample     the workflow's test sample, or null
 *   starts      the triggers that start it                       columns(table)   a table's column names, or null
 *   kind(kind)  the catalog's entry                              answers(step)    what a function step's function answers (its Response's names), or null
 */
export function readSources(wf, stepId, { run = null, sample = null, starts = [], columns = () => null, kind = () => null, answers = () => null } = {}) {
  const ran = [...(run?.values() ?? [])].find((r) => r.input && typeof r.input === 'object' && 'body' in r.input);
  const t = starts[0], out = [];
  // what started it
  const row = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'ACL')) : v); // who may read a row is not a value to use
  if (ran) out.push({ root: 'body', words: startWords(starts), from: 'run', value: row(ran.input.body) });
  else if (sample && Object.keys(sample.body ?? {}).length) out.push({ root: 'body', words: startWords(starts), from: 'sample', value: row(sample.body) });
  else if (t?.type === 'db-change') {
    const cols = columns(t.dbChange?.collection) ?? [];
    out.push({ root: 'body', words: startWords(starts), from: 'shape', value: blank(['objectId', ...cols, 'createdAt', 'updatedAt']) });
  } else out.push({ root: 'body', words: startWords(starts), from: 'shape', value: {}, note: t?.type === 'schedule' ? 'A schedule sends nothing unless it is given a payload.' : 'Its fields show once the test has a sample.' });
  const how = { type: null, firedAt: null, ...(t?.type === 'db-change' ? { collection: null, action: null, recordId: null } : t?.type === 'webhook' ? { slug: null } : t?.type === 'schedule' ? { cron: null } : {}) };
  out.push(ran?.input.trigger && typeof ran.input.trigger === 'object' ? { root: 'trigger', words: 'how it started', from: 'run', value: ran.input.trigger } : { root: 'trigger', words: 'how it started', from: 'shape', value: how });
  // each step upstream of it
  for (const s of upstreamOf(wf, stepId)) {
    const r = run?.get(s.id), words = s.name || kind(s.kind)?.displayName || s.id;
    if (r && r.output !== undefined && r.status !== 'error' && r.status !== 'skipped') { out.push({ root: `upstream.${s.id}`, words, from: 'run', value: r.output, step: s.id }); continue; }
    const fn = s.kind === 'call-function' ? answers(s) : null;
    const own = s.kind === 'transform' && s.params?.output && typeof s.params.output === 'object' && !Array.isArray(s.params.output) ? Object.keys(s.params.output) : null;
    const value = fn ? { result: blank(fn) } : own ? blank(own) : blank(shapeFields(kind(s.kind)?.output));
    out.push({ root: `upstream.${s.id}`, words, from: 'shape', value, step: s.id });
  }
  return out;
}
/**
 * Inside a step that goes through a list (a filter, a For Each's filter), what its condition reads per item: the item,
 * its fields from the list's first item in `sources` (readSources'), and its position. `step.params.items` names the list.
 */
export function itemSources(wf, step, sources) {
  const p = step.params ?? {}, key = typeof p.itemKey === 'string' ? p.itemKey : 'item', at = typeof p.indexKey === 'string' ? p.indexKey : 'index';
  const form = valueForm(p.items === undefined ? { $path: 'previous.items' } : p.items);
  let list, src = null;
  if ('typed' in form) list = form.typed;
  else {
    const [root, ...rest] = form.from.split('.');
    const before = root === 'previous' ? (wf.steps ?? []).filter((s) => stepWires(s).some((w) => w.to === step.id)) : [];
    const named = root === 'previous' ? (before.length === 1 ? `upstream.${before[0].id}` : null) : root === 'upstream' ? `upstream.${rest.shift()}` : root;
    src = sources.find((s) => s.root === named) ?? null;
    list = src && dig(src.value, rest);
  }
  const from = src ? src.from : 'run', first = Array.isArray(list) ? list[0] : undefined;
  const item = first === undefined
    ? { root: key, words: 'this item', from: 'shape', value: {}, note: from === 'shape' || !Array.isArray(list) ? 'Its fields show once the workflow is tested.' : 'The list was empty in the test.' }
    : { root: key, words: 'this item', from, value: first };
  return [item, { root: at, words: 'its position', from: item.from, value: 0, leaf: true }];
}
/** A value read from the run in words, for its pill: `{ name, from }`, "plant · from the Watering that was made". */
export function pathWords(path, wf, starts = [], { item = 'item', index = 'index', kindName = (k) => k } = {}) {
  const [root, ...rest] = String(path).split('.');
  const seg = (xs, whole = 'all of it') => (xs.length ? xs.map((x) => (/^\d+$/.test(x) ? `#${Number(x) + 1}` : x)).join(' › ') : whole);
  if (root === 'body') return { name: seg(rest), from: startWords(starts) };
  if (root === 'trigger') return { name: seg(rest), from: 'how it started' };
  if (root === 'previous') return { name: seg(rest), from: 'the step before' };
  if (root === 'upstream') {
    const s = (wf.steps ?? []).find((x) => x.id === rest[0]);
    let r = rest.slice(1);
    if (s?.kind === 'call-function' && r[0] === 'result' && r.length > 1) r = r.slice(1); // a function answers { result: { … } }: its names are what a person knows
    return s ? { name: seg(r), from: s.name || kindName(s.kind) } : { name: seg(r), from: `a step that is not there (${rest[0] ?? ''})`, missing: true };
  }
  if (root === item) return { name: seg(rest, 'this item'), from: 'the list' };
  if (root === index && !rest.length) return { name: 'its position', from: 'the list' };
  return { name: seg([root, ...rest]), from: 'the run' };
}

/* ---- P132 BWF-004: formulas, `{ "$fn": name, "args": [...] }`, from the backend's closed list (the catalog's
   `formulaLanguage`: each formula's label, sentence, typed args). Studio holds no list of its own. ---- */
/** What an arg starts as: a value the backend accepts, so a formula is saved the moment it is picked (a date is Now). */
const ARG_START = { text: '', number: 0, numbers: 0, boolean: false, date: { $fn: 'now' }, list: [], any: '' };
export const formulaArgStart = (a) => (a.type === 'choice' ? (a.oneOf?.includes('days') ? 'days' : a.oneOf?.[0] ?? '') : structuredClone(ARG_START[a.type] ?? ''));
/** A new formula from its served spec: every required arg filled, a repeating one twice where it combines values. */
export function formulaStart(spec) {
  const args = [];
  for (const a of spec.args ?? []) {
    if (a.optional) break;
    args.push(formulaArgStart(a));
    if (a.repeats && (a.type === 'numbers' || spec.name === 'default')) args.push(formulaArgStart(a));
  }
  return args.length ? { $fn: spec.name, args } : { $fn: spec.name };
}
/** Which of a formula's args a value at position `i` fills (a repeating last arg takes every value past it). */
export const formulaArgAt = (spec, i) => spec.args[Math.min(i, spec.args.length - 1)];
/** A formula drawn as its sentence, each arg in words (`valueWords(v)` for one): "days between last watered and now".
    Returns the parts, `{ text }` and `{ arg, words }`, so a page can set the values apart. */
export function formulaParts(f, formulas, valueWords) {
  const spec = formulas?.find((x) => x.name === f.$fn);
  if (!spec) return [{ text: `${f.$fn} (a formula this backend does not have)` }];
  const args = Array.isArray(f.args) ? f.args : [];
  const idx = (name) => spec.args.findIndex((a) => a.name === name);
  const out = [], pieces = spec.sentence.split(/(\{\w+\})/).filter(Boolean);
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k], m = /^\{(\w+)\}$/.exec(piece);
    if (!m) { out.push({ text: piece }); continue; }
    const i = idx(m[1]), a = spec.args[i];
    const vals = a?.repeats ? args.slice(i) : i < args.length ? [args[i]] : [];
    if (a?.optional && !vals.length) { // its clause, ", to {places} decimal places", is left out with it
      const before = out.at(-1)?.text, comma = before?.lastIndexOf(',') ?? -1;
      if (comma > 0) out.at(-1).text = before.slice(0, comma); else if (before) out.pop();
      if (k === pieces.length - 2) k++;
      continue;
    }
    const words = vals.map((v) => wordsOf(v, formulas, valueWords));
    out.push({ arg: m[1], words: !words.length ? `(no ${a?.label ?? m[1]})` : spec.name === 'text' ? words.join('') : words.length > 2 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words.join(' and ') });
  }
  return out;
}
function wordsOf(v, formulas, valueWords) {
  const form = valueForm(v);
  if ('fn' in form) return formulaParts(v, formulas, valueWords).map((p) => p.text ?? p.words).join('');
  return valueWords(v);
}
export const formulaWords = (f, formulas, valueWords) => formulaParts(f, formulas, valueWords).map((p) => p.text ?? p.words).join('');

/* ---- P132 BWF-006: *Paste a curl command* — an API's docs say how to call it as a curl line, and that line fills the
   Call an API form. A key in the line (an Authorization header, a key-named header or query parameter, -u user:pass)
   is lifted OUT of the settings: it is handed back as `key`, for Secrets, and the step names the Secret instead. ---- */

/** A header or query name that carries a key (the backend's own list, httpParams.ts CREDENTIAL_NAME). */
export const CREDENTIAL_NAME = /^(authorization|proxy-authorization|x-api-key|api-?key|apikey|x-auth-token|x-access-token|access_token|api_key|token|secret|client_secret|password|key|appid|app_id)$/i;

/** A command line split as a shell would: quotes, backslash escapes, a backslash at a line's end joining lines. */
export function shellWords(text) {
  const out = []; let cur = null, i = 0;
  const s = String(text).replace(/\\\r?\n/g, ' ');
  const push = () => { if (cur !== null) out.push(cur); cur = null; };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { push(); i++; continue; }
    cur ??= '';
    if (c === "'") { const j = s.indexOf("'", i + 1); cur += s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j + 1; continue; }
    if (c === '$' && s[i + 1] === "'") { const j = s.indexOf("'", i + 2); cur += s.slice(i + 2, j < 0 ? s.length : j).replace(/\\n/g, '\n').replace(/\\'/g, "'"); i = j < 0 ? s.length : j + 1; continue; }
    if (c === '"') {
      i++;
      while (i < s.length && s[i] !== '"') { if (s[i] === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) i++; cur += s[i++]; }
      i++; continue;
    }
    if (c === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue; }
    cur += c; i++;
  }
  push();
  return out;
}

/** A Secret's name for an API's key, from its address: api.openweathermap.org → OPENWEATHERMAP_KEY. */
export function secretNameFor(url) {
  let host = ''; try { host = new URL(url).hostname; } catch { /* below */ }
  if (!host || host === 'localhost' || /^[\d.]+$|:/.test(host)) return 'API_KEY'; // an address by number names nothing
  const parts = host.split('.').filter((p) => p && !/^(api|www|v\d+)$/i.test(p));
  const word = (parts.length > 1 ? parts.at(-2) : parts[0] || 'API').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  return `${word}_KEY`;
}

const CURL_FLAGS_WITH_VALUE = new Set(['-o', '--output', '-A', '--user-agent', '-e', '--referer', '-b', '--cookie', '-m', '--max-time', '--connect-timeout', '-x', '--proxy', '-w', '--write-out', '-c', '--cookie-jar', '--retry', '-T', '--upload-file', '-K', '--config', '--cacert', '--cert', '--key', '-r', '--range', '-z', '--time-cond']);

/**
 * A curl command as the `http-request` step's params: `{ params, key, notes }`. `key` is `{ value, name, how }` when the
 * command carried one (`how`: bearer / header / query / basic, the step's `authType`), or null. Throws, in words, on a
 * line that is not a curl command or names no address.
 */
export function parseCurl(text) {
  const words = shellWords(String(text).trim());
  if (words[0] !== 'curl') throw new Error('That is not a curl command: it should start with "curl".');
  let method = null, url = null, getMode = false, bodyType = null, timeoutMs = null, user = null;
  const headers = [], data = [], form = [], notes = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i], next = () => words[++i];
    const long = w.startsWith('--') && w.includes('=') ? [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)] : null;
    const flag = long ? long[0] : w, val = () => (long ? long[1] : next());
    if (flag === '-X' || flag === '--request') method = String(val()).toUpperCase();
    else if (/^-X[A-Z]+$/.test(w)) method = w.slice(2);
    else if (flag === '-H' || flag === '--header') headers.push(val());
    else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii'].includes(flag)) data.push(val());
    else if (flag === '--data-urlencode') { data.push(val()); bodyType ??= 'form'; }
    else if (flag === '--json') { data.push(val()); bodyType = 'json'; }
    else if (flag === '-F' || flag === '--form') form.push(val());
    else if (flag === '-u' || flag === '--user') user = val();
    else if (flag === '-G' || flag === '--get') getMode = true;
    else if (flag === '--url') url = val();
    else if (flag === '-m' || flag === '--max-time') { const s = Number(val()); if (s > 0) timeoutMs = Math.round(s * 1000); }
    else if (flag === '-A' || flag === '--user-agent') headers.push(`User-Agent: ${val()}`);
    else if (flag === '-b' || flag === '--cookie') { const c = val(); if (!/^[^=]*$/.test(c)) headers.push(`Cookie: ${c}`); }
    else if (CURL_FLAGS_WITH_VALUE.has(flag)) val();
    else if (w.startsWith('-')) { /* -s, -L, -i, -k, --compressed…: how curl shows the answer, nothing the step needs */ }
    else if (!url) url = w;
  }
  if (!url) throw new Error('The command names no address to call.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let u; try { u = new URL(url); } catch { throw new Error(`"${url}" is not an address.`); }

  const params = {}; let key = null;
  const takeKey = (value, how, name) => { if (!key && value) { key = { value, how, name: secretNameFor(u.href) }; if (name) params.authName = name; return true; } return false; };

  const query = {};
  for (const [k, v] of u.searchParams) {
    if (CREDENTIAL_NAME.test(k) && takeKey(v, 'query', k)) continue;
    query[k] = v;
  }
  const hdrs = {};
  for (const line of headers) {
    const at = line.indexOf(':'); if (at < 0) continue;
    const name = line.slice(0, at).trim(), value = line.slice(at + 1).trim(), low = name.toLowerCase();
    if (low === 'authorization') {
      const m = /^(Bearer|Token)\s+(.+)$/i.exec(value), b = /^Basic\s+(.+)$/i.exec(value);
      if (m && takeKey(m[2], 'bearer')) continue;
      if (b) { let pair = ''; try { pair = atob(b[1]); } catch { /* not base64 */ } const c = pair.indexOf(':'); if (c > 0 && takeKey(pair.slice(c + 1), 'basic')) { params.authUser = pair.slice(0, c); continue; } }
    } else if (CREDENTIAL_NAME.test(name) && takeKey(value, 'header', name)) continue;
    if (low === 'content-type' && /^application\/json\b/i.test(value)) { bodyType ??= 'json'; continue; }
    if (low === 'content-type' && /^application\/x-www-form-urlencoded\b/i.test(value)) { bodyType ??= 'form'; continue; }
    if (low === 'accept' && /^application\/json$/i.test(value)) continue;
    hdrs[name] = value;
  }
  if (user !== null) {
    const c = user.indexOf(':');
    if (c > 0 && takeKey(user.slice(c + 1), 'basic')) params.authUser = user.slice(0, c);
    else if (c < 0) notes.push('The command names a user with no password (curl would ask for it): add the password as a Secret and choose Basic.');
  }

  // the body: JSON when it reads as JSON, a form's fields when it is name=value&…, the text otherwise
  const raw = data.join('&');
  let body;
  if (form.length) { body = Object.fromEntries(form.map((f) => { const e = f.indexOf('='); return [f.slice(0, e), f.slice(e + 1)]; })); bodyType = 'form'; if (form.some((f) => /=@/.test(f))) notes.push('A file in the form (=@…) is sent as its name: a step sends no files.'); }
  else if (data.length) {
    const trimmed = raw.trim();
    if (bodyType !== 'form' && /^[[{]/.test(trimmed)) { try { body = JSON.parse(trimmed); bodyType = 'json'; } catch { body = trimmed; bodyType = 'text'; } }
    else if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(trimmed)) { body = Object.fromEntries(new URLSearchParams(trimmed)); bodyType = 'form'; }
    else { body = trimmed; bodyType = bodyType === 'json' ? 'text' : bodyType ?? 'text'; }
  }
  if (getMode && body && typeof body === 'object' && !Array.isArray(body)) { Object.assign(query, body); body = undefined; }
  // a key in the body (a form's api_key) goes the same way as one in the query: out, to Secrets
  if (body && typeof body === 'object' && !Array.isArray(body)) for (const k of Object.keys(body)) if (CREDENTIAL_NAME.test(k) && typeof body[k] === 'string' && body[k]) { notes.push(`The body's "${k}" looks like a key: it was left out. Send it from Secrets, or pick it from the run.`); delete body[k]; }

  method ??= body !== undefined && !getMode ? 'POST' : 'GET';
  if (method !== 'GET') params.method = method;
  params.url = u.origin + u.pathname;
  if (Object.keys(query).length) params.query = query;
  if (Object.keys(hdrs).length) params.headers = hdrs;
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') { params.body = body; if (bodyType && bodyType !== 'json') params.bodyType = bodyType; }
  if (timeoutMs) params.timeoutMs = timeoutMs;
  if (key) { params.authType = key.how; params.authSecret = key.name; }
  return { params, key, notes };
}
