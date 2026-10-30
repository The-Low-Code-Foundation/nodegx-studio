/**
 * STU-094 (Richard's Greenhouse note 5: "option sets need fields that point at one or many options of another set",
 * Bubble's shape). An option set's attribute can be `{ type: 'option', of: <set key> }` or `{ type: 'options', of }`:
 * each option holds that set's Value (or a list of them), as a Choice taken from a set holds its Values
 * (P123-GH-OPTSETCHOICE). Pure: no DOM, no store, so shapes-check.mjs runs it on fixtures.
 */

/** An attribute that points at another set: the set's key, or null. */
export const linkOf = (a) => ((a?.type === 'option' || a?.type === 'options') && a.of ? a.of : null);

/**
 * The fields an option is found by, in the order studio.html's `optionValue` reads them: its Value, its Label, the
 * set's first column, then the shapes made before Label + Value (`display`, the importer's `value`).
 */
export const valueKeys = (attributes) => [...new Set(['Value', 'Label', attributes?.[0]?.name, 'display', 'value'].filter(Boolean))];

/**
 * What an attribute's cells become when it starts pointing at a set (or stops): a typed word that names one of the
 * set's options, by its Value or its Label, becomes that option's Value; a word naming none is dropped (the panel
 * shows the set's options to pick from). A list stops being a list as its first item; a link becomes plain text.
 * `find(word)` returns the Value of the option the word names, or undefined.
 */
export function convertCell(v, type, find) {
  if (v === undefined || v === null || v === '') return undefined;
  const words = Array.isArray(v) ? v.map(String) : String(v).split(',').map((s) => s.trim()).filter(Boolean);
  if (type === 'option') return words.map(find).find((x) => x !== undefined);
  if (type === 'options') { const out = [...new Set(words.map(find).filter((x) => x !== undefined))]; return out.length ? out : undefined; }
  return Array.isArray(v) ? v.join(', ') : v;
}

/**
 * The script of the Function node the ⚡ menu places to read through sets: "Task's language's size's Label" is the
 * record's language (`Inputs.value`), found by Value in Languages (`Inputs.set0`), its size found in Sizes
 * (`Inputs.set1`), its Label. Each step: `{ attr, keys }` (the field to read, the fields its set's options are found
 * by). A list (a list of options, or a list read on) is read item by item. The node's ports are its script's
 * `Inputs.name` and `Outputs.name`, so each set is named in full.
 */
export function readThroughScript(steps, says = '') {
  const sets = steps.map((_, i) => `Inputs.set${i}`).join(', ');
  return [
    `// ${says || 'An option read through its set'}: each step finds the option holding the value in its set, then reads one of its fields`,
    `const steps = ${JSON.stringify(steps)};`,
    `const sets = [${sets}];`,
    `const valueOf = (o, keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return String(o[k]); return ''; };`,
    `const read = (v, i) => {`,
    `  if (v === undefined || v === null || v === '') return undefined;`,
    `  if (Array.isArray(v)) return v.flatMap((x) => { const r = read(x, i); return r === undefined ? [] : r; });`,
    `  if (i === steps.length) return v;`,
    `  const o = (Array.isArray(sets[i]) ? sets[i] : []).find((x) => x && valueOf(x, steps[i].keys) === String(v));`,
    `  return o ? read(o[steps[i].attr], i + 1) : undefined;`,
    `};`,
    `Outputs.result = read(Inputs.value, 0);`
  ].join('\n');
}
