/**
 * NodeGX Studio — P127 BKO-005: ./automations.mjs with no browser. A trigger's head in a person's words, a schedule's
 * time read and moved (and refused where a cron runs more than once a day), a workflow laid out left to right with its
 * error routes told apart, and a failed run said at the step it failed. The drawing is graded in Chrome by
 * automations-drive.mjs.
 *
 *   node editor/automations-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { parseCurl, secretNameFor, shellWords, testMailWords, composeParts, composeValue, isChip, knownAt, chipRefinements, chipWords } from './automations.mjs';
import { ALWAYS_WORDS, formulaParts, formulaStart, formulaWords, itemSources, pathWords, readSources, shapeFields, startWords, upstreamOf, addStepAfter, sampleFor, sampleRun, sampleWords, testRefusal, agrees, atTime, canMove, deleteStep, insertBetween, moveStep, nextOntoRoute, stepPorts, newStepId, readAutomations, runLine, scheduleTime, stepsOfRun, stepWires, targetOf, triggerHead, valueForm, workflowLayout } from './automations.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); if (!cond || process.argv.includes('-v')) console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const throws = (f) => { try { f(); return false; } catch { return true; } };

// the file
ok(readAutomations(null).triggers.length === 0 && !readAutomations(null).error, 'no file: no automations, no error');
ok(/not readable JSON/.test(readAutomations('{').error), 'a broken file is said, not drawn as empty');
ok(readAutomations('{"version":1,"triggers":[{"id":"a"}]}').workflows.length === 0, 'a file with triggers only has no workflows');

// a trigger's head
const daily = { id: 'daily', type: 'schedule', schedule: { cron: '0 9 * * *', missedFirePolicy: 'skip' }, target: { kind: 'function', name: 'sendDigest' }, enabled: true };
ok(triggerHead(daily, 'Every day at 09:00') === 'Every day at 09:00', "a schedule is said in the backend's words");
ok(triggerHead(daily, null) === 'On a schedule: 0 9 * * *', 'with no words for its shape, the cron is said, not guessed');
const rows = { id: 'rows', type: 'db-change', dbChange: { collection: 'Task', actions: ['create'] }, target: { kind: 'workflow', name: 'triage' } };
ok(triggerHead(rows) === 'When a Task is created', 'a row change: "When a Task is created"', triggerHead(rows));
ok(triggerHead({ ...rows, dbChange: { collection: 'Task', actions: ['create', 'update', 'delete'] } }) === 'When a Task is created, changed or deleted', 'three actions in a list');
ok(triggerHead({ id: 'h', type: 'webhook', webhook: { slug: 'stripe' } }) === 'When a webhook arrives at /hooks/…/stripe', 'a webhook: where it arrives');
ok(targetOf(daily).key === '__cloud__/sendDigest' && targetOf(daily).kind === 'function', "a function target opens the function's component");
ok(targetOf(rows).key === 'triage' && targetOf(rows).kind === 'workflow', 'a workflow target is the workflow id');

// the schedule's time
ok(JSON.stringify(scheduleTime('0 9 * * *')) === '{"hour":9,"minute":0}', 'daily at 09:00 is read');
ok(JSON.stringify(scheduleTime('30 7 * * 1-5')) === '{"hour":7,"minute":30}', 'weekdays at 07:30 is read');
ok(scheduleTime('*/15 * * * *') === null && scheduleTime('0 9,17 * * *') === null && scheduleTime('@daily') === null && scheduleTime('0 25 * * *') === null && scheduleTime('0 9.5 * * *') === null && scheduleTime('1e1 9 * * *') === null, 'a cron that runs more than once a day, a preset or an impossible hour is not a time to move');
ok(atTime('0 9 * * *', 10, 0) === '0 10 * * *', 'moved to 10:00');
ok(atTime('30 7 * * 1-5', 18, 45) === '45 18 * * 1-5', 'the days are kept');
ok(throws(() => atTime('*/5 * * * *', 10, 0)) && throws(() => atTime('0 9 * * *', 24, 0)), 'an unmovable cron or an impossible time is refused');

// a workflow's layout
const two = { id: 'triage', entry: 'check', steps: [
  { id: 'check', kind: 'call-function', ref: 'checkTask', next: ['notify'], onError: ['giveup'] },
  { id: 'notify', kind: 'call-function', ref: 'notifyOwner' },
  { id: 'giveup', kind: 'stop', params: { fail: true } }] };
const L = workflowLayout(two);
ok(JSON.stringify(L.columns) === '[["check"],["notify","giveup"]]', 'two steps: the entry first, what follows it next', L.columns);
ok(L.wires.filter((w) => w.kind === 'fail').length === 1 && L.wires.find((w) => w.kind === 'fail').to === 'giveup', 'the error route is a fail wire');
const diamond = { entry: 'a', steps: [
  { id: 'a', kind: 'branch', routes: { ontrue: ['b'], onfalse: ['c'] } }, { id: 'b', kind: 'call-function', next: ['c', 'd'] },
  { id: 'c', kind: 'merge', next: ['d'] }, { id: 'd', kind: 'return' }, { id: 'lost', kind: 'wait' }] };
