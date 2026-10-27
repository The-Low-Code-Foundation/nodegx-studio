/**
 * NodeGX Studio — P127 BKO-005: ./automations.mjs with no browser. A trigger's head in a person's words, a schedule's
 * time read and moved (and refused where a cron runs more than once a day), a workflow laid out left to right with its
 * error routes told apart, and a failed run said at the step it failed. The drawing is graded in Chrome by
 * automations-drive.mjs.
 *
 *   node editor/automations-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { agrees, atTime, readAutomations, runLine, scheduleTime, stepsOfRun, stepWires, targetOf, triggerHead, workflowLayout } from './automations.mjs';

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

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
