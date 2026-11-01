// packages/nodegx-backend/src/admin/app/ruleVocabulary.ts
function atomWords(atom) {
  if (typeof atom === "string") return atom;
  const hops = Array.isArray(atom.path?.hops) ? atom.path.hops.length : 0;
  return `Whoever reaches it (through ${hops} link${hops === 1 ? "" : "s"})`;
}
var CLP_OPS = ["find", "get", "create", "update", "delete"];
var ROLE_PREFIX = "role:";
function roleAtom(name) {
  return `${ROLE_PREFIX}${name}`;
}
function roleName(atom) {
  if (!atom.startsWith(ROLE_PREFIX)) return null;
  const name = atom.slice(ROLE_PREFIX.length);
  return name.length > 0 ? name : null;
}
var NOBODY = { inherit: false, anyone: false, signedIn: false, roles: [], unknown: [] };
var INHERIT = { ...NOBODY, inherit: true };
function atomsOf(rule) {
  if (rule === void 0 || rule === null) return [];
  return Array.isArray(rule) ? rule : [rule];
}
function parseRule(rule) {
  if (rule === void 0 || rule === null) return { ...INHERIT };
  const selection = { inherit: false, anyone: false, signedIn: false, roles: [], unknown: [] };
  for (const atom of atomsOf(rule)) {
    if (typeof atom !== "string") {
      selection.unknown.push(atom);
      continue;
    }
    if (atom === "public") selection.anyone = true;
    else if (atom === "authenticated") selection.signedIn = true;
    else if (atom === "nobody") continue;
    else {
      const name = roleName(atom);
      if (name !== null) {
        if (!selection.roles.includes(name)) selection.roles.push(name);
      } else selection.unknown.push(atom);
    }
  }
  return selection;
}
function selectionToRule(selection) {
  if (selection.inherit) return void 0;
  const atoms = [];
  if (selection.anyone) atoms.push("public");
  if (selection.signedIn) atoms.push("authenticated");
  for (const role of selection.roles) atoms.push(roleAtom(role));
  for (const extra of selection.unknown) atoms.push(extra);
  if (atoms.length === 0) return "nobody";
  return atoms.length === 1 ? atoms[0] : atoms;
}
function isNobody(selection) {
  return !selection.inherit && !selection.anyone && !selection.signedIn && selection.roles.length === 0 && selection.unknown.length === 0;
}
function withAnyone() {
  return { ...NOBODY, anyone: true };
}
function withNobody() {
  return { ...NOBODY };
}
function withInherit() {
  return { ...INHERIT };
}
function withSignedIn(selection, on) {
  const base = grantable(selection);
  return { ...base, signedIn: on };
}
function withRole(selection, role, on) {
  const base = grantable(selection);
  const roles = base.roles.filter((r) => r !== role);
  if (on) roles.push(role);
  return { ...base, roles };
}
function grantable(selection) {
  return { ...selection, inherit: false, anyone: false };
}