const D = workflowLayout(diamond);
ok(JSON.stringify(D.columns) === '[["a"],["b"],["c"],["d"],["lost"]]', 'a step two paths reach sits after the longer one; an unreached step is loose, last', D.columns);
ok(D.loose.length === 1 && D.wires.filter((w) => w.kind === 'route').map((w) => w.label).join() === 'ontrue,onfalse', "a branch's routes keep their names");
ok(D.wires.every((w) => D.columns.findIndex((c) => c.includes(w.from)) < D.columns.findIndex((c) => c.includes(w.to))), 'every wire runs left to right');
// P132-BRANCHROWSCROSS (Richard's re-walk, 2026-11-03): a second step on each side, the No side's added first, stays on No's row
const crossed = { entry: 'if', steps: [
  { id: 'if', kind: 'branch', routes: { ontrue: ['y1'], onfalse: ['n1'] } },
  { id: 'n1', kind: 'wait', next: ['n2'] }, { id: 'y1', kind: 'wait', next: ['y2'] }, { id: 'n2', kind: 'wait' }, { id: 'y2', kind: 'wait' }] };
const X = workflowLayout(crossed, (s) => (s.kind === 'branch' ? ['ontrue', 'onfalse'] : []));
ok(JSON.stringify(X.columns) === '[["if"],["y1","n1"],["y2","n2"]]', 'Yes above No in every column, whatever order the steps sit in the file', X.columns);
const noFirst = { entry: 'if', steps: [{ id: 'if', kind: 'branch', routes: { onfalse: ['n1'], ontrue: ['y1'] } }, { id: 'n1', kind: 'wait' }, { id: 'y1', kind: 'wait' }] };
ok(JSON.stringify(workflowLayout(noFirst, () => ['ontrue', 'onfalse']).columns[1]) === '["y1","n1"]', 'a branch whose No was written first still draws Yes on top');
ok(workflowLayout({ entry: 'x', steps: [{ id: 'x', next: ['ghost'] }] }).dangling.length === 1, 'a wire to a step that is not there is said as dangling');
ok(stepWires({ id: 's', routes: { failed: ['t'] } })[0].kind === 'fail', 'a route named "failed" is a failure');
ok(workflowLayout({ entry: 'a', steps: [{ id: 'a', next: ['b'] }, { id: 'b', next: ['a'] }] }).columns.flat().length === 2, 'a loop back to the entry does not hang or lose a step');

// the project and the backend
ok(agrees('trigger', daily, { ...daily, scheduleWords: 'Every day at 09:00', status: { fires: 3 } }), "a backend's copy with its own decorations agrees");
ok(!agrees('trigger', daily, { ...daily, enabled: false }) && !agrees('trigger', daily, { ...daily, schedule: { cron: '0 10 * * *' } }) && !agrees('trigger', daily, null), 'off on the backend, another time, or missing: they differ');
ok(agrees('trigger', { ...daily, enabled: undefined }, daily), 'no "enabled" in the file means on, as the backend reads it');
ok(agrees('workflow', two, structuredClone(two)) && !agrees('workflow', two, { ...two, steps: two.steps.slice(0, 2) }), 'a workflow agrees step for step, and a missing step differs');

// a run
const failedRun = { status: 'error', startedAt: Date.UTC(2026, 9, 27, 9), durationMs: 41, errorMessage: 'notifyOwner: no owner', steps: [
  { nodeId: 'check', stepIndex: 0, status: 'success', durationMs: 12 }, { nodeId: 'notify', stepIndex: 1, status: 'error', durationMs: 29, errorMessage: 'no owner' }] };
const S = stepsOfRun(failedRun);
ok(S.get('check').status === 'success' && S.get('notify').status === 'error' && S.get('notify').durationMs === 29, 'a run read by step id: how each went and how long');
ok(/failed at step 2, Notify the owner: no owner/.test(runLine(failedRun, (id) => (id === 'notify' ? 'Notify the owner' : id))), 'a failed run is said at the step it failed', runLine(failedRun, () => 'Notify the owner'));
ok(runLine(null) === 'Not run on this backend yet.' && /finished/.test(runLine({ status: 'success', startedAt: 0 })), 'no run, and a run that finished');

// STU-092: a step's data in a run
const withData = stepsOfRun({ steps: [{ nodeId: 'mark', stepIndex: 0, status: 'success', inputData: { plant: 'p1' }, outputData: { result: { changed: 1 } } }] });
ok(withData.get('mark').input.plant === 'p1' && withData.get('mark').output.result.changed === 1, 'a run step carries what went in and what came out');

