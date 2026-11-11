/**
 * NodeGX P123-GH-ADMINRATE: a backend on this computer allows 300 admin requests a minute (burst 100), and Studio asks
 * as its admin for everything in Data, Privacy and the Backend tab. Past the limit the backend answers 429 with
 * `Retry-After: <seconds>` and the sentence "Rate limit exceeded for admin requests … Retry in 1s.", and Studio used to
 * hand that sentence to the person with no way on (Deploy to live's drawer, a workflow saved from the Backend tab).
 *
 * This waits the time the backend names and asks again, a few times, for a backend on this computer only and only when
 * the wait is short: a long wait, a refusal from anywhere else, or a request whose body cannot be sent twice comes back
 * as it was, so the person still sees the backend's own words when waiting would not help.
 */

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** A fetch that waits out a local backend's short 429s. `tries` is how many times it asks again. */
export function patientFetch(fetchImpl, { tries = 3, maxWaitSeconds = 10, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  return async function fetchPatiently(input, init) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(input, init);
      if (res.status !== 429 || attempt >= tries) return res;
      let host;
      try {
        host = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url).hostname;
      } catch {
        return res;
      }
      if (!LOOPBACK.has(host)) return res;
      const after = Number(res.headers.get('retry-after'));
      if (!Number.isFinite(after) || after < 0 || after > maxWaitSeconds) return res;
      const body = init?.body;
      if (body != null && typeof body !== 'string' && !(body instanceof Uint8Array)) return res; // a stream is sent once
      if (typeof input !== 'string' && !(input instanceof URL) && input.body) return res; // so is a Request's own body
      await res.arrayBuffer().catch(() => {});
      await sleep(Math.max(after, 1) * 1000);
    }
  };
}
