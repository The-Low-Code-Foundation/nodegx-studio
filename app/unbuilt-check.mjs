/**
 * NodeGX Studio — Publish and an app nobody has built (NodeGX P26-SKELSHIP, ruled 2026-10-26: "a loud warning
 * everywhere but the option to push ahead anyway"). Plain Node, no window, no backend.
 *
 *   1. lib/publish.mjs `unbuiltPagesOf` on project folders as create_project writes them: the placeholder (today's
 *      words and the earlier ones) is unbuilt; one word changed, or one node added, and it is built (known-firing pairs)
 *   2. the endings are NodeGX's own, when a NodeGX checkout is beside Studio (NODEGX_REPO, or ../OpenNoodl)
 *   3. app/main.cjs asks before either route writes anything, and both done windows say the deploy's warnings
 *   4. (P112-OWN023-DEPLOYLOOPBACK, ruled 2026-10-26) a backend on this computer makes "A Server of Your Own" the
 *      default, so the backend goes with the app unless the person picks the folder (which then says why it won't work)
 *
 *   node app/unbuilt-check.mjs     PASS n/n and exit 0, or the failing lines and exit 1
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { studioRoot } from '../lib/nodegx.mjs';
import { isPlaceholderPage, PLACEHOLDER_ENDINGS, unbuiltPagesOf, unbuiltQuestion } from '../lib/publish.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-unbuilt-check-'));

/** A project folder as create_project writes it: App, and Home holding a Page and the placeholder Text. */
function project(name, { text, extra = false, secondPage = false }) {
  const dir = join(tmp, name);
  const components = { App: { path: 'App', type: 'root' }, 'Pages/Home': { path: 'Pages/Home', type: 'page' } };
  const write = (at, nodes) => {
    mkdirSync(join(dir, 'components', at), { recursive: true });
    writeFileSync(join(dir, 'components', at, 'nodes.json'), JSON.stringify({ nodes }));
  };
  write('App', [{ id: 'r', type: 'Router', parameters: {} }]);
  write('Pages/Home', [
    { id: 'p', type: 'Page', parameters: { title: 'Home' }, children: ['t', ...(extra ? ['g'] : [])] },
    { id: 't', type: 'Text', parent: 'p', parameters: { text } },
    ...(extra ? [{ id: 'g', type: 'Group', parent: 'p', parameters: {} }] : [])
  ]);
  if (secondPage) {
    components['Pages/Lessons'] = { path: 'Pages/Lessons', type: 'page' };
    write('Pages/Lessons', [{ id: 'p2', type: 'Page', parameters: {} }, { id: 'x', type: 'Text', parameters: { text: 'Lessons' } }, { id: 'y', type: 'Group', parameters: {} }]);
  }
  writeFileSync(join(dir, 'components/_registry.json'), JSON.stringify({ components }));
  return dir;
}

try {
  console.log('1. which projects are unbuilt');
  const [today, earlier] = PLACEHOLDER_ENDINGS;
  ok(JSON.stringify(unbuiltPagesOf(project('today', { text: `Lingo${today}` }))) === '["Pages/Home"]', 'today’s placeholder: unbuilt, Pages/Home named');
  ok(JSON.stringify(unbuiltPagesOf(project('earlier', { text: `Lingo${earlier}` }))) === '["Pages/Home"]', 'the earlier placeholder (to the agent): unbuilt too');
  ok(unbuiltPagesOf(project('worded', { text: 'Welcome to Lingo' })).length === 0, 'the words changed: built');
  ok(unbuiltPagesOf(project('added', { text: `Lingo${today}`, extra: true })).length === 0, 'a node added beside the placeholder: built');
  ok(unbuiltPagesOf(project('second', { text: `Lingo${today}`, secondPage: true })).length === 0, 'a second, built page: built');
  ok(unbuiltPagesOf(join(tmp, 'no-such-project')).length === 0, 'a folder with no registry: nothing said');
  ok(isPlaceholderPage([{ type: 'Page' }, { type: 'Text', parameters: { text: `Lingo${today}` } }]), 'the page reading, on its own');
  ok(/^Pages\/Home is still the placeholder page/.test(unbuiltQuestion(['Pages/Home'])) && /Publish it anyway/.test(unbuiltQuestion(['Pages/Home'])), 'the question names the page and the way on', unbuiltQuestion(['Pages/Home']));

  console.log('2. the endings are NodeGX’s');
  const repo = [process.env.NODEGX_REPO, resolve(studioRoot, '../OpenNoodl')].find((d) => d && existsSync(join(d, 'packages/noodl-mcp/src/tools/createProject.ts')));
  if (!repo) {
    console.log('  (no NodeGX checkout beside Studio: not compared)');
  } else {
    const writer = readFileSync(join(repo, 'packages/noodl-mcp/src/tools/createProject.ts'), 'utf8');
    const now = /export const SKELETON_PLACEHOLDER_MARKER =\s*'([^']*)'/.exec(writer)?.[1];
    const before = [...(/export const LEGACY_SKELETON_PLACEHOLDER_MARKERS[^=]*=\s*\[([^\]]*)\]/.exec(writer)?.[1] ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1]);
    ok(JSON.stringify([now, ...before]) === JSON.stringify(PLACEHOLDER_ENDINGS), 'create_project writes and reads the same endings', [now, ...before]);
  }

  console.log('3. Publish asks first, and says the warnings after');
  const main = readFileSync(join(studioRoot, 'app/main.cjs'), 'utf8');
  const flow = main.slice(main.indexOf('async function publishFlow('), main.indexOf('/* ---------------------------------------------------------------- STU-071: Publish to a server'));
  const asks = flow.indexOf('pub.unbuiltPagesOf(dir)');
  ok(asks > 0 && asks < flow.indexOf('publishToServerFlow(dir, pub, asked)') && asks < flow.indexOf('pub.publish(dir, out)'), 'the question comes before both routes write anything');
  ok(/buttons: \['Publish Anyway', 'Cancel'\]/.test(flow), 'with a way to go ahead');
  ok(/for \(const warning of result\.warnings \?\? \[\]\) lines\.push/.test(flow), 'the folder’s done window says the warnings');
  const server = main.slice(main.indexOf('async function publishToServerFlow('));
  ok(/for \(const warning of result\.warnings \?\? \[\]\) lines\.push/.test(server.slice(0, server.indexOf('\nfunction menu('))), 'the server’s done window says them too');
  ok(/result\.next\.replace\(AGENT_SAY_WARNINGS, ''\)/.test(server), 'and drops deploy_to_vm’s line to the agent');

  console.log('4. a backend on this computer goes with the app by default');
  ok(/const backendHere = pub\.backendTargetOf\(dir\)\.local;/.test(flow), 'Publish reads whether the backend is here');
  ok(/defaultId: lastServer \|\| backendHere \? 1 : 0,/.test(flow), 'and then defaults to A Server of Your Own');
  ok(flow.indexOf('if (target.local) {') > flow.indexOf("if (where === 1) return publishToServerFlow"), 'the folder route still says a backend here works on this computer only');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
