// dictionary.mjs — STU-044: the community's Bubble→Noodl dictionary as cases the importer's expression compiler is graded on.
//
// The dictionary (OpenNoodl dev-docs/tasks/phase-86-the-community-already-built-it/corpus/bubble-dictionary/, 94 rows)
// names each operator the way Bubble's editor DISPLAYS it (":count", "<-range->"); a Bubble app stores the INTERNAL name
// (`count`, `to_range`?) in its expression's Message chain. This table is the join: per phrasebook row (scripts/bubble-
// phrasebook/rows.js, where every answer was executed), the internal name, where that name comes from, the operands, and
// the answer. `dictionary-check.mjs` builds a Bubble app with one Group per case (its data source is the expression), runs
// the real converter on it and evaluates the Expression each Group gets.
//
// name       the internal operator name sent; null when Bubble's name for it is not measured and the importer has none
// grounded   'bubble_ex' when the name (and the operand's place: `args` or `properties`) is in Rico Trevisan's bubble_ex
//            vocabulary or compiler (commit 5f1c480), which were written from real payloads; null when the name is the
//            importer's own and has never been seen in a payload — a pass on such a row says the operator computes the
//            right thing, not that a real app reaches it
// x          the subject (root `This thing`, read as `thing`)
// args       the operator's argument; { v: 'b' } is a second value (a URL parameter named b, read as `url_b`)
// props      the operator's `properties`, for the operators bubble_ex shows keep their operands there
// then       further operators applied after this one
// expect     the answer; `from` says whose: the phrasebook's executed fixture, Bubble's own stated result (bubbleResult),
//            or a probe of this gate where the dictionary's example cannot tell a right compile from a wrong one
// none       the phrasebook's answer is that NodeGX has no equivalent
const B = { v: 'b' };
const text = (s) => ({ type: 'TextExpression', entries: { 0: s } }); // how Bubble's editor stores a typed text operand

