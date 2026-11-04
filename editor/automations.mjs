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
  if (text == null) return { workflows: [], triggers: [], apiCalls: [] };
  try {
    const j = JSON.parse(text);
    return { workflows: Array.isArray(j.workflows) ? j.workflows : [], triggers: Array.isArray(j.triggers) ? j.triggers : [], apiCalls: Array.isArray(j.apiCalls) ? j.apiCalls : [] };
  } catch (e) {
    return { workflows: [], triggers: [], apiCalls: [], error: `${AUTOMATIONS_FILE} is not readable JSON (${e.message})` };
  }
}

/*
 * P132 BWF-012 — saved API calls (R7). A saved call is a Call an API's settings kept once in the file's `apiCalls`, its
 * blanks written in them as `{ $path: 'fill.<blank>' }`; a step uses it as `{ call: '<id>', fill: { <blank>: value } }`.
 * The backend reads the call when the step runs, so a change to it reaches every workflow that uses it.
 */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isSpec = (v) => isObj(v) && (typeof v.$path === 'string' || '$fn' in v || '$literal' in v);
const BLANK_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** What part of a step's settings a blank can be: the address, and each query, header and body entry by name. */
export function callParts(params = {}) {
  const parts = [];
  if (params.url !== undefined) parts.push({ key: 'url', words: 'The address', value: params.url, suggest: 'address' });
  for (const [group, words] of [['query', 'Query'], ['headers', 'Header'], ['body', 'Body']]) {
    const v = params[group];
    if (!isObj(v) || isSpec(v)) continue;
    for (const [name, value] of Object.entries(v)) parts.push({ key: `${group}.${name}`, words: `${words}: ${name}`, value, suggest: name });
  }
  return parts;
}