// STU-092: a workflow edited
const line = { id: 'w', entry: 'a', steps: [{ id: 'a', kind: 'validate', next: ['b'] }, { id: 'b', kind: 'call-function', ref: 'F', next: ['c'] }, { id: 'c', kind: 'return' }] };
const frozen = JSON.stringify(line);
const deepEmpty = (wf) => Array.isArray(wf.steps.find((s) => s.id === 'if').routes.ontrue) && wf.steps.find((s) => s.id === 'if').routes.ontrue.length === 0;
const order = (wf) => { const out = []; let at = wf.entry; const by = Object.fromEntries(wf.steps.map((s) => [s.id, s])); while (at && out.length < 10) { out.push(at); at = by[at].next?.[0]; } return out.join(' '); };
ok(newStepId(line, 'wait') === 'wait' && newStepId({ steps: [{ id: 'wait' }] }, 'wait') === 'wait-2', 'a new step id is its kind, then -2');
ok(order(addStepAfter(line, 'a', 'next', { id: 'n', kind: 'wait' })) === 'a n b c', 'a step added after another: what came after follows it', order(addStepAfter(line, 'a', 'next', { id: 'n', kind: 'wait' })));
ok(order(addStepAfter(line, null, 'next', { id: 'n', kind: 'wait' })) === 'n a b c', 'a step added first is the entry, the old first after it');
ok(order(addStepAfter({ ...line, steps: [...line.steps.slice(0, 2), { id: 'c', kind: 'wait' }] }, 'c', 'next', { id: 'n', kind: 'return' })) === 'a b c n', 'a step added at the end');
ok(JSON.stringify(line) === frozen, 'the workflow given is not changed');
ok(throws(() => addStepAfter(line, 'a', 'next', { id: 'b', kind: 'wait' })), 'an id already used is refused');
ok(throws(() => addStepAfter(line, 'c', 'next', { id: 'n', kind: 'wait' }).steps && addStepAfter(line, 'a', 'next', { id: 'r', kind: 'return' })) && throws(() => addStepAfter({ ...line, steps: [...line.steps.slice(0, 2), { id: 'c', kind: 'stop' }] }, 'c', 'next', { id: 'n', kind: 'wait' })), 'a Return goes at the end, and nothing goes after a Stop');
const br = addStepAfter(line, 'a', 'next', { id: 'if', kind: 'branch', routes: { ontrue: [] } });
ok(br.steps.find((s) => s.id === 'if').routes.ontrue[0] === 'b' && !br.steps.find((s) => s.id === 'if').next, 'a branch put in a line carries on down its Yes side');
ok(order(deleteStep(line, 'b')) === 'a c', 'a step deleted: the one before goes on to the one after');
ok(order(deleteStep(line, 'a')) === 'b c' && deleteStep(line, 'a').entry === 'b', 'the first deleted: its next is the first');
ok(!('next' in deleteStep(line, 'c').steps.find((s) => s.id === 'b')), 'the last deleted: no wire left to nowhere');
ok(throws(() => deleteStep({ id: 'w', entry: 'a', steps: [{ id: 'a', kind: 'return' }] }, 'a')), 'the only step is not deleted');
ok(throws(() => deleteStep(br, 'if')), 'a branch with steps on its sides is not deleted');
const routed = { id: 'w', entry: 'if', steps: [{ id: 'if', kind: 'branch', routes: { ontrue: ['x'], onfalse: ['y'] } }, { id: 'x', kind: 'wait', next: ['z'] }, { id: 'y', kind: 'stop' }, { id: 'z', kind: 'return' }] };
ok(deleteStep(routed, 'x').steps.find((s) => s.id === 'if').routes.ontrue[0] === 'z', 'a step deleted off a side: the side goes on to what followed it');
ok(deepEmpty(deleteStep(deleteStep(routed, 'x'), 'z')), 'a side left with nothing on it stays named (a branch needs one)');
ok(order(moveStep(line, 'b', -1)) === 'b a c' && moveStep(line, 'b', -1).entry === 'b', 'moved earlier: it and the one before swap, the entry with them');
ok(order(moveStep(line, 'b', 1)) === 'a c b', 'moved later', order(moveStep(line, 'b', 1)));
ok(canMove(line, 'a').earlier === false && canMove(line, 'a').later === true && canMove(routed, 'x').earlier === false, 'what can move: not before the first, not out of a branch');
ok(throws(() => moveStep(routed, 'x', -1)), 'a move out of a branch is refused');
// P132-BRANCHNEXT: no edit gives a step that branches a plain next beside its routes (the engine runs next whatever the If says)
const both = (wf) => wf.steps.filter((s) => Object.keys(s.routes ?? {}).length && (s.next ?? []).length).map((s) => s.id);
const ifStep = (id = 'if2') => ({ id, kind: 'branch', routes: { ontrue: [] } });
const atStart = addStepAfter(line, null, 'next', ifStep('if'));
ok(!both(atStart).length && atStart.steps.find((s) => s.id === 'if').routes.ontrue[0] === 'a' && atStart.entry === 'if', 'a branch added at the start carries on down its Yes, never a next', atStart.steps[0]);
ok(throws(() => addStepAfter(line, null, 'next', { id: 'r', kind: 'return' })), 'a Return is not put at the start of steps');
const edits = [atStart, br, addStepAfter(br, 'if', 'onfalse', { id: 'n', kind: 'wait' }), addStepAfter(br, 'if', 'ontrue', { id: 'n', kind: 'wait' }), addStepAfter(routed, 'if', 'onfalse', ifStep()),
  deleteStep(addStepAfter(br, 'if', 'onfalse', { id: 'n', kind: 'wait' }), 'n'), insertBetween(routed, 'if', 'ontrue', 'x', ifStep()), insertBetween(line, 'a', 'next', 'b', ifStep())];
