/**
 * NodeGX Studio — Publish to a server's gate (STU-071, R10). Plain Node, no window and no server: what Studio owns is
 * the question and the call, and the ship itself is NodeGX's `deploy_to_vm`, graded in NodeGX (its unit rows, and its
 * drive against a throwaway VM, P26 DEP-002 s4).
 *
 *   1. the name Studio offers for the app on the server, from the project's own
 *   2. the answers NodeGX would refuse, refused here first in the person's words; what it takes, passed as it takes it
 *   3. the call: `deploy_to_vm` through the MCP server, with exactly those arguments and a timeout a first ship fits in
 *   4. the pinned @nodegx/mcp (0.2.6 carries deploy_to_vm), run for real against a server nobody answers for
 *      (203.0.113.7, TEST-NET-3): its refusal reaches the person as its sentence, never "[object Object]"; a refusal
 *      from the tool comes back in its own words
 *
 *   node app/server-publish-check.mjs     PASS n/n and exit 0, or the failing lines and exit 1
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-server-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // before the kit loads: nothing is written to ~/.noodl
const { createFromTemplate } = await import('./actions.mjs');
const { serverAppName, serverRequest, publishToServer, DEFAULT_SERVER_PORT } = await import('../lib/publish.mjs');
const { kit } = await import('../lib/nodegx.mjs');

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
const refused = async (p) => { try { await p; return ''; } catch (err) { return err.message; } };

try {
  console.log('1. the name offered for the app on the server');
  const { dir } = await createFromTemplate('todo-list', join(tmp, 'My Todo List!'));
  const name = serverAppName(dir);
  ok(/^[a-z][a-z0-9-]{1,30}$/.test(name) && name.includes('todo'), 'from the project’s name, in the form deploy_to_vm takes', name);
  ok(DEFAULT_SERVER_PORT >= 1024 && DEFAULT_SERVER_PORT <= 65535, 'with a port offered beside it', DEFAULT_SERVER_PORT);

  console.log('2. the answers');
  const base = { host: 'root@203.0.113.7', app: 'todos', port: '8720' };
  const problem = (a) => serverRequest(a).problem ?? '';
  ok(/Which server\?/.test(problem({ ...base, host: '' })), 'no server: asked which, with the two forms it takes');
  ok(/not a server/.test(problem({ ...base, host: '-oProxyCommand=x' })) && /not a server/.test(problem({ ...base, host: 'root@a b' })), 'an option or a space for a server: refused, never passed to ssh');
  ok(/short lowercase name/.test(problem({ ...base, app: '9lives' })), 'a name that is not a service name: refused');
  ok(/1024 to 65535/.test(problem({ ...base, port: '80' })), 'a port below 1024: refused');
  ok(/not an address/.test(problem({ ...base, domain: 'example' })), 'an address that is not a host name: refused');
  const tidy = serverRequest({ ...base, app: 'Todos', domain: 'https://Todo.Example.com/', sshKey: '', sshPort: '' });
  ok(JSON.stringify(tidy.args) === JSON.stringify({ host: 'root@203.0.113.7', app: 'todos', port: 8720, domain: 'todo.example.com' }), 'what it takes is passed as deploy_to_vm takes it (https:// and the slash gone, no empty options)', tidy.args);
  const keyed = serverRequest({ ...base, sshKey: '~/.ssh/box', sshPort: '2222' }).args;
  ok(keyed.ssh_key === join(homedir(), '.ssh/box') && keyed.ssh_port === 2222, 'an ssh key (~ expanded: no shell reads it) and port go as ssh_key and ssh_port', keyed);

  console.log('3. the call');
  const calls = [];
  const answer = { ok: true, app: 'todos', host: 'root@203.0.113.7', url: 'https://todo.example.com', build: { files: 41, functions: [], rules: 'project' }, provision: [], secrets: [], health: 200, appStatus: 200, next: '' };
  const got = await publishToServer(dir, { ...base, domain: 'todo.example.com' }, { call: async (...a) => (calls.push(a), answer) });
  ok(calls.length === 1 && calls[0][0] === dir && calls[0][1] === 'deploy_to_vm', 'one call, to deploy_to_vm, for this project', calls.map((c) => c[1]));
  ok(JSON.stringify(calls[0][2]) === JSON.stringify({ host: 'root@203.0.113.7', app: 'todos', port: 8720, domain: 'todo.example.com' }), 'with the answers as arguments', calls[0][2]);
  ok(calls[0][3]?.timeoutMs >= 10 * 60_000, 'given minutes, not seconds (the folder is built here and sent over ssh)', calls[0][3]);
  ok(got === answer, 'and its answer is what Publish says');
  const bad = await refused(publishToServer(dir, { ...base, host: '' }, { call: async () => { throw new Error('called'); } }));
  ok(/Which server\?/.test(bad), 'answers it would refuse never reach NodeGX', bad);

  console.log('4. the MCP server Studio runs, for real, and the tool’s own refusal');
  const said = await refused(publishToServer(dir, base));
  ok(/203\.0\.113\.7/.test(said) && !/object Object|cannot publish to a server yet/.test(said), `the MCP server Studio runs (${kit.from}) has deploy_to_vm, and a server that does not answer is said in its words`, said);
  const own = await refused(publishToServer(dir, base, { call: async () => { throw new Error('root@203.0.113.7 refused the login. This tool cannot type a password…'); } }));
  ok(/refused the login/.test(own), 'a refusal from deploy_to_vm comes back in its own words', own);
} catch (err) {
  ok(false, 'the gate ran to the end', err.stack?.split('\n').slice(0, 3).join(' | '));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
