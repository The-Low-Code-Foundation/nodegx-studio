/**
 * STU-051's Conditional tab: an element's rules, "when … then this property is …", read from and written to the graph.
 * Pure: an Expression's text in, its arms out, and back. Studio's page draws them; a gate can run them in Node.
 *
 * A rule is how the importer writes a Bubble conditional and how Studio writes one: an Expression wired into one of the
 * element's properties, its text `(when) ? value : otherwise`. Several rules on one property are one Expression, a chain
 * `(b) ? y : (a) ? x : otherwise`, the first that holds winning (Bubble: the last rule in the list that holds wins, so the
 * newest is put first). Into a yes/no property that shows or hides (Visible, Mounted) a rule is the condition itself:
 * `(when)` shows the element while it holds, `!(when)` hides it.
 */

/** Skips a quoted string starting at `i`; returns the index of its closing quote. */
function skipString(js, i) {
  const q = js[i];
  for (i++; i < js.length && js[i] !== q; i++) if (js[i] === '\\') i++;
  return i;
}
/** The index of the bracket closing the one at `at`, or -1. */
export function closeOf(js, at) {
  let depth = 0;
  for (let i = at; i < js.length; i++) {
    const ch = js[i];
    if (ch === '"' || ch === "'" || ch === '`') { i = skipString(js, i); continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch) && --depth === 0) return i;
  }
  return -1;
}
/** The index of the first `ch` outside every bracket and string, from `from`, or -1. */
export function topLevel(js, ch, from = 0) {
  let depth = 0;
  for (let i = from; i < js.length; i++) {
    const c = js[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(js, i); continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && c === ch) return i;
  }
  return -1;
}
/** `((a < 2))` → `a < 2`: brackets around the whole, dropped. */
export function unwrap(s) {
  s = s.trim();
  while (s.startsWith('(') && closeOf(s, 0) === s.length - 1) s = s.slice(1, -1).trim();
  return s;
}
export const SHOWING = new Set(['visible', 'mounted']);

/**
 * An Expression's text, read as rules on the property it feeds: `{ arms: [{ when, then }], otherwise, shows }`, or null
 * when it is not one (a computed value is a value, not a rule). `shows`: a showing rule, its `then` "true" or "false".
 */
export function readRule(js, port) {
  const text = String(js ?? '').trim();
  if (!text) return null;
  const arms = [];
  let rest = text;
  for (;;) {
    if (!rest.startsWith('(')) break;
    const end = closeOf(rest, 0);
    if (end < 0) return null;
    const after = rest.slice(end + 1).trimStart();
    if (!after.startsWith('?')) break;
    const body = after.slice(1);
    const colon = topLevel(body, ':');
    if (colon < 0) return null;
    const then = body.slice(0, colon).trim();
    if (!then || topLevel(then, '?') >= 0) return null; // a choice inside a value: not a rule Studio can draw
    arms.push({ when: unwrap(rest.slice(0, end + 1)), then });
    rest = body.slice(colon + 1).trim();
  }
  if (arms.length) return rest ? { arms, otherwise: rest, shows: false } : null;
  if (!SHOWING.has(port)) return null;
  // a showing rule: the condition, or its negation, as the whole text
  if (text.startsWith('!(') && closeOf(text, 1) === text.length - 1) return { arms: [{ when: unwrap(text.slice(1)), then: 'false' }], otherwise: 'true', shows: true };
  return { arms: [{ when: unwrap(text), then: 'true' }], otherwise: 'false', shows: true };
}
/** Rules back into an Expression's text (the inverse of `readRule` for what it returns). */
export function writeRule({ arms, otherwise, shows }) {
  if (shows && arms.length === 1) return arms[0].then === 'false' ? `!(${arms[0].when})` : `(${arms[0].when})`;
  return arms.map((a) => `(${a.when}) ? ${a.then} : `).join('') + otherwise;
}

