/**
 * M6 — the Data tab's reading of an app's types, without a page: what is declared where, where the project and the
 * running backend disagree, and how a value goes to the backend and comes back in a person's words. Pure; studio.html
 * draws it and editor/data-check.mjs grades it.
 *
 * A type can be in three places: the project (`metadata.dbCollections`, what the NodeGX editor reads and Studio
 * writes), the running backend (`GET /admin/schema`), and the app's own nodes (a Record node's `collectionName` and its
 * `prop-*` fields). The kinds of field are the backend manager's (`fields.js`, vendored from nodegx-backend's
 * admin/app/fieldKinds.ts); this module takes them as an argument so it never carries its own copy.
 */

export const SYSTEM_FIELDS = ['objectId', 'createdAt', 'updatedAt', 'ACL'];
const own = (cols = []) => cols.filter((c) => c && !SYSTEM_FIELDS.includes(c.name));

/**
 * Every type the app has, once, with where it is: `{ name, declared, onBackend, usedByApp, columns }`. The project's
 * columns win; a type only the backend or only the app knows reads its columns from there (an app's are untyped).
 */
export function typesOf({ declared = [], backend = [], used = new Map() }) {
  const out = new Map();
  for (const c of declared) out.set(c.name, { name: c.name, declared: true, onBackend: false, usedByApp: used.has(c.name), columns: own(c.columns) });
  for (const t of backend) {
    if (t.name.startsWith('_')) continue;
    const at = out.get(t.name);
    if (at) at.onBackend = true;
    else out.set(t.name, { name: t.name, declared: false, onBackend: true, usedByApp: used.has(t.name), columns: own(t.columns) });
  }
  for (const [name, fields] of used) {
    if (out.has(name)) continue;
    out.set(name, { name, declared: false, onBackend: false, usedByApp: true, columns: [...fields].map((f) => ({ name: f, type: '' })) });
  }
  return [...out.values()].sort((a, b) => Number(b.declared) - Number(a.declared) || a.name.localeCompare(b.name));
}

/**
 * Where the project's fields and the backend's disagree, for one type: fields only the backend has, fields only the
 * project has, fields whose storage type differs (a Link's target counts as part of its type), and fields of one type
 * that are required in one and not the other (the backend's diff never compares Required, so nothing else would say).
 */
export function driftOf(projectCols = [], backendCols = []) {
  const p = new Map(own(projectCols).map((c) => [c.name, c]));
  const b = new Map(own(backendCols).map((c) => [c.name, c]));
  const shape = (c) => `${c.type}${c.targetClass ? `<${c.targetClass}>` : ''}`;
  return {
    onlyBackend: [...b.values()].filter((c) => !p.has(c.name)),
    onlyProject: [...p.values()].filter((c) => !b.has(c.name)),
    retyped: [...p.values()].filter((c) => b.has(c.name) && shape(c) !== shape(b.get(c.name))).map((c) => ({ name: c.name, project: c, backend: b.get(c.name) })),
    required: [...p.values()].filter((c) => b.has(c.name) && shape(c) === shape(b.get(c.name)) && !!c.required !== !!b.get(c.name).required).map((c) => ({ name: c.name, project: !!c.required, backend: !!b.get(c.name).required })),
    get none() {
      return !this.onlyBackend.length && !this.onlyProject.length && !this.retyped.length && !this.required.length;
    }
  };
}

/** A column as the project keeps it: what the NodeGX editor reads, plus what the backend's drawer declared on it. */
export function projectColumn(col) {
  const out = { name: col.name, type: col.type };
  for (const k of ['targetClass', 'required', 'description', 'defaultValue']) if (col[k] !== undefined && col[k] !== null && col[k] !== '') out[k] = col[k];
  return out;
}

