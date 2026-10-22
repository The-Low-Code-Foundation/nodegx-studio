// packages/nodegx-backend/src/admin/app/format.ts
var NAME_RULE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
var RESERVED_COLUMNS = ["objectId", "createdAt", "updatedAt", "ACL"];
var RESERVED_WORDS = [
  "ABORT",
  "ACTION",
  "ADD",
  "AFTER",
  "ALL",
  "ALTER",
  "ANALYZE",
  "AND",
  "AS",
  "ASC",
  "ATTACH",
  "AUTOINCREMENT",
  "BEFORE",
  "BEGIN",
  "BETWEEN",
  "BY",
  "CASCADE",
  "CASE",
  "CAST",
  "CHECK",
  "COLLATE",
  "COLUMN",
  "COMMIT",
  "CONFLICT",
  "CONSTRAINT",
  "CREATE",
  "CROSS",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "DATABASE",
  "DEFAULT",
  "DEFERRABLE",
  "DEFERRED",
  "DELETE",
  "DESC",
  "DETACH",
  "DISTINCT",
  "DROP",
  "EACH",
  "ELSE",
  "END",
  "ESCAPE",
  "EXCEPT",
  "EXCLUSIVE",
  "EXISTS",
  "EXPLAIN",
  "FAIL",
  "FOR",
  "FOREIGN",
  "FROM",
  "FULL",
  "GLOB",
  "GROUP",
  "HAVING",
  "IF",
  "IGNORE",
  "IMMEDIATE",
  "IN",
  "INDEX",
  "INDEXED",
  "INITIALLY",
  "INNER",
  "INSERT",
  "INSTEAD",
  "INTERSECT",
  "INTO",
  "IS",
  "ISNULL",
  "JOIN",
  "KEY",
  "LEFT",
  "LIKE",
  "LIMIT",
  "MATCH",
  "NATURAL",
  "NO",
  "NOT",
  "NOTNULL",
  "NULL",
  "OF",
  "OFFSET",
  "ON",
  "OR",
  "ORDER",
  "OUTER",
  "PLAN",
  "PRAGMA",
  "PRIMARY",
  "QUERY",
  "RAISE",
  "RECURSIVE",
  "REFERENCES",
  "REGEXP",
  "REINDEX",
  "RELEASE",
  "RENAME",
  "REPLACE",
  "RESTRICT",
  "RIGHT",
  "ROLLBACK",
  "ROW",
  "SAVEPOINT",
  "SELECT",
  "SET",
  "TABLE",
  "TEMP",
  "TEMPORARY",
  "THEN",
  "TO",
  "TRANSACTION",
  "TRIGGER",
  "UNION",
  "UNIQUE",
  "UPDATE",
  "USING",
  "VACUUM",
  "VALUES",
  "VIEW",
  "VIRTUAL",
  "WHEN",
  "WHERE",
  "WITH",
  "WITHOUT"
];
function isReservedWord(name) {
  return RESERVED_WORDS.indexOf(name.toUpperCase()) !== -1;
}
function validName(name, taken, what) {
  if (!name) return what + " needs a name.";
  if (!NAME_RULE.test(name)) return '"' + name + '": start with a letter, then letters, digits or _ only.';
  if (RESERVED_COLUMNS.indexOf(name) !== -1) return '"' + name + '" is reserved by the backend.';
  if (name.length > 64) return '"' + name + '" is too long: at most 64 characters.';
  if (isReservedWord(name)) return '"' + name + '" is a word the database keeps for itself. Try ' + name + "Value or the" + name.charAt(0).toUpperCase() + name.slice(1) + ".";
  if (taken && taken.indexOf(name) !== -1) return 'There is already a field called "' + name + '".';
  return null;
}