/** A blank's name made from a part's: letters, digits and _, starting with a letter or _, and not one already taken. */
export function blankName(suggest, taken = []) {
  let n = String(suggest ?? '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'value';
  if (/^[0-9]/.test(n)) n = `_${n}`;
  n = n.slice(0, 60);
  let out = n, i = 2;
  while (taken.includes(out)) out = `${n}_${i++}`;
  return out;
}

/** A saved call's id from its name: what a workflow writes after `call:`. Unique among `taken`. */
export function callId(name, taken = []) {
  const base = (String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'api-call').slice(0, 56);
  let out = /^[a-z0-9]/.test(base) ? base : `call-${base}`, i = 2;
  while (taken.includes(out)) out = `${base}-${i++}`;
  return out;
}

/**
 * *Save this call*: a Call an API step's settings made a saved call, the parts `blankKeys` names made its blanks, and the
 * step's new params, which fill each blank with what the step had there, so the step does exactly what it did before.
 * A literal part's value is the blank's example (what a test fills it with); one read from the run is not.
 */
export function saveCallFrom(params, { id, name, blankKeys = [] }) {
  const callParams = structuredClone(params ?? {});
  delete callParams.call; delete callParams.fill;
  const parts = callParts(params);
  const blanks = [], fill = {}, taken = [];
  for (const key of blankKeys) {
    const part = parts.find((p) => p.key === key);
    if (!part) continue;
    const b = blankName(part.suggest, taken); taken.push(b);
    const spec = { $path: `fill.${b}` };
    if (key === 'url') callParams.url = spec;
    else { const [group, ...rest] = key.split('.'); callParams[group][rest.join('.')] = spec; }
    fill[b] = structuredClone(part.value);
    blanks.push(Object.fromEntries(Object.entries({ name: b, type: typeof part.value === 'number' ? 'number' : typeof part.value === 'boolean' ? 'boolean' : 'text', example: isSpec(part.value) || isObj(part.value) ? undefined : part.value }).filter(([, v]) => v !== undefined)));
  }
  const call = { id, ...(name ? { name } : {}), params: callParams, ...(blanks.length ? { blanks } : {}) };
  return { call, stepParams: { call: id, ...(blanks.length ? { fill } : {}) } };
}

/** A new step's params for a saved call: each blank filled with its example (or empty), so the step can be stored. */
export function stepForCall(c) {
  const fill = {};
  for (const b of c.blanks ?? []) fill[b.name] = b.example !== undefined ? structuredClone(b.example) : '';
  return { call: c.id, ...(Object.keys(fill).length ? { fill } : {}) };
}

/** The workflows (by id) whose steps use the saved call `id`. */
export function usersOfCall(workflows, id) {
  return (workflows ?? []).filter((w) => (w.steps ?? []).some((s) => s.kind === 'http-request' && s.params?.call === id)).map((w) => w.id);
}

/* ---- P132 BWF-013 (R6): a reusable piece is a workflow others run, with a `run-workflow` step
   (`{ workflow: '<id>', send: { <name>: value } }`), `send` arriving in the piece as `body.<name>`. ---- */
export const PIECE_KIND = 'run-workflow';
/** The piece a step runs, by a plain id, or null (the engine's `pieceOf`). */
export const pieceOf = (s) => (s?.kind === PIECE_KIND && typeof s.params?.workflow === 'string' && s.params.workflow ? s.params.workflow : null);
/** The workflows that are pieces: the project's workflows no trigger starts (a trigger starting a function starts no workflow). */
export function piecesIn(workflows = [], triggers = []) {
  const started = new Set(triggers.map(targetOf).filter((g) => g.kind === 'workflow').map((g) => g.name));
  return workflows.filter((w) => !started.has(w.id));
}
/** The workflows (by id, each once, in the file's order) with a step that runs `id`. */
export function runnersOf(workflows, id) {
  return (workflows ?? []).filter((w) => (w.steps ?? []).some((s) => pieceOf(s) === id)).map((w) => w.id);
}
/** The names `id` is sent by the steps that run it, each once, in the order they are first met. */
export function sentNames(workflows, id) {
  const out = [];
  for (const w of workflows ?? []) for (const s of w.steps ?? []) if (pieceOf(s) === id && isObj(s.params?.send)) for (const k of Object.keys(s.params.send)) if (!out.includes(k)) out.push(k);
  return out;
}
/** The names a workflow reads from what it was given (`body.<name>` anywhere in its steps' settings), each once: what a piece asks for. */
export function bodyNames(wf) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!isObj(v)) return;
    if (typeof v.$path === 'string') { const [root, name] = v.$path.split('.'); if (root === 'body' && name && !out.includes(name)) out.push(name); return; }
    if ('$literal' in v) return;
    Object.values(v).forEach(walk);
  };
  for (const s of wf?.steps ?? []) walk(s.params);
  return out;
}
/** True when a step in `fromId` running `toId` would close a ring: `toId` is `fromId`, or runs it, directly or through others. */
export function wouldRing(workflows, fromId, toId) {
  const runs = new Map((workflows ?? []).map((w) => [w.id, (w.steps ?? []).map(pieceOf).filter(Boolean)]));
  const seen = new Set(), queue = [toId];
  while (queue.length) {
    const id = queue.shift();
    if (id === fromId) return true;
    if (seen.has(id)) continue;
    seen.add(id); queue.push(...(runs.get(id) ?? []));
  }
  return false;
}
/** The run a piece's failure names ("… (its run: <id>)", the engine's words), or null. */
export const runInFailure = (error) => /\(its run: ([^)\s]+)\)/.exec(String(error ?? ''))?.[1] ?? null;
/** An unnamed step's title, as its card says it: "Run <function>", "Run <piece>", else the kind's words. `workflowName(id)`: a piece's name. */
export function stepTitle(s, kindName = (k) => k, workflowName = (id) => id) {
  if (s.name) return s.name;
  if (s.kind === 'call-function' && s.ref) return `Run ${s.ref}`;
  if (pieceOf(s)) return `Run ${workflowName(pieceOf(s))}`;
  return kindName(s.kind);
}
/** A piece's row: who runs it, in words. `nameOf(id)`: a workflow's name. */
export function runnersWords(ids, nameOf = (id) => id) {
  if (!ids.length) return 'No workflow runs it yet';
  const names = ids.map((id) => `“${nameOf(id)}”`);
  return `Run by ${names.length < 3 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`}`;
}

/* ---- P132 BWF-013 Build 3: *Make a reusable piece* from steps chosen on the canvas. Allowed when they have one way in
   (one step something outside them, or the start, leads to) and at most one way out (the plain next of their only last
   step), and none of them ends the workflow. They move into a new piece that ends in a Return of their last step's
   answer; one Run <piece> step takes their place, sending each value the moved steps read from before them. What reads
   the moved last step after them reads the piece's answer instead (`upstream.<run>.result…`, `previous.result…`), so
   the workflow does what it did. Pure: answers { piece, runner, run, sends, notes } or throws a sentence. ---- */
const ROOTS_SENT = new Set(['body', 'trigger', 'previous', 'upstream']);
/** Every value path in a step's settings (a `$path`, a Validate rule's `path`), each given to `fn(path)`, which answers
    the path to put there instead (or the same). Inside a `$literal` nothing is a path. Answers the new params. */
function mapPaths(step, fn) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!isObj(v)) return v;
    if (typeof v.$path === 'string') return { ...v, $path: fn(v.$path) };
    if ('$literal' in v) return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  };
  const params = walk(step.params ?? {});
  if (step.kind === 'validate' && Array.isArray(params.rules)) params.rules = params.rules.map((r) => (isObj(r) && typeof r.path === 'string' ? { ...r, path: fn(r.path) } : r));
  return params;
}
/** A step's settings with what it reads without saying made explicit: a list kind's `items` (the catalog's default,
    `previous.items`), a Return's value (the step before's answer). `defaults(kind)`: { <param>: its default }. */
function explicitReads(step, defaults) {
  const params = { ...(step.params ?? {}) };
  for (const [k, d] of Object.entries(defaults(step.kind) ?? {})) if (params[k] === undefined && isObj(d) && typeof d.$path === 'string') params[k] = structuredClone(d);
  if (step.kind === 'return' && params.value === undefined) params.value = { $path: 'previous' };
  return { ...step, params };
}
const nameFrom = (s) => String(s).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1');
export function pieceFrom(wf, chosen, { id, name = '', defaults = () => ({}), title = (s) => s.name || s.id, workflows = [] } = {}) {
  const steps = wf.steps ?? [], byId = new Map(steps.map((s) => [s.id, s]));
  const ids = new Set([...chosen].filter((x) => byId.has(x)));
  if (!ids.size) throw new Error('Shift-press the steps to put in the piece.');
  const said = (x) => `“${title(byId.get(x))}”`;
  const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const ends = steps.filter((s) => ids.has(s.id) && (s.kind === 'return' || s.kind === 'stop'));
  if (ends.length) throw new Error(`${said(ends[0].id)} ends the whole workflow: in a piece it would end only the piece. Leave it out.`);
  // one way in
  const wiresIn = steps.filter((s) => !ids.has(s.id)).flatMap(stepWires).filter((w) => ids.has(w.to));
  const heads = [...new Set([...(ids.has(wf.entry) ? [wf.entry] : []), ...wiresIn.map((w) => w.to)])];
  if (!heads.length) throw new Error('Nothing leads into these steps: a piece starts where the workflow reaches it.');
  if (heads.length > 1) throw new Error(`These steps have ${heads.length} ways in: ${list(heads.map(said))} are each reached from outside them. A piece starts at one step.`);
  const head = heads[0];
  // at most one way out: the plain next of their only last step
  const inner = steps.filter((s) => ids.has(s.id)), wires = inner.flatMap(stepWires);
  const out = wires.filter((w) => !ids.has(w.to)), lasts = inner.filter((s) => !stepWires(s).some((w) => ids.has(w.to)));
  if (out.length > 1 || (out.length === 1 && lasts.length > 1)) {
    const ways = [...out.map((w) => `${said(w.from)} leads on to ${said(w.to)}${w.kind === 'fail' ? ' if it fails' : w.label ? ` on ${ROUTE_WORDS[w.label] ?? w.label}` : ''}`), ...lasts.filter((s) => !out.some((w) => w.from === s.id)).map((s) => `${said(s.id)} ends there`)];
    throw new Error(`These steps have ${ways.length} ways out: ${list(ways)}. A piece comes back to one place.`);
  }
  const exit = out[0] ?? null;
  if (exit && exit.kind !== 'then') throw new Error(`${said(exit.from)} leads on to ${said(exit.to)} only ${exit.kind === 'fail' ? 'if it fails' : `on ${ROUTE_WORDS[exit.label] ?? exit.label}`}: after a piece, what comes next always runs. Put ${said(exit.to)} in too, or leave ${said(exit.from)} out.`);
  const last = lasts.length === 1 ? lasts[0].id : null;
  // what reads the moved steps after them: only the last one's answer comes back out
  const others = steps.filter((s) => !ids.has(s.id)).map((s) => (exit && s.id === exit.to ? explicitReads(s, defaults) : s));
  for (const s of others) {
    let bad = null;
    mapPaths(s, (p) => { const [r, x] = p.split('.'); if (r === 'upstream' && ids.has(x) && x !== last) bad ??= x; return p; });
    for (const src of s.kind === 'merge' && Array.isArray(s.params?.sources) ? s.params.sources : []) if (ids.has(src)) bad ??= src;
    if (bad) throw new Error(`${said(s.id)} reads ${said(bad)}, which would move into the piece: only the answer of its last step${last ? `, ${said(last)},` : ''} comes back out.`);
    if (s.kind === 'merge' && exit && s.id === exit.to && !Array.isArray(s.params?.sources)) throw new Error(`${said(s.id)} collects the steps that lead into it by their names: put it in the piece too, or leave ${said(exit.from)} out.`);
  }
  if (!id) throw new Error('The piece needs a name.');
  if (id === wf.id || workflows.some((w) => w.id === id)) throw new Error(`There is already a workflow called ${id}.`);
  // what the moved steps read from before them, sent by name
  const sends = [], taken = new Set(), nameOf = new Map();
  const before = steps.filter((s) => (s.next ?? []).includes(head) || Object.values(s.routes ?? {}).some((t) => t?.includes(head)) || (s.onError ?? []).includes(head));
  const send = (p) => {
    if (nameOf.has(p)) return nameOf.get(p);
    const [root, ...rest] = p.split('.');
    const tail = (root === 'upstream' ? rest.slice(1) : rest).filter((x) => x !== 'result' && !/^-?\d+$/.test(x));
    const base = nameFrom(tail.at(-1) ?? (root === 'upstream' ? rest[0] : root === 'previous' && before.length === 1 ? before[0].id : root)) || 'value';
    let n = base;
    for (let i = 2; taken.has(n); i++) n = `${base}_${i}`;
    taken.add(n); nameOf.set(p, n); sends.push({ name: n, path: p });
    return n;
  };
  const moved = inner.map((s) => {
    const own = s.id === head ? explicitReads(s, defaults) : s;
    const params = mapPaths(own, (p) => {
      const [root, x] = p.split('.');
      if (!ROOTS_SENT.has(root) || (root === 'upstream' && ids.has(x)) || (root === 'previous' && s.id !== head)) return p;
      return `body.${send(p)}`;
    });
    const copy = structuredClone({ ...s, ...(Object.keys(params).length ? { params } : {}) });
    if (exit && copy.id === exit.from) { copy.next = copy.next.filter((t) => t !== exit.to); if (!copy.next.length) delete copy.next; }
    return copy;
  });
  // the piece: the moved steps, then a Return of the last one's answer
  const piece = { id, ...(name.trim() ? { name: name.trim() } : {}), entry: head, concurrency: 1, steps: moved };
  const end = last && moved.find((s) => s.id === last);
  if (end && !end.routes) { // a last step with sides (a branch) leads nowhere on them: the piece answers with it, as the engine does
    const ret = { id: newStepId(piece, 'return'), kind: 'return', params: { value: { $path: `upstream.${last}` } } };
    end.next = [...(end.next ?? []), ret.id];
    piece.steps.push(ret);
  }
  // the runner: one Run <piece> step where the moved steps were
  const runner = clone(wf);
  const run = { id: newStepId({ steps: steps.filter((s) => !ids.has(s.id)) }, PIECE_KIND), kind: PIECE_KIND, params: { workflow: id, ...(sends.length ? { send: Object.fromEntries(sends.map((s) => [s.name, { $path: s.path }])) } : {}) }, ...(exit ? { next: [exit.to] } : {}) };
  const at = steps.findIndex((s) => s.id === head);
  runner.steps = [];
  for (const [i, s] of steps.entries()) {
    if (i === at) runner.steps.push(run);
    if (ids.has(s.id)) continue;
    const t = structuredClone(exit && s.id === exit.to ? others.find((o) => o.id === s.id) : s);
    for (const k of ['next', 'onError']) if (t[k]) t[k] = t[k].map((x) => (x === head ? run.id : x));
    for (const r of Object.keys(t.routes ?? {})) t.routes[r] = (t.routes[r] ?? []).map((x) => (x === head ? run.id : x));
    if (t.params || (exit && s.id === exit.to)) {
      const params = mapPaths(t, (p) => {
        const [root, x, ...rest] = p.split('.');
        if (root === 'upstream' && x === last) return ['upstream', run.id, 'result', ...rest].join('.');
        if (root === 'previous' && exit && s.id === exit.to) return ['previous', 'result', ...p.split('.').slice(1)].join('.');
        return p;
      });
      if (Object.keys(params).length) t.params = params;
    }
    runner.steps.push(t);
  }
  if (wf.entry === head) runner.entry = run.id;
  const notes = [];
  for (const s of inner) if (s.kind === 'call-function' || s.kind === 'for-each') notes.push(`${said(s.id)} runs a function: in the piece, it is given what the piece is sent, not what started ${wf.name || wf.id}.`);
  if (exit && byId.get(exit.to)?.kind === 'call-function') notes.push(`${said(exit.to)} runs a function: the step before it is now the piece, whose answer it is given as result.`);
  return { piece, runner, run, sends, notes: [...new Set(notes)], head, last };
}

/** True when a value reads the run somewhere (a `$path` not into a blank): in a saved call, such a part must be a blank. */
export function readsRun(v) {
  if (Array.isArray(v)) return v.some(readsRun);
  if (!isObj(v)) return false;
  if (typeof v.$path === 'string') return !v.$path.startsWith('fill.');
  if ('$literal' in v) return false;
  return Object.values(v).some(readsRun);
}

/** True when a name is one a blank can have. */
export const isBlankName = (n) => BLANK_RE.test(n);

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
 * Within a column a step sits in the order of what leads to it: its nearest parent's row, then the port it leaves by in
 * the order the card draws them (`stepPorts`, so Yes above No), never the order the steps sit in the file
 * (P132-BRANCHROWSCROSS: a step added on No before one on Yes drew the No side on top, its wires crossing).
 */
export function workflowLayout(wf, routeNamesOf = () => []) {
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
  const row = new Map(), fileAt = new Map(steps.map((s, i) => [s.id, i]));
  const portAt = (from, to) => {
    const ports = stepPorts(byId.get(from), routeNamesOf(byId.get(from)));
    const p = ports.findIndex((x) => x.tos.includes(to));
    return p < 0 ? ports.length : p * 1000 + ports[p].tos.indexOf(to);
  };
  columns.forEach((col, d) => {
    if (!col) return;
    if (d > 0) {
      const key = (id) => {
        const parents = wires.filter((w) => w.to === id && row.has(w.from) && depth.get(w.from) < d);
        const near = parents.sort((a, b) => depth.get(b.from) - depth.get(a.from) || row.get(a.from) - row.get(b.from))[0];
        return near ? [row.get(near.from), portAt(near.from, id)] : [Infinity, 0];
      };
      const keys = new Map(col.map((id) => [id, key(id)]));
      // the nearest parent's row decides; a step whose parent sits in an earlier column keeps its parent's row too
      col.sort((a, b) => keys.get(a)[0] - keys.get(b)[0] || keys.get(a)[1] - keys.get(b)[1] || fileAt.get(a) - fileAt.get(b));
    }
    col.forEach((id, i) => row.set(id, i));
  });
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

/**
 * P132 BWF-007: who a test is about to email, in words, or null when it sends none. A test is a real run, so a *Send an
 * email* step in it sends. Only the steps the test runs count: with `stopAfter`, that step and the steps before it.
 * `valueWords(path)`: a value picked from the run, in words (the panel's pill words); a formula's addresses are not
 * known until it runs, and say so.
 */
export function testMailWords(wf, stopAfter = null, valueWords = (p) => p) {
  const runs = stopAfter ? new Set([stopAfter, ...upstreamOf(wf, stopAfter).map((s) => s.id)]) : null;
  const who = [];
  for (const s of wf?.steps ?? []) {
    if (s.kind !== 'send-email' || (runs && !runs.has(s.id))) continue;
    const to = s.params?.to, one = (v) => {
      if (typeof v === 'string') for (const a of v.split(/[,;\n]/)) { if (a.trim()) who.push(a.trim()); }
      else if (v && typeof v === 'object' && typeof v.$path === 'string') who.push(valueWords(v.$path));
      else if (v && typeof v === 'object' && '$fn' in v) who.push('the addresses its formula gives');
    };
    if (Array.isArray(to)) to.forEach(one); else one(to);
  }
  const all = [...new Set(who)];
  if (!all.length) return null;
  return all.length === 1 ? all[0] : `${all.slice(0, -1).join(', ')} and ${all.at(-1)}`;
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
export function readSources(wf, stepId, { run = null, sample = null, starts = [], columns = () => null, kind = () => null, answers = () => null, sent = [], workflowName = (id) => id } = {}) {
  const ran = [...(run?.values() ?? [])].find((r) => r.input && typeof r.input === 'object' && 'body' in r.input);
  const t = starts[0], out = [];
  // what started it
  const row = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'ACL')) : v); // who may read a row is not a value to use
  if (ran) out.push({ root: 'body', words: startWords(starts), from: 'run', value: row(ran.input.body) });
  else if (sample && Object.keys(sample.body ?? {}).length) out.push({ root: 'body', words: startWords(starts), from: 'sample', value: row(sample.body) });
  else if (t?.type === 'db-change') {
    const cols = columns(t.dbChange?.collection) ?? [];
    out.push({ root: 'body', words: startWords(starts), from: 'shape', value: blank(['objectId', ...cols, 'createdAt', 'updatedAt']) });
  } else if (!t && sent.length) out.push({ root: 'body', words: startWords(starts), from: 'shape', value: blank(sent) }); // BWF-013: a piece is given what the workflows that run it send
  else out.push({ root: 'body', words: startWords(starts), from: 'shape', value: {}, note: t?.type === 'schedule' ? 'A schedule sends nothing unless it is given a payload.' : 'Its fields show once the test has a sample.' });
  const how = { type: null, firedAt: null, ...(t?.type === 'db-change' ? { collection: null, action: null, recordId: null } : t?.type === 'webhook' ? { slug: null } : t?.type === 'schedule' ? { cron: null } : {}) };
  out.push(ran?.input.trigger && typeof ran.input.trigger === 'object' ? { root: 'trigger', words: 'how it started', from: 'run', value: ran.input.trigger } : { root: 'trigger', words: 'how it started', from: 'shape', value: how });
  // each step upstream of it
  for (const s of upstreamOf(wf, stepId)) {
    const r = run?.get(s.id), words = stepTitle(s, (k) => kind(k)?.displayName || s.id, workflowName); // as its card says it
    if (r && r.output !== undefined && r.status !== 'error' && r.status !== 'skipped') { out.push({ root: `upstream.${s.id}`, words, from: 'run', value: r.output, step: s.id }); continue; }
    const fn = s.kind === 'call-function' || s.kind === PIECE_KIND ? answers(s) : null; // BWF-013: a piece answers { result, run } as a function answers { result }
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
export function pathWords(path, wf, starts = [], { item = 'item', index = 'index', kindName = (k) => k, workflowName = (id) => id } = {}) {
  const [root, ...rest] = String(path).split('.');
  const seg = (xs, whole = 'all of it') => (xs.length ? xs.map((x) => (x === '-1' ? 'the last' : /^\d+$/.test(x) ? `#${Number(x) + 1}` : x)).join(' › ') : whole); // BWF-011: -1 is the last one
  if (root === 'body') return { name: seg(rest), from: startWords(starts) };
  if (root === 'trigger') return { name: seg(rest), from: 'how it started' };
  if (root === 'previous') return { name: seg(rest), from: 'the step before' };
  if (root === 'fill') return { name: seg(rest), from: 'each workflow' }; // BWF-012: a saved call's blank, filled in by each workflow using it
  if (root === 'upstream') {
    const s = (wf.steps ?? []).find((x) => x.id === rest[0]);
    let r = rest.slice(1);
    if ((s?.kind === 'call-function' || s?.kind === PIECE_KIND) && r[0] === 'result' && r.length > 1) r = r.slice(1); // a function (a piece) answers { result: { … } }: its names are what a person knows
    return s ? { name: seg(r), from: stepTitle(s, kindName, workflowName) } : { name: seg(r), from: `a step that is not there (${rest[0] ?? ''})`, missing: true };
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

/* ---- P132 BWF-011 (R8): a value composed in a setting. Words and values together, as n8n's expressions and Studio's
   front-end composer have them, built from the backend's formulas underneath (R2: never JavaScript). A setting's value
   is a list of parts: words (strings) and values ("chips": a `{ $path }`, or one of the few formulas a chip is refined
   into: first / last / how many / each one's field / joined). One chip alone is saved as itself, words alone as the
   typed value, both as `{ $fn: 'text', args: parts }`. ---- */
const CHIP_FNS = new Set(['count', 'pick', 'join']);
const isPath = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.$path === 'string' && Object.keys(v).length === 1;
/** A value a chip can stand for: a path, or how many / each one's field / joined, over a chip. */
export function isChip(v) {
  if (isPath(v)) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v) || !CHIP_FNS.has(v.$fn) || !Array.isArray(v.args) || !isChip(v.args[0])) return false;
  const rest = v.args.slice(1);
  return v.$fn === 'count' ? rest.length === 0 : rest.length === 1 && typeof rest[0] === 'string';
}
/** A setting's value as composer parts, or null when it is not one a composer shows (another formula, a list, an object). */
export function composeParts(v) {
  if (v === undefined || v === null || v === '') return [];
  if (typeof v === 'string') return [v];
  if (typeof v === 'number' || typeof v === 'boolean') return [String(v)];
  if (isChip(v)) return [v];
  if (v && typeof v === 'object' && v.$fn === 'text' && Array.isArray(v.args) && v.args.every((a) => typeof a === 'string' || typeof a === 'number' || isChip(a)))
    return v.args.map((a) => (typeof a === 'number' ? String(a) : a));
  return null;
}
/** Composer parts back to what the backend keeps. `type`: the setting's ('any' reads "5", "true", JSON as themselves). */
export function composeValue(parts, type = 'any') {
  const out = [];
  for (const p of parts) {
    if (typeof p === 'string') { if (!p) continue; if (typeof out.at(-1) === 'string') out[out.length - 1] += p; else out.push(p); }
    else out.push(p);
  }
  if (!out.length) return undefined;
  if (out.length > 1) return { $fn: 'text', args: out };
  const [one] = out;
  if (typeof one !== 'string' || type === 'string') return one;
  try { return /^(-?\d+(\.\d+)?|true|false|null|[[{].*)$/s.test(one.trim()) ? JSON.parse(one) : one; } catch { return one; }
}
const ROW_STEPS = new Set(['create-record', 'update-record', 'find-records']);
/** What is known at `path` among `sources` (readSources'): `{ value, from }` (value undefined when nothing is). Before a
    run a record step's rows are its table's columns: a find's `items` a list of them, `first` and `record` one. */
export function knownAt(sources, path, { wf = null, columns = () => null } = {}) {
  const src = [...sources].sort((a, b) => b.root.length - a.root.length).find((s) => path === s.root || path.startsWith(`${s.root}.`));
  if (!src) return { value: undefined, from: null };
  const rest = path === src.root ? [] : path.slice(src.root.length + 1).split('.');
  let base = src.value;
  const step = src.step && (wf?.steps ?? []).find((s) => s.id === src.step);
  if (src.from === 'shape' && step && ROW_STEPS.has(step.kind) && typeof step.params?.table === 'string') {
    const cols = columns(step.params.table);
    if (cols?.length) { const row = blank(['objectId', ...cols]); base = { ...(base ?? {}), ...(step.kind === 'find-records' ? { items: [row], first: row, count: null } : { record: row }) }; }
  }
  let v = base;
  for (const k of rest) {
    if (v == null || typeof v !== 'object') { v = undefined; break; }
    if (Array.isArray(v)) { const i = Number(k); v = Number.isInteger(i) ? v[i < 0 ? v.length + i : i] : undefined; } else v = v[k];
  }
  return { value: v, from: src.from };
}
const isRowish = (x) => x && typeof x === 'object' && !Array.isArray(x) && x.__type !== 'Date';
const LATE = ['objectId', 'createdAt', 'updatedAt'];
const fieldsOf = (x) => (isRowish(x) ? Object.keys(x).filter((k) => !['ACL', '__type', 'className'].includes(k)).sort((a, b) => LATE.includes(a) - LATE.includes(b)) : []); // a row's own fields first, its id and dates after
/** What a chip can become, refined in place: a list's first, last, how many, each one's field, joined; a record's fields.
    `known` is knownAt's value at the chip's path (undefined when not known). Each `{ group, words, value }`. */
export function chipRefinements(chip, known) {
  const out = [];
  if (isPath(chip)) {
    const p = chip.$path;
    if (Array.isArray(known)) {
      const el = known.find((x) => x != null), fs = fieldsOf(el);
      out.push({ group: 'list', words: 'the first one', value: { $path: `${p}.0` } });
      for (const f of fs) out.push({ group: 'first', words: `the first one's ${f}`, value: { $path: `${p}.0.${f}` } });
      out.push({ group: 'list', words: 'the last one', value: { $path: `${p}.-1` } });
      out.push({ group: 'list', words: 'how many there are', value: { $fn: 'count', args: [chip] } });
      for (const f of fs) out.push({ group: 'each', words: `each one's ${f}`, value: { $fn: 'pick', args: [chip, f] } });
      if (!fs.length) out.push({ group: 'list', words: 'all of them, joined with commas', value: { $fn: 'join', args: [chip, ', '] } });
    } else for (const f of fieldsOf(known)) out.push({ group: 'field', words: f, value: { $path: `${p}.${f}` } });
  } else if (chip?.$fn === 'pick') {
    out.push({ group: 'list', words: 'joined with commas', value: { $fn: 'join', args: [chip, ', '] } });
    out.push({ group: 'list', words: 'how many there are', value: { $fn: 'count', args: [chip.args[0]] } });
  }
  return out;
}
/** The path a chip reads, under its formulas. */
export const chipPath = (chip) => (isPath(chip) ? chip.$path : chip?.args ? chipPath(chip.args[0]) : null);
/** A chip in words, `{ name, from }`: `pathName(path)` gives a path's `{ name, from }` (pathWords, for the step open). */
export function chipWords(chip, pathName) {
  if (isPath(chip)) return pathName(chip.$path);
  const inner = chipWords(chip.args[0], pathName);
  if (chip.$fn === 'count') return { ...inner, name: `how many ${inner.name}` };
  if (chip.$fn === 'pick') return { ...inner, name: `each one's ${chip.args[1]} in ${inner.name}` };
  if (chip.$fn === 'join') return { ...inner, name: `${inner.name}, joined${chip.args[1] === ', ' ? ' with commas' : ` with “${chip.args[1]}”`}` };
  return inner;
}