for (const m of ['x', 'y', 'z']) if (canMove(routed, m).earlier) edits.push(moveStep(routed, m, -1)); else if (canMove(routed, m).later) edits.push(moveStep(routed, m, 1));
ok(edits.every((wf) => !both(wf).length), 'every add, insert, move and delete around a branch leaves it without a next', edits.map(both));
// P132 BWF-001 AC4: the + on a wire puts the step on that wire only
const fan = { id: 'w', entry: 'a', steps: [{ id: 'a', kind: 'wait', next: ['b', 'c'] }, { id: 'b', kind: 'return' }, { id: 'c', kind: 'return' }] };
const ins = insertBetween(fan, 'a', 'next', 'c', { id: 'n', kind: 'wait' });
ok(JSON.stringify(ins.steps.find((s) => s.id === 'a').next) === '["b","n"]' && ins.steps.find((s) => s.id === 'n').next[0] === 'c', 'a step put on the wire a → c: a goes to b and to it, it goes to c', ins.steps);
const onYes = insertBetween(routed, 'if', 'ontrue', 'x', { id: 'n', kind: 'wait' });
ok(onYes.steps.find((s) => s.id === 'if').routes.ontrue[0] === 'n' && onYes.steps.find((s) => s.id === 'n').next[0] === 'x' && onYes.steps.find((s) => s.id === 'if').routes.onfalse[0] === 'y', 'a step put on the Yes wire stays on Yes; No is untouched');
ok(throws(() => insertBetween(line, 'a', 'next', 'c', { id: 'n', kind: 'wait' })) && throws(() => insertBetween(line, 'a', 'next', 'b', { id: 'r', kind: 'return' })) && JSON.stringify(line) === frozen, 'no wire there, or a Return in the middle: refused, the workflow untouched');
// P132 BWF-001 AC3: a step's ways on, each a port in words
const tt = { id: 'branch', kind: 'branch', routes: { ontrue: ['c3'] }, next: ['c2'] }; // TriggerTest's, as Richard's Studio left it
const ttp = stepPorts(tt, ['ontrue', 'onfalse']);
ok(ttp.map((p) => `${p.label}:${p.tos.join('+') || '-'}`).join(' ') === `Yes:c3 No:- ${ALWAYS_WORDS}:c2`, "TriggerTest's If: Yes, an open No, and its next said as Always, as well", ttp);
const sw = stepPorts({ id: 's', kind: 'switch', routes: { small: ['a'], default: ['b'] } }, ['default', 'small', 'medium', 'large']);
ok(sw.length === 4 && sw.map((p) => p.label).join() === 'Anything else,small,medium,large' && sw.every((p) => p.where !== 'next'), 'a switch with three cases: four ports, each named, no plain next', sw.map((p) => p.label));
ok(stepPorts({ id: 'a', kind: 'wait', next: ['b'], onError: ['f'] }).map((p) => `${p.where}/${p.kind}/${p.label}`).join() === 'next/then/,onError/fail/If it fails', 'a plain step: one port on, and its error route in words');
ok(stepPorts({ id: 'a', kind: 'wait' })[0].tos.length === 0, 'a step with nothing after it has an open port');
const fixed = nextOntoRoute({ id: 'w', entry: 'branch', steps: [tt] }, 'branch', 'onfalse');
ok(JSON.stringify(fixed.steps[0].routes) === '{"ontrue":["c3"],"onfalse":["c2"]}' && !('next' in fixed.steps[0]) && tt.next[0] === 'c2', 'the next put on No: the If decides again; the given workflow untouched');
ok(valueForm({ $path: 'body.plant' }).from === 'body.plant' && valueForm('Kitchen').typed === 'Kitchen' && valueForm({ $path: 'a', x: 1 }).typed, 'a value read from the run, and a typed one');

// P132 BWF-002: a workflow tested on a sample
{
  const rowSample = { kind: 'db-change', table: 'Watering', action: 'create', rowId: 'w1', label: 'Monstera', body: { objectId: 'w1', plant: 'Monstera' } };
  ok(sampleWords(rowSample) === 'Sample: Watering Monstera, made', 'a picked row in the panel\'s words: "Sample: Watering Monstera, made"', sampleWords(rowSample));
  ok(sampleWords({ kind: 'webhook', body: { order: 7 } }) === 'Sample: a call from outside, with 1 value' && sampleWords(null) === 'No sample yet', 'a call\'s body, and none yet');
  const env = sampleRun(rowSample, 'read');
  ok(JSON.stringify(env) === JSON.stringify({ payload: rowSample.body, as: { type: 'db-change', collection: 'Watering', action: 'create', recordId: 'w1' }, test: true, stopAfter: 'read' }), 'a row sample is the run route\'s envelope: the row as the payload, the change as `as`, up to the step', env);
  ok(sampleRun({ kind: 'manual', body: {} }).as.type === 'manual' && !('stopAfter' in sampleRun({ kind: 'manual', body: {} })), 'a run asked for: no trigger shape, no stop');
  ok(JSON.stringify(sampleFor([rows])) === JSON.stringify({ kind: 'db-change', table: 'Task', action: 'create', body: {} }) && sampleFor([]).kind === 'manual', 'a first sample follows what starts the workflow: its table and change', sampleFor([rows]));
  ok(/never on live/.test(testRefusal({ env: 'live' }) ?? ''), 'a test asked of live is refused in words');
  ok(/development backend is its live one/.test(testRefusal({ dev: { endpoint: 'http://127.0.0.1:8625/' }, live: { endpoint: 'http://127.0.0.1:8625' } }) ?? '') && /live one/.test(testRefusal({ dev: { endpoint: 'a' }, live: {}, name: 'Greenhouse live backend' }) ?? ''), 'a development binding that is the live backend is refused too');
  ok(testRefusal({ dev: { endpoint: 'http://127.0.0.1:8625' }, live: { endpoint: 'http://127.0.0.1:8626' }, name: 'Greenhouse backend' }) === null, 'development, beside its own live backend: a test runs');
  const t0 = Date.parse('2026-11-02T20:00:00Z');
  const tested = { status: 'success', startedAt: t0, durationMs: 4, metadata: { test: true, stoppedAfter: 'read' }, steps: [{ nodeId: 'read', status: 'success', stepIndex: 0 }, { nodeId: 'say', status: 'skipped', stepIndex: 1 }] };
  ok(/^● Tested .* · stopped after step 1, Read the row · 4 ms$/.test(runLine(tested, (id) => (id === 'read' ? 'Read the row' : id))), 'a test up to a step says so: "Tested … stopped after step 1, Read the row"', runLine(tested, (id) => (id === 'read' ? 'Read the row' : id)));
  ok(/^● Last run .* · finished/.test(runLine({ ...tested, metadata: {} })), 'a run that was not a test is still "Last run"');
}

