/**
 * STU-065 — development and live: the app's two databases, and what moves between them.
 *
 * Studio does not have its own way of comparing or promoting a schema. The backend has one (BAK-007): a snapshot of
 * the source backend's tables, rules and triggers is sent to the target's `POST /admin/schema/diff` (what would change,
 * and whether anything would be lost) and `/apply`. What is Studio's own:
 *   - the snapshot is read from the development backend's admin API (`/admin/schema`, `/admin/permissions`,
 *     `/admin/triggers`), since the backend reads it only from its own folder;
 *   - the apply adds tables, fields, indexes and checks, and merges the rules into the target's file. It leaves a
 *     removed field and a changed type for a person to do, and the running backend does not reread the rules file;
 *     so after it, with the person's yes for anything that loses values, Studio drops and retypes those fields and puts
 *     each type's rule through `/admin/permissions` on the live backend, the calls the backend's own manager makes;
 *   - live never takes development's `devOpen` (the relaxation of the rules on this computer): its rules hold.
 *
 * Rows move as the backend's export and import of one type (`/admin/export/:type`, `/admin/import/:type`, JSON): a row
 * with an id the target has replaces it, a new one is added, and the target's other rows stay. A dry run first says
 * how many of each.
 */

/** A backend as its admin: `{ get, post, put, del }` over fetch, each resolving with the JSON or throwing its words. */
export function admin({ endpoint, token, appId }) {
  const base = endpoint.replace(/\/$/, '');
  const call = async (method, path, body) => {
    const headers = { 'X-Parse-Application-Id': appId ?? '', 'Content-Type': 'application/json' };
    if (token) headers['X-Parse-Master-Key'] = token;
    let r;
    try {
      r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (err) {
      throw new Error(`The backend at ${endpoint} did not answer: ${err.message}`);
    }
    let json = null;
    try {
      json = await r.json();
    } catch { /* empty */ }
    if (!r.ok) throw new Error(json?.error ?? `${r.status} ${r.statusText} from ${path}`);
    return json;
  };
  return { endpoint, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p) };
}

/** The app's own tables: the backend's, without its system ones (`_User` and the rest start with `_`). */
const ownTables = (tables) => tables.filter((t) => !t.name.startsWith('_'));

/** A snapshot of a running backend, in the shape `/admin/schema/diff` takes. Live never gets `devOpen`. */
export async function snapshotOf(be) {
  const [schema, perms, triggers] = await Promise.all([be.get('/admin/schema'), be.get('/admin/permissions'), be.get('/admin/triggers').catch(() => ({ triggers: [] }))]);
  return {
    tables: ownTables(schema.tables ?? []).map((t) => ({
      name: t.name,
      columns: t.columns ?? [],
      // a declaration as the backend keeps it: an index's status without its name and state, a check's rule
      indexes: (t.indexes ?? []).filter((i) => i.declared !== false).map(({ fields, unique, order, where }) => ({ fields, ...(unique ? { unique } : {}), ...(order && order !== 'asc' ? { order } : {}), ...(where ? { where } : {}) })),
      checks: (t.checks ?? []).filter((c) => c.declared).map((c) => c.rule)
    })),
    permissions: { ...perms.config, devOpen: false },
    triggers: triggers.triggers ?? []
  };
}

/**
 * What Deploy to live would do: the backend's own diff of development against live, its sentences, and the rules
 * that differ (the diff names a type whose rule changed; Studio puts each one through the admin API).
 */
export async function compare(dev, live) {
  const source = await snapshotOf(dev);
  const { diff, rendered } = await live.post('/admin/schema/diff', { source });
  // the system tables are not the app's: a diff that only says live lacks one of them is not a change to make
  diff.tables.removed = diff.tables.removed.filter((n) => !n.startsWith('_'));
  const liveRules = (await live.get('/admin/permissions')).config;
  const rules = Object.keys({ ...(source.permissions.collections ?? {}), ...(liveRules.collections ?? {}) }).filter(
    (name) => JSON.stringify(source.permissions.collections?.[name] ?? null) !== JSON.stringify(liveRules.collections?.[name] ?? null)
  );
  const lost = [
    ...diff.tables.removed.map((name) => ({ kind: 'type', table: name, words: `the type ${name} and every row of it` })),
    ...diff.tables.changed.flatMap((c) => [
      ...c.removedColumns.map((col) => ({ kind: 'field', table: c.name, column: col, words: `${c.name}'s field ${col}, in every row` })),
      ...c.typeChanges.map((t) => ({ kind: 'retype', table: c.name, column: t.name, to: t.to, words: `${c.name}'s ${t.name} changes from ${t.from} to ${t.to}: values that do not convert are lost` }))
    ])
  ];
  const added = [
    ...diff.tables.added.map((t) => `the type ${t.name} (${t.columns.filter((c) => !['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(c.name)).length} fields)`),
    ...diff.tables.changed.flatMap((c) => c.addedColumns.map((col) => `${c.name}'s field ${col.name}`)),
    ...diff.tables.changed.filter((c) => c.indexChange || c.checkChange).map((c) => `${c.name}'s rules for its values`),
    ...rules.map((name) => `who may reach ${name}`)
  ];
  return { source, diff, rendered, rules, lost, added, same: !lost.length && !added.length };
}