// packages/nodegx-backend/src/admin/app/fieldKinds.ts
var KINDS = [
  { id: "text", label: "Text", line: "words, names, descriptions", icon: "Aa", storage: "String" },
  { id: "number", label: "Number", line: "amounts, counts, prices", icon: "#", storage: "Number" },
  { id: "yesno", label: "Yes / No", line: "a switch", icon: "\u25D0", storage: "Boolean" },
  { id: "date", label: "Date & time", line: "when something happened", icon: "\u25F7", storage: "Date" },
  { id: "choice", label: "Choice", line: "one of a list you define", icon: "\u2630", storage: "String" },
  { id: "link", label: "Link", line: "points at one record in another collection", icon: "\u2192", storage: "Pointer" },
  { id: "links", label: "Links", line: "points at many records in another collection", icon: "\u21C9", storage: "Relation" },
  { id: "file", label: "Picture or file", line: "an upload", icon: "\u25A3", storage: "File" },
  { id: "location", label: "Location", line: "a point on the map", icon: "\u2316", storage: "GeoPoint" },
  { id: "list", label: "List", line: "several values", icon: "\u2261", storage: "Array" },
  { id: "anything", label: "Anything", line: "structured data for developers", icon: "{}", storage: "Object" }
];
function kindById(id) {
  return KINDS.find((k) => k.id === id) || KINDS[0];
}
function searchKinds(query) {
  const q = query.trim().toLowerCase();
  if (!q) return KINDS;
  return KINDS.filter((k) => (k.label + " " + k.line + " " + k.storage).toLowerCase().indexOf(q) !== -1);
}
function ruleFields(rule) {
  if (rule.exactlyOne) return rule.exactlyOne;
  if (rule.allOrNone) return rule.allOrNone;
  return rule.field ? [rule.field] : [];
}
function rulesOn(field, checks) {
  return (checks || []).filter((c) => c.declared && c.rule.field === field).map((c) => c.rule);
}
function kindOf(col, checks) {
  if (col.type === "String" && rulesOn(col.name, checks).some((r) => r.oneOf)) return kindById("choice");
  return KINDS.find((k) => k.storage === col.type && k.id !== "choice") || { id: "anything", label: col.type, line: "", icon: "?", storage: col.type };
}
function withRules(columns, checks) {
  if (!checks || !checks.length) return columns;
  return columns.map((c) => {
    const rules = rulesOn(c.name, checks);
    if (!rules.length) return c;
    const out = { ...c };
    rules.forEach((r) => {
      if (r.oneOf) out.allowed = r.oneOf;
      if (r.min !== void 0) out.min = r.min;
      if (r.max !== void 0) out.max = r.max;
      if (r.maxLength !== void 0) out.maxLength = r.maxLength;
      if (r.looksLike) out.looksLike = r.looksLike;
      if (r.whole) out.whole = true;
    });
    return out;
  });
}
function blankDraft(kind = "text") {
  return {
    kind,
    name: "",
    description: "",
    required: false,
    unique: false,
    dflt: "",
    boolDefaultSet: false,
    boolDefault: false,
    maxLength: "",
    looksLike: "",
    min: "",
    max: "",
    whole: false,
    values: [],
    target: ""
  };
}
function takesDefault(kind) {
  return kind === "text" || kind === "number" || kind === "yesno" || kind === "choice";
}
function takesUnique(kind) {
  return kind === "text" || kind === "number" || kind === "date" || kind === "choice" || kind === "link";
}
var num = (s) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return isNaN(n) ? NaN : n;
};
function draftProblem(d, ctx) {
  const n = d.name.trim();
  const problem = validName(n, ctx.taken, "The field");
  if (problem) return problem;
  const kind = kindById(d.kind);
  const box = d.required && ctx.records > 0 ? "The fill value" : "The default";
  if ((d.kind === "link" || d.kind === "links") && !d.target) return "Choose the collection it points at.";
  if ((d.kind === "link" || d.kind === "links") && ctx.collections.indexOf(d.target) === -1) return "There is no collection called " + d.target + ".";
  if (d.kind === "choice") {
    if (!d.values.length) return "A choice needs at least one value.";
    if (d.dflt && d.values.indexOf(d.dflt) === -1) return box + " must be one of the choices.";
  }
  if (d.kind === "number") {
    const lo = num(d.min);
    const hi = num(d.max);
    if (lo !== null && isNaN(lo)) return "The minimum must be a number.";
    if (hi !== null && isNaN(hi)) return "The maximum must be a number.";
    if (lo !== null && hi !== null && lo > hi) return "The minimum is above the maximum.";
    const df = num(d.dflt);
    if (df !== null && isNaN(df)) return box + " must be a number.";
    if (df !== null && d.whole && !Number.isInteger(df)) return box + " must be a whole number.";
    if (df !== null && lo !== null && df < lo) return box + " is below the minimum.";
    if (df !== null && hi !== null && df > hi) return box + " is above the maximum.";
    if (d.whole && lo !== null && !Number.isInteger(lo)) return "With whole numbers only, the minimum is a whole number too.";
    if (d.whole && hi !== null && !Number.isInteger(hi)) return "With whole numbers only, the maximum is a whole number too.";
  }
  if (d.kind === "text") {
    const ml = num(d.maxLength);
    if (ml !== null && (isNaN(ml) || !Number.isInteger(ml) || ml < 1)) return "The max length is a whole number of at least 1.";
    if (ml !== null && d.dflt.length > ml) return box + " is longer than the max length.";
  }
  if (d.required && ctx.records > 0 && !takesDefault(kind.id)) {
    return "A required " + kind.label + " can only be added while the collection is empty: the " + recordsWord(ctx.records) + " already here would have nothing in it.";
  }
  if (d.required && ctx.records > 0 && !hasDefault(d)) {
    return "Say what the " + recordsWord(ctx.records) + " already in the collection get: a required field needs a value in each of them.";
  }
  return null;
}
function recordsWord(n) {
  return n === 1 ? "1 record" : n + " records";
}
function defaultRule(d, records) {
  if (!takesDefault(d.kind)) return { disabled: true, why: "", label: "Default", fill: false };
  if (!d.required) return { disabled: false, why: "", label: "Default", fill: false };
  if (records > 0) {
    return {
      disabled: false,
      label: "Fill the " + recordsWord(records) + " already here with",
      why: "Once, now. It is not a default: a new record without this field is refused.",
      fill: true
    };
  }
  return { disabled: true, why: "A required field has no default: every record must say it.", label: "Default", fill: false };
}
function hasDefault(d) {
  if (d.kind === "yesno") return d.boolDefaultSet;
  if (!takesDefault(d.kind)) return false;
  return d.dflt.trim() !== "";
}
function toColumn(d, records = 0) {
  const kind = kindById(d.kind);
  const column = { name: d.name.trim(), type: kind.storage };
  if (d.kind === "link" || d.kind === "links") column.targetClass = d.target;
  if (d.required) column.required = true;
  if (d.description.trim()) column.description = d.description.trim();
  if (d.kind === "yesno") {
    if (d.boolDefaultSet) column.defaultValue = d.boolDefault;
  } else if (d.kind === "number") {
    const df = num(d.dflt);
    if (df !== null && !isNaN(df)) column.defaultValue = df;
  } else if (d.kind === "text" || d.kind === "choice") {
    if (d.dflt.trim()) column.defaultValue = d.dflt.trim();
  }
  if (d.required && records > 0 && column.defaultValue !== void 0) {
    column.fillExisting = column.defaultValue;
    delete column.defaultValue;
  }
  return column;
}
function toRules(d) {
  const field = d.name.trim();
  const out = [];
  if (d.kind === "choice") out.push({ field, oneOf: d.values.slice() });
  if (d.kind === "text") {
    const ml = num(d.maxLength);
    if (ml !== null && !isNaN(ml)) out.push({ field, maxLength: ml });
    if (d.looksLike) out.push({ field, looksLike: d.looksLike });
  }
  if (d.kind === "number") {
    const lo = num(d.min);
    const hi = num(d.max);
    const range = { field };
    if (lo !== null && !isNaN(lo)) range.min = lo;
    if (hi !== null && !isNaN(hi)) range.max = hi;
    if (range.min !== void 0 || range.max !== void 0) out.push(range);
    if (d.whole) out.push({ field, whole: true });
  }
  return out;
}
function mergeRules(existing, field, mine) {
  const kept = (existing || []).filter((c) => c.declared && c.rule.field !== field).map((c) => c.rule);
  return kept.concat(mine);
}
function rulesWithout(existing, field) {
  return (existing || []).filter((c) => c.declared && ruleFields(c.rule).indexOf(field) === -1).map((c) => c.rule);
}
function defaultWords(col) {
  if (col.defaultValue === void 0 || col.defaultValue === null) return "";
  if (col.type === "Boolean") return col.defaultValue === true ? "Yes" : "No";
  return String(col.defaultValue);
}
export {
  KINDS,
  blankDraft,
  defaultRule,
  defaultWords,
  draftProblem,
  hasDefault,
  kindById,
  kindOf,
  mergeRules,
  recordsWord,
  ruleFields,
  rulesOn,
  rulesWithout,
  searchKinds,
  takesDefault,
  takesUnique,
  toColumn,
  toRules,
  withRules
};
