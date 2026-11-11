/**
 * check:patientfetch — lib/patient-fetch.mjs (NodeGX P123-GH-ADMINRATE) against a real HTTP server on 127.0.0.1 that
 * answers 429 with Retry-After the way a NodeGX backend does past its admin limit.
 */
import http from 'node:http';
import { patientFetch } from './patient-fetch.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); };

let refusals = 0, retryAfter = '1', seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    seen.push(body);
    if (refusals > 0) {
      refusals--;
      res.writeHead(429, { 'Retry-After': retryAfter, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Rate limit exceeded for admin requests (300/min, burst 100). Retry in ${retryAfter}s.` }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, body }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/admin/roles`;
const waits = [];
const f = patientFetch(fetch, { sleep: async (ms) => { waits.push(ms); } });

console.log('check: a local backend past its admin limit');
refusals = 2; seen = []; waits.length = 0;
let r = await f(url, { method: 'POST', body: '{"name":"editors"}', headers: { 'content-type': 'application/json' } });
ok(r.status === 200, 'two 429s, then the answer: the caller sees the answer', r.status);
ok(seen.length === 3 && seen.every((b) => b === '{"name":"editors"}'), 'the same body each time', seen);
ok(waits.join() === '1000,1000', 'waits the Retry-After the backend named, each time', waits);

refusals = 9; seen = []; waits.length = 0;
r = await f(url);
ok(r.status === 429 && seen.length === 4, 'still refused after three more tries: the backend\'s own 429 comes back', { status: r.status, asked: seen.length });
ok(/Rate limit exceeded/.test((await r.json()).error), 'with its words intact');

refusals = 1; retryAfter = '60'; seen = []; waits.length = 0;
r = await f(url);
ok(r.status === 429 && seen.length === 1 && waits.length === 0, 'a wait longer than 10 s is not taken: the refusal comes back at once', { status: r.status, waits });
retryAfter = '1';

refusals = 1; seen = []; waits.length = 0;
r = await patientFetch(fetch, { sleep: async () => {} })(url.replace('127.0.0.1', 'localhost'));
ok(r.status === 200 && seen.length === 2, 'localhost counts as this computer', { status: r.status, asked: seen.length });

const off = patientFetch(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }), { sleep: async (ms) => { waits.push(ms); } });
waits.length = 0;
r = await off('https://api.cloudflare.com/client/v4/accounts');
ok(r.status === 429 && waits.length === 0, 'a 429 from anywhere else is not waited out', waits);

refusals = 0;
r = await f(url);
ok(r.status === 200 && waits.length === 0, 'an answer the first time is not delayed');

server.close();
const pass = results.every(Boolean);
console.log(`${pass ? 'PASS' : 'FAIL'} ${results.filter(Boolean).length}/${results.length}`);
process.exit(pass ? 0 : 1);