/**
 * Deploy to live. Refuses, changing nothing, when something would be lost and `allowDestructive` is not set. Resolves
 * with what was done, in words.
 */
export async function promote(dev, live, { allowDestructive = false } = {}) {
  const plan = await compare(dev, live);
  if (plan.same) return { done: [], plan };
  if (plan.lost.length && !allowDestructive) {
    const err = new Error(`Deploying would lose ${plan.lost.map((l) => l.words).join('; ')}. Nothing was changed.`);
    err.plan = plan;
    throw err;
  }
  const done = [];
  // the backend's apply: new types, fields, indexes and checks, and (with the yes) types development no longer has
  const { result } = await live.post('/admin/schema/apply', { source: plan.source, allowDestructive });
  done.push(...result.appliedTables.map((t) => `added the type ${t}`), ...result.appliedColumns.map((c) => `added ${c.replace('.', "'s field ")}`), ...result.droppedTables.map((t) => `deleted the type ${t}`));
  if (result.appliedChecks.length || result.droppedChecks.length || result.appliedIndexes.length || result.droppedIndexes.length) done.push('brought the rules for values across');
  // what the apply leaves for a person: a removed field and a changed type, done here with the person's yes
  for (const l of plan.lost) {
    if (l.kind === 'field') {
      await live.post('/admin/schema', { action: 'dropColumn', table: l.table, column: l.column });
      done.push(`deleted ${l.table}'s field ${l.column}`);
    }
    if (l.kind === 'retype') {
      const r = await live.post('/admin/schema', { action: 'changeColumnType', table: l.table, column: l.column, type: l.to });
      done.push(`changed ${l.table}'s ${l.column} to ${l.to}${r.convertedValues ? ` (${r.convertedValues} values converted)` : ''}`);
    }
  }
  // the rules, through the running backend (the apply wrote only its file)
  for (const name of plan.rules) {
    const rule = plan.source.permissions.collections?.[name];
    if (rule) await live.put(`/admin/permissions/collections/${encodeURIComponent(name)}`, rule);
    else await live.del(`/admin/permissions/collections/${encodeURIComponent(name)}`);
    done.push(`set who may reach ${name}`);
  }
  for (const s of result.skipped ?? []) if (!/^(drop column|type change) /.test(s)) done.push(`not done: ${s}`);
  return { done, plan };
}

/** Live keeps its rules on this computer too: `devOpen` off, once, when it is made. */
export async function closeLive(live) {
  const { config } = await live.get('/admin/permissions');
  if (config.devOpen === false) return false;
  await live.put('/admin/permissions', { ...config, devOpen: false });
  return true;
}

/**
 * Copies the rows of `types` (every type the source has when empty) from one backend to the other, through the
 * backend's export and import. `dryRun` imports nothing and says how many rows would be added and replaced.
 */
export async function copyRows(from, to, { types = [], dryRun = true } = {}) {
  const fromTables = ownTables((await from.get('/admin/schema')).tables ?? []).map((t) => t.name);
  const toTables = new Set(ownTables((await to.get('/admin/schema')).tables ?? []).map((t) => t.name));
  const report = [];
  for (const name of types.length ? types : fromTables) {
    if (!fromTables.includes(name)) {
      report.push({ type: name, error: 'not a type here' });
      continue;
    }
    if (!toTables.has(name)) {
      report.push({ type: name, error: 'the other database has no such type yet: deploy to live first' });
      continue;
    }
    const { content, count } = await from.get(`/admin/export/${encodeURIComponent(name)}?format=json`);
    const r = await to.post(`/admin/import/${encodeURIComponent(name)}`, { format: 'json', content, dryRun });
    report.push({ type: name, rows: count, created: r.created, updated: r.updated, rejected: r.rejected ?? [], error: r.error ?? null, applied: !!r.applied });
  }
  return { dryRun, report };
}
