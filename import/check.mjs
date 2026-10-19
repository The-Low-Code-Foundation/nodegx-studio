#!/usr/bin/env node
// check.mjs — the Bubble importer's gate (s6). Converts the fixtures committed in this folder (the Bubble editor's
// requests: backend workflows, option sets, data types with privacy rules) and, when `exports/template/` holds a
// run-mode bundle (gitignored; IMPORT.md §7 says how to fetch it), Richard's template too. Asserts what each session
// paid for: P123-S5-NOHOME (rootNodeId), P123-S5B-DISABLEDSTEP (no Log In in someApiWorkflow), §10 (four cloud
// components, two triggers), §12 (three collections), s6 (nodegx.security.json valid, the rules derived). Prints
// PASS n/n or FAIL and exits 1. The backend's own validator is used when packages/nodegx-backend/dist is built, and
// validate_project through the MCP when packages/noodl-mcp/dist is; each is skipped by name when it is not.
//   node import/check.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { nodegxRepo } from '../lib/nodegx.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = nodegxRepo;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-check-'));
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ' — ' + detail : ''}`); return !!ok; };
const skip = (name, why) => console.log(`skip ${name} — ${why}`);
const run = (args, timeoutMs = 300000) => spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1 << 28, timeout: timeoutMs });
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);
const require = createRequire(import.meta.url);
const backendDist = path.join(repo, 'packages/nodegx-backend/dist/index.js');
const validateSecurity = exists(backendDist) ? require(backendDist).validateSecurityConfig : null;
const mcpBuilt = exists(path.join(repo, 'packages/noodl-mcp/dist/noodl-mcp.cjs'));

function convert(name, inDir) {
  const out = path.join(tmp, name); const exp = path.join(out, 'app.export.json'); const project = path.join(out, 'project');
  const b = run([path.join(here, 'bundles-to-export.mjs'), inDir, exp]);
  if (!check(`${name}: the bundler exits 0`, b.status === 0, (b.stderr || b.stdout).slice(-400))) return null;
  const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, project]);
  if (!check(`${name}: the converter exits 0`, c.status === 0, (c.stderr || c.stdout).slice(-600))) return null;
  return { project, report: fs.readFileSync(path.join(project, 'docs', 'IMPORT-REPORT.md'), 'utf8'), out: c.stdout };
}
function validateProject(name, project) {
  if (!mcpBuilt) return skip(`${name}: validate_project`, 'packages/noodl-mcp/dist is not built');
  const v = run([path.join(here, 'validate-project.mjs'), project], 240000);
  const m = /summary: (\{.*\})/.exec(v.stdout || '');
  const summary = m ? JSON.parse(m[1]) : null;
  check(`${name}: validate_project reports 0 errors`, summary && summary.errors === 0, summary ? JSON.stringify(summary) : (v.stderr || v.stdout || '').slice(-400));
}
const countBy = (text, re) => (text.match(re) || []).length;

// ---------------------------------------------------------------- 1. the editor requests alone (committed fixtures)
{
  const inDir = path.join(tmp, 'editor-in'); fs.mkdirSync(inDir);
  for (const f of ['backend-workflows/example-c5r6j filled.json', 'option-sets/example-dxr78ubfdtfq6tbmec.json', 'database-schema/example-privacy-rule-entpawjzehwq0tbk.json']) fs.copyFileSync(path.join(here, f), path.join(inDir, path.basename(f)));
  const r = convert('editor requests', inDir);
  if (r) {
    const { project, report } = r;
    const pj = readJson(path.join(project, 'nodegx.project.json'));
    check('P123-S5-NOHOME: nodegx.project.json names rootNodeId app_root', pj.rootNodeId === 'app_root', JSON.stringify(pj.rootNodeId));
    check('§12: three collections declared (_User, someDataType, someOtherDataType)', JSON.stringify((pj.metadata?.dbCollections || []).map((c) => c.name).sort()) === JSON.stringify(['_User', 'someDataType', 'someOtherDataType']), JSON.stringify((pj.metadata?.dbCollections || []).map((c) => c.name)));
    const cloudDir = path.join(project, 'components', '__cloud__');
    const cloudComponents = exists(cloudDir) ? fs.readdirSync(cloudDir, { recursive: true }).filter((f) => f.endsWith('component.json')).length : 0;
    check('§10: four cloud components (three functions and one shared custom event)', cloudComponents === 4, String(cloudComponents));
    const api = path.join(cloudDir, 'someApiWorkflow', 'nodes.json');
    check('P123-S5B-DISABLEDSTEP: the disabled Log In step of someApiWorkflow is not converted', exists(api) && !fs.readFileSync(api, 'utf8').includes('net.noodl.user.LogIn'));
    const trig = path.join(project, 'backend', 'triggers.imported.json');
    const t = exists(trig) ? readJson(trig) : null;
    check('§10: a db-change and a schedule trigger are written', t && t.triggers.map((x) => x.type).sort().join(',') === 'db-change,schedule', t && JSON.stringify(t.triggers.map((x) => x.type)));
    // s6: nodegx.security.json
    const secPath = path.join(project, 'nodegx.security.json');
    const sec = exists(secPath) ? readJson(secPath) : null;
    check('s6: nodegx.security.json is written', !!sec);
    if (sec) {
      if (validateSecurity) { const errs = validateSecurity(sec); check("s6: the backend's validateSecurityConfig accepts it", errs.length === 0, errs.join('; ')); } else skip('s6: validateSecurityConfig', 'packages/nodegx-backend/dist is not built');
      check('s6: no system collection carries rules', !Object.keys(sec.collections).some((k) => k.startsWith('_')), Object.keys(sec.collections).join(','));
      const sd = sec.collections.someDataType;
      check('s6: someDataType reads public ("everyone" views and finds), writes nobody (no page writes it)', sd && sd.permissions.find === 'public' && sd.permissions.get === 'public' && sd.permissions.create === 'nobody' && sd.permissions.update === 'nobody' && sd.permissions.delete === 'nobody' && sd.creatorOwns === false, JSON.stringify(sd));
      check('s6: the API workflow is callable signed-in and runs as system (it writes)', sec.functions.someApiWorkflow?.call === 'authenticated' && sec.functions.someApiWorkflow?.runAs === 'system', JSON.stringify(sec.functions.someApiWorkflow));
      check('s6: the db-change trigger\'s function is callable by nobody and runs as system', sec.functions.someThingIsModified?.call === 'nobody' && sec.functions.someThingIsModified?.runAs === 'system', JSON.stringify(sec.functions.someThingIsModified));
      check('s6: the recurring event\'s function is callable by nobody', sec.functions.recurringEvent1?.call === 'nobody', JSON.stringify(sec.functions.recurringEvent1));
      check('s6: signup is public (the backend workflow signs a user up)', sec.signup === 'public', sec.signup);
      check('s6: devOpen is false and the defaults are nobody', sec.devOpen === false && Object.values(sec.defaults.permissions).every((v) => v === 'nobody'));
    }
    check('s6: the report has the Security section with the three User rules read', report.includes('## Security — nodegx.security.json') && report.includes("| User | User's own data |") && report.includes('| User | somePrivacyRule |'));
    check("s6: the report says the User rules have no place in the file (fixed posture)", report.includes('_User is a system collection with a fixed posture'));
    check('s6: the old "privacy rules are not converted" finding is gone', !report.includes('are not converted; nodegx.security.json needs'));
    check('s6: a write to a type the schema lacks is listed, not dropped', report.includes('is not one of the app\'s data types'));
    validateProject('editor requests', project);
  }
}

// ---------------------------------------------------------------- 1b. P123-S6-THINGTYPE: a page added to the editor fixtures, whose steps change
// "Parent group's item" (a row of someDataType, a Group of someOtherDataType) and "Result of step 1", with no explicit type
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    synth.pages = { tpage: { type: 'Page', id: 'tpage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      grp: { id: 'grp', type: 'Group', name: 'Group other', properties: { group_type: 'custom.someotherdatatype', container_layout: 'column' }, elements: {
        rg1: { id: 'rg1', type: 'RepeatingGroup', name: 'RG rows', properties: { group_type: 'custom.somedatatype', container_layout: 'column' }, elements: {
          b1: { id: 'b1', type: 'Button', name: 'Button edit', properties: {} } } },
        b2: { id: 'b2', type: 'Button', name: 'Button delete other', properties: {} } } } },
      workflows: {
        w1: { id: 'w1', type: 'ButtonClicked', properties: { element_id: 'b1' }, actions: {
          0: { id: 'a1', type: 'ChangeThing', properties: { thing_to_change: { type: 'ElementParent' }, changes: {} } },
          1: { id: 'a2', type: 'ChangeThing', properties: { thing_to_change: { type: 'PreviousStep', properties: { action_id: 'a1' } }, changes: {} } } } },
        w2: { id: 'w2', type: 'ButtonClicked', properties: { element_id: 'b2' }, actions: {
          0: { id: 'a3', type: 'DeleteThing', properties: { thing_to_delete: { type: 'ElementParent' } } } } } } } };
    const out = path.join(tmp, 'synth'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('P123-S6-THINGTYPE: the synthetic page converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const nodes = fs.readdirSync(path.join(out, 'project', 'components'), { recursive: true }).filter((f) => f.endsWith('nodes.json') && !f.includes('__cloud__')).map((f) => fs.readFileSync(path.join(out, 'project', 'components', f), 'utf8')).join('\n'); // the page and its row only: the backend fixture writes a deleted type, "thing", on purpose
      check('P123-S6-THINGTYPE: "Parent group\'s item" in a row is the row\'s type, and "Result of step 1" the same', countBy(nodes, /"collectionName": "someDataType"/g) === 2, `someDataType named ${countBy(nodes, /"collectionName": "someDataType"/g)} times`);
      check('P123-S6-THINGTYPE: no page step writes to "Message" or "thing" (the expression\'s node kind)', !/"collectionName": "(Message|thing)"/.test(nodes));
      const sec = readJson(path.join(out, 'project', 'nodegx.security.json'));
      check('s6: a page write with no condition is the floor "public" on that op (someDataType update, someOtherDataType delete)', sec.collections.someDataType.permissions.update === 'public' && sec.collections.someOtherDataType.permissions.delete === 'public' && sec.collections.someDataType.permissions.delete === 'nobody', JSON.stringify([sec.collections.someDataType.permissions, sec.collections.someOtherDataType.permissions]));
      const report = fs.readFileSync(path.join(out, 'project', 'docs', 'IMPORT-REPORT.md'), 'utf8');
      check('s6: the writes table lists the delete of a someOtherDataType from the page', /\| someOtherDataType \| delete \| the page \|/.test(report));
    }
  }
}

// ---------------------------------------------------------------- 1c. STU-013: repeated searches on a page are one page data item
// Three Texts ask "someDataType where name is a" (one of them beside "… is b"), two ask "… where owner is Current User".
// On a second page, three Texts ask "… where owner is Parent group's thing": two in one group, one in another.
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const q = (constraints) => ({ type: 'Search', properties: { thing_type: 'custom.somedatatype', constraints }, next: { type: 'Message', name: 'count' } });
    const byName = (v) => q({ 0: { key: 'name_text', constraint_type: 'equals', value: v } });
    const mine = () => q({ 0: { key: 'owner_user', constraint_type: 'equals', value: { type: 'CurrentUser' } } });
    const text = (...entries) => ({ type: 'TextExpression', entries: Object.fromEntries(entries.map((e, i) => [i, e])) });
    const t = (id, value) => ({ id, type: 'Text', name: `Text ${id}`, properties: { text: value } });
    synth.pages = { spage: { type: 'Page', id: 'spage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      t1: t('t1', text(byName('a'))), t2: t('t2', text('a: ', byName('a'))), t3: t('t3', text(byName('a'), ' / ', byName('b'))),
      t4: t('t4', text(mine())), t5: t('t5', text(mine())),
      t9: { id: 't9', type: 'Text', name: 'Text t9', properties: { text: 'Hi', background_style: 'bgcolor', bgcolor: '#ffffff', font_color: '#000000' }, states: { 0: { condition: { type: 'CurrentUser', next: { type: 'Message', name: 'logged_in' } }, properties: { font_color: '#ff0000' } } } } } },
      gpage: { type: 'Page', id: 'gpage', name: 'groups', properties: { new_responsive: true, container_layout: 'column' }, elements: Object.fromEntries(['g1', 'g2'].map((gid) => [gid, { id: gid, type: 'Group', name: `Group ${gid}`, properties: { container_layout: 'column', data_source: { type: 'CurrentUser' } },
        elements: Object.fromEntries((gid === 'g1' ? ['t6', 't7'] : ['t8']).map((id) => [id, t(id, text(q({ 0: { key: 'owner_user', constraint_type: 'equals', value: { type: 'ElementParent' } } })))])) }])) } };
    const out = path.join(tmp, 'stu013'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-013: the page with repeated searches converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const { readItems } = await import('../editor/pagedata.mjs');
      const dir = path.join(out, 'project', 'components', 'Pages', 'index');
      const nodes = readJson(path.join(dir, 'nodes.json')).nodes, conns = readJson(path.join(dir, 'connections.json')).connections;
      const queries = nodes.filter((n) => n.type === 'DbCollection2');
      check('STU-013: six searches on the page are three queries', queries.length === 3, `${queries.length} queries`);
      const items = readItems(nodes, conns);
      check('STU-013: each query is a page data item Studio reads back', items.length === 3 && items.every((i) => i.collection === 'someDataType' && !i.unsupported), JSON.stringify(items));
      const a = items.find((i) => i.where.some((w) => w.value === 'a')), b = items.find((i) => i.where.some((w) => w.value === 'b')), u = items.find((i) => i.where.some((w) => w.from));
      check('STU-013: "name is a" is an equalTo on name, typed in', a && a.where.length === 1 && a.where[0].field === 'name' && a.where[0].op === 'equalTo', JSON.stringify(a));
      const readsOf = (item) => item ? conns.filter((w) => w.fromId === item.id && nodes.find((n) => n.id === w.toId)?.type === 'Expression').length : 0;
      check('STU-013: the three Texts that ask "name is a" read the one item', readsOf(a) === 3, `${readsOf(a)} readers`);
      check('STU-013: "name is b" is its own item, read once', b && b.id !== a?.id && readsOf(b) === 1, JSON.stringify(b));
      check('STU-013: "owner is Current User" is one item whose value is wired from the page, read twice', u && u.where[0].from && u.where[0].port === 'qp-owner' && readsOf(u) === 2, JSON.stringify(u));
      check('STU-013: nothing wires an item\'s Do: it runs on open and again on change (runOnChange)', !conns.some((w) => queries.some((qq) => qq.id === w.toId) && w.toProperty === 'fetch') && queries.every((qq) => qq.parameters['runOnChange-collectionName'] === true && qq.parameters['runOnChange-querySettings'] === true) && queries.find((qq) => qq.id === u?.id)?.parameters['runOnChange-qp-owner'] === true);
      const report = fs.readFileSync(path.join(out, 'project', 'docs', 'IMPORT-REPORT.md'), 'utf8');
      const colourTo = conns.filter((w) => w.toProperty === 'color').map((w) => nodes.find((n) => n.id === w.toId));
      check('STU-013-GROUPCOLOR: a boxed Text\'s conditional font colour is wired to the Text inside the box, not the Group', colourTo.length === 1 && colourTo[0]?.type === 'Text', JSON.stringify(colourTo.map((n) => n && [n.type, n.label])));
      const gdir = path.join(out, 'project', 'components', 'Pages', 'groups');
      const gnodes = readJson(path.join(gdir, 'nodes.json')).nodes, gconns = readJson(path.join(gdir, 'connections.json')).connections;
      const gitems = readItems(gnodes, gconns);
      const fed = (item) => gconns.find((w) => w.toId === item.id && w.toProperty === item.where[0]?.port);
      const feeder = (item) => gnodes.find((n) => n.id === fed(item)?.fromId);
      check('STU-013: "owner is Parent group\'s thing" is one item per group, not one per Text (2 items for 3 Texts)', gitems.length === 2, `${gitems.length} items`);
      check('STU-013: each of those items takes its value from its own group\'s data', gitems.length === 2 && gitems.every((i) => fed(i)) && new Set(gitems.map((i) => (gconns.find((w) => w.toId === feeder(i)?.id) || {}).fromId)).size === 2, JSON.stringify(gitems.map((i) => [i.id, feeder(i)?.label])));
      check('STU-013: the report says nine searches became five queries', report.includes('| searches → page data | 9 | 5 queries (4 repeated searches read the query already there) |'), (/\| searches → [^\n]*/.exec(report) || ['no row'])[0]);
    }
  }
}

// ---------------------------------------------------------------- 1d. STU-013-NAVLOOP: a workflow's conditions test when it runs, never on a change
// NodeGX re-tests a Condition whenever its value changes, Evaluate wired or not (NDA-017): a click's "Only when Current
// User is logged out → Go to page" fired as the page opened, and the real app bounced between two pages ~8 times a second.
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const user = (name) => ({ type: 'CurrentUser', next: { type: 'Message', name } });
    synth.pages = { npage: { type: 'Page', id: 'npage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      b1: { id: 'b1', type: 'Button', name: 'Button go', properties: {} } },
      workflows: {
        w1: { id: 'w1', type: 'ButtonClicked', properties: { element_id: 'b1', condition: user('not_logged_in') }, actions: {
          0: { id: 'a1', type: 'ChangePage', properties: { element_id: 'opage', condition: user('logged_in') } } } },
        w2: { id: 'w2', type: 'ConditionTrue', properties: { condition: user('logged_in'), run_when: 'every_time' }, actions: {
          0: { id: 'a2', type: 'ChangePage', properties: { element_id: 'opage' } } } } } },
      opage: { type: 'Page', id: 'opage', name: 'other', properties: { new_responsive: true, container_layout: 'column' }, elements: {} } };
    const out = path.join(tmp, 'navloop'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-013-NAVLOOP: the page with gated workflows converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const dir = path.join(out, 'project', 'components', 'Pages', 'index');
      const nodes = readJson(path.join(dir, 'nodes.json')).nodes, conns = readJson(path.join(dir, 'connections.json')).connections;
      const conds = nodes.filter((n) => n.type === 'Condition');
      // four: a Do when workflow also gets an Only when from the same condition (the importer reads `properties.condition` for both)
      check('STU-013-NAVLOOP: the workflow\'s Only when, the step\'s Only when and the Do when (with its own Only when) are four Conditions, each run by a wire into Evaluate', conds.length === 4 && conds.every((n) => conns.some((w) => w.toId === n.id && w.toProperty === 'eval')), JSON.stringify(conds.map((n) => n.label)));
      check('STU-013-NAVLOOP: none of them re-tests when its value changes (runOnChange-condition false)', conds.length === 4 && conds.every((n) => n.parameters?.['runOnChange-condition'] === false), JSON.stringify(conds.map((n) => [n.label, n.parameters])));
    }
  }
}

// ---------------------------------------------------------------- 1e. STU-014 (R8): a reusable's search asks while that copy is shown; a copy's
// shown / hidden reaches its reusable; a visibility condition that restates the default changes nothing
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const user = (name) => ({ type: 'CurrentUser', next: { type: 'Message', name } });
    const search = { type: 'Search', properties: { thing_type: 'custom.somedatatype', constraints: {} }, next: { type: 'Message', name: 'count' } };
    synth.custom_elements = { ...(synth.custom_elements || {}), ce1: { id: 'ce1', type: 'CustomDefinition', name: 'Panel', properties: { element_type: 'Group', container_layout: 'column' }, elements: {
      pt: { id: 'pt', type: 'Text', name: 'Text count', properties: { text: { type: 'TextExpression', entries: { 0: search } } } } } } };
    const copy = (id, extra = {}) => ({ id, type: 'CustomElement', name: `Panel ${id}`, properties: { custom_id: 'ce1', ...extra.properties }, ...(extra.states ? { states: extra.states } : {}) });
    const grp = (id, props, states) => ({ id, type: 'Group', name: `Group ${id}`, properties: { container_layout: 'column', ...props }, states, elements: {} });
    synth.pages = { rpage: { type: 'Page', id: 'rpage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      c1: copy('c1'),
      c2: copy('c2', { properties: { is_visible: false }, states: { 0: { condition: user('logged_in'), properties: { is_visible: true } } } }),
      c3: copy('c3', { states: { 0: { condition: user('logged_in'), properties: { margin_left: 30 } } } }),
      g1: grp('g1', { is_visible: false }, { 0: { condition: user('logged_in'), properties: { is_visible: false } } }),
      g2: grp('g2', {}, { 0: { condition: user('logged_in'), properties: { is_visible: true } } }),
      g3: grp('g3', { is_visible: false }, { 0: { condition: user('logged_in'), properties: { is_visible: true } } }),
      pt2: { id: 'pt2', type: 'Text', name: 'Text page count', properties: { text: { type: 'TextExpression', entries: { 0: search } } } } } } };
    const out = path.join(tmp, 'stu014'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-014: the page with three copies of a reusable converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const { readItems } = await import('../editor/pagedata.mjs');
      const load = (rel) => { const d = path.join(out, 'project', 'components', rel); return { nodes: readJson(path.join(d, 'nodes.json')).nodes, conns: readJson(path.join(d, 'connections.json')).connections }; };
      const r = load('Reusable/Panel'), pg = load('Pages/index');
      const has = (g, from, fp, to, tp) => g.conns.some((w) => w.fromId === from && w.fromProperty === fp && w.toId === to && w.toProperty === tp);
      const [ri] = readItems(r.nodes, r.conns), [pi] = readItems(pg.nodes, pg.conns);
      const rq = r.nodes.find((n) => n.id === ri?.id);
      check('STU-014: the reusable\'s search is an item that asks while shown, its query never running by itself', ri?.whenShown && Object.entries(rq.parameters).filter(([k]) => k.startsWith('runOnChange-')).every(([, v]) => v === false), JSON.stringify(rq?.parameters));
      check('STU-014: its Switch follows the reusable\'s top element, and the ask fires the query', has(r, 'root_ce1', 'didMount', ri?.shownId, 'on') && has(r, 'root_ce1', 'willUnmount', ri?.shownId, 'off') && has(r, ri?.askId, 'isTrueEv', ri?.id, 'storageFetch'), JSON.stringify(ri));
      check('STU-014: the same search on the page is an ordinary page data item (loads with the page)', pi && !pi.whenShown, JSON.stringify(pi));
      const ins = r.nodes.find((n) => n.type === 'Component Inputs' && n.id === 'copy_ce1');
      check('STU-014-INSTANCEHIDE: the reusable takes mounted and visible from its copy and passes them to its top element', ins && has(r, ins.id, 'mounted', 'root_ce1', 'mounted') && has(r, ins.id, 'visible', 'root_ce1', 'visible'), JSON.stringify(ins?.ports));
      check('STU-014-INSTANCEHIDE: the hidden copy\'s condition reaches it (a wire into its mounted, which the reusable declares)', pg.conns.some((w) => w.toId === 'el_c2' && w.toProperty === 'mounted'));
      check('STU-014-INSTANCEHIDE: a copy\'s conditional margin is declared on the reusable and passed to its top element', ins?.ports.some((q) => q.name === 'marginLeft') && has(r, ins.id, 'marginLeft', 'root_ce1', 'marginLeft') && pg.conns.some((w) => w.toId === 'el_c3' && w.toProperty === 'marginLeft'), JSON.stringify(ins?.ports));
      const visWired = (id) => pg.conns.some((w) => w.toId === id && (w.toProperty === 'mounted' || w.toProperty === 'visible'));
      check('STU-014-VISDEFAULT: "hidden when X" on a group hidden on load, and "shown when X" on one shown, change nothing (no wire); "shown when X" on a hidden one is wired', !visWired('el_g1') && !visWired('el_g2') && visWired('el_g3') && pg.nodes.find((n) => n.id === 'el_g1')?.parameters.mounted === false, JSON.stringify(['el_g1', 'el_g2', 'el_g3'].map((id) => [id, visWired(id)])));
      validateProject('STU-014 fixture', path.join(out, 'project'));
    }
  }
}

// ---------------------------------------------------------------- 2. the template's run-mode bundle (gitignored; optional)
{
  const tplDir = path.join(here, 'exports', 'template');
  const bundles = exists(tplDir) ? fs.readdirSync(tplDir).filter((f) => f.endsWith('dynamic.js')) : [];
  if (!bundles.length) skip('template bundle', 'import/exports/template has no *.dynamic.js (IMPORT.md §7 says how to fetch it)');
  else {
    const r = convert('template', tplDir);
    if (r) {
      const { project, report } = r;
      const m = /\| elements \| (\d+) \| (\d+) /.exec(report);
      check('§9: every element of the template is mapped', m && m[1] === m[2] && Number(m[1]) > 0, m ? `${m[2]}/${m[1]}` : 'no elements row');
      const pj = readJson(path.join(project, 'nodegx.project.json'));
      check('§9: the Google Fonts link is in settings.headCode', String(pj.settings?.headCode || '').includes('fonts.googleapis.com/css2'));
      const sec = readJson(path.join(project, 'nodegx.security.json'));
      if (validateSecurity) check("s6: the template's nodegx.security.json validates", validateSecurity(sec).length === 0, validateSecurity(sec).join('; '));
      validateProject('template', project);
      // STU-050: the same structure ≥3 times, ≥5 elements → one reusable, a copy in each place (the look, element by element,
      // was measured the same as an ungrouped conversion: 227 elements, same text, place, size, colour; SCOPE.md)
      const idx = readJson(path.join(project, 'components', 'Pages', 'index', 'nodes.json')).nodes;
      const copies = idx.filter((n) => n.type === '/Reusable/Horizontal Buttons');
      const rc = exists(path.join(project, 'components', 'Reusable', 'Horizontal Buttons', 'nodes.json')) ? readJson(path.join(project, 'components', 'Reusable', 'Horizontal Buttons', 'nodes.json')).nodes : [];
      check('STU-050: the six feature rows are one reusable with six copies on the page, each setting its own icon', copies.length === 6 && rc.length >= 7 && new Set(copies.map((c) => JSON.stringify(Object.entries(c.parameters || {}).find(([k]) => /glyph/.test(k))?.[1]))).size > 1, `${copies.length} copies, ${rc.length} nodes`);
      check('STU-050: the import report lists it, and the repeats it left alone with why', /\| index \| Reusable\/Horizontal Buttons \| 6 \|/.test(report) && /left as it was: .*hover \/ pressed look/.test(report));
    }
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${failed ? 'FAIL' : 'PASS'} ${checks.length - failed}/${checks.length}`);
process.exit(failed ? 1 : 0);
