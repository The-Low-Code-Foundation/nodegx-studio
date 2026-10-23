#!/usr/bin/env node
// check.mjs — the Bubble importer's gate (s6). Converts the fixtures committed in this folder (the Bubble editor's
// requests: backend workflows, option sets, data types with privacy rules) and, when `exports/template/` holds a
// run-mode bundle (gitignored; IMPORT.md §7 says how to fetch it), Richard's template too. Asserts what each session
// paid for: P123-S5-NOHOME (rootNodeId), P123-S5B-DISABLEDSTEP (no Log In in someApiWorkflow), §10 (four cloud
// components, two triggers), §12 (three collections), s6 (nodegx.security.json valid, the rules derived). Prints
// PASS n/n or FAIL and exits 1. The backend's own validator is used (lib/backend.mjs's kit), and validate_project
// through the MCP server when it is there (lib/nodegx.mjs); that one is skipped by name when it is not.
//   node import/check.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { kit } from '../lib/nodegx.mjs';
import { kit as backendKit } from '../lib/backend.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-check-'));
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ' — ' + detail : ''}`); return !!ok; };
const skip = (name, why) => console.log(`skip ${name} — ${why}`);
const run = (args, timeoutMs = 300000) => spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1 << 28, timeout: timeoutMs });
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);
const require = createRequire(import.meta.url);
const validateSecurity = (await backendKit()).validateSecurityConfig;
const mcpBuilt = exists(kit.mcpServer);

function convert(name, inDir) {
  const out = path.join(tmp, name); const exp = path.join(out, 'app.export.json'); const project = path.join(out, 'project');
  const b = run([path.join(here, 'bundles-to-export.mjs'), inDir, exp]);
  if (!check(`${name}: the bundler exits 0`, b.status === 0, (b.stderr || b.stdout).slice(-400))) return null;
  const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, project]);
  if (!check(`${name}: the converter exits 0`, c.status === 0, (c.stderr || c.stdout).slice(-600))) return null;
  return { project, report: fs.readFileSync(path.join(project, 'docs', 'IMPORT-REPORT.md'), 'utf8'), out: c.stdout };
}
function validateProject(name, project) {
  if (!mcpBuilt) return skip(`${name}: validate_project`, `no NodeGX MCP server at ${kit.mcpServer}`);
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
      { const errs = validateSecurity(sec); check("s6: the backend's validateSecurityConfig accepts it", errs.length === 0, errs.join('; ')); }
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

// ---------------------------------------------------------------- 1c2. STU-051-RULECHAIN: one rule Expression per property
// Two conditionals setting one margin were two Expressions wired into one port, and whichever changed last showed;
// Bubble's later conditional wins when both hold. A conditional whose value is the element's own changes nothing.
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const user = (name) => ({ type: 'CurrentUser', next: { type: 'Message', name } });
    synth.pages = { cpage: { type: 'Page', id: 'cpage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      r1: { id: 'r1', type: 'Text', name: 'Text r1', properties: { text: 'Hi', margin_left: 5 }, states: {
        0: { condition: user('logged_in'), properties: { margin_left: 30 } },
        1: { condition: { type: 'PageData', properties: { name: 'Current Page Width' }, next: { type: 'Message', name: 'less_than', args: 768 } }, properties: { margin_left: 10 } },
        2: { condition: user('logged_out'), properties: { margin_left: 5 } } } },
      r2: { id: 'r2', type: 'Group', name: 'Group r2', properties: { container_layout: 'column' }, elements: {}, states: {
        0: { condition: user('logged_in'), properties: { is_visible: false } },
        1: { condition: user('logged_out'), properties: { is_visible: false } } } } } } };
    const out = path.join(tmp, 'rulechain'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-051-RULECHAIN: the page with two rules on one property converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const { readRule } = await import('../editor/rules.mjs');
      const dir = path.join(out, 'project', 'components', 'Pages', 'index');
      const nodes = readJson(path.join(dir, 'nodes.json')).nodes, conns = readJson(path.join(dir, 'connections.json')).connections;
      const into = (id, port) => conns.filter((w) => w.toId === id && w.toProperty === port).map((w) => nodes.find((n) => n.id === w.fromId));
      const [m, ...moreM] = into('el_r1', 'marginLeft');
      const rm = m && readRule(m.parameters.expression, 'marginLeft');
      check('STU-051-RULECHAIN: two rules on one margin are one Expression, the later first (10 under 768, else 30 when signed in, else 5)', m && !moreM.length && rm?.arms.map((a) => a.then).join() === '10,30' && rm.otherwise === '5', JSON.stringify(m?.parameters.expression));
      // evaluated with its inputs: the later rule wins when both hold
      const names = conns.filter((w) => w.toId === m?.id).map((w) => [w.toProperty, nodes.find((n) => n.id === w.fromId)?.type]);
      const narrow = names.find(([, t]) => t === 'Screen Resolution')?.[0], vals = (w, inn) => names.map(([n]) => (n === narrow ? w : inn));
      let both, wide;
      try { const f = new Function(...names.map(([n]) => n), `return (${m.parameters.expression});`); both = f(...vals(500, true)); wide = f(...vals(1600, true)); } catch (err) { both = String(err); }
      check('STU-051-RULECHAIN: run, narrow and signed in gives the later rule\'s 10; wide and signed in gives 30', both === 10 && wide === 30, JSON.stringify({ names, both, wide }));
      const vis = into('el_r2', 'mounted');
      const rv = vis[0] && readRule(vis[0].parameters.expression, 'mounted');
      check('STU-051-RULECHAIN: two hiding rules on one group are one Expression into Mounted, hidden when either holds', vis.length === 1 && rv?.arms.length === 2 && rv.arms.every((a) => a.then === 'false') && rv.otherwise === 'true', JSON.stringify(vis.map((n) => n?.parameters.expression)));
      const report = fs.readFileSync(path.join(out, 'project', 'docs', 'IMPORT-REPORT.md'), 'utf8');
      // the base export's own reusables bring rules too: the chained count is this page's, the skipped at least its margin rule
      const row = /\| element conditions \| \d+ \| see findings; (\d+) chained onto the rule already on that property, (\d+) that change nothing not written \|/.exec(report);
      check('STU-051-RULECHAIN: the report counts them (2 chained; the margin rule equal to the element\'s own among those not written)', row && row[1] === '2' && Number(row[2]) >= 1, (/\| element conditions [^\n]*/.exec(report) || ['no row'])[0]);
      validateProject('STU-051-RULECHAIN fixture', path.join(out, 'project'));
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

// ---------------------------------------------------------------- 1d2. STU-024: one card per event — "Only when A" and "Only when not A" on
// one click are one branch; conditions that can both hold stay two lanes from the same signal, so both still run
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const user = (name) => ({ type: 'CurrentUser', next: { type: 'Message', name } });
    const go = (id, page, extra = {}) => ({ 0: { id, type: 'ChangePage', properties: { element_id: page, ...extra } } });
    const click = (id, el, condition, actions) => ({ id, type: 'ButtonClicked', properties: { element_id: el, ...(condition ? { condition } : {}) }, actions });
    const btn = (id) => ({ id, type: 'Button', name: `Button ${id}`, properties: {} });
    const blank = (id, name) => ({ type: 'Page', id, name, properties: { new_responsive: true, container_layout: 'column' }, elements: {} });
    synth.pages = { spage: { type: 'Page', id: 'spage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: { b1: btn('b1'), b2: btn('b2'), b3: btn('b3') },
      workflows: {
        w1: click('w1', 'b1', user('logged_in'), go('a1', 'opage')), w2: click('w2', 'b1', user('not_logged_in'), go('a2', 'tpage')),
        w3: click('w3', 'b2', user('logged_in'), go('a3', 'opage')), w4: click('w4', 'b2', null, go('a4', 'tpage')),
        w5: click('w5', 'b3', user('logged_in'), go('a5', 'opage')), w6: click('w6', 'b3', user('logged_in'), go('a6', 'tpage')) } },
      opage: blank('opage', 'other'), tpage: blank('tpage', 'third') };
    const out = path.join(tmp, 'stu024'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-024: the page with split clicks converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const dir = path.join(out, 'project', 'components', 'Pages', 'index');
      const nodes = readJson(path.join(dir, 'nodes.json')).nodes, conns = readJson(path.join(dir, 'connections.json')).connections;
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const from = (id, port) => conns.filter((w) => w.fromId === id && w.fromProperty === port).map((w) => ({ node: byId.get(w.toId), port: w.toProperty }));
      const navTo = (id, port) => from(id, port).filter((t) => t.node?.type === 'RouterNavigate' && t.port === 'navigate').map((t) => t.node.parameters?.target);
      const el = (b) => nodes.find((n) => n.label === `Button ${b}`)?.id;
      const b1 = from(el('b1'), 'onClick'), cond1 = b1[0]?.node;
      check('STU-024: "Only when logged in" and "Only when not logged in" on one click are ONE branch from it: Yes goes to other, No to third', b1.length === 1 && cond1?.type === 'Condition' && b1[0].port === 'eval' && JSON.stringify(navTo(cond1.id, 'ontrue')) === '["/Pages/other"]' && JSON.stringify(navTo(cond1.id, 'onfalse')) === '["/Pages/third"]' && /\?$/.test(cond1.label), JSON.stringify({ wires: b1.map((t) => `${t.node?.type}.${t.port}`), label: cond1?.label, yes: cond1 && navTo(cond1.id, 'ontrue'), no: cond1 && navTo(cond1.id, 'onfalse') }));
      const b2 = from(el('b2'), 'onClick');
      check('STU-024: "Only when logged in" beside a workflow with no condition can both run: two lanes from the same click, the second a plain step', b2.length === 2 && b2.some((t) => t.node?.type === 'Condition' && t.port === 'eval') && b2.some((t) => t.node?.type === 'RouterNavigate' && t.port === 'navigate'), JSON.stringify(b2.map((t) => `${t.node?.type}.${t.port}`)));
      const b3 = from(el('b3'), 'onClick');
      check('STU-024: the same condition twice is not opposite: two lanes, each behind its own Only when', b3.length === 2 && b3.every((t) => t.node?.type === 'Condition' && /^Only when /.test(t.node.label)), JSON.stringify(b3.map((t) => t.node?.label)));
      validateProject('STU-024 fixture', path.join(out, 'project'));
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

// ---------------------------------------------------------------- 1g. R5: a reusable's states, shown / hidden and displayed data are each copy's own
// Bubble's Card has a state (mood, default "calm"), a text reading it, a group a step fills ("Display data") with a text
// reading "Parent group's thing", and a group a step hides; one click sets all three. The page places two copies, reads
// Card one's mood and sets Card two's. Before R5 a read of a state came out empty, the displayed data was never read, and
// a Hide in one copy hid the group in both. Measured in the running app when Chrome is there.
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const txt = (s) => ({ type: 'TextExpression', entries: { 0: s } });
    const mood = (el) => ({ type: 'GetElement', properties: { element_id: el }, next: { type: 'Message', name: 'custom.mood_' } });
    synth.custom_elements = { ce1: { id: 'ce1', type: 'CustomDefinition', name: 'Card', properties: { element_type: 'Group', container_layout: 'column' },
      custom_states: { mood_: { display: 'mood', value: 'text', default_val: 'calm' } },
      elements: {
        ct: { id: 'ct', type: 'Text', name: 'Text mood', properties: { text: { type: 'TextExpression', entries: { 0: 'mood ', 1: mood('ce1') } } } },
        cb: { id: 'cb', type: 'Button', name: 'Button set', properties: { text: txt('Set it') } },
        cg: { id: 'cg', type: 'Group', name: 'Group details', properties: { container_layout: 'column' }, elements: {
          cd: { id: 'cd', type: 'Text', name: 'Text detail', properties: { text: { type: 'TextExpression', entries: { 0: 'detail ', 1: { type: 'ElementParent' } } } } } } },
        ch: { id: 'ch', type: 'Group', name: 'Group extra', properties: { container_layout: 'column' }, elements: { cx: { id: 'cx', type: 'Text', name: 'Text extra', properties: { text: txt('extra here') } } } } },
      workflows: { w1: { id: 'w1', type: 'ButtonClicked', properties: { element_id: 'cb' }, actions: {
        0: { id: 'a1', type: 'SetCustomState', properties: { element_id: 'ce1', custom_state: 'custom.mood_', value: txt('clicked') } },
        1: { id: 'a2', type: 'HideElement', properties: { element_id: 'ch' } },
        2: { id: 'a3', type: 'DisplayGroupData', properties: { element_id: 'cg', data_source: txt('shown') } } } } } } };
    synth.pages = { rpage: { type: 'Page', id: 'rpage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      c1: { id: 'c1', type: 'CustomElement', name: 'Card one', properties: { custom_id: 'ce1' } },
      c2: { id: 'c2', type: 'CustomElement', name: 'Card two', properties: { custom_id: 'ce1' } },
      pr: { id: 'pr', type: 'Text', name: 'Text page reads', properties: { text: { type: 'TextExpression', entries: { 0: 'page reads ', 1: mood('c1') } } } },
      pb: { id: 'pb', type: 'Button', name: 'Button page set', properties: { text: txt('Page sets') } } },
      workflows: { w2: { id: 'w2', type: 'ButtonClicked', properties: { element_id: 'pb' }, actions: { 0: { id: 'a4', type: 'SetCustomState', properties: { element_id: 'c2', custom_state: 'custom.mood_', value: txt('from page') } } } } } } };
    const out = path.join(tmp, 'r5'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const project = path.join(out, 'project');
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, project]);
    if (check('R5: a reusable with a state, a filled group and a hidden one, two copies on a page, converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const load = (rel) => { const d = path.join(project, 'components', rel); return { nodes: readJson(path.join(d, 'nodes.json')).nodes, conns: readJson(path.join(d, 'connections.json')).connections }; };
      const r = load('Reusable/Card'), pg = load('Pages/index');
      const has = (g, from, fp, to, tp) => g.conns.some((w) => w.fromId === from && w.fromProperty === fp && w.toId === to && w.toProperty === tp);
      const st = r.nodes.find((n) => n.metadata?.customState?.name === 'mood');
      check('R5: the state in the reusable is a Component Object property with its default (one value per copy), not a Variable', st?.type === 'net.noodl.ComponentObject' && st.parameters.properties === 'mood' && st.parameters['value-mood'] === 'calm' && !r.nodes.some((n) => n.type === 'Variable2' || n.type === 'Set Variable'), JSON.stringify(st));
      const read = r.nodes.find((n) => n.type === 'Expression' && r.conns.some((w) => w.fromId === n.id && w.toId === 'el_ct'));
      check('R5: the text reads the state\'s own value (value-mood), not a field off the element', read && r.conns.some((w) => w.fromId === st?.id && w.fromProperty === 'value-mood' && w.toId === read.id) && !/el_Card/.test(read.parameters.expression), JSON.stringify(read?.parameters));
      const steps = r.nodes.filter((n) => n.type === 'net.noodl.SetComponentObjectProperties');
      const set = steps.find((n) => n.parameters.properties === 'mood'), hide = steps.find((n) => n.parameters.properties === 'Group_extra_shown'), show = steps.find((n) => n.parameters.properties === 'Group_details_data');
      check('R5: the click\'s three steps set the copy\'s record, chained store → done', set?.parameters['prop-mood'] === 'clicked' && hide?.parameters['prop-Group_extra_shown'] === false && show?.parameters['prop-Group_details_data'] === 'shown' && has(r, 'el_cb', 'onClick', set?.id, 'store') && has(r, set?.id, 'done', hide?.id, 'store') && has(r, hide?.id, 'done', show?.id, 'store'), JSON.stringify(steps.map((n) => n.parameters)));
      const vis = r.nodes.find((n) => n.type === 'net.noodl.ComponentObject' && n.parameters.properties === 'Group_extra_shown');
      const data = r.nodes.find((n) => n.type === 'net.noodl.ComponentObject' && n.parameters.properties === 'Group_details_data');
      const detail = r.nodes.find((n) => n.type === 'Expression' && r.conns.some((w) => w.fromId === n.id && w.toId === 'el_cd'));
      check('R5: the hidden group\'s mounted and the filled group\'s data are the copy\'s too, and the text inside reads that data', vis?.parameters['value-Group_extra_shown'] === true && has(r, vis.id, 'value-Group_extra_shown', 'el_ch', 'mounted') && data && detail && r.conns.some((w) => w.fromId === data.id && w.fromProperty === 'value-Group_details_data' && w.toId === detail.id), JSON.stringify({ vis: vis?.parameters, data: data?.id, detail: detail?.parameters }));
      const outs = r.nodes.find((n) => n.type === 'Component Outputs'), ins = r.nodes.find((n) => n.id === 'copy_ce1');
      check('R5: the page reads Card one\'s mood through an output the reusable declares, and sets Card two\'s through an input', outs?.ports.some((q) => q.name === 'state-mood') && has(r, st?.id, 'value-mood', outs.id, 'state-mood') && pg.conns.some((w) => w.fromId === 'el_c1' && w.fromProperty === 'state-mood') && ins?.ports.some((q) => q.name === 'state-mood') && has(r, 'copy_ce1', 'state-mood', st?.id, 'value-mood') && pg.conns.some((w) => w.toId === 'el_c2' && w.toProperty === 'state-mood') && !pg.conns.some((w) => w.toId === 'el_c1' && w.toProperty === 'state-mood'), JSON.stringify({ outs: outs?.ports, ins: ins?.ports }));
      validateProject('R5 fixture', project);
      const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (!exists(chrome)) skip('R5: in the running app', `no Chrome at ${chrome}`);
      else {
        const { spawn } = await import('node:child_process');
        const { browser } = await import('../editor/cdp.mjs');
        const srv = spawn(process.execPath, [path.join(here, 'preview-solo.mjs'), project, '--port', '0'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let b;
        try {
          const url = await new Promise((res, rej) => { setTimeout(() => rej(new Error('preview-solo did not start')), 30000); srv.stdout.on('data', (d) => { const m = /http:\/\/[\d.:]+\//.exec(String(d)); if (m) res(m[0]); }); });
          b = await browser({ port: 9300 + Math.floor(Math.random() * 600), chrome });
          await b.goto(url);
          await b.until(`/draw|not shown/.test(document.getElementById('status')?.textContent || '')`, 60000);
          const W = '__preview.frame.contentWindow';
          const wait = (ms) => new Promise((res) => setTimeout(res, ms));
          const seen = async () => JSON.parse(await b.evaluate(`JSON.stringify((() => { const t = ${W}.document.body.innerText; return { moods: t.match(/mood [\\w ]*/g), page: t.match(/page reads[\\w ]*/g), details: t.match(/detail[\\w ]*/g), extra: (t.match(/extra here/g) || []).length }; })())`));
          const press = (label) => b.evaluate(`[...${W}.document.querySelectorAll('button')].find((e) => e.textContent.trim() === ${JSON.stringify(label)}).click()`);
          await wait(1500); const open = await seen();
          await press('Set it'); await wait(800); const one = await seen();
          await press('Page sets'); await wait(800); const two = await seen();
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
          check('R5, in the running app: both copies open at the default, and the page reads Card one\'s', same(open.moods, ['mood calm', 'mood calm']) && same(open.page, ['page reads calm']) && open.extra === 2, JSON.stringify(open));
          check('R5, in the running app: Card one\'s click sets its own mood, hides its own group and fills its own; Card two is as it was', same(one.moods, ['mood clicked', 'mood calm']) && same(one.page, ['page reads clicked']) && same(one.details, ['detail shown', 'detail ']) && one.extra === 1, JSON.stringify(one));
          check('R5, in the running app: the page sets Card two\'s mood, and Card one keeps its own', same(two.moods, ['mood clicked', 'mood from page']) && two.extra === 1, JSON.stringify(two));
          check('R5, in the running app: no errors', !b.problems.some((p) => /port named|Error/.test(p)), JSON.stringify(b.problems.slice(0, 3)));
        } catch (e) { check('R5, in the running app: the run itself', false, e.message); }
        finally { try { await b?.close(); } catch { /* gone */ } srv.kill(); }
      }
    }
  }
}

// ---------------------------------------------------------------- 1f. STU-053: the Bubble elements NodeGX has no node of its own for
// Two floating groups (one at the bottom, one at Bubble's default), a popup, a repeating group of three columns and a
// dropdown whose choices come from a search.
{
  const base = path.join(tmp, 'editor requests', 'app.export.json');
  if (exists(base)) {
    const synth = readJson(base);
    const search = { type: 'Search', properties: { thing_type: 'custom.somedatatype', constraints: {} } };
    synth.pages = { fpage: { type: 'Page', id: 'fpage', name: 'index', properties: { new_responsive: true, container_layout: 'column' }, elements: {
      fg: { id: 'fg', type: 'FloatingGroup', name: 'Bottom bar', properties: { container_layout: 'row', float_vertical: 'bottom', zindex: 3, height: 60, top: 0, left: 0 }, elements: {} },
      fg2: { id: 'fg2', type: 'FloatingGroup', name: 'Top menu', properties: { container_layout: 'column', zindex: 2, is_visible: false, top: 0, left: 0 }, elements: {} },
      pop: { id: 'pop', type: 'Popup', name: 'Popup confirm', properties: { container_layout: 'column', width: 400 }, elements: {} },
      rg: { id: 'rg', type: 'RepeatingGroup', name: 'RG cards', properties: { group_type: 'custom.somedatatype', container_layout: 'column', columns: 3, data_source: search }, elements: {
        ct: { id: 'ct', type: 'Text', name: 'Text card', properties: { text: 'Card' } } } },
      dd: { id: 'dd', type: 'Dropdown', name: 'Dropdown pick', properties: { data_source: search } },
      pt: { id: 'pt', type: 'Text', name: 'Picked name', properties: { text: { type: 'TextExpression', entries: { 0: { type: 'GetElement', properties: { element_id: 'dd' }, next: { type: 'Message', name: 'get_data', next: { type: 'Message', name: 'name' } } } } } } } } } };
    const out = path.join(tmp, 'stu053'); fs.mkdirSync(out); const exp = path.join(out, 'app.export.json'); fs.writeFileSync(exp, JSON.stringify(synth));
    const c = run([path.join(here, 'app-to-nodegx.mjs'), exp, path.join(out, 'project')]);
    if (check('STU-053: the page of floating, popup, grid and dropdown converts', c.status === 0, (c.stderr || c.stdout).slice(-600))) {
      const dir = path.join(out, 'project', 'components', 'Pages', 'index');
      const nodes = readJson(path.join(dir, 'nodes.json')).nodes, conns = readJson(path.join(dir, 'connections.json')).connections;
      const P = (id) => nodes.find((n) => n.id === id)?.parameters || {};
      const fg = P('el_fg'), fg2 = P('el_fg2'), pop = P('el_pop'), rg = P('el_rg');
      check('STU-053: a floating group is fixed to the window on its layer, at the bottom when it floats there', fg.position === 'fixed' && fg.zIndex === 3 && fg.alignY === 'bottom' && fg.marginTop === undefined, JSON.stringify(fg));
      check('STU-053: one with no float setting floats at the top (Bubble\'s default), hidden as it starts', fg2.position === 'fixed' && fg2.zIndex === 2 && fg2.alignY === 'top' && fg2.mounted === false, JSON.stringify(fg2));
      check('STU-053: a popup is fixed in the middle of the window above the rest, no wider than Bubble\'s 400 px, hidden as it starts', pop.position === 'fixed' && pop.alignX === 'center' && pop.alignY === 'center' && pop.zIndex > fg.zIndex && pop.maxWidth?.value === 400 && pop.mounted === false, JSON.stringify(pop));
      const rowDir = fs.readdirSync(path.join(out, 'project', 'components'), { recursive: true }).find((f) => f.endsWith('nodes.json') && /RG cards/.test(f));
      const cell = rowDir && readJson(path.join(out, 'project', 'components', rowDir)).nodes.find((n) => n.label === 'Cell');
      check('STU-053: a repeating group of 3 columns wraps its cells in rows, each a third of the width', rg.flexDirection === 'row' && rg.flexWrap === 'wrap' && cell?.parameters.width?.value === 33.33 && cell.parameters.width.unit === '%', JSON.stringify({ rg: [rg.flexDirection, rg.flexWrap], cell: cell?.parameters.width, rowDir }));
      // the dropdown's choices, run: a record becomes { Label, Value } (it drew an empty choice handed over as it was)
      const feed = conns.find((w) => w.toId === 'el_dd' && w.toProperty === 'items'), ex = feed && nodes.find((n) => n.id === feed.fromId);
      const ins = conns.filter((w) => w.toId === ex?.id).map((w) => w.toProperty);
      let got;
      try { got = new Function(...ins, `return (${ex.parameters.expression});`)(...ins.map(() => [{ id: 'a1', name: 'Alpha' }, { id: 'b2', display: 'Beta' }, null])); } catch (err) { got = String(err); }
      check('STU-053: a dropdown fed by a search shows each record by its name or display, valued by its id', ins.length === 1 && JSON.stringify(got) === JSON.stringify([{ Label: 'Alpha', Value: 'a1' }, { Label: 'Beta', Value: 'b2' }, null]), JSON.stringify({ ins, expr: ex?.parameters.expression, got }));
      // STU-053-DROPDOWNVALUE, run: "Dropdown pick's value's name" looks the chosen record up by the id the dropdown gives
      const textFeed = conns.find((w) => w.toId === 'el_pt' && w.toProperty === 'text'), tex = textFeed && nodes.find((n) => n.id === textFeed.fromId);
      const chosenFeed = conns.find((w) => w.toId === tex?.id && /^chosen_/.test(w.toProperty)), cex = chosenFeed && nodes.find((n) => n.id === chosenFeed.fromId);
      const cins = conns.filter((w) => w.toId === cex?.id), records = [{ id: 'a1', name: 'Alpha' }, { id: 'b2', name: 'Beta' }, null];
      const runEx = (e, ins, vals) => { try { return new Function(...ins, `return (${e.parameters.expression});`)(...vals); } catch (err) { return String(err); } };
      const pick = (v) => cex && runEx(cex, cins.map((w) => w.toProperty), cins.map((w) => w.toProperty === 'chosenValue' ? v : records));
      const shown = tex && chosenFeed && runEx(tex, [chosenFeed.toProperty], [pick('b2')]);
      check('STU-053-DROPDOWNVALUE: a field read off a dropdown\'s value reads the chosen record\'s field (it read nothing off the id)', cins.some((w) => w.fromId === 'el_dd' && w.fromProperty === 'value' && w.toProperty === 'chosenValue') && pick('b2')?.name === 'Beta' && pick('') === null && pick('zz') === null && shown === 'Beta', JSON.stringify({ chosen: cex?.parameters.expression, text: tex?.parameters.expression, ins: cins.map((w) => w.toProperty), b2: pick('b2'), shown }));
      const report = fs.readFileSync(path.join(out, 'project', 'docs', 'IMPORT-REPORT.md'), 'utf8');
      check('STU-053: the report says what is not carried over (the popup\'s backdrop; the dropdown\'s value is the id)', report.includes("Bubble's grey backdrop behind it is not drawn") && report.includes("\"Dropdown pick's value\" is that id"), '');
      validateProject('STU-053 fixture', path.join(out, 'project'));
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
      const menu = idx.find((n) => n.label === 'Floating Mobile Nav Menu')?.parameters;
      check('STU-053: the template\'s Floating Mobile Nav Menu is fixed to the window on its layer 2, hidden as it starts (it sat in the page\'s flow)', menu?.position === 'fixed' && menu.zIndex === 2 && menu.alignY === 'top' && menu.mounted === false, JSON.stringify(menu));
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
