#!/usr/bin/env node
/**
 * `npx @nodegx/studio [folder] [--port n] [--no-open]` — NodeGX Studio on a project folder, in your browser.
 *
 * Starts the same server the agent's `open_studio` starts (`editor/serve.mjs <folder> --port <n>`, CCN-006 AC7), on
 * this Node, and opens its address once it is up. The folder is the one named, or the one you are in; a NodeGX project
 * is a folder holding `nodegx.project.json`. Ctrl+C stops Studio and the backend it started.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npx @nodegx/studio [folder] [--port n] [--no-open]\n\nOpens NodeGX Studio on a NodeGX project folder (one holding nodegx.project.json) in your browser.');
  process.exit(0);
}
const portAt = args.indexOf('--port');
const port = portAt >= 0 ? args[portAt + 1] : '0';
const folder = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') ?? '.');
if (!existsSync(join(folder, 'nodegx.project.json'))) {
  console.error(`nodegx-studio: ${folder} is not a NodeGX project (it has no nodegx.project.json).\nName a project folder, or make one with: npm create nodegx`);
  process.exit(2);
}
const serve = join(dirname(fileURLToPath(import.meta.url)), '..', 'editor', 'serve.mjs');
const child = spawn(process.execPath, [serve, folder, '--port', port], { stdio: ['inherit', 'pipe', 'inherit'] });
let opened = false, out = '';
child.stdout.on('data', (d) => {
  process.stdout.write(d);
  if (opened) return;
  out += d;
  const m = /nodegx-studio: (http:\/\/127\.0\.0\.1:\d+\/)/.exec(out);
  if (!m) return;
  opened = true;
  if (args.includes('--no-open')) return;
  const [cmd, cmdArgs] = process.platform === 'darwin' ? ['open', [m[1]]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', m[1]]] : ['xdg-open', [m[1]]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => console.log(`Open ${m[1]} in your browser.`)).unref();
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