// P132 BWF-003: what a step can read
{
  // AC2: a diamond, A → B, A → C, B and C → D (the gate before it: an If whose two sides meet again)
  const dia = { id: 'd', entry: 'A', steps: [{ id: 'A', kind: 'branch', routes: { ontrue: ['B'], onfalse: ['C'] } }, { id: 'B', kind: 'wait', next: ['D'] }, { id: 'C', kind: 'wait', next: ['D'], onError: ['E'] }, { id: 'D', kind: 'merge' }, { id: 'E', kind: 'stop' }] };
  const up = (id) => upstreamOf(dia, id).map((s) => s.id).join();
  ok(up('D') === 'A,B,C' && up('B') === 'A' && up('C') === 'A' && up('A') === '', 'a diamond: D reads A, B and C; B does not read C; the entry reads no step', ['D', 'B', 'C', 'A'].map(up));
  ok(up('E') === 'A,C', 'a step on an error route reads the step that failed and what was before it', up('E'));
  ok(upstreamOf({ entry: 'a', steps: [{ id: 'a', next: ['b'] }, { id: 'b', next: ['a'] }] }, 'a').map((s) => s.id).join() === 'b', 'a loop does not hang');
  // the catalog's words for what a kind gives (nodegx-backend steps/kinds.ts `output`)
  ok(shapeFields('`{ result: boolean, isfalse: boolean }` — mirrors the client Condition node output port names.').join() === 'result,isfalse', 'an If gives result and isfalse');
  ok(shapeFields('`{ results: unknown[], count, skipped, errors: [{index,message}], failed: number }`.').join() === 'results,count,skipped,errors,failed', 'a For Each: a list of objects inside is one field, not five');
  ok(shapeFields('`{ matched: string | null, value: unknown }`.').join() === 'matched,value' && shapeFields('The object you described, and nothing else').length === 0, "a switch's two, and words with no shape in them: none");
  // AC3: no run, no sample: the table's columns, said as a shape
  const ww = { id: 'when-watered', entry: 'check', steps: [{ id: 'check', name: 'The watering names its plant', kind: 'validate', next: ['mark'] }, { id: 'mark', name: 'Mark the plant watered', kind: 'call-function', ref: 'Cloud Functions/Mark watered', params: { plant: { $path: 'body.plant' } } }] };
  const watered = [{ id: 't', type: 'db-change', dbChange: { collection: 'Watering', actions: ['create'] }, target: { kind: 'workflow', name: 'when-watered' } }];
  const cat = { validate: { displayName: 'Validate', output: '`{ ok: true, checked: number }` when every rule held.' } };
  const have = { starts: watered, columns: (t) => (t === 'Watering' ? ['plant', 'note', 'at'] : null), kind: (k) => cat[k], answers: (s) => (s.ref === 'Cloud Functions/Mark watered' ? ['changed'] : null) };
  const first = readSources(ww, 'check', have);
  ok(first.map((x) => x.root).join() === 'body,trigger' && first[0].from === 'shape' && Object.keys(first[0].value).join() === 'objectId,plant,note,at,createdAt,updatedAt', "the first step, no run yet: what started it is the Watering table's columns", first[0]);
  ok(first[0].words === 'the Watering that was made' && startWords([]) === 'what it was given', 'what started it, in words');
  const second = readSources(ww, 'mark', have);
  ok(second[2]?.root === 'upstream.check' && second[2].from === 'shape' && Object.keys(second[2].value).join() === 'ok,checked' && second[2].words === 'The watering names its plant', "the step after it: the step before, its catalog shape, under its own name", second[2]);
  // a run: its values win
  const run = stepsOfRun({ steps: [{ nodeId: 'check', stepIndex: 0, status: 'success', inputData: { action: 'create', body: { objectId: 'w1', ACL: { '*': { read: true } }, plant: { objectId: 'p1' } }, trigger: { type: 'db_change', collection: 'Watering' } }, outputData: { ok: true, checked: 2 } }] });
  const ran = readSources(ww, 'mark', { ...have, run });
  ok(ran[0].from === 'run' && ran[0].value.plant.objectId === 'p1' && !('action' in ran[0].value) && !('ACL' in ran[0].value) && ran[1].value.collection === 'Watering' && ran[2].value.checked === 2, "a run's own values: the row under body (never the deprecated top-level copy, nor its ACL), the trigger, the step's output", ran);
  const sampled = readSources(ww, 'check', { ...have, sample: { kind: 'db-change', body: { objectId: 'w9', plant: 'x' } } });
  ok(sampled[0].from === 'sample' && sampled[0].value.objectId === 'w9', 'tested on nothing yet, a sample: its row');
  ok(JSON.stringify(readSources({ steps: [{ id: 'a', kind: 'call-function', ref: 'Cloud Functions/Mark watered', next: ['b'] }, { id: 'b', kind: 'return' }] }, 'b', have)[2].value) === '{"result":{"changed":null}}', "a function step's shape: what its Response answers, under result");
  // AC4: inside a filter, the item from the list's sample
  const list = { id: 'l', entry: 'get', steps: [{ id: 'get', kind: 'call-function', ref: 'F', next: ['keep'] }, { id: 'keep', kind: 'filter', params: { items: { $path: 'upstream.get.result.plants' }, itemKey: 'plant', condition: { left: { $path: 'plant.thirsty' }, op: 'truthy' } } }] };
  const lrun = stepsOfRun({ steps: [{ nodeId: 'get', stepIndex: 0, status: 'success', inputData: { body: {} }, outputData: { result: { plants: [{ name: 'Monstera', thirsty: true }, { name: 'Fern' }] } } }] });
  const items = itemSources(list, list.steps[1], readSources(list, 'keep', { run: lrun }));
  ok(items[0].root === 'plant' && items[0].from === 'run' && items[0].value.name === 'Monstera' && items[1].root === 'index' && items[1].leaf, "a filter's item, under its itemKey, from the list's first item in the run; its position", items);
  const before = itemSources({ ...list, steps: [list.steps[0], { ...list.steps[1], params: {} }] }, { id: 'keep', kind: 'filter' }, readSources(list, 'keep', {}));
  ok(before[0].root === 'item' && before[0].from === 'shape' && /tested/.test(before[0].note), 'no run: the item is offered, its fields said to come with a test', before[0]);
  // a value read from the run, in words (its pill)
  ok(JSON.stringify(pathWords('body.plant', ww, watered)) === '{"name":"plant","from":"the Watering that was made"}', '"plant · from the Watering that was made"');
  ok(pathWords('upstream.mark.result.changed', ww).name === 'changed' && pathWords('upstream.mark.result.changed', ww).from === 'Mark the plant watered', "a function's answer by its own name, from the step's name");
  ok(pathWords('upstream.gone.x', ww).missing && pathWords('previous.result', ww).from === 'the step before' && pathWords('plant.name', ww, [], { item: 'plant' }).from === 'the list' && pathWords('body.items.0.name', ww).name === 'items › #1 › name', 'a step that is not there, the step before, an item, a place in a list');
}

