/**
 * NodeGX Studio — an expression read as a sentence (STU-098, Richard's Greenhouse note 12). The Expression node holds
 * JavaScript; the composer shows it as pieces a person who does not code can read and change: a value (a chip), a word
 * for each operator (`===` is "is"), and a typed value in a box of its kind (a text, a number, yes / no, a date) with no
 * quotes to keep. Every piece remembers where it is in the text, so a change to a piece is a change to the JavaScript.
 *
 * Pure: no DOM. studio.html draws the pieces; editor/sentence-check.mjs grades them.
 */

// a token per word, text, number, operator (`===` is one, not `= = =`) or single character: the composer's own
const TOKEN = /[A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|\s+|===|!==|==|!=|<=|>=|\*\*|&&|\|\||\?\?|\?\.|=>|\.\.\.|./g;

/** Each token with where it starts and ends in the text. */
export function tokenize(text) {
  const out = []; let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) out.push({ t: m[0], from: m.index, to: m.index + m[0].length });
  return out;
}

/** The word each operator is read as. A token not here and not a value is shown as it is. */
export const WORDS = {
  '===': 'is', '==': 'is', '!==': 'is not', '!=': 'is not', '&&': 'and', '||': 'or', '!': 'not',
  '>': 'is more than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most',
  '+': '+', '-': '−', '*': '×', '/': '÷', '**': 'to the power of', '?': 'then', ':': 'otherwise', '??': 'or if empty',
  null: 'nothing', undefined: 'nothing',
};

/** What the composer's buttons insert, by the word on the button. `back` puts the caret that far before the end (inside the brackets). */
export const INSERTS = [
  ['is', '==='], ['is not', '!=='], ['and', '&&'], ['or', '||'], ['not', '!'],
  ['is more than', '>'], ['is less than', '<'], ['contains', '.includes()', 1],
  ['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['( )', '()', 1], ['then … otherwise', '?  :', 2],
];

/** The JavaScript for a typed value of each kind. */
export const literal = {
  text: (v) => JSON.stringify(String(v)),
  number: (v) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? String(Number(v)) : '0'),
  yesno: (v) => (v ? 'true' : 'false'),
  date: (v) => `new Date(${JSON.stringify(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today())})`,
};
export const today = () => new Date().toISOString().slice(0, 10);

const unquote = (t) => { try { return new Function(`return ${t};`)(); } catch { return t.slice(1, -1); } }; // the token is a matched literal

/* ---- A phrase from the composer's more… menu, read back as the words on its button (Richard, 2026-10-31: "first
   item" showed `[0]`, "items from" showed `slice()`). Each phrase's JavaScript is a template: its subject (the chip it
   follows), its other values and its typed numbers / texts are holes; the rest is the phrase, shown as its Bubble words. ---- */

// the order a value of no known type tries them in: a list's `[0]` is its first item before a date range's start
const READ_ORDER = ['List', 'String', 'Integer', 'Date', 'Any', 'Integer range', 'Date Range'];

/**
 * The templates of a phrasebook (serve.mjs /phrasebook.json, `{ type: phrases }`): one per phrase that inserts and is
 * more than an operator Studio already has a word for. A number or text in it is a value the person sets only when the
 * button's words ask for one ("items from #", "truncated to", "split by..."); otherwise it is the phrase's own (`[0]` is
 * "first item", `[1]` a range's end, `/ 2` an average). A value named twice (`range[0] … range[1]`) is one value.
 */