/** A value from the backend, as a cell says it. */
export function cellWords(col, v) {
  if (v === undefined || v === null || v === '') return '';
  switch (col?.type) {
    case 'Boolean':
      return v === true ? 'Yes' : v === false ? 'No' : String(v);
    case 'Date': {
      const iso = typeof v === 'object' ? v.iso : v;
      const d = new Date(iso);
      return isNaN(d) ? String(iso) : d.toISOString().slice(0, 16).replace('T', ' ');
    }
    case 'Pointer':
      return typeof v === 'object' ? v.objectId ?? JSON.stringify(v) : String(v);
    case 'File':
      return typeof v === 'object' ? v.name ?? v.url ?? JSON.stringify(v) : String(v);
    case 'GeoPoint':
      return typeof v === 'object' ? `${v.latitude}, ${v.longitude}` : String(v);
    default:
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
}

/** What a cell's editor holds, as text: a date as `datetime-local` wants it, JSON for what has no control of its own. */
export function editText(col, v) {
  if (v === undefined || v === null) return '';
  if (col?.type === 'Date') {
    const d = new Date(typeof v === 'object' ? v.iso : v);
    return isNaN(d) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  if (col?.type === 'Pointer') return typeof v === 'object' ? v.objectId ?? '' : String(v);
  if (col?.type === 'Boolean') return v === true ? 'yes' : v === false ? 'no' : '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/**
 * What a person typed or chose, as the backend takes it for this column; `{ error }` when it can't be. Empty is
 * null (the field cleared). A date from `datetime-local` is the person's local time.
 */
export function toWire(col, text) {
  const t = String(text ?? '');
  if (t.trim() === '') return { value: null };
  switch (col?.type) {
    case 'Number': {
      const n = Number(t);
      return isNaN(n) ? { error: `${col.name} is a number; "${t}" is not one.` } : { value: n };
    }
    case 'Boolean':
      return /^(yes|true|1)$/i.test(t) ? { value: true } : /^(no|false|0)$/i.test(t) ? { value: false } : { error: `${col.name} is Yes or No.` };
    case 'Date': {
      const d = new Date(t);
      return isNaN(d) ? { error: `${col.name} is a date; "${t}" is not one.` } : { value: { __type: 'Date', iso: d.toISOString() } };
    }
    case 'Pointer':
      return { value: { __type: 'Pointer', className: col.targetClass, objectId: t.trim() } };
    case 'Array':
    case 'Object':
    case 'GeoPoint':
    case 'File':
    case 'Relation':
      try {
        return { value: JSON.parse(t) };
      } catch {
        return col.type === 'Array' ? { value: t.split(',').map((s) => s.trim()).filter(Boolean) } : { error: `${col.name} takes JSON here.` };
      }
    default:
      return { value: t };
  }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The `where` that finds `q` in any text field of the type, case aside; null when there is nothing to search. */
export function searchWhere(cols, q) {
  const text = own(cols).filter((c) => c.type === 'String' || c.type === '').map((c) => c.name);
  const s = String(q ?? '').trim();
  if (!s || !text.length) return null;
  return { $or: text.map((name) => ({ [name]: { $regex: escapeRegex(s), $options: 'i' } })) };
}

/** A row in a few words, for a Link's picker: its first name-like text field, else its first text, else its id. */
export function rowLabel(row, cols = []) {
  const words = ['name', 'title', 'label', 'subject', 'email', 'username', 'displayName'];
  for (const k of words) if (typeof row[k] === 'string' && row[k].trim()) return row[k].slice(0, 60);
  for (const c of own(cols)) if ((c.type === 'String' || !c.type) && typeof row[c.name] === 'string' && row[c.name].trim()) return row[c.name].slice(0, 60);
  return String(row.objectId ?? '').slice(0, 10);
}

/** "1–50 of 213", or "No rows". */
export function pageWords(skip, shown, total) {
  if (!total) return 'No rows';
  return `${skip + 1}–${skip + shown} of ${total}`;
}

/** The query string for one page of rows: `limit`, `skip`, `count`, `order`, `where`. */
export function rowsQuery({ limit = 50, skip = 0, order = '', where = null }) {
  const q = new URLSearchParams({ limit: String(limit), skip: String(skip), count: '1' });
  if (order) q.set('order', order);
  if (where) q.set('where', JSON.stringify(where));
  return q.toString();
}