// P132 BWF-004: formulas, from the served list (three, shaped as nodegx-backend's `formulaLanguage` serves them)
{
  const UNITS = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];
  const F = [
    { name: 'date-difference', label: 'Time between', sentence: '{unit} between {from} and {to}', returns: 'number', args: [{ name: 'from', label: 'from', type: 'date' }, { name: 'to', label: 'to', type: 'date' }, { name: 'unit', label: 'in', type: 'choice', oneOf: UNITS }] },
    { name: 'now', label: 'Now', sentence: 'now', returns: 'date', args: [] },
    { name: 'text', label: 'Text with values', sentence: '{parts}', returns: 'text', args: [{ name: 'parts', label: 'part', type: 'any', repeats: true }] },
    { name: 'add', label: 'Add', sentence: '{values} added together', returns: 'number', args: [{ name: 'values', label: 'number', type: 'numbers', repeats: true }] },
    { name: 'round', label: 'Round', sentence: '{number} rounded, to {places} decimal places', returns: 'number', args: [{ name: 'number', label: 'number', type: 'number' }, { name: 'places', label: 'decimal places', type: 'number', optional: true }] }
  ];
  const spec = (n) => F.find((x) => x.name === n);
  ok(JSON.stringify(formulaStart(spec('date-difference'))) === '{"$fn":"date-difference","args":[{"$fn":"now"},{"$fn":"now"},"days"]}', 'a formula picked starts with values the backend takes: its dates Now, its unit days', formulaStart(spec('date-difference')));
  ok(JSON.stringify(formulaStart(spec('now'))) === '{"$fn":"now"}' && JSON.stringify(formulaStart(spec('add')).args) === '[0,0]' && JSON.stringify(formulaStart(spec('round')).args) === '[0]' && JSON.stringify(formulaStart(spec('text')).args) === '[""]', 'no args for Now; Add starts with two numbers; an optional arg is left out; text with one part');
  ok(valueForm({ $fn: 'now' }).fn === 'now' && valueForm({ $fn: 'add', args: [1, 2] }).args.length === 2 && 'typed' in valueForm({ $in: [1] }), 'a formula is its own form; another $-keyed object is a typed value');
  const vw = (v) => { const f = valueForm(v); return 'from' in f ? f.from.split('.').pop() : typeof f.typed === 'string' ? f.typed : JSON.stringify(f.typed); };
  const days = { $fn: 'date-difference', args: [{ $path: 'body.lastWatered' }, { $fn: 'now' }, 'days'] };
  ok(formulaWords(days, F, vw) === 'days between lastWatered and now', 'drawn as its sentence: "days between lastWatered and now"', formulaWords(days, F, vw));
  ok(JSON.stringify(formulaParts(days, F, vw).filter((p) => p.arg).map((p) => p.arg)) === '["unit","from","to"]', 'each arg a part of its own, so the page can set the values apart');
  ok(formulaWords({ $fn: 'text', args: ['Hi ', { $path: 'body.name' }, '!'] }, F, vw) === 'Hi name!' && formulaWords({ $fn: 'add', args: [1, 2, 3] }, F, vw) === '1, 2 and 3 added together', 'text with values reads as the text; three values as "1, 2 and 3"');
  ok(formulaWords({ $fn: 'round', args: [2.456] }, F, vw) === '2.456 rounded' && formulaWords({ $fn: 'round', args: [2.456, 2] }, F, vw) === '2.456 rounded, to 2 decimal places', 'an optional arg left out takes its clause with it: "2.456 rounded"; given, "…, to 2 decimal places"');
  ok(formulaWords({ $fn: 'date-difference', args: [{ $path: 'body.at' }] }, F, vw) === 'days between at and (no to)'.replace('days', '(no in)') && /does not have/.test(formulaWords({ $fn: 'eval' }, F, vw)), 'a required arg missing is said; a formula the backend lacks is said, not drawn', formulaWords({ $fn: 'date-difference', args: [{ $path: 'body.at' }] }, F, vw));
}

