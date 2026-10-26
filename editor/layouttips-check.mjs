/**
 * NodeGX Studio — the layout warnings a person sees under the app, and their fixes (NodeGX P112-OWN020-PILLWRAP /
 * FILLGROW, ruled 2026-10-26: warn and teach, "but make sure it works"). Plain Node, no window.
 *
 *   1. editor/layouttips.mjs on the two warnings as NodeGX's preview hands them over: the first sentence, where it is,
 *      and the edits (the pill's Texts → contentSize, a Text that already has a width left alone; the row → contentHeight)
 *   2. when a NodeGX checkout is beside Studio (NODEGX_REPO, or ../OpenNoodl): CGQ1's two screens written as a project,
 *      NodeGX's own validator says both warnings, the fixes Studio offers are applied by Studio's own `applyEdit`, and
 *      the validator says neither — so the button does what the sentence says
 *   3. studio.html shows them while the app is on screen, and its button applies the tip's edits
 *
 *   node editor/layouttips-check.mjs     PASS n/n and exit 0, or the failing lines and exit 1
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { studioRoot } from '../lib/nodegx.mjs';
import { applyEdit } from './edits.mjs';
import { layoutTips } from './layouttips.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const pct = (value) => ({ unit: '%', value });

/** CGQ1's two screens, as GLM-5.3 wrote them (the parameters that matter). */
const SCREENS = {
  'Pages/Start': [
    { id: 'page', type: 'Page', parameters: {}, children: ['s_shell'] },
    { id: 's_shell', type: 'Group', parent: 'page', parameters: { alignItems: 'center', flexDirection: 'column', width: pct(100) }, children: ['s_title', 's_glass'] },
    { id: 's_title', type: 'Text', parent: 's_shell', parameters: { text: 'Capital quiz' } },
    { id: 's_glass', type: 'Group', label: 'Glass strip', parent: 's_shell', parameters: { flexDirection: 'row', sizeMode: 'contentSize', columnGap: 'var(--space-8)' }, children: ['s_stat_a', 's_stat_b', 's_stat_c'] },
    { id: 's_stat_a', type: 'Text', parent: 's_glass', parameters: { text: '5 questions' } },
    { id: 's_stat_b', type: 'Text', parent: 's_glass', parameters: { text: '10 s each' } },
    // a Text someone gave a width of its own: the fix leaves it as it is
    { id: 's_stat_c', type: 'Text', parent: 's_glass', parameters: { text: '·', width: { unit: 'px', value: 12 } } }
  ],
  'Pages/Quiz': [
    { id: 'page', type: 'Page', parameters: {}, children: ['q_band'] },
    { id: 'q_band', type: 'Group', parent: 'page', parameters: { flexDirection: 'column', minHeight: pct(100) }, children: ['q_shell'] },
    { id: 'q_shell', type: 'Group', parent: 'q_band', parameters: { flexDirection: 'column', rowGap: 'var(--space-5)', width: pct(100) }, children: ['q_meta', 'q_question'] },
    { id: 'q_meta', type: 'Group', label: 'Question meta', parent: 'q_shell', parameters: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: pct(100) }, children: ['q_label', 'q_timer'] },
    { id: 'q_label', type: 'Text', parent: 'q_meta', parameters: { sizeMode: 'contentSize', text: 'Question 1 of 5' } },
    { id: 'q_timer', type: 'Text', parent: 'q_meta', parameters: { sizeMode: 'contentSize', text: '10 s' } },
    { id: 'q_question', type: 'Text', parent: 'q_shell', parameters: { text: 'What is the capital of Australia?' } }
  ]
};
const PILL = 'This row sizes to its content, but 2 of its children (s_stat_a, s_stat_b) have no width of their own, so they take equal shares of the row: the longer one wraps onto a second line although the words would fit. Set each of them to Size: Content (sizeMode "contentSize") so they hug their words.';
const HEADER = 'This row has no height of its own, so whenever the page is shorter than the screen it takes all the spare height of its column: what it holds floats in the middle of a tall empty band, far from the content around it. Set it to Size: Content height (sizeMode "contentHeight") so it is as tall as its words. If it is meant to fill the space, give it a height to say so.';

