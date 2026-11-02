/**
 * NodeGX Studio — P127 BKO-005: ./automations.mjs with no browser. A trigger's head in a person's words, a schedule's
 * time read and moved (and refused where a cron runs more than once a day), a workflow laid out left to right with its
 * error routes told apart, and a failed run said at the step it failed. The drawing is graded in Chrome by
 * automations-drive.mjs.
 *
 *   node editor/automations-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { ALWAYS_WORDS, addStepAfter, agrees, atTime, canMove, deleteStep, insertBetween, moveStep, nextOntoRoute, stepPorts, newStepId, readAutomations, runLine, scheduleTime, stepsOfRun, stepWires, targetOf, triggerHead, valueForm, workflowLayout } from './automations.mjs';

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

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
