/**
 * Step mode (STU-033): one card's workflow paused before each step, a teaching aid and not real timing.
 *
 * Nothing in the runtime pauses. A signal crossing a wire reaches its node through one method,
 * `Node.prototype._setPulseFromConnection(port, seq)` (the runtime's node.ts), and the trace has just written that
 * signal down under the same `seq` (outputproperty.ts calls `traceEdgeSend` first). A signal into a component goes on
 * out of its Component Inputs as two values instead, `true` then `false`, through `_setValueFromConnection` (the
 * runtime's componentinstance.ts): a command's "do" is a card's event that way. In the app's frame Studio wraps
 * both: the trace's write says where the signal came from, and a signal that is a step of the card is not handed to
 * its node but held, until the person presses Next. Values keep arriving while a step waits; the node reads them when
 * the signal is let go, so what a step reads is what it held then, which is what step mode shows. That is also why it
 * is not real timing: a value sent after the signal, which the app as it runs would not have given that step, is
 * there by the time the step runs.
 *
 * Which signals are a step is the timeline's rule (./timeline.mjs): the card's event starts a run, and a signal into a
 * node the card reaches, from a node already in the run, is its next step.
 */

/**
 * The rule, with the run it is in. `take(signal)` for each signal on its way to a node: null when it is not this
 * card's, else { step: { n, signal }, run, hold }. `free()`: the rest of this run goes through without a pause
 * (its steps are still counted); the card's next event starts a new run that pauses again.
 *
 * @param {{ node: string, port: string, reach: Set<string> }} card
 */
export function stepRule(card) {
  let run = null;
  return {
    get run() { return run; },
    take(s) {
      const event = s.fromNode === card.node && s.fromPort === card.port;
      // a value is a signal only as the card's event sent through a component's inputs (see installStepper)
      if (s.kind === 'value' && !event) return null;
      if (event) {
        // one event wired to two first steps sends both in the same millisecond: lanes of one run (STU-024)
        if (!run || s.t - run.t >= 1 || run.steps.length > run.firsts) run = { t: s.t, steps: [], nodes: new Set([card.node]), firsts: 0, free: false };
        run.firsts++;
      } else if (!run || !card.reach.has(s.toNode) || !run.nodes.has(s.fromNode)) return null;
      const step = { n: run.steps.length + 1, signal: s };
      run.steps.push(step); run.nodes.add(s.toNode);
      return { step, run, hold: !run.free };
    },
    free() { if (run) run.free = true; }
  };
}

/**
 * Wrap the runtime in the app's frame `w` once; `w.__studioStep` is read on every signal, so arming, disarming and a
 * new card need no second wrap. hooks: { take(signal) → truthy to hold it, held({ signal, release }) }.
 * Returns false when the frame has no runtime yet.
 */
export function installStepper(w, hooks) {
  let ctx;
  try { ctx = w.Noodl.Navigation._noodlRuntime.context; } catch { return false; }
  if (!ctx?.rootComponent) return false;
  w.__studioStep = hooks;
  if (w.__studioStepInstalled) return true;
  let proto = ctx.rootComponent;
  while (proto && !Object.prototype.hasOwnProperty.call(proto, '_setPulseFromConnection')) proto = Object.getPrototypeOf(proto);
  if (!proto) return false;
  const deliver = proto._setPulseFromConnection, deliverValue = proto._setValueFromConnection, write = ctx.traceEdgeSend;
  let last = null;
  const waiting = new Map(); // node id|port → what arrived on a held port, in order, given on release
  ctx.traceEdgeSend = function (fromNode, fromPort, toNode, toPort, value, kind) {
    const seq = write.apply(this, arguments);
    if (seq && (kind === 'signal' || value === true)) last = { seq, t: w.performance.now(), kind, fromNode, fromPort, toNode, toPort };
    return seq;
  };
  const hold = (node, port, seq, send) => {
    const hk = w.__studioStep, s = last;
    if (!hk || !seq || !s || s.seq !== seq || s.toNode !== node.id || s.toPort !== port) return false;
    let take = false;
    try { take = !!hk.take(s); } catch (e) { console.warn('step mode:', e); }
    if (!take) return false;
    const key = `${node.id}|${port}`, sends = [send];
    waiting.set(key, sends);
    let gone = false;
    // let go: the node gets what came in on that port as it would have, and runs on the runtime's next update
    hk.held({ signal: s, release: () => { if (gone) return; gone = true; if (waiting.get(key) === sends) waiting.delete(key); if (!node._deleted) for (const f of sends) f(); } });
    return true;
  };
  proto._setPulseFromConnection = function (port, seq) {
    const node = this, send = () => deliver.call(node, port, seq);
    if (hold(node, port, seq, send)) return;
    return send();
  };
  proto._setValueFromConnection = function (port, value, type, seq) {
    const node = this, send = () => deliverValue.call(node, port, value, type, seq);
    const sends = waiting.get(`${node.id}|${port}`);
    if (sends) { sends.push(send); return; } // the false after a held true, kept behind it
    if (value === true && hold(node, port, seq, send)) return;
    return send();
  };
  w.__studioStepInstalled = true;
  return true;
}