export function phraseReads(byType = {}) {
  const out = [];
  for (const type of READ_ORDER) for (const ph of byType[type] || []) {
    if (!ph.insert || ph.type !== type) continue; // the Any rows are listed under every type: read each once
    const { code, subject, others } = ph.insert;
    const toks = tokenize(code).map((x) => x.t).filter((t) => !/^\s+$/.test(t));
    const params = new Set(); // an arrow's parameters: `item` in `(item) => item.name`; the field after one is the person's
    toks.forEach((t, i) => { if (t !== '=>') return; if (/^[A-Za-z_$]/.test(toks[i - 1])) params.add(toks[i - 1]); else if (toks[i - 1] === ')') for (let j = i - 2; j >= 0 && toks[j] !== '('; j--) if (/^[A-Za-z_$]/.test(toks[j])) params.add(toks[j]); });
    const asks = /#|\.\.\.|\bto\b|\bby\b/.test(ph.bubble);
    let subj = false; const seen = new Set();
    const tpl = toks.map((t, i) => {
      if (t === subject) { if (subj) return { same: true }; subj = true; return { subject: true }; }
      if (Object.hasOwn(others, t)) { if (seen.has(t)) return { again: t }; seen.add(t); return { hole: true, name: t }; }
      if (/^["'\d]/.test(t)) return asks && t !== '0' ? { hole: true } : { fixed: t }; // `.slice(0, 2)`: from the start, to a number
      if (/^[A-Za-z_$]/.test(t) && toks[i - 1] === '.' && params.has(toks[i - 2])) { if (seen.has(`.${t}`)) return { again: `.${t}` }; seen.add(`.${t}`); return { field: true, name: `.${t}` }; }
      return { fixed: t };
    });
    const fixed = tpl.filter((x) => x.fixed !== undefined);
    if (!subj || fixed.every((x) => Object.hasOwn(WORDS, x.fixed) || x.fixed === '(' || x.fixed === ')')) continue;
    out.push({ type, word: ph.bubble.replace(/^[\s.]+|[\s.]+$/g, ''), bubble: ph.bubble, tpl, code: fixed.map((x) => x.fixed).join('') });
  }
  return out;
}

const isValueTok = (t) => /^[A-Za-z_$"'\d]/.test(t) && !['new', 'typeof', 'null', 'undefined'].includes(t);

/** A template matched at toks[i]: the template entry and token index of each token it took, or null. `chained` (a
    value's name) lets a template that starts at its subject start after it instead, on a value already read
    (`plants[0].toUpperCase()`: the first item, uppercased). */
function matchRead(toks, i, r, isName, chained) {
  const tpl = chained ? r.tpl.slice(1) : r.tpl;
  const got = []; let subjTok = chained; const holes = {};
  for (let k = 0, j = i; k < tpl.length; k++, j++) {
    const e = tpl[k], tok = toks[j];
    if (!tok) return null;
    if (e.subject) { if (!/^[A-Za-z_$]/.test(tok.t) || !isName(tok.t)) return null; subjTok = tok.t; }
    else if (e.same) { if (tok.t !== subjTok) return null; }
    else if (e.hole) { if (!isValueTok(tok.t)) return null; if (e.name) holes[e.name] = tok.t; }
    else if (e.again) { if (tok.t !== holes[e.again]) return null; }
    else if (e.field) { if (!/^[A-Za-z_$]/.test(tok.t)) return null; holes[e.name] = tok.t; }
    else if (tok.t !== e.fixed) return null;
    got.push({ e, j });
  }
  return got.length ? got : null;
}

/** The piece one token is, outside any phrase. */
function tokenPiece({ t, from, to }, isName) {
  if (/^["']/.test(t)) return { kind: 'text', value: unquote(t), from, to };
  if (/^\d/.test(t)) return { kind: 'number', value: Number(t), from, to };
  if (t === 'true' || t === 'false') return { kind: 'yesno', value: t === 'true', from, to };
  if (/^[A-Za-z_$]/.test(t) && isName(t)) return { kind: 'name', name: t, from, to };
  if (Object.hasOwn(WORDS, t)) return { kind: 'word', word: WORDS[t], code: t, from, to };
  return { kind: 'code', code: t, from, to };
}

/**
 * The pieces of an expression, in order, whitespace dropped. `isName(name)` says whether a word is one of the
 * expression's values (a chip or an empty slot). Each piece has `from` / `to` in the text; a piece that owns a closing
 * bracket further on (`contains`, a date) has `close`, the range of that bracket, hidden from the sentence.
 * A phrase (`reads`, from phraseReads) is a word piece with `phrase` (its Bubble words), `parts` (the rest of its code,
 * hidden) and `whole` (its range, and the subject it leaves when it is removed), after its subject and before its
 * values; `typeOf(name)` (a chip's dictionary type) picks between phrases written alike (a list's `[0]`, a range's start).
 *   { kind: 'name', name } · { kind: 'text' | 'number' | 'yesno' | 'date', value } · { kind: 'word', word, code } · { kind: 'code', code }
 */
export function pieces(text, isName = () => false, { reads = [], typeOf = () => null } = {}) {
  const toks = tokenize(text).filter((x) => !/^\s+$/.test(x.t));
  const out = [];
  const hidden = new Set(); // closing brackets owned by a piece before them
  const closer = (i) => { // the `)` that closes the `(` at toks[i]
    for (let depth = 0, j = i; j < toks.length; j++) {
      if (toks[j].t === '(') depth++;
      else if (toks[j].t === ')' && --depth === 0) return j;
    }
    return -1;
  };
  let value = null; // the value the token before ended (a name, or a phrase on one): a phrase may follow it
  for (let i = 0; i < toks.length; i++) {
    if (hidden.has(i)) continue;
    // a phrase: of the templates that match here, the one of the value's own type, then the one with most code its own,
    let best = null;
    for (const r of reads) {
      const chained = value && value.end === i - 1 && r.tpl[0].subject ? value.name : null;
      const got = matchRead(toks, i, r, isName, chained);
      if (!got) continue;
      const subj = chained ?? toks[got.find((g) => g.e.subject)?.j]?.t;
      // alike in both (`!a.includes(b)`: "doesn't contain", or "is not in"), the one whose subject comes first
      const score = (typeOf(subj) === r.type ? 1000 : 0) + got.filter((g) => g.e.fixed !== undefined).length - got.findIndex((g) => g.e.subject) / 100;
      if (!best || score > best.score) best = { r, got, score, subj };
    }
    if (best) {
      const { r, got } = best;
      // the phrase's own code in runs of adjacent tokens: its word sits on the first, the rest are hidden
      const runs = [];
      for (const g of got.filter((x) => x.e.fixed !== undefined || x.e.same || x.e.again)) { // a value named again is the phrase's code too
        const last = runs.at(-1);
        if (last && g.j === last.j + 1) { last.to = toks[g.j].to; last.j = g.j; } else runs.push({ from: toks[g.j].from, to: toks[g.j].to, j: g.j });
      }
      const subjG = got.find((g) => g.e.subject);
      if (subjG) out.push(tokenPiece(toks[subjG.j], isName));
      out.push({ kind: 'word', word: r.word, code: r.code, phrase: r.bubble, from: runs[0].from, to: runs[0].to, parts: runs.slice(1).map(({ from, to }) => ({ from, to })),
        whole: { from: toks[got[0].j].from, to: toks[got.at(-1).j].to, keep: subjG ? best.subj : '' } });
      for (const g of got) {
        if (g.e.hole) out.push(tokenPiece(toks[g.j], isName));
        else if (g.e.field) out.push({ kind: 'code', code: toks[g.j].t, from: toks[g.j].from, to: toks[g.j].to });
      }
      i = got.at(-1).j; value = { end: i, name: best.subj }; continue;
    }
    const { t, from, to } = toks[i];
    if (/^[A-Za-z_$]/.test(t) && isName(t)) value = { end: i, name: t };
    // new Date("2026-10-30"): one date box
    if (t === 'new' && toks[i + 1]?.t === 'Date' && toks[i + 2]?.t === '(' && /^["']\d{4}-\d{2}-\d{2}["']$/.test(toks[i + 3]?.t || '') && toks[i + 4]?.t === ')') {
      out.push({ kind: 'date', value: unquote(toks[i + 3].t), from, to: toks[i + 4].to }); i += 4; continue;
    }
    // .includes( … ): the word "contains", its bracket kept out of the sentence
    if (t === '.' && toks[i + 1]?.t === 'includes' && toks[i + 2]?.t === '(') {
      const j = closer(i + 2);
      if (j > 0) { hidden.add(j); out.push({ kind: 'word', word: 'contains', code: '.includes(', from, to: toks[i + 2].to, close: { from: toks[j].from, to: toks[j].to } }); i += 2; continue; }
    }
    out.push(tokenPiece(toks[i], isName));
  }
  return out;
}

/* ---- Both, the teaching view (Richard, 2026-10-31: "is there a way to show both that's kind of educational?"): the
   sentence over its JavaScript, each piece lighting its own characters in the code, and what that code does. ---- */

/** What each operator does, in a sentence a person who does not code reads. */
export const MEANS = {
  '===': 'true when both sides are the same', '==': 'true when both sides are the same (loosely: "3" and 3 count as the same)',
  '!==': 'true when the two sides differ', '!=': 'true when the two sides differ (loosely)',
  '&&': 'true only when both sides are true', '||': 'true when either side is true', '!': 'turns true into false, and false into true',
  '>': 'true when the left side is bigger', '<': 'true when the left side is smaller', '>=': 'true when the left side is bigger or the same', '<=': 'true when the left side is smaller or the same',
  '+': 'adds two numbers, or joins two texts into one', '-': 'takes the right number away from the left', '*': 'multiplies', '/': 'divides the left number by the right', '**': 'multiplies the left number by itself, the right number of times',
  '?': 'if what comes before it is true, the answer is what comes after it…', ':': '…and if not, the answer is what comes after this',
  '??': 'the left side, or the right side when the left one is empty', null: 'no value at all', undefined: 'no value at all',
  '.includes(': 'true when the text or list holds what is in the brackets',
};

/** What a piece is in the code, and what that code does: the line the teaching view says while a piece is pointed at. */
export function teach(piece, chipText = (n) => n) {
  if (piece.kind === 'name') return `[${chipText(piece.name)}] is the name ${piece.name} in the code: the app hands the value to the expression under that name.`;
  if (piece.kind === 'text') return 'A text goes in quotes in the code, so the app knows where it starts and ends.';
  if (piece.kind === 'number') return 'A number is written as it is, no quotes.';
  if (piece.kind === 'yesno') return `Yes and no are true and false in the code: this one is ${piece.value}.`;
  if (piece.kind === 'date') return 'A date is new Date("year-month-day") in the code.';
  if (piece.kind === 'word' && piece.phrase) return `“${piece.word}” is ${piece.code} in the code (the lit part): Bubble’s ${piece.phrase}, as the community’s Bubble→NodeGX dictionary writes it.`;
  if (piece.kind === 'word') return `“${piece.word}” is ${piece.code === '.includes(' ? '.includes( … )' : piece.code} in the code: ${MEANS[piece.code] ?? 'JavaScript'}.`;
  return 'Studio has no word for this: it is JavaScript as it is.';
}

/** The text cut at the pieces' edges: each segment is `{ text, piece }`, `piece` the index of the piece that wrote it
    (a closing bracket a piece owns is that piece's), or null for the spaces between. Their texts join back to `text`. */
export function codeSegments(text, ps) {
  const marks = [];
  ps.forEach((q, i) => { marks.push({ from: q.from, to: q.to, piece: i }); if (q.close) marks.push({ from: q.close.from, to: q.close.to, piece: i }); for (const r of q.parts || []) marks.push({ from: r.from, to: r.to, piece: i }); });
  marks.sort((a, b) => a.from - b.from);
  const out = []; let at = 0;
  for (const m of marks) {
    if (m.from < at) continue;
    if (m.from > at) out.push({ text: text.slice(at, m.from), piece: null });
    out.push({ text: text.slice(m.from, m.to), piece: m.piece }); at = m.to;
  }
  if (at < text.length) out.push({ text: text.slice(at), piece: null });
  return out;
}

/** The text with a range replaced. */
export const splice = (text, from, to, code) => text.slice(0, from) + code + text.slice(to);

/** The text without a piece (and the bracket it owns), its spaces tidied. A phrase goes back to the value it followed. */
export function removePiece(text, piece) {
  if (piece.whole) return splice(text, piece.whole.from, piece.whole.to, piece.whole.keep).replace(/\s{2,}/g, ' ').trim();
  let s = text;
  if (piece.close) s = splice(s, piece.close.from, piece.close.to, ' ');
  s = splice(s, piece.from, piece.to, ' '); // `tags.includes(` out of `tags.includes("fern")` leaves `tags "fern"`, not `tags"fern"`
  return s.replace(/\s{2,}/g, ' ').trim();
}

/** "then … otherwise" reads as English only after an "if": the sentence starts with one when it has a `?`. */
export const opensWithIf = (ps) => ps.some((p) => p.kind === 'word' && p.code === '?');

/** One line of the sentence, for a chip or a step's name: `chipText(name)` is a value's words. */
export function sentenceLine(text, chipText = (n) => n, isName = () => false, opts) {
  const ps = pieces(text, isName, opts);
  const words = (opensWithIf(ps) ? ['if'] : []).concat(ps.map((p) => (
    p.kind === 'name' ? `[${chipText(p.name)}]`
      : p.kind === 'text' ? `“${p.value}”`
        : p.kind === 'yesno' ? (p.value ? 'yes' : 'no')
          : p.kind === 'date' ? p.value
            : p.kind === 'word' ? p.word
              : p.kind === 'number' ? String(p.value) : p.code)));
  // a bracket and a dot sit against what they open or follow
  return words.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ \. /g, '.').replace(/ ,/g, ',').replace(/ :(?=[a-z])/g, ':'); // Bubble's "plants:first item:uppercase"
}