console.log('1. the tips, from the warnings as the preview hands them over');
const nodesOf = (component) => SCREENS[component.replace(/^\//, '')];
const tips = layoutTips(
  [
    { severity: 'warning', code: 'content-row-splits-its-children', message: PILL, component: '/Pages/Start', nodeId: 's_glass', nodeLabel: 'Glass strip' },
    { severity: 'warning', code: 'row-of-words-fills-its-column', message: HEADER, component: '/Pages/Quiz', nodeId: 'q_meta', nodeLabel: 'Question meta' },
    { severity: 'warning', code: 'oversized-page', message: 'Something else.', component: '/Pages/Quiz', nodeId: 'q_meta' }
  ],
  nodesOf
);
ok(tips.length === 2, 'two tips; a warning that is not about layout is not one', tips.map((t) => t.code));
ok(tips[0]?.text === 'This row sizes to its content, but 2 of its children (s_stat_a, s_stat_b) have no width of their own, so they take equal shares of the row.', 'the pill’s first sentence', tips[0]?.text);
ok(tips[0]?.where === '/Pages/Start · Glass strip', 'and where it is', tips[0]?.where);
ok(JSON.stringify(tips[0]?.edits.map((e) => [e.id, e.name, e.value])) === JSON.stringify([['s_stat_a', 'sizeMode', 'contentSize'], ['s_stat_b', 'sizeMode', 'contentSize']]), 'the pill’s Texts hug their words; the one with a width is left alone', tips[0]?.edits);
ok(JSON.stringify(tips[1]?.edits) === JSON.stringify([{ edit: 'set_parameter', id: 'q_meta', name: 'sizeMode', value: 'contentHeight' }]), 'the header row is as tall as its words', tips[1]?.edits);
ok(layoutTips([{ code: 'row-of-words-fills-its-column', message: HEADER, component: '/Pages/Gone', nodeId: 'q_meta' }], () => undefined).length === 0, 'a warning about a node that is no longer there is not shown');

console.log('2. NodeGX says them, the buttons fix them, NodeGX says nothing');
const repo = [process.env.NODEGX_REPO, resolve(studioRoot, '../OpenNoodl')].find((d) => d && existsSync(join(d, 'scripts/validate-project.ts')));
if (!repo) {
  console.log('  (no NodeGX checkout beside Studio: not run)');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'nodegx-studio-layouttips-'));
  try {
    const components = {};
    for (const [path, nodes] of Object.entries(SCREENS)) {
      components[path] = { path, type: 'page' };
      mkdirSync(join(dir, 'components', path), { recursive: true });
      writeFileSync(join(dir, 'components', path, 'nodes.json'), JSON.stringify({ nodes }));
    }
    writeFileSync(join(dir, 'components/_registry.json'), JSON.stringify({ components }));
    writeFileSync(join(dir, 'nodegx.project.json'), JSON.stringify({ name: 'quiz', settings: { bodyScroll: true } }));
    const validate = () => {
      const run = spawnSync('npx', ['ts-node', '--transpile-only', 'scripts/validate-project.ts', '--json', '--only', 'content-row-splits-its-children,row-of-words-fills-its-column', dir], { cwd: repo, encoding: 'utf8' });
      const report = JSON.parse(run.stdout);
      return report.results[0].diagnostics.map((d) => ({ ...d, ...d.location }));
    };
    const before = validate();
    ok(JSON.stringify(before.map((d) => `${d.code}@${d.nodeId}`).sort()) === JSON.stringify(['content-row-splits-its-children@s_glass', 'row-of-words-fills-its-column@q_meta']), 'NodeGX’s validator says both, on the nodes Richard pointed at', before.map((d) => `${d.code}@${d.nodeId}`));
    const read = (component) => JSON.parse(readFileSync(join(dir, 'components', component.replace(/^\//, ''), 'nodes.json'), 'utf8')).nodes;
    for (const tip of layoutTips(before, read)) {
      const file = join(dir, 'components', tip.component.replace(/^\//, ''), 'nodes.json');
      let files = { nodes: JSON.parse(readFileSync(file, 'utf8')), connections: { connections: [] } };
      for (const edit of tip.edits) files = applyEdit(files, edit).files;
      writeFileSync(file, JSON.stringify(files.nodes));
    }
    const after = validate();
    ok(after.length === 0, 'after Studio’s two buttons, it says neither', after.map((d) => `${d.code}@${d.nodeId}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('3. studio.html shows them with the app on screen');
const page = readFileSync(join(studioRoot, 'editor/studio.html'), 'utf8');
ok(/if \(s\?\.status === 'ok'\) \{ showLayoutTips\(box, s\.report\?\.diagnostics\); return; \}/.test(page), 'a shown app’s report goes to the tips');
ok(/onclick: \(\) => \{ edits\(hit\.key, tip\.edits\);/.test(page), 'and the button applies the tip’s edits');

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
