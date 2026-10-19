/**
 * NodeGX Studio — the composer's typed follow-ups (STU-052), from the community's Bubble→Noodl dictionary as the
 * phrasebook executed it (OpenNoodl scripts/bubble-phrasebook/rows.js: one row per operator, every code cell run).
 *
 * After a chip, Bubble's editor offers what can follow a value of that type: a list `:count`, `:first item`; a date
 * `+(days)`; a number `:rounded to`. Here a chip's type is read off the port it comes from (`dictionaryType`), and the
 * type's rows — with the Any rows, which follow every value — are offered (`phrasesFor`). A row whose answer is an
 * expression (or a one-line Function) is inserted (`applyPhrase`): the chip becomes the row's subject, and each other value
 * the row needs becomes a SLOT, a name with no value yet that the person fills with a chip, as Bubble leaves an empty slot
 * after ":contains". A row the phrasebook answers with a node, or with nothing, is offered too, as what to do instead.
 * Pure: no DOM, so `phrases-check.mjs` runs every inserted phrase to the phrasebook's answer.
 */

/** The dictionary's seven types, in Bubble's order, and the names a slot of each kind takes. */
export const TYPES = ['String', 'Integer', 'Integer range', 'Date', 'Date Range', 'List', 'Any'];
export const TYPE_WORDS = { String: 'text', Integer: 'number', 'Integer range': 'number range', Date: 'date', 'Date Range': 'date range', List: 'list', Any: 'any value' };

/** A port's type (NodeGX's names) as the dictionary's. A value of unknown type is Any until the person says. */
export function dictionaryType(portType) {
  const t = String(portType ?? '*').toLowerCase();
  if (t === 'string' || t === 'text' || t === 'color' || t === 'enum') return 'String';
  if (t === 'number') return 'Integer';
  if (t === 'array') return 'List';
  if (t === 'date') return 'Date';
  return 'Any';
}

const slotWord = (v) => (v instanceof Date ? 'date' : Array.isArray(v) ? (v.length === 2 && v.every((x) => x instanceof Date) ? 'dateRange' : v.length === 2 && v.every((x) => typeof x === 'number') ? 'range' : 'list') : typeof v === 'number' ? 'number' : typeof v === 'string' ? 'text' : 'value');
const names = (code) => [...new Set(String(code).match(/[A-Za-z_$][\w$]*/g) || [])];

/**
 * One row as a phrase: { id, bubble, type, insert?: { code, subject, others: { name: slot kind } }, node?, prose?, code? }.
 * Plain data (JSON-safe): the server sends the table to the page.
 * `insert` is there when the row's answer is an expression, or a Function whose whole work is one `Outputs.x = …`.
 */
export function phraseOf(row) {
  const p = { id: row.id, bubble: row.bubble, type: row.type, example: row.example, kind: row.answer.kind, node: row.answer.node || null, prose: row.answer.prose || null, note: row.note || null };
  let code = null, vars = null;
  if (row.answer.kind === 'expression' && row.fixture?.vars) { code = row.answer.code; vars = row.fixture.vars; }
  else if (row.answer.kind === 'function' && row.fixture?.inputs) {
    const body = String(row.answer.code).split('\n').map((l) => l.trim()).filter((l) => l && !/^Outputs\.\w+\(\);$/.test(l));
    const one = body.length === 1 && /^Outputs\.(\w+) = (.+);$/.exec(body[0]);
    if (one && !/\bOutputs\b/.test(one[2])) { code = one[2].replace(/\bInputs\.(\w+)/g, '$1'); vars = row.fixture.inputs; p.output = one[1]; }
    else p.code = row.answer.code;
  }
  if (code) {
    const free = Object.keys(vars).filter((v) => names(code).includes(v));
    const first = names(row.example).find((w) => free.includes(w));
    const subject = first || (free.length === 1 ? free[0] : null);
    if (subject) p.insert = { code, subject, others: Object.fromEntries(free.filter((v) => v !== subject).map((v) => [v, slotWord(vars[v])])) }; // each other value: the kind of slot it is
  }
  return p;
}

/** The phrases that follow a value of `type`: that type's rows, then the Any rows, each once. */
export function phrasesFor(rows, type) {
  const own = rows.filter((r) => r.type === type);
  const any = type === 'Any' ? [] : rows.filter((r) => r.type === 'Any' && !own.some((o) => o.bubble === r.bubble));
  return [...own, ...any].map(phraseOf);
}

/** Where a value's chain ends: past `.name`, `(…)` and `[…]` after it (`state.toUpperCase()`), brackets balanced. */
function chainEnd(text, i) {
  const close = (at, open, shut) => { let depth = 0, q = null; for (let j = at; j < text.length; j++) { const c = text[j]; if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') q = c; else if (c === open) depth++; else if (c === shut && --depth === 0) return j + 1; } return -1; };
  for (;;) {
    const m = /^\s*(\?\.|\.)\s*[A-Za-z_$][\w$]*/.exec(text.slice(i));
    if (m) { i += m[0].length; continue; }
    const k = /^\s*/.exec(text.slice(i))[0].length;
    if (text[i + k] === '(' || text[i + k] === '[') { const e = close(i + k, text[i + k], text[i + k] === '(' ? ')' : ']'); if (e < 0) return i; i = e; continue; }
    return i;
  }
}

/**
 * Applies a phrase to the chip `name` in `text`: its last occurrence, with the chain it already ends with
 * (`state.toUpperCase()`: Bubble's "state :uppercase is …"), becomes the phrase's code with that as the subject, each other value a slot named for its kind (text, number, list, date) and not taken in `taken`. Returns
 * { text, slots: { slotName: the phrasebook variable it stands for } }, or null when the phrase cannot be inserted.
 */
const afterDot = (s, at) => s[at - 1] === '.' && s[at - 2] !== '.'; // `item.name` is a property; `...list` is a spread of a value
export function applyPhrase(text, name, phrase, taken = new Set()) {
  if (!phrase.insert) return null;
  const { code, subject, others } = phrase.insert;
  const used = new Set([...taken, ...names(text)]);
  const re = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b(?![\\w$])`, 'g');
  let last = -1, m;
  while ((m = re.exec(text))) if (!afterDot(text, m.index)) last = m.index;
  const end = last < 0 ? -1 : chainEnd(text, last + name.length);
  const slots = {}; const rename = { [subject]: last < 0 ? name : text.slice(last, end) };
  for (const [v, base] of Object.entries(others)) {
    let s = base, i = 2;
    while (used.has(s)) s = `${base}${i++}`;
    used.add(s); rename[v] = s; slots[s] = v;
  }
  let out = code.replace(/[A-Za-z_$][\w$]*/g, (w, at) => (rename[w] !== undefined && !afterDot(code, at) ? rename[w] : w));
  if (/\s(===|!==|==|!=|<=|>=|<|>|\+|-|\*|\/|&&|\|\||\?)\s/.test(out)) out = `(${out})`;
  if (last < 0) return { text: (text && !/\s$/.test(text) ? text + ' ' : text) + out, slots };
  return { text: text.slice(0, last) + out + text.slice(end), slots };
}