/** A value as the text of a JavaScript literal: 16, {"value":100,"unit":"%"}, "rgba(…)", true. */
export const literal = (v) => (v === undefined ? 'undefined' : typeof v === 'number' ? String(v) : JSON.stringify(v));
/** A literal's value, or `{ code }` when the text computes something (it is then edited as an expression). */
export function valueOf(js) {
  const t = String(js ?? '').trim();
  if (t === 'undefined') return { value: undefined };
  try { return { value: JSON.parse(t) }; } catch { /* not JSON */ }
  if (/^'(?:[^'\\]|\\.)*'$/.test(t)) return { value: t.slice(1, -1).replace(/\\(.)/g, '$1') };
  return { code: t };
}

/**
 * The key two arms share when they are the same condition: its text with each name replaced by where the name's value
 * comes from (`names`: name → "node.port"), so `w < 768` on two Expressions wired from the same Screen width is one rule.
 */
export function conditionKey(when, names) {
  const out = String(when).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*/g, (m) => (/^["']/.test(m) ? m : names.has(m) ? `{${names.get(m)}}` : m));
  return out.replace(/\s+/g, '');
}

/**
 * Every rule on an element, grouped by condition as Bubble's tab lists them: `[{ key, when, expr, parts: [{ expr, port,
 * arm }] }]`, in the order the element's properties are wired. `exprs`: the Expressions wired into the element, as
 * `{ id, port, text, names: Map(name → "node.port") }`.
 */
export function rulesOf(exprs) {
  const cards = new Map();
  for (const e of exprs) {
    const r = readRule(e.text, e.port);
    if (!r) continue;
    r.arms.forEach((a, arm) => {
      const key = conditionKey(a.when, e.names);
      if (!cards.has(key)) cards.set(key, { key, when: a.when, expr: e.id, parts: [] });
      cards.get(key).parts.push({ expr: e.id, port: e.port, arm, then: a.then, otherwise: r.otherwise, shows: r.shows, rank: arm, of: r.arms.length });
    });
  }
  return [...cards.values()];
}

/** The text after one arm is taken out: `null` when none is left (the Expression goes). */
export function withoutArm(text, port, arm) {
  const r = readRule(text, port);
  if (!r) return text;
  const arms = r.arms.filter((_, i) => i !== arm);
  return arms.length ? writeRule({ ...r, arms }) : null;
}
/** The text with one arm's value, or the otherwise, changed (`arm` -1 is the otherwise). */
export function withValue(text, port, arm, js) {
  const r = readRule(text, port);
  if (!r) return text;
  if (arm < 0) return writeRule({ ...r, otherwise: js });
  return writeRule({ ...r, arms: r.arms.map((a, i) => (i === arm ? { ...a, then: js } : a)) });
}
/** The text with one arm's condition changed. */
export function withCondition(text, port, arm, when) {
  const r = readRule(text, port);
  if (!r) return text;
  return writeRule({ ...r, arms: r.arms.map((a, i) => (i === arm ? { ...a, when: unwrap(when) } : a)) });
}
/**
 * A new rule on a property: a fresh Expression's text, or, when a rule already feeds it, that chain with the new arm
 * first (it wins, as the newest rule in Bubble's list does). `current`: the property's value now, the otherwise.
 */
export function addArm(existingText, port, when, thenJs, current) {
  const r = existingText !== undefined ? readRule(existingText, port) : null;
  if (SHOWING.has(port) && !r) return writeRule({ arms: [{ when: unwrap(when), then: thenJs }], otherwise: thenJs === 'false' ? 'true' : 'false', shows: true });
  if (!r) return writeRule({ arms: [{ when: unwrap(when), then: thenJs }], otherwise: literal(current), shows: false });
  // a showing rule beside another: both become arms of a chain of yes/no values
  const arms = r.shows ? r.arms.map((a) => ({ ...a })) : r.arms;
  return writeRule({ arms: [{ when: unwrap(when), then: thenJs }, ...arms], otherwise: r.otherwise, shows: false });
}