// P132 BWF-006: Paste a curl command — the form's settings from the line, a key it carries lifted out for Secrets
{
  const c1 = parseCurl(`curl -X POST https://api.example.com/v1/messages \\
  -H 'Authorization: Bearer sk-live-abcdef123456' \\
  -H 'Content-Type: application/json' \\
  -d '{"text":"hi","n":2}'`);
  ok(c1.key?.value === 'sk-live-abcdef123456' && c1.key.how === 'bearer' && JSON.stringify(c1.params) === JSON.stringify({ method: 'POST', url: 'https://api.example.com/v1/messages', body: { text: 'hi', n: 2 }, authType: 'bearer', authSecret: 'EXAMPLE_KEY' }), 'a Bearer header becomes Authentication from a Secret; the JSON body its fields; the content type left to the step', c1);
  ok(!JSON.stringify(c1.params).includes('sk-live'), 'the key is in no setting');
  const c2 = parseCurl('curl "https://api.openweathermap.org/data/2.5/weather?q=Paris&appid=abcdef123456"');
  ok(c2.key?.how === 'query' && c2.params.authName === 'appid' && JSON.stringify(c2.params.query) === '{"q":"Paris"}' && c2.params.authSecret === 'OPENWEATHERMAP_KEY' && !c2.params.method, "a key in the query (appid) is lifted out; the rest of the query stays; the Secret named for the API", c2.params);
  const c3 = parseCurl('curl -u greenhouse:s3cretpass https://api.stripe.com/v1/charges -d amount=200 -d currency=eur');
  ok(c3.key?.how === 'basic' && c3.params.authUser === 'greenhouse' && c3.params.bodyType === 'form' && c3.params.body.amount === '200' && c3.params.method === 'POST', '-u user:pass is Basic, the password the key; -d pairs a form body, so POST', c3.params);
  const c4 = parseCurl('curl -G https://api.example.com/search --data-urlencode "q=red plants" -H "X-API-Key: k-998877"');
  ok(c4.key?.how === 'header' && c4.params.authName === 'X-API-Key' && c4.params.query.q === 'red plants' && !c4.params.body && !c4.params.method, '-G sends the data as the query; an X-API-Key header is a key, its name kept', c4.params);
  const c5 = parseCurl('curl https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35');
  ok(c5.key === null && !c5.params.authType && c5.params.query.latitude === '48.85', 'a command with no key fills the form and asks for no Secret', c5);
  let refused = ''; try { parseCurl('wget https://x.example'); } catch (e) { refused = e.message; }
  ok(/not a curl command/.test(refused), 'a line that is not curl is said so', refused);
  ok(JSON.stringify(shellWords(`curl -H "A: \\"q\\"" 'b c' d\\ e`)) === JSON.stringify(['curl', '-H', 'A: "q"', 'b c', 'd e']), 'a line split as a shell splits it: quotes and escapes');
  ok(secretNameFor('http://127.0.0.1:5000/x') === 'API_KEY' && secretNameFor('https://hooks.slack.com/x') === 'SLACK_KEY', 'a Secret named for the API, or API_KEY for an address by number');
}

// P132 BWF-007: a test that sends an email says who to, before it runs; only the steps the test runs count
{
  const wf = { id: 'morning', steps: [
    { id: 'find', kind: 'find-records', params: { table: 'Plant' }, next: ['tell', 'keepers'] },
    { id: 'tell', kind: 'send-email', params: { to: 'gardener@example.com; helper@example.com', subject: 'Water' } },
    { id: 'keepers', kind: 'send-email', params: { to: { $path: 'body.email' }, subject: 'Yours' } },
    { id: 'later', kind: 'send-email', params: { to: { $fn: 'pick', args: [{ $path: 'upstream.find.items' }, 'keeper'] }, subject: 'Later' } }
  ] };
  const words = (p) => `the ${p.split('.').pop()} it started with`;
  ok(testMailWords(wf, null, words) === 'gardener@example.com, helper@example.com, the email it started with and the addresses its formula gives', 'the whole test: every address, a picked value in words, a formula said as one', testMailWords(wf, null, words));
  ok(testMailWords(wf, 'tell', words) === 'gardener@example.com and helper@example.com', 'tested up to one step: only that step and the ones before it', testMailWords(wf, 'tell', words));
  ok(testMailWords(wf, 'find', words) === null, 'a test that reaches no email step says nothing about email');
}

