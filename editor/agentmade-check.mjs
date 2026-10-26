/**
 * Not a gate itself: the agent's half that functions-check.mjs and hosted-check.mjs share (P127 BKO-004). The kit's own
 * MCP server, started on the project as an agent's client starts it, makes a cloud function with `create_component`:
 * the catalogue's "who is in this role" example (a Request, an Expression, List Users In Role, an answer and a refusal;
 * signals and values both), at `#__cloud__/List Role Members`. Its name ends in check.mjs so it never ships.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const AGENT_FN = '__cloud__/List Role Members';

/** Resolves to the tool's answer text; throws when the server refuses or does not answer. `deployTo`: a backend id, and
    the agent then deploys it as the write's own note tells it to (the backend group revealed first, `deploy_cloud_functions`). */
export async function makeFunctionAsAgent(project, mcpServer, repo, deployTo = null) {
  const example = JSON.parse(readFileSync(join(repo, 'docs/node-catalog/examples/cloud-who-is-in-this-role.json'), 'utf8')).components[0];
  const mcp = spawn(process.execPath, [mcpServer, project, '--allow-writes'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NODEGX_NO_UPDATE_CHECK: '1' } });
  let buf = '', id = 0;
  const waiting = new Map();
  mcp.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); waiting.get(m.id)?.(m); } catch { /* not a message */ } } });
  const rpc = (method, params) => new Promise((ok, no) => { const n = ++id; const t = setTimeout(() => no(new Error(`${method}: no answer in 30 s`)), 30000); waiting.set(n, (m) => { clearTimeout(t); ok(m); }); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  try {
    await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nodegx-studio-check', version: '0' } });
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const made = await rpc('tools/call', { name: 'create_component', arguments: { path: '#__cloud__/List Role Members', type: 'cloud', nodes: example.nodes, connections: example.connections } });
    const text = made.result?.content?.[0]?.text ?? JSON.stringify(made.error ?? made.result);
    if (made.error || made.result?.isError) throw new Error(`create_component refused: ${text.slice(0, 300)}`);
    if (!deployTo) return text;
    await rpc('tools/call', { name: 'find_tools', arguments: { group: 'backend' } });
    const deployed = await rpc('tools/call', { name: 'deploy_cloud_functions', arguments: { backendId: deployTo } });
    const said = deployed.result?.content?.[0]?.text ?? JSON.stringify(deployed.error ?? deployed.result);
    if (deployed.error || deployed.result?.isError) throw new Error(`deploy_cloud_functions refused: ${said.slice(0, 300)}`);
    return said;
  } finally {
    mcp.kill();
  }
}
