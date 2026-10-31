/**
 * NodeGX Studio — an expression read as a sentence (STU-098, Richard's Greenhouse note 12). The Expression node holds
 * JavaScript; the composer shows it as pieces a person who does not code can read and change: a value (a chip), a word
 * for each operator (`===` is "is"), and a typed value in a box of its kind (a text, a number, yes / no, a date) with no
 * quotes to keep. Every piece remembers where it is in the text, so a change to a piece is a change to the JavaScript.
 *
 * Pure: no DOM. studio.html draws the pieces; editor/sentence-check.mjs grades them.
 */

// a token per word, text, number, operator (`===` is one, not `= = =`) or single character: the composer's own
const TOKEN = /[A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|\s+|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\?\.|=>|\.\.\.|./g;

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
  '+': '+', '-': '−', '*': '×', '/': '÷', '?': 'then', ':': 'otherwise', '??': 'or if empty',
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

/**
 * The pieces of an expression, in order, whitespace dropped. `isName(name)` says whether a word is one of the
 * expression's values (a chip or an empty slot). Each piece has `from` / `to` in the text; a piece that owns a closing
 * bracket further on (`contains`, a date) has `close`, the range of that bracket, hidden from the sentence.
 *   { kind: 'name', name } · { kind: 'text' | 'number' | 'yesno' | 'date', value } · { kind: 'word', word, code } · { kind: 'code', code }
 */
export function pieces(text, isName = () => false) {
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
  for (let i = 0; i < toks.length; i++) {
    if (hidden.has(i)) continue;
    const { t, from, to } = toks[i];
    // new Date("2026-10-30"): one date box
    if (t === 'new' && toks[i + 1]?.t === 'Date' && toks[i + 2]?.t === '(' && /^["']\d{4}-\d{2}-\d{2}["']$/.test(toks[i + 3]?.t || '') && toks[i + 4]?.t === ')') {
      out.push({ kind: 'date', value: unquote(toks[i + 3].t), from, to: toks[i + 4].to }); i += 4; continue;
    }
    // .includes( … ): the word "contains", its bracket kept out of the sentence
    if (t === '.' && toks[i + 1]?.t === 'includes' && toks[i + 2]?.t === '(') {
      const j = closer(i + 2);
      if (j > 0) { hidden.add(j); out.push({ kind: 'word', word: 'contains', code: '.includes(', from, to: toks[i + 2].to, close: { from: toks[j].from, to: toks[j].to } }); i += 2; continue; }
    }
    if (/^["']/.test(t)) out.push({ kind: 'text', value: unquote(t), from, to });
    else if (/^\d/.test(t)) out.push({ kind: 'number', value: Number(t), from, to });
    else if (t === 'true' || t === 'false') out.push({ kind: 'yesno', value: t === 'true', from, to });
    else if (/^[A-Za-z_$]/.test(t) && isName(t)) out.push({ kind: 'name', name: t, from, to });
    else if (Object.hasOwn(WORDS, t)) out.push({ kind: 'word', word: WORDS[t], code: t, from, to });
    else out.push({ kind: 'code', code: t, from, to });
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
  '+': 'adds two numbers, or joins two texts into one', '-': 'takes the right number away from the left', '*': 'multiplies', '/': 'divides the left number by the right',
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
  if (piece.kind === 'word') return `“${piece.word}” is ${piece.code === '.includes(' ? '.includes( … )' : piece.code} in the code: ${MEANS[piece.code] ?? 'JavaScript'}.`;
  return 'Studio has no word for this: it is JavaScript as it is.';
}

/** The text cut at the pieces' edges: each segment is `{ text, piece }`, `piece` the index of the piece that wrote it
    (a closing bracket a piece owns is that piece's), or null for the spaces between. Their texts join back to `text`. */
export function codeSegments(text, ps) {
  const marks = [];
  ps.forEach((q, i) => { marks.push({ from: q.from, to: q.to, piece: i }); if (q.close) marks.push({ from: q.close.from, to: q.close.to, piece: i }); });
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

/** The text without a piece (and the bracket it owns), its spaces tidied. */
export function removePiece(text, piece) {
  let s = text;
  if (piece.close) s = splice(s, piece.close.from, piece.close.to, ' ');
  s = splice(s, piece.from, piece.to, ' '); // `tags.includes(` out of `tags.includes("fern")` leaves `tags "fern"`, not `tags"fern"`
  return s.replace(/\s{2,}/g, ' ').trim();
}

/** "then … otherwise" reads as English only after an "if": the sentence starts with one when it has a `?`. */
export const opensWithIf = (ps) => ps.some((p) => p.kind === 'word' && p.code === '?');

/** One line of the sentence, for a chip or a step's name: `chipText(name)` is a value's words. */
export function sentenceLine(text, chipText = (n) => n, isName = () => false) {
  const ps = pieces(text, isName);
  const words = (opensWithIf(ps) ? ['if'] : []).concat(ps.map((p) => (
    p.kind === 'name' ? `[${chipText(p.name)}]`
      : p.kind === 'text' ? `“${p.value}”`
        : p.kind === 'yesno' ? (p.value ? 'yes' : 'no')
          : p.kind === 'date' ? p.value
            : p.kind === 'word' ? p.word
              : p.kind === 'number' ? String(p.value) : p.code)));
  // a bracket and a dot sit against what they open or follow
  return words.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ \. /g, '.').replace(/ ,/g, ',');
}
