/**
 * One run of the app, recorded from its first signal to the moment it has finished (Richard, 2026-10-20: Record
 * "primes for ONE click or ONE signal … when all the signals are extinguished … the recording auto stops", and it
 * "can't time out until" a call or a script still working has finished, "so you see the full end to end").
 *
 * Record arms a watch on the app's frame. The first signal that crosses a wire starts the recording; every signal
 * after it moves "the last thing that happened" on. The run is over when nothing has happened for `quiet` ms (a
 * page's Did Mount a moment after a click is still the same run) and nothing it started is still working:
 *
 *   a request     made since the run began and not yet answered (the probe's log, XHR and fetch alike)
 *   a timer       the page's `setTimeout` of at most 10 s, made within 50 ms of a signal of the run or from inside
 *                 such a timer's callback (a script's `await sleep(…)`, a retry), still waiting (the probe's
 *                 `__studioTimers`); a clock that re-arms every minute, or a loop the app had going before the run,
 *                 is not the run's
 *   a Timer node  the runtime's own timers started since the run began, other than one that repeats for ever
 *
 * A timer can hold a run open for 30 s at most (a timer that re-arms itself for ever would otherwise hold it for
 * ever); a request holds it until it is answered. Stop still ends a recording by hand.
 *
 * A long computation in a script blocks the page, and the watch with it: the run ends after it, never during it.
 */

export const QUIET_MS = 1500;
export const TIMER_HOLD_MS = 30000;

/**
 * Is the run over? Pure: what the watch read off the frame in, the verdict and what it is still waiting for out.
 * @param {object} r
 * @param {number} r.now          the frame's clock
 * @param {number} r.t0           when the run began (its first signal)
 * @param {number} r.last         the last signal of the run, or the last answer it got, whichever came later
 * @param {{ t0: number, t1?: number }[]} r.requests  the probe's requests
 * @param {number} r.timers       the run's timers still waiting (page timers and Timer nodes)
 * @param {number} [r.quiet]
 * @returns {{ done: boolean, waiting: string | null }}
 */
export function runOver({ now, t0, last, requests = [], timers = 0, quiet = QUIET_MS }) {
  const open = requests.filter((e) => e.t0 >= t0 && e.t1 === undefined).length;
  if (open) return { done: false, waiting: open === 1 ? 'an answer from the backend' : `${open} answers from the backend` };
  if (timers && now - t0 < TIMER_HOLD_MS) return { done: false, waiting: timers === 1 ? 'a timer' : `${timers} timers` };
  return { done: now - last >= quiet, waiting: null };
}

/** The last thing that happened in the run: its last signal, or the last answer to a request it made. */
export function lastActivity(t0, lastSignal, requests = []) {
  let last = lastSignal;
  for (const e of requests) if (e.t0 >= t0 && e.t1 !== undefined && e.t1 > last) last = e.t1;
  return last;
}

/**
 * Watch the signals in the app's frame `w`: `onSignal(t)` for every signal crossing a wire, on the frame's clock.
 * Wraps the context's `traceEdgeSend` once (the trace writes every edge there, the in-page preview arms it at boot);
 * `w.__studioWatch` is read on every signal, so a new watch needs no second wrap. The time of the last signal is put
 * where the probe can read it (`__studioLastSignal`), so a timer made right after one is known to be the run's.
 * Returns false when the frame has no runtime yet.
 */
export function watchSignals(w, onSignal) {
  let ctx;
  try { ctx = w.Noodl.Navigation._noodlRuntime.context; } catch { return false; }
  if (!ctx?.rootComponent) return false;
  w.__studioWatch = onSignal;
  if (w.__studioWatched === ctx) return true;
  const write = ctx.traceEdgeSend;
  ctx.traceEdgeSend = function (fromNode, fromPort, toNode, toPort, value, kind) {
    const seq = write.apply(this, arguments);
    if (kind === 'signal') {
      const t = w.performance.now();
      w.__studioLastSignal = t;
      try { w.__studioWatch?.(t); } catch (e) { console.warn('run watch:', e); }
    }
    return seq;
  };
  w.__studioWatched = ctx;
  return true;
}

/** The runtime's Timer-node timers, as a set to tell the ones a run started from the ones already going. */
export function runtimeTimers(w) {
  try {
    const s = w.Noodl.Navigation._noodlRuntime.context.timerScheduler;
    return new Set([...(s.runningTimers || []), ...(s.newTimers || [])]);
  } catch { return new Set(); }
}

/** The run's timers still waiting: the probe's page timers it counts, and Timer-node timers started since `before`. */
export function runTimers(w, t0, before) {
  let n = 0;
  try { for (const x of w.__studioTimers.pending.values()) if (x.run && x.t >= t0) n++; } catch { /* no probe */ }
  for (const timer of runtimeTimers(w)) if (!before.has(timer) && timer.repeatCount < 100000) n++;
  return n;
}