// P132 BWF-011 (R8): a value composed in a setting, words and values, saved as the backend's formulas
console.log('check: P132 BWF-011, a value composed in a setting');
{
  const name = { $path: 'upstream.find.items.0.name' };
  ok(JSON.stringify(composeValue(['Water ', name, ' today'])) === JSON.stringify({ $fn: 'text', args: ['Water ', name, ' today'] }), 'words around a value: { $fn: "text", args: parts }');
  ok(JSON.stringify(composeValue([name])) === JSON.stringify(name) && JSON.stringify(composeValue(['', name, ''])) === JSON.stringify(name), 'one value alone is itself, a path (empty words dropped)');
  ok(composeValue(['Water the ', 'plants']) === 'Water the plants', 'words alone are the typed text, joined');
  ok(composeValue([]) === undefined && composeValue(['']) === undefined, 'nothing is no value');
  ok(composeValue(['5']) === 5 && composeValue(['true']) === true && composeValue(['5'], 'string') === '5', 'a setting of any kind reads "5" and "true" as themselves; a text setting keeps them text');
  ok(JSON.stringify(composeParts({ $fn: 'text', args: ['Hi ', { $path: 'body.name' }, 3] })) === '["Hi ",{"$path":"body.name"},"3"]', 'a text formula back as its parts');
  ok(JSON.stringify(composeParts('Hello')) === '["Hello"]' && JSON.stringify(composeParts(undefined)) === '[]' && JSON.stringify(composeParts(4)) === '["4"]', 'a typed value is its words');
  ok(composeParts({ $fn: 'upper', args: [{ $path: 'body.code' }] }) === null && composeParts({ $fn: 'text', args: [{ $fn: 'upper', args: ['x'] }] }) === null && composeParts([1, 2]) === null && composeParts({ a: 1 }) === null, 'another formula, a list or an object is not a composer\'s: it keeps its own control');
  ok(isChip({ $fn: 'count', args: [{ $path: 'x' }] }) && isChip({ $fn: 'pick', args: [{ $path: 'x' }, 'name'] }) && isChip({ $fn: 'join', args: [{ $fn: 'pick', args: [{ $path: 'x' }, 'name'] }, ', '] }) && !isChip({ $fn: 'join', args: [{ $path: 'x' }] }) && !isChip({ $fn: 'first', args: [{ $path: 'x' }] }), 'a chip: a path, how many, each one\'s field, joined; a first is a path, never a formula');
  // what a chip can become
  const items = { $path: 'upstream.find.items' }, rows = [{ name: 'Fern', room: 'Kitchen' }];
  const refs = chipRefinements(items, rows), by = (w) => refs.find((x) => x.words === w)?.value;
  ok(JSON.stringify(by('the first one')) === '{"$path":"upstream.find.items.0"}' && JSON.stringify(by("the first one's name")) === '{"$path":"upstream.find.items.0.name"}', "a list: the first one, and the first one's name in one step, as paths (AC2: items → first → name)");
  ok(JSON.stringify(by('the last one')) === '{"$path":"upstream.find.items.-1"}' && JSON.stringify(by('how many there are')) === '{"$fn":"count","args":[{"$path":"upstream.find.items"}]}', 'its last one is a path (-1), how many a formula');
  ok(JSON.stringify(by("each one's name")) === '{"$fn":"pick","args":[{"$path":"upstream.find.items"},"name"]}', "each one's name: pick");
  ok(JSON.stringify(chipRefinements({ $fn: 'pick', args: [items, 'name'] }).find((x) => x.words === 'joined with commas')?.value) === '{"$fn":"join","args":[{"$fn":"pick","args":[{"$path":"upstream.find.items"},"name"]},", "]}', "each one's name, joined with commas");
  ok(JSON.stringify(chipRefinements({ $path: 'body' }, { name: 'Fern', ACL: {} }).map((x) => x.value.$path)) === '["body.name"]', 'a record: its fields, never who may read it');
  ok(JSON.stringify(chipRefinements({ $path: 'body' }, { objectId: 'a', createdAt: 't', name: 'Fern', room: 'K' }).map((x) => x.words)) === '["name","room","objectId","createdAt"]', "a row's own fields first, its id and dates after");
  ok(chipRefinements({ $path: 'body.name' }, 'Fern').length === 0 && chipRefinements({ $path: 'body.x' }, undefined).length === 0, 'one value, or nothing known: nothing to refine');
  // what is known at a path, before a run: a find's items are its table's rows
  const wf = { steps: [{ id: 'find', kind: 'find-records', params: { table: 'Plant' } }, { id: 'mail', kind: 'send-email' }] };
  const shape = [{ root: 'body', from: 'shape', value: {} }, { root: 'upstream.find', from: 'shape', step: 'find', value: { items: null, count: null, first: null } }];
  const k = knownAt(shape, 'upstream.find.items', { wf, columns: (t) => (t === 'Plant' ? ['name', 'room'] : null) });
  ok(Array.isArray(k.value) && JSON.stringify(Object.keys(k.value[0])) === '["objectId","name","room"]' && k.from === 'shape', "no run yet: a find's items are a list of its table's rows", k);
  ok(JSON.stringify(Object.keys(knownAt(shape, 'upstream.find.items.0', { wf, columns: () => ['name'] }).value)) === '["objectId","name"]', "and its first one is a row");
  const ran = [{ root: 'upstream.find', from: 'run', step: 'find', value: { items: [{ name: 'Fern' }, { name: 'Basil' }] } }];
  ok(knownAt(ran, 'upstream.find.items.-1.name', { wf }).value === 'Basil' && knownAt(ran, 'upstream.nothing', { wf }).value === undefined, 'after a run, what it gave: -1 is the last one; another root, nothing');
  // a chip in words
  const pw = (p) => ({ name: p.split('.').slice(2).join(' › '), from: 'Find plants' });
  ok(chipWords({ $fn: 'join', args: [{ $fn: 'pick', args: [items, 'name'] }, ', '] }, pw).name === "each one's name in items, joined with commas" && chipWords({ $fn: 'count', args: [items] }, pw).name === 'how many items', 'a chip says what it is in words');
  ok(pathWords('upstream.find.items.-1', { steps: [{ id: 'find', name: 'Find plants', kind: 'find-records' }] }).name === 'items › the last', 'the last one is said, never "-1"');
}

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