export const cases = (S) => {
  const d = (y, m, day, h = 0, min = 0) => new Date(y, m, day, h, min, 0);
  const ranges = { DR1: [d(2023, 0, 1, 14), d(2023, 0, 6, 14)], DR2: [d(2023, 0, 4, 14), d(2023, 0, 10, 14)], DR3: [d(2022, 11, 25), d(2023, 0, 2)] };
  return [
    // ── Any
    { row: '96', name: 'equals', grounded: 'bubble_ex', x: S.String1, args: B, b: S.String2, expect: false, from: 'fixture' },
    { row: '97', name: 'not_equals', grounded: 'bubble_ex', x: S.String1, args: B, b: S.String2, expect: true, from: 'fixture' },
    { row: '98', name: 'is_empty', grounded: 'bubble_ex', x: S.String1, expect: false, from: 'bubbleResult' },
    { row: '98', case: 'an empty text', name: 'is_empty', grounded: 'bubble_ex', x: '', expect: true, from: 'probe' },
    { row: '99', name: 'is_not_empty', grounded: 'bubble_ex', x: S.String2, expect: true, from: 'bubbleResult' },
    { row: '100', name: 'format_json_encode', grounded: 'bubble_ex', x: S.String4, expect: '"pink, blue, purple, red, white, cherry/deep-red"', from: 'fixture' },
    { row: '101', name: 'format_json_encode', grounded: 'bubble_ex', x: S.Date1, expectOneOf: [S.Date1.toISOString(), JSON.stringify(S.Date1.toISOString())], from: 'bubbleResult', note: 'the dictionary shows the ISO instant unquoted; quoted is accepted too (a JSON literal, as text gets)' },
    // ── String
    { row: '102', name: 'is_not_contained_by_list', grounded: 'bubble_ex', x: S.String1, args: B, b: S.List1, expect: true, from: 'fixture' },
    { row: '103', name: 'contains', grounded: 'bubble_ex', x: S.String2, args: B, b: S.String1, expect: true, from: 'fixture' },
    { row: '104', name: 'not_contains', grounded: 'bubble_ex', x: S.String1, args: B, b: S.String2, expect: true, from: 'fixture' },
    { row: '105', none: true }, { row: '106', none: true },
    { row: '107', name: 'capitalized_words', grounded: 'bubble_ex', x: S.String2, expect: 'Hello World', from: 'fixture' },
    { row: '108', name: 'to_uppercase', grounded: 'bubble_ex', x: S.String2, expect: 'HELLO WORLD', from: 'fixture' },
    { row: '109', name: 'to_lowercase', grounded: 'bubble_ex', x: S.String1, expect: 'hello', from: 'fixture' },
    { row: '110', name: 'append', grounded: null, x: S.String1, args: ' World', expect: 'Hello World', from: 'bubbleResult' },
    { row: '111', name: 'format_url_encode', grounded: 'bubble_ex', x: S.String2, expect: 'Hello%20world', from: 'fixture' },
    { row: '112', none: true }, { row: '113', none: true },
    { row: '114', name: 'trim', grounded: 'bubble_ex', x: '  Hello world ', expect: 'Hello world', from: 'probe' },
    { row: '115', name: 'number_of_characters', grounded: 'bubble_ex', x: S.String2, expect: 11, from: 'fixture' },
    { row: '116', name: 'truncated', grounded: 'bubble_ex', x: S.String2, args: 5, expect: 'Hello', from: 'fixture' },
    { row: '117', name: null, expect: 'world', from: 'fixture' },
    { row: '118', name: 'convert_to_number', grounded: 'bubble_ex', x: S.String3, expect: 99, from: 'bubbleResult' },
    { row: '119', name: 'split_by', grounded: 'bubble_ex', x: S.String4, props: { separator: text(', ') }, expect: S.List1, from: 'fixture' },
    { row: '120', name: 'find_replace', grounded: 'bubble_ex', x: S.String2, props: { find: text('world'), replace: text('Homer') }, expect: 'Hello Homer', from: 'fixture' },
    { row: '120', case: 'every match', name: 'find_replace', grounded: 'bubble_ex', x: 'a-b-c', props: { find: text('-'), replace: text('+') }, expect: 'a+b+c', from: 'probe', note: "Bubble's find & replace replaces every occurrence; String.replace with a text replaces the first" },
    { row: '121', name: null, expect: 'world', from: 'fixture' },
    // ── Integer
    { row: '122', name: 'format_number', grounded: 'bubble_ex', x: S.Int1, props: { formatting_type: 'currency', currency: 'USD' }, expect: '$3.33', from: 'fixture', note: "bubble_ex keeps format_number's settings verbatim and names none of them: the property keys sent here are unmeasured" },
    { row: '123', name: 'format_number', grounded: 'bubble_ex', x: S.Int1, props: { decimals: 2 }, expect: '3.33', from: 'fixture', note: 'the property keys are unmeasured, as above' },
    { row: '124', name: 'times', grounded: 'bubble_ex', x: S.Int1, args: B, b: S.Int2, expect: 29997, from: 'fixture' },
    { row: '124', case: 'plus', name: 'plus', grounded: 'bubble_ex', x: 2, args: B, b: 3, expect: 5, from: 'probe' },
    { row: '124', case: 'minus', name: 'minus', grounded: 'bubble_ex', x: 2, args: B, b: 3, expect: -1, from: 'probe' },
    { row: '124', case: 'divide', name: 'divide', grounded: 'bubble_ex', x: 9, args: B, b: 3, expect: 3, from: 'probe' },
    { row: '124', case: 'modulo', name: 'modulo', grounded: 'bubble_ex', x: 9, args: B, b: 4, expect: 1, from: 'probe' },
    { row: '124', case: 'less than', name: 'less_than', grounded: 'bubble_ex', x: 2, args: B, b: 3, expect: true, from: 'probe' },
    { row: '124', case: 'greater or equal', name: 'greater_or_equal_than', grounded: 'bubble_ex', x: 2, args: B, b: 3, expect: false, from: 'probe' },
    { row: '125', name: 'rounded', grounded: 'bubble_ex', x: S.Int1, args: 0, expect: 3, from: 'fixture' },
    { row: '125', case: 'no places given', name: 'rounded', grounded: 'bubble_ex', x: 2.5, expect: 3, from: 'probe' },
    { row: '126', name: null, expect: 3, from: 'fixture' }, { row: '127', name: null, expect: 4, from: 'fixture' }, { row: '128', name: null, expect: 11.108889000000001, from: 'fixture' },
    { row: '129', name: 'to_range', grounded: null, x: S.Int1, args: B, b: S.Int2, expect: [3.333, 9000], from: 'fixture' },
    // ── Integer range (a range is two numbers, as the phrasebook models it)
    { row: '130', name: 'min', grounded: null, x: S.IntRange1, expect: 1, from: 'fixture' },
    { row: '131', name: 'max', grounded: null, x: S.IntRange1, expect: 20, from: 'fixture' },
    { row: '132', name: 'average', grounded: null, x: S.IntRange1, expect: 10.5, from: 'fixture' },
    { row: '133', name: null, expect: true, from: 'fixture' },
    { row: '134', name: 'range_contains_point', grounded: null, x: S.IntRange1, args: B, b: S.Int1, expect: true, from: 'fixture' },
    { row: '135', name: null, expect: false, from: 'fixture' },
    { row: '136', name: 'range_overlaps', grounded: null, x: S.IntRange1, args: B, b: S.IntRange2, expect: true, from: 'fixture' },
    { row: '137', name: null, expect: false, from: 'fixture' }, { row: '138', name: null, expect: false, from: 'fixture' }, { row: '139', name: null, expect: false, from: 'fixture' },
    { row: '140', name: 'range_less_than_point', grounded: null, x: S.IntRange1, args: B, b: S.Int1, expect: false, from: 'fixture' },
    // ── Date
    { row: '141', root: { type: 'PageData', properties: { name: 'Current Date/Time' } }, grounded: 'bubble_ex', name: 'Current Date/Time', now: true, from: 'probe' },
    { row: '142', name: 'format_date', grounded: 'bubble_ex', x: S.Date1, props: { formatting_type: 'custom', custom_format: 'ddd dS mm-yy HH:MM' }, expect: 'Thu 6th 07-23 14:22', from: 'bubbleResult' },
    { row: '143', name: 'format_json_encode', grounded: 'bubble_ex', x: S.Date1, expectOneOf: [S.Date1.toISOString(), JSON.stringify(S.Date1.toISOString())], from: 'bubbleResult' },
    { row: '144', name: 'to_range', grounded: null, x: S.Date2, args: B, b: S.Date1, expect: [S.Date2, S.Date1], from: 'probe' },
    { row: '145', name: 'plus_days', grounded: 'bubble_ex', x: S.Date1, args: 2, expect: d(2023, 6, 8, 14, 22), from: 'bubbleResult' },
    { row: '145', case: '+(months) on the 31st', name: 'plus_months', grounded: 'bubble_ex', x: d(2023, 0, 31, 9), args: 1, expect: d(2023, 1, 28, 9), from: 'probe', note: "months clamp to the month's last day (the phrasebook's Date Add rule); setMonth rolls 31 January into March" },
    { row: '146', name: 'change_minutes', grounded: null, x: S.Date1, args: 0, expect: d(2023, 6, 6, 14, 0), from: 'fixture' },
    { row: '147', name: 'greater_than', grounded: 'bubble_ex', x: S.Date1, args: B, b: S.Date2, expect: true, from: 'fixture' },
    { row: '148', name: 'less_than', grounded: 'bubble_ex', x: S.Date1, args: B, b: S.Date2, expect: false, from: 'fixture' },
    { row: '149', name: null, expect: 53, from: 'bubbleResult' },
    { row: '150', name: 'extract_from_date', grounded: 'bubble_ex', x: S.Date1, props: { component_to_extract: 'month' }, expect: 7, from: 'bubbleResult', note: "the unit's spelling ('month') is unmeasured; its place, properties.component_to_extract, is bubble_ex's" },
    { row: '151', name: 'rounded_down', grounded: 'bubble_ex', x: S.Date1, props: { component_to_extract: 'week' }, expect: d(2023, 6, 3), from: 'bubbleResult' },
    { row: '151', case: 'to the month', name: 'rounded_down', grounded: 'bubble_ex', x: S.Date1, props: { component_to_extract: 'month' }, expect: d(2023, 6, 1), from: 'probe' },
    { row: '152', name: 'equals_rounded_down', grounded: null, x: S.Date1, args: B, b: d(2023, 6, 6, 15, 30), props: { component_to_extract: 'year' }, expect: true, from: 'probe', note: "the dictionary's own example (2023 against 1970) is false for every reading of the operator; an hour apart in one year is the case that tells" },
    { row: '153', name: null, expect: S.Date1, from: 'fixture' }, { row: '154', name: null, expect: S.Date2, from: 'fixture' },
    // ── Date Range
    { row: '155', name: null, expect: ranges.DR1[0], from: 'fixture' }, { row: '156', name: null, expect: ranges.DR1[1], from: 'fixture' }, { row: '157', name: null, from: 'fixture' },
    { row: '158', name: null, expect: false, from: 'fixture' },
    { row: '159', name: 'range_contains_point', grounded: null, x: ranges.DR1, args: B, b: S.Date1, expect: false, from: 'fixture' },
    { row: '160', name: null, expect: true, from: 'fixture' },
    { row: '161', name: 'range_overlaps', grounded: null, x: ranges.DR1, args: B, b: ranges.DR2, expect: true, from: 'fixture' },
    { row: '162', name: null, expect: true, from: 'fixture' }, { row: '163', name: null, expect: true, from: 'fixture' }, { row: '164', name: null, expect: false, from: 'fixture' },
    { row: '165', name: 'range_less_than_point', grounded: null, x: ranges.DR2, args: B, b: S.Date1, expect: true, from: 'fixture' },
    // ── List
    { row: '166', name: 'merged_with', grounded: 'bubble_ex', x: S.List1, args: B, b: S.List2, then: [{ name: 'unique' }], expect: [...S.List1, ...S.List2], from: 'fixture' },
    { row: '166', case: 'a repeat removed', name: 'unique', grounded: 'bubble_ex', x: ['a', 'b', 'a'], expect: ['a', 'b'], from: 'probe' },
    { row: '167', name: 'count', grounded: 'bubble_ex', x: S.List1, expect: 6, from: 'fixture' },
    { row: '168', name: 'contains', grounded: 'bubble_ex', x: S.List1, args: B, b: 'apples', expect: false, from: 'fixture' },
    { row: '169', name: 'contains', grounded: 'bubble_ex', x: S.List3, args: B, b: S.List3[0], expect: true, from: 'fixture', note: 'the same record object: a NodeGX record is one object per id, so membership by identity is membership by id' },
    { row: '170', name: 'not_contains', grounded: 'bubble_ex', x: S.List3, args: B, b: { name: 'John', location: 'Paris' }, expect: true, from: 'fixture' },
    { row: '171', name: 'first_element', grounded: 'bubble_ex', x: S.List1, expect: 'pink', from: 'fixture' },
    { row: '172', name: 'last_element', grounded: 'bubble_ex', x: S.List1, expect: 'cherry/deep-red', from: 'fixture' },
    { row: '173', name: 'random_item', grounded: null, x: S.List1, expectOneOf: S.List1, from: 'fixture' },
    { row: '174', name: 'specific_item', grounded: 'bubble_ex', x: S.List1, args: 2, expect: 'blue', from: 'fixture' },
    { row: '175', name: 'limit_to', grounded: 'bubble_ex', x: S.List1, args: 2, expect: ['pink', 'blue'], from: 'fixture', note: "bubble_ex's limit_to is the dictionary's \":items until #\"" },
    { row: '176', name: 'items_from', grounded: null, x: S.List1, args: 5, expect: ['white', 'cherry/deep-red'], from: 'fixture' },
    { row: '177', name: 'contains_list', grounded: 'bubble_ex', x: S.List1, args: B, b: S.List2, expect: false, from: 'fixture' },
    { row: '177', case: 'every one there', name: 'contains_list', grounded: 'bubble_ex', x: S.List1, args: B, b: ['red', 'pink'], expect: true, from: 'probe' },
    { row: '178', root: { type: 'Search', properties: { type: 'custom.person' } }, then: [{ name: 'location_text' }], name: 'location_text', grounded: 'bubble_ex', x: S.List3, expect: ['New York', 'New York', 'Boston'], from: 'fixture', note: "a search's field is each item's field (bubble_ex: a field's owner is the list's item type); the search's items stand in for List3" },
    { row: '178', case: 'after a list operator', name: 'unique', grounded: 'bubble_ex', then: [{ name: 'location_text' }], x: S.List3, expect: ['New York', 'New York', 'Boston'], from: 'probe' },
    { row: '178', case: "a list field's field", root: { type: 'Search', properties: { type: 'custom.team' } }, then: [{ name: 'members_list_custom_person' }, { name: 'location_text' }], name: 'members_list_custom_person', grounded: 'bubble_ex', x: [{ members: S.List3.slice(0, 2) }, { members: S.List3.slice(2) }], expect: ['New York', 'New York', 'Boston'], from: 'probe', note: "a list of lists reads flat in Bubble (Teams' members' locations), as the members field of every team in turn" },
    { row: '179', name: 'plus_element', grounded: 'bubble_ex', x: S.List1, args: 'mauve', expect: [...S.List1, 'mauve'], from: 'fixture' },
    { row: '180', same: '179' },
    { row: '181', name: 'minus_element', grounded: 'bubble_ex', x: S.List1, args: 'pink', expect: S.List1.slice(1), from: 'fixture' },
    { row: '182', name: 'minus_list', grounded: 'bubble_ex', x: S.List1, args: B, b: ['pink', 'blue'], expect: S.List1.slice(2), from: 'fixture' },
    { row: '183', name: 'merged_with', grounded: 'bubble_ex', x: S.List1, args: B, b: S.List2, expect: [...S.List1, ...S.List2], from: 'fixture' },
    { row: '184', name: 'intersect_with', grounded: 'bubble_ex', x: S.List1, args: B, b: ['blue', 'red', 'teal'], expect: ['blue', 'red'], from: 'fixture' },
    { row: '185', name: null, from: 'fixture' },
    { row: '186', name: 'filtered', grounded: 'bubble_ex', x: S.List3, props: { constraints: { 0: { key: 'name_text', constraint_type: 'not equal', value: 'Frank' } } }, expect: S.List3.slice(1), from: 'fixture' },
    { row: '187', name: 'sorted', grounded: 'bubble_ex', x: S.List3, props: { sort_field: 'name_text', descending: true }, expect: [S.List3[1], S.List3[2], S.List3[0]], from: 'fixture' },
    { row: '186', case: 'an empty value matches nothing', name: 'filtered', grounded: 'bubble_ex', x: S.List3, props: { constraints: { 0: { key: 'name_text', constraint_type: 'equals', value: { v: 'b' } } } }, b: '', expect: [], from: 'probe', note: "bubble_ex's replay (2026-10-07): a page's :filtered with an empty constraint value matches nothing unless Ignore empty constraints is set" },
    { row: '186', case: 'ignore empty constraints', name: 'filtered', grounded: 'bubble_ex', x: S.List3, props: { ignore_empty_constraints: true, constraints: { 0: { key: 'name_text', constraint_type: 'equals', value: { v: 'b' } } } }, b: '', expect: S.List3, from: 'probe' },
    { row: '186', case: 'a number above', name: 'filtered', grounded: 'bubble_ex', x: [{ n: 1 }, { n: 5 }, { n: 9 }], props: { constraints: { 0: { key: 'n_number', constraint_type: 'greater than', value: 4 } } }, expect: [{ n: 5 }, { n: 9 }], from: 'probe' },
    { row: '187', case: 'numbers, ascending', name: 'sorted', grounded: 'bubble_ex', x: [{ n: 10 }, { n: 9 }, { n: 100 }], props: { sort_field: 'n_number' }, expect: [{ n: 9 }, { n: 10 }, { n: 100 }], from: 'probe', note: 'numbers sort as numbers, not as text (10 before 9)' },
    { row: '187', case: 'a list of texts', name: 'sorted', grounded: 'bubble_ex', x: ['pear', 'apple'], props: {}, expect: ['apple', 'pear'], from: 'probe' },
    { row: '188', none: true },
    { row: '189', name: 'join_with', grounded: null, x: S.List3.map((i) => i.name), args: ' & ', expect: 'Frank & Jim & Jane', from: 'fixture', note: "the importer's join_with on the names; the per-item part (\"per item: name\") is a field read before it" },
  ];
};
