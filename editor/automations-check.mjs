/**
 * NodeGX Studio — P127 BKO-005: ./automations.mjs with no browser. A trigger's head in a person's words, a schedule's
 * time read and moved (and refused where a cron runs more than once a day), a workflow laid out left to right with its
 * error routes told apart, and a failed run said at the step it failed. The drawing is graded in Chrome by
 * automations-drive.mjs.
 *
 *   node editor/automations-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { callParts, saveCallFrom, stepForCall, usersOfCall, callId, readsRun, blankName } from './automations.mjs';
import { stepTitle, pieceOf, piecesIn, runnersOf, sentNames, bodyNames, runnersWords, wouldRing, runInFailure, pieceFrom } from './automations.mjs';
import { parseCurl, secretNameFor, shellWords, testMailWords, composeParts, composeValue, isChip, knownAt, chipRefinements, chipWords } from './automations.mjs';
import { ALWAYS_WORDS, formulaParts, formulaStart, formulaWords, itemSources, pathWords, readSources, shapeFields, startWords, upstreamOf, addStepAfter, sampleFor, sampleRun, sampleWords, testRefusal, agrees, atTime, canMove, deleteStep, insertBetween, moveStep, nextOntoRoute, stepPorts, routeWord, servedRouteWords, newStepId, readAutomations, runLine, scheduleTime, stepsOfRun, stepWires, targetOf, triggerHead, valueForm, workflowLayout } from './automations.mjs';

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
// Studio reads the backend's route words (catalog 1.9.0) before its own table; a backend before 1.9.0 has none, and the table speaks
const servedBranch = servedRouteWords({ kind: 'branch', routes: [{ name: 'ontrue', displayName: 'When it holds' }, { name: 'onfalse', displayName: 'No' }] });
ok(stepPorts(tt, ['ontrue', 'onfalse'], servedBranch).map((p) => p.label).join() === `When it holds,No,${ALWAYS_WORDS}`, "a route's words are the backend's when it serves them (a word Studio's table does not have)");
ok(stepPorts(tt, ['ontrue', 'onfalse'], servedRouteWords({ kind: 'branch', routes: [{ name: 'ontrue' }, { name: 'onfalse' }] })).map((p) => p.label).join() === `Yes,No,${ALWAYS_WORDS}` && JSON.stringify(servedRouteWords(undefined)) === '{}', 'a backend before 1.9.0 (no displayName, or no kind at all): Studio\'s own words');
ok(routeWord('later', {}) === 'later' && routeWord('later', { later: 'Some time after' }) === 'Some time after', 'a route nobody has words for says its name; served words name a route Studio never heard of');
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
  ok(JSON.stringify(pathWords('fill.city', {})) === '{"name":"city","from":"each workflow"}', 'P132 BWF-012: a saved call\'s blank is "city · from each workflow", never "fill › city · from the run"');
}

// P132 BWF-012: saved API calls
{
  const params = { url: 'https://api.example.com/forecast', query: { city: { $path: 'body.title' }, units: 'metric' }, authType: 'bearer', authSecret: 'WEATHER_KEY', timeoutMs: 5000 };
  ok(JSON.stringify(callParts(params).map((p) => p.key)) === '["url","query.city","query.units"]', 'a Call an API\'s parts that can be blanks: the address, each query entry');
  ok(readsRun(params.query.city) && !readsRun('metric') && readsRun({ $fn: 'text', args: ['x', { $path: 'body.a' }] }) && !readsRun({ $path: 'fill.city' }), 'a part that reads the run is told from one that reads a blank or is typed');
  const { call, stepParams } = saveCallFrom(params, { id: 'the-weather', name: 'The weather', blankKeys: ['query.city'] });
  ok(JSON.stringify(call) === JSON.stringify({ id: 'the-weather', name: 'The weather', params: { url: 'https://api.example.com/forecast', query: { city: { $path: 'fill.city' }, units: 'metric' }, authType: 'bearer', authSecret: 'WEATHER_KEY', timeoutMs: 5000 }, blanks: [{ name: 'city', type: 'text' }] }), 'saved: the settings once, the ticked part a blank read as fill.city', call);
  ok(JSON.stringify(stepParams) === '{"call":"the-weather","fill":{"city":{"$path":"body.title"}}}', 'and the step fills it with what it had there, so it does what it did', stepParams);
  ok(params.query.city.$path === 'body.title', "the step's own settings are not changed in place");
  const typed = saveCallFrom(params, { id: 'w', blankKeys: ['query.units', 'url'] });
  ok(typed.call.blanks.find((b) => b.name === 'units').example === 'metric' && typed.call.params.url.$path === 'fill.address' && typed.stepParams.fill.address === 'https://api.example.com/forecast', 'a typed part becomes a blank with its value as the example; the address is "address"', typed);
  ok(JSON.stringify(stepForCall(typed.call)) === JSON.stringify({ call: 'w', fill: { units: 'metric', address: 'https://api.example.com/forecast' } }) && JSON.stringify(stepForCall(call)) === '{"call":"the-weather","fill":{"city":""}}', 'picked from the menu, each blank starts at its example, or empty, so the step can be stored');
  ok(callId('The weather', []) === 'the-weather' && callId('The weather', ['the-weather']) === 'the-weather-2' && callId('  !!', []) === 'api-call', "a call's id from its name, unique");
  ok(blankName('X-Request-Id', []) === 'X_Request_Id' && blankName('2fa', []) === '_2fa' && blankName('city', ['city']) === 'city_2', "a blank's name is one a path can carry");
  ok(JSON.stringify(usersOfCall([{ id: 'a', steps: [{ kind: 'http-request', params: { call: 'w' } }] }, { id: 'b', steps: [{ kind: 'http-request', params: { url: 'x' } }] }], 'w')) === '["a"]', 'who uses a saved call');
  ok(JSON.stringify(readAutomations('{"version":1,"workflows":[],"triggers":[],"apiCalls":[{"id":"w"}]}').apiCalls) === '[{"id":"w"}]' && readAutomations(null).apiCalls.length === 0, 'the file\'s saved calls are read');
}

// P132 BWF-013 (R6): a reusable piece is a workflow others run
{
  const run = (to, send) => ({ id: `run-${to}`, kind: 'run-workflow', params: { workflow: to, ...(send ? { send } : {}) } });
  const thirsty = { id: 'thirsty', name: 'Find thirsty plants', steps: [{ id: 'find', kind: 'find-records', params: { table: 'Plant', where: [{ field: 'room', op: 'eq', value: { $path: 'body.room' } }] } }, { id: 'say', kind: 'transform', params: { output: { line: { $fn: 'text', args: ['Water ', { $path: 'body.who.name' }] }, kept: { $literal: { $path: 'body.never' } } } } }] };
  const morning = { id: 'morning', name: 'The morning check', steps: [run('thirsty', { room: 'Kitchen' })] };
  const evening = { id: 'evening', name: 'The evening check', steps: [run('thirsty', { room: { $path: 'body.room' }, extra: 1 }), run('tell')] };
  const tell = { id: 'tell', name: 'Tell the gardener', steps: [] };
  const wfs = [thirsty, morning, evening, tell];
  const trig = [{ id: 't1', type: 'schedule', target: { kind: 'workflow', name: 'morning' } }, { id: 't2', type: 'schedule', target: { kind: 'workflow', name: 'evening' } }, { id: 't3', type: 'schedule', target: { kind: 'function', name: 'tell' } }];
  ok(JSON.stringify(piecesIn(wfs, trig).map((w) => w.id)) === '["thirsty","tell"]', 'the pieces: the workflows no trigger starts (a trigger starting a FUNCTION of the same name starts no workflow)');
  ok(pieceOf(morning.steps[0]) === 'thirsty' && pieceOf({ kind: 'run-workflow', params: { workflow: { $path: 'body.w' } } }) === null && pieceOf({ kind: 'call-function', ref: 'x' }) === null, 'the piece a step runs, by a plain id only');
  ok(JSON.stringify(runnersOf(wfs, 'thirsty')) === '["morning","evening"]' && runnersOf(wfs, 'morning').length === 0, 'who runs a piece, in the file\'s order');
  ok(JSON.stringify(sentNames(wfs, 'thirsty')) === '["room","extra"]', 'the names a piece is sent, each once', sentNames(wfs, 'thirsty'));
  ok(JSON.stringify(bodyNames(thirsty)) === '["room","who"]', 'the names a piece reads from what it was given, inside conditions and formulas, never inside a $literal', bodyNames(thirsty));
  ok(runnersWords(['morning', 'evening'], (id) => wfs.find((w) => w.id === id).name) === 'Run by “The morning check” and “The evening check”' && runnersWords([]) === 'No workflow runs it yet' && /and 1 more$/.test(runnersWords(['a', 'b', 'c'])), 'a piece\'s row says who runs it');
  ok(wouldRing(wfs, 'thirsty', 'morning') && wouldRing(wfs, 'thirsty', 'thirsty') && !wouldRing(wfs, 'morning', 'thirsty') && !wouldRing(wfs, 'tell', 'thirsty'), 'a ring is seen before it is offered: running a workflow that runs this one, or itself');
  ok(wouldRing([{ id: 'a', steps: [run('b')] }, { id: 'b', steps: [run('c')] }, { id: 'c', steps: [] }], 'c', 'a') && !wouldRing([{ id: 'a', steps: [run('b')] }, { id: 'b', steps: [] }], 'c', 'a'), 'and through a second piece');
  ok(runInFailure('Step "ask": the piece "Always fails" failed at its step "Say no": no (its run: 9f2c-1)') === '9f2c-1' && runInFailure('(its run: not recorded)') === null && runInFailure('boom') === null, "the piece's run named in its failure (none when it was not recorded)");
  // what a piece can read: what its runners send, before any run or sample
  const src = readSources(thirsty, 'find', { sent: sentNames(wfs, 'thirsty') });
  ok(src[0].root === 'body' && src[0].from === 'shape' && JSON.stringify(Object.keys(src[0].value)) === '["room","extra"]' && !src[0].note, 'inside a piece, what it was given is the names its runners send', src[0]);
  ok(readSources(thirsty, 'find', {}).length && readSources(thirsty, 'find', {})[0].note, 'a piece nothing runs yet keeps the note');
  ok(readSources(thirsty, 'find', { sent: ['room'], starts: [trig[0]] })[0].note, 'a started workflow is not given its runners\' names');
  // a step running a piece answers { result, run }, said by the piece's names
  const after = readSources({ steps: [{ ...morning.steps[0], next: ['next'] }, { id: 'next', kind: 'transform' }], entry: 'run-thirsty' }, 'next', { answers: (s) => (s.kind === 'run-workflow' ? ['plants'] : null) });
  ok(JSON.stringify(after.find((x) => x.root === 'upstream.run-thirsty')?.value) === '{"result":{"plants":null}}', 'after a Run a workflow, its result\'s names, as a function step\'s', after.map((x) => x.root));
  ok(pathWords('upstream.run-thirsty.result.plants', { steps: [{ ...morning.steps[0], name: 'Thirsty' }] }).name === 'plants', 'a piece\'s answer is said by its own names, not "result › plants"');
  // an unnamed step is said as its card says it (s17, Electron: a chip read "checked · from Call Function" beside a card saying "Run Check thirst")
  const unnamed = { entry: 'first', steps: [{ id: 'first', kind: 'call-function', ref: 'Cloud Functions/Check thirst', next: ['run-thirsty'] }, morning.steps[0]] };
  ok(pathWords('upstream.first.result.checked', unnamed, [], { kindName: () => 'Call Function' }).from === 'Run Cloud Functions/Check thirst' && pathWords('upstream.run-thirsty.result.x', unnamed, [], { workflowName: (id) => (id === 'thirsty' ? 'Find thirsty plants' : id) }).from === 'Run Find thirsty plants', 'an unnamed step\'s values are "from Run <its function>" / "from Run <its piece>", as its card is titled');
  ok(readSources(unnamed, 'run-thirsty', { kind: () => ({ displayName: 'Call Function' }) }).find((x) => x.step === 'first')?.words === 'Run Cloud Functions/Check thirst', 'and What it can read heads its block the same');
}

// P132 BWF-013 Build 3: Make a reusable piece from chosen steps
{
  const J = (v) => JSON.stringify(v);
  const refused = (f) => { try { f(); return null; } catch (e) { return e.message; } };
  // Greenhouse's TriggerTest, as Richard left it
  const tt = { id: 'triggertest', name: 'TriggerTest', entry: 'transform', steps: [{ id: 'transform', kind: 'transform', params: { output: { result: { $path: 'previous.result' } } }, next: ['branch'] }, { id: 'branch', kind: 'branch', params: { condition: { left: { $path: 'previous.result' }, op: 'truthy' } }, routes: { ontrue: ['call-function-3'] }, next: ['call-function-2'] }, { id: 'call-function-2', kind: 'call-function', ref: 'Cloud Functions/Check thirst', next: ['call-function'] }, { id: 'call-function', kind: 'call-function', ref: 'Cloud Functions/Check thirst', next: ['first'] }, { id: 'first', name: 'The end', kind: 'return' }, { id: 'call-function-3', kind: 'call-function', ref: 'Cloud Functions/Check thirst' }] };
  const m = pieceFrom(tt, ['call-function-2', 'call-function'], { id: 'check-twice', name: 'Check twice' });
  ok(J(m.piece.steps.map((s) => s.id)) === '["call-function-2","call-function","return"]' && m.piece.entry === 'call-function-2' && J(m.piece.steps[2].params) === '{"value":{"$path":"upstream.call-function"}}' && J(m.piece.steps[1].next) === '["return"]', 'the chosen steps move into the piece, which ends in a Return of the last one\'s answer', m.piece);
  ok(!('triggers' in m.piece) && m.piece.name === 'Check twice' && m.piece.id === 'check-twice', 'a piece: a name, no trigger');
  const rs = m.runner.steps;
  ok(J(rs.map((s) => s.id)) === '["transform","branch","run-workflow","first","call-function-3"]' && J(rs[1].next) === '["run-workflow"]' && J(rs[2].next) === '["first"]' && rs[2].params.workflow === 'check-twice' && !rs[2].params.send, 'one Run <piece> step where they were, the wire into it and on from it kept', rs);
  ok(J(rs[3].params) === '{"value":{"$path":"previous.result"}}', 'a Return after them that said nothing returned their last answer: it now returns the piece\'s answer, the same value', rs[3]);
  ok(J(rs[1].routes) === '{"ontrue":["call-function-3"]}' && J(rs[0]) === J(tt.steps[0]) && J(tt.steps.map((s) => s.id)) === '["transform","branch","call-function-2","call-function","first","call-function-3"]', 'the rest as it was; the workflow given is not touched');
  ok(m.notes.length === 2 && m.notes.every((n) => /runs a function/.test(n)) && pieceFrom(tt, ['call-function-2', 'call-function'], { id: 'x', title: () => 'Same' }).notes.length === 1, 'a moved function step is said, once per name: it is given what the piece is sent', m.notes);
  // refused, in words
  ok(/2 ways out: “branch” leads on to “call-function-2” and “branch” leads on to “call-function-3” on Yes\./.test(refused(() => pieceFrom(tt, ['transform', 'branch'], { id: 'x' }))), 'two ways out (a branch\'s Yes and its Always) refused, naming both', refused(() => pieceFrom(tt, ['transform', 'branch'], { id: 'x' })));
  ok(/ways in: “call-function-2” and “call-function-3”/.test(refused(() => pieceFrom(tt, ['call-function-2', 'call-function-3'], { id: 'x' }))), 'two ways in refused, naming both');
  ok(/“The end” ends the whole workflow/.test(refused(() => pieceFrom(tt, ['call-function', 'first'], { id: 'x' }))), 'a Return is not moved: in a piece it would end only the piece');
  ok(/only on Yes/.test(refused(() => pieceFrom({ entry: 'b', steps: [{ id: 'b', kind: 'branch', routes: { ontrue: ['t'] } }, { id: 't', kind: 'transform' }] }, ['b'], { id: 'x' }))), 'a way out on one side only refused: after a piece, what comes next always runs');
  ok(/only on When it holds/.test(refused(() => pieceFrom({ entry: 'b', steps: [{ id: 'b', kind: 'branch', routes: { ontrue: ['t'] } }, { id: 't', kind: 'transform' }] }, ['b'], { id: 'x', routeWordsOf: (st) => (st?.kind === 'branch' ? { ontrue: 'When it holds' } : {}) }))), 'the refusal says the side in the backend\'s words');
  ok(/ends there/.test(refused(() => pieceFrom({ entry: 'b', steps: [{ id: 'b', kind: 'branch', routes: { ontrue: ['y'], onfalse: ['n'] } }, { id: 'y', kind: 'transform', next: ['t'] }, { id: 'n', kind: 'transform' }, { id: 't', kind: 'transform' }] }, ['b', 'y', 'n'], { id: 'x' }))), 'one side leading on while the other ends there: two ways out');
  ok(/There is already a workflow called triggertest/.test(refused(() => pieceFrom(tt, ['call-function'], { id: 'triggertest', workflows: [tt] }))) && /Shift-press/.test(refused(() => pieceFrom(tt, [], { id: 'x' }))), 'a taken name, and nothing chosen');
  // what the moved steps read from before them is sent by name; what reads them after reads the piece's answer
  const mc = { id: 'morning-check', entry: 'check', steps: [{ id: 'check', name: 'Mark who is thirsty today', kind: 'call-function', ref: 'Cloud Functions/Check thirst', next: ['branch'] }, { id: 'done', kind: 'return', params: { value: { $path: 'previous.result' } } }, { id: 'branch', kind: 'branch', params: { condition: { left: { $path: 'upstream.check.result.checked' }, op: 'gte', right: { $fn: 'lower', args: [{ $path: 'upstream.check.result.checked' }] } } }, routes: { ontrue: ['done'] } }] };
  const c = pieceFrom(mc, ['check'], { id: 'p' });
  ok(c.runner.entry === 'run-workflow' && J(c.runner.steps.find((s) => s.id === 'branch').params.condition) === '{"left":{"$path":"upstream.run-workflow.result.result.checked"},"op":"gte","right":{"$fn":"lower","args":[{"$path":"upstream.run-workflow.result.result.checked"}]}}', 'the first step moved: the Run step is the first; a later read of the moved last step reads the piece\'s answer, inside formulas too', c.runner);
  ok(/“branch” reads “Mark who is thirsty today”, which would move into the piece: only the answer of its last step, “t”, comes back out/.test(refused(() => pieceFrom({ ...mc, steps: [{ ...mc.steps[0], next: ['t'] }, { id: 't', kind: 'transform', next: ['branch'] }, mc.steps[2], mc.steps[1]] }, ['check', 't'], { id: 'p' }))), 'a later read of a moved step that is not the last refused, naming both');
  const ww = { id: 'when-watered', entry: 'check', steps: [{ id: 'check', kind: 'validate', params: { rules: [{ path: 'body.plant', message: 'm' }, { path: 'upstream.x.id', message: 'n' }] }, next: ['mark'] }, { id: 'mark', kind: 'call-function', ref: 'F', params: { plant: { $path: 'body.plant' }, watering: { $path: 'body.objectId' }, n: 2, k: { $literal: { $path: 'body.never' } }, at: { $path: 'trigger.firedAt' }, w: { $path: 'upstream.x.items.0.name' } } }, { id: 'x', kind: 'transform' }] };
  ww.steps[2].next = ['check']; ww.entry = 'x';
  const w2 = pieceFrom(ww, ['check', 'mark'], { id: 'p' });
  ok(J(w2.sends) === J([{ name: 'plant', path: 'body.plant' }, { name: 'id', path: 'upstream.x.id' }, { name: 'objectId', path: 'body.objectId' }, { name: 'firedAt', path: 'trigger.firedAt' }, { name: 'name', path: 'upstream.x.items.0.name' }]), 'each value read from before them sent once, named by its last part', w2.sends);
  const pm = w2.piece.steps.find((s) => s.id === 'mark').params, pv = w2.piece.steps.find((s) => s.id === 'check').params;
  ok(J(pv.rules.map((r) => r.path)) === '["body.plant","body.id"]' && pm.plant.$path === 'body.plant' && pm.watering.$path === 'body.objectId' && pm.at.$path === 'body.firedAt' && pm.w.$path === 'body.name' && J(pm.k) === '{"$literal":{"$path":"body.never"}}' && pm.n === 2, 'inside the piece each reads what it was sent (a Validate rule\'s path too); a $literal and a typed value stay', pm);
  ok(J(w2.run.params.send) === J({ plant: { $path: 'body.plant' }, id: { $path: 'upstream.x.id' }, objectId: { $path: 'body.objectId' }, firedAt: { $path: 'trigger.firedAt' }, name: { $path: 'upstream.x.items.0.name' } }), 'and the Run step sends each from where it was read', w2.run.params);
  // what a step read without saying: a list's items, from the step before
  const lf = { id: 'l', entry: 'f', steps: [{ id: 'f', kind: 'find-records', params: { table: 'Plant' }, next: ['dry'] }, { id: 'dry', kind: 'filter', params: { condition: { left: { $path: 'item.dry' }, op: 'truthy' } }, next: ['s'] }, { id: 's', kind: 'sort', params: { by: 'name' } }] };
  const l = pieceFrom(lf, ['dry'], { id: 'p', defaults: (k) => (k === 'filter' || k === 'sort' ? { items: { $path: 'previous.items' } } : {}) });
  ok(J(l.sends) === '[{"name":"items","path":"previous.items"}]' && l.piece.steps[0].params.items.$path === 'body.items' && l.piece.steps[0].params.condition.left.$path === 'item.dry', 'a list step\'s unsaid items (the step before\'s) are sent; its item stays its item', l.piece.steps[0]);
  ok(l.runner.steps.find((s) => s.id === 's').params.items.$path === 'previous.result.items', 'and the step after, which read the moved one\'s items without saying, reads them from the piece\'s answer');
  ok(/collects the steps/.test(refused(() => pieceFrom({ entry: 'a', steps: [{ id: 'a', kind: 'transform', next: ['m'] }, { id: 'm', kind: 'merge' }] }, ['a'], { id: 'p' }))), 'a Merge after them, which collects by step name, refused');
}

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