// packages/nodegx-backend/src/admin/app/permissionsModel.ts
var OP_ROWS = [
  { op: "find", word: "List", verb: "list" },
  { op: "get", word: "Open one", verb: "open" },
  { op: "create", word: "Create", verb: "create" },
  { op: "update", word: "Change", verb: "change" },
  { op: "delete", word: "Delete", verb: "delete" }
];
var FILE_ROWS = [
  { op: "upload", word: "Upload", verb: "upload" },
  { op: "read", word: "Open", verb: "open" },
  { op: "delete", word: "Delete", verb: "delete" }
];
function opVerb(op) {
  const row = OP_ROWS.find((r) => r.op === op) || FILE_ROWS.find((r) => r.op === op);
  return row ? row.verb : op === "call" ? "call" : op;
}
function audienceWords(sel, defaultSel) {
  if (sel.inherit) return defaultSel ? "Default (" + audienceWords(defaultSel) + ")" : "Default";
  if (sel.anyone) return "Everyone";
  const parts = [];
  if (sel.signedIn) parts.push("Signed in");
  parts.push(...sel.roles, ...sel.unknown.map(atomWords));
  return parts.length ? parts.join(", ") : "No one";
}
function ruleWords(rule, fallback) {
  return audienceWords(parseRule(rule), fallback === void 0 ? void 0 : parseRule(fallback));
}
function matrixFrom(rules, ops) {
  const out = {};
  for (const op of ops) out[op] = parseRule(rules ? rules[op] : void 0);
  return out;
}
function rulesFrom(matrix, ops) {
  const out = {};
  for (const op of ops) {
    const rule = selectionToRule(matrix[op]);
    if (rule !== void 0) out[op] = rule;
  }
  return out;
}
function allInherit(matrix, ops) {
  return ops.every((op) => matrix[op].inherit);
}
function rolesNamed(rules) {
  const out = [];
  for (const rule of rules) {
    for (const atom of atomsOf(rule)) {
      const name = typeof atom === "string" ? roleName(atom) : null;
      if (name !== null && out.indexOf(name) === -1) out.push(name);
    }
  }
  return out;
}
function matrixRules(matrix, ops) {
  return ops.map((op) => selectionToRule(matrix[op]));
}
function cellState(sel, column) {
  if (column === "default") return { checked: sel.inherit, implied: false };
  if (sel.inherit) return { checked: false, implied: false };
  if (column === "everyone") return { checked: sel.anyone, implied: false };
  if (column === "noOne") return { checked: isNobody(sel), implied: sel.anyone };
  if (column === "signedIn") return { checked: sel.signedIn || sel.anyone, implied: sel.anyone };
  return { checked: sel.roles.indexOf(column.role) !== -1 || sel.anyone, implied: sel.anyone };
}
function toggleCell(sel, column, on) {
  if (column === "default") return on ? withInherit() : withNobody();
  if (column === "noOne") return on ? withNobody() : sel.inherit ? withNobody() : sel;
  if (column === "everyone") return on ? withAnyone() : withNobody();
  if (column === "signedIn") return withSignedIn(sel, on);
  return withRole(sel, column.role, on);
}
function roleColumnEmpty(matrix, ops, role) {
  return ops.every((op) => matrix[op].roles.indexOf(role) === -1);
}
function withoutRoleColumn(matrix, ops, role) {
  const out = { ...matrix };
  for (const op of ops) out[op] = withRole(out[op], role, false);
  return out;
}
var TEMPLATES = [
  {
    id: "public-read",
    label: "Public read, signed-in write",
    sentence: "Anyone can list and open records. Only signed-in people can create, change or delete them."
  },
  { id: "signed-in", label: "Signed-in only", sentence: "Only signed-in people can see or change anything." },
  {
    id: "owner",
    label: "Only the owner",
    sentence: "Signed-in people can create records, and each person sees and changes only the records they created."
  },
  { id: "role-only", label: "One role only", sentence: "Only people in the role you pick can see or change anything.", needsRole: true },
  { id: "locked", label: "Locked", sentence: "No one can reach this collection except the admin credential." }
];
function templateEntry(id, role) {
  const all = (rule) => ({ find: rule, get: rule, create: rule, update: rule, delete: rule });
  switch (id) {
    case "public-read":
      return { permissions: { find: "public", get: "public", create: "authenticated", update: "authenticated", delete: "authenticated" }, creatorOwns: false };
    case "signed-in":
      return { permissions: all("authenticated"), creatorOwns: false };
    case "owner":
      return { permissions: all("authenticated"), creatorOwns: true };
    case "role-only":
      return { permissions: all("role:" + (role || "")), creatorOwns: false };
    case "locked":
      return { permissions: all("nobody"), creatorOwns: false };
  }
}
function visibleCollections(names) {
  return names.filter((n) => !n.startsWith("_")).sort((a, b) => a.localeCompare(b));
}
function entrySummary(entry, defaults) {
  if (!entry || !entry.permissions && entry.creatorOwns === void 0) return "The defaults";
  const rules = entry.permissions || {};
  const parts = OP_ROWS.filter((r) => rules[r.op] !== void 0).map((r) => r.verb + ": " + ruleWords(rules[r.op]));
  if (entry.creatorOwns !== void 0) parts.push(entry.creatorOwns ? "records belong to their creator" : "records are shared");
  const inherited = OP_ROWS.filter((r) => rules[r.op] === void 0).length;
  if (inherited && inherited < OP_ROWS.length) parts.push(inherited + " from the defaults");
  return parts.join(" \xB7 ") || "The defaults";
}
function signupChoice(rule) {
  const sel = parseRule(rule);
  if (sel.anyone) return "public";
  if (isNobody(sel) || sel.inherit) return "nobody";
  return "other";
}
var IDEMPOTENCY_OPTIONS = [
  ["off", "Run every time"],
  ["key", "Replay on a repeated key"],
  ["key-body", "Replay on key + body"],
  ["required", "Require a key, then replay"],
  ["required-body", "Require a key + body"]
];
function idempotencyChoice(value) {
  if (!value || !value.enabled) return "off";
  if (value.requireKey) return value.hashBody ? "required-body" : "required";
  return value.hashBody ? "key-body" : "key";
}
function idempotencyValue(choice) {
  switch (choice) {
    case "off":
      return void 0;
    case "key":
      return { enabled: true };
    case "key-body":
      return { enabled: true, hashBody: true };
    case "required":
      return { enabled: true, requireKey: true };
    case "required-body":
      return { enabled: true, requireKey: true, hashBody: true };
  }
}
function draftFrom(row) {
  return {
    call: parseRule(row.configured === null ? void 0 : row.configured),
    runAs: row.runAs === "system" ? "system" : "",
    ownLimit: row.rateLimit !== null,
    perMinute: row.rateLimit ? row.rateLimit.ratePerMinute : 60,
    burst: row.rateLimit ? row.rateLimit.burst : 30,
    timeoutSeconds: row.timeoutMs === null ? "" : String(row.timeoutMs / 1e3),
    idempotency: idempotencyChoice(row.idempotency)
  };
}
function draftProblem(d) {
  if (d.ownLimit && (!Number.isFinite(d.perMinute) || d.perMinute < 0 || !Number.isFinite(d.burst) || d.burst < 0)) {
    return "A limit is a number of calls per minute and a burst, each 0 or more (0 and 0 means no limit at all).";
  }
  if (d.timeoutSeconds.trim() !== "") {
    const s = Number(d.timeoutSeconds);
    if (!Number.isFinite(s) || s < 0) return "The time limit is a number of seconds, 0 or more (0 means no limit).";
  }
  return null;
}
function entryFromDraft(d) {
  const entry = {};
  const call = selectionToRule(d.call);
  if (call !== void 0) entry.call = call;
  if (d.runAs === "system") entry.runAs = "system";
  if (d.ownLimit) entry.rateLimit = { ratePerMinute: d.perMinute, burst: d.burst };
  if (d.timeoutSeconds.trim() !== "") entry.timeoutMs = Math.round(Number(d.timeoutSeconds) * 1e3);
  const idem = idempotencyValue(d.idempotency);
  if (idem) entry.idempotency = idem;
  return Object.keys(entry).length ? entry : void 0;
}
function functionChips(row, publicWriteDefault) {
  const chips = [];
  if (!row.deployed) {
    chips.push({ kind: "warn", label: "not deployed", why: "A rule guards the name " + row.name + ", but no deployed function answers to it. It grants nothing until one does." });
  }
  if (row.source === "graph") {
    chips.push({
      kind: "",
      label: "from the graph",
      why: "No rule of its own: the graph\u2019s Allow Unauthenticated port decides (" + (row.allowNoAuth ? "ticked, so everyone" : "unticked, so signed in") + ")."
    });
  }
  if (row.graphRefusesAnonymous) {
    chips.push({
      kind: "bad",
      label: "fails for signed-out callers",
      why: "This rule lets a signed-out caller through, but the function\u2019s Request node does not have Allow Unauthenticated ticked, so the call reaches the graph and fails there. Tick the port on the canvas, or set this to Signed in."
    });
  }
  if (row.rateLimitSource === "public-write-default" && publicWriteDefault) {
    chips.push({
      kind: "accent",
      label: publicWriteDefault.ratePerMinute + "/min default",
      why: "Anyone can call it and it writes records, and it has no limit of its own, so the public-write default applies: " + publicWriteDefault.ratePerMinute + " a minute, burst " + publicWriteDefault.burst + ", per caller."
    });
  }
  if (row.rateLimitSource === "declared" && row.effectiveRateLimit === null) {
    chips.push({ kind: "accent", label: "no limit, on purpose", why: "Its limit is 0 and 0, which means no budget of its own \u2014 the opt-out for a provider\u2019s webhook." });
  }
  return chips;
}
function verdictSentence(who, op, what, answer) {
  const verb = opVerb(op);
  const refusedRow = answer.allowed && answer.recordAllowed === false;
  const may = answer.allowed && !refusedRow ? " may " : " may not ";
  const tail = op === "call" ? "call " + what : verb + " " + what;
  return who + may + tail + (refusedRow ? ": the collection allows it, but that record\u2019s sharing does not." : ".");
}
function verdictRule(answer) {
  const words = ruleWords(answer.rule);
  return "The rule for it is " + words + (answer.source === "graph" ? " (from the graph\u2019s Allow Unauthenticated port)" : "") + ".";
}
export {
  CLP_OPS,
  FILE_ROWS,
  IDEMPOTENCY_OPTIONS,
  OP_ROWS,
  TEMPLATES,
  allInherit,
  atomWords,
  audienceWords,
  cellState,
  draftFrom,
  draftProblem,
  entryFromDraft,
  entrySummary,
  functionChips,
  idempotencyChoice,
  idempotencyValue,
  matrixFrom,
  matrixRules,
  opVerb,
  parseRule,
  roleAtom,
  roleColumnEmpty,
  rolesNamed,
  ruleWords,
  rulesFrom,
  selectionToRule,
  signupChoice,
  templateEntry,
  toggleCell,
  verdictRule,
  verdictSentence,
  visibleCollections,
  withoutRoleColumn
};
