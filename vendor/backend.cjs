var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  HEARTBEAT_INTERVAL_MS: () => HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS: () => HEARTBEAT_STALE_MS,
  RUNTIME_FILE: () => RUNTIME_FILE,
  allocatePort: () => allocatePort,
  backendsRoot: () => backendsRoot,
  censusBackends: () => censusBackends,
  createBackendDir: () => createBackendDir,
  deleteRuntimeRecord: () => deleteRuntimeRecord,
  ensureProjectId: () => ensureProjectId,
  explainReuse: () => explainReuse,
  findReusableBackend: () => findReusableBackend,
  heartbeatIsFresh: () => heartbeatIsFresh,
  installExitHooks: () => installExitHooks,
  isOwnedBySelf: () => isOwnedBySelf,
  listBackendConfigs: () => listBackendConfigs,
  listRuntimeRecords: () => listRuntimeRecords,
  ownedBackendIds: () => ownedBackendIds,
  ownerIsLive: () => ownerIsLive,
  portIsFree: () => portIsFree,
  processCommandLine: () => processCommandLine,
  processIsAlive: () => processIsAlive,
  provisionBackend: () => provisionBackend,
  readBackendConfig: () => readBackendConfig,
  readRuntimeRecord: () => readRuntimeRecord,
  resolveServiceEntry: () => resolveServiceEntry,
  selfOwnerStartedAt: () => selfOwnerStartedAt,
  startBackend: () => startBackend,
  stopBackend: () => stopBackend,
  stopOwnedBackends: () => stopOwnedBackends,
  touchRuntimeRecord: () => touchRuntimeRecord,
  validateSecurityConfig: () => validateSecurityConfig,
  verifyIsOurBackend: () => verifyIsOurBackend,
  writeRuntimeRecord: () => writeRuntimeRecord
});
module.exports = __toCommonJS(stdin_exports);

// packages/noodl-mcp/src/backend/provision.ts
var import_child_process2 = require("child_process");
var fs3 = __toESM(require("fs"));
var net = __toESM(require("net"));
var path3 = __toESM(require("path"));

// packages/noodl-mcp/src/errors.ts
var ToolError = class extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = "ToolError";
  }
};

// packages/noodl-mcp/src/backend/client.ts
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
function backendsRoot() {
  return process.env.NODEGX_BACKENDS_DIR || path.join(os.homedir(), ".noodl", "backends");
}
function listBackends() {
  const root = backendsRoot();
  let entries;
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  const backends = [];
  for (const id of entries) {
    const dir = path.join(root, id);
    const configPath2 = path.join(dir, "config.json");
    if (!fs.existsSync(configPath2)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath2, "utf-8"));
      let adminToken = null;
      const secretsPath = path.join(dir, "secrets.json");
      if (fs.existsSync(secretsPath)) {
        try {
          adminToken = JSON.parse(fs.readFileSync(secretsPath, "utf-8")).adminToken || null;
        } catch {
          adminToken = null;
        }
      }
      backends.push({ id: config.id || id, name: config.name || id, port: config.port, dir, adminToken });
    } catch {
    }
  }
  return backends;
}
var BackendClient = class {
  constructor(backend) {
    this.backend = backend;
  }
  get descriptor() {
    return this.backend;
  }
  /**
   * @param tolerate status codes to RETURN rather than throw on. Used where a
   *   4xx is a legitimate answer rather than a failure — BAK-005's dashboard
   *   probe, where a 404 means "the operator ran with --no-admin", which is
   *   exactly what the agent asked about. 401 is never tolerable: a rejected
   *   credential is always an error worth stopping for.
   */
  async request(method, routePath, body, tolerate = []) {
    const headers = {};
    if (this.backend.adminToken) headers.authorization = `Bearer ${this.backend.adminToken}`;
    if (body !== void 0) headers["content-type"] = "application/json";
    let res;
    try {
      res = await fetch(`http://127.0.0.1:${this.backend.port}${routePath}`, {
        method,
        headers,
        body: body !== void 0 ? JSON.stringify(body) : void 0
      });
    } catch (e) {
      throw new ToolError(
        "no-backend",
        `Could not reach backend "${this.backend.name}" on port ${this.backend.port}: ${e instanceof Error ? e.message : e}. Is it running? Start it from the editor's Backend Services panel.`
      );
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
    }
    if (res.status === 401) {
      throw new ToolError(
        "backend-error",
        `Backend "${this.backend.name}" rejected the admin credential (401). ` + (this.backend.adminToken ? "The token in its secrets.json may be stale." : `No secrets.json found in ${this.backend.dir} \u2014 start the backend once under BAK-003 to mint the admin credential.`)
      );
    }
    if (res.status >= 400 && !tolerate.includes(res.status)) {
      const message = json && typeof json === "object" && json.error || `HTTP ${res.status}`;
      throw new ToolError("backend-error", `Backend "${this.backend.name}": ${message}`);
    }
    return { status: res.status, json };
  }
  /** Health probe used to decide "running". */
  async isReachable() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.backend.port}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
};

// packages/noodl-mcp/src/backend/runtimeRecord.ts
var import_child_process = require("child_process");
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var RUNTIME_FILE = "runtime.json";
var HEARTBEAT_STALE_MS = 6e4;
var HEARTBEAT_INTERVAL_MS = 1e4;
function recordPath(root, backendId) {
  return path2.join(root, backendId, RUNTIME_FILE);
}
function writeRuntimeRecord(record, root = backendsRoot()) {
  const file = recordPath(root, record.backendId);
  fs2.mkdirSync(path2.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs2.writeFileSync(tmp, JSON.stringify(record, null, 2) + "\n", { mode: 384 });
  fs2.renameSync(tmp, file);
  try {
    fs2.chmodSync(file, 384);
  } catch {
  }
}
function readRuntimeRecord(backendId, root = backendsRoot()) {
  try {
    const parsed = JSON.parse(fs2.readFileSync(recordPath(root, backendId), "utf-8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.backendId !== "string" || typeof parsed.pid !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
function listRuntimeRecords(root = backendsRoot()) {
  let entries;
  try {
    entries = fs2.readdirSync(root);
  } catch {
    return [];
  }
  const out = [];
  for (const id of entries) {
    const record = readRuntimeRecord(id, root);
    if (record) out.push(record);
  }
  return out;
}
function deleteRuntimeRecord(backendId, root = backendsRoot()) {
  try {
    fs2.rmSync(recordPath(root, backendId), { force: true });
  } catch {
  }
}
function touchRuntimeRecord(backendId, root = backendsRoot()) {
  const record = readRuntimeRecord(backendId, root);
  if (!record) return;
  writeRuntimeRecord({ ...record, heartbeatAt: (/* @__PURE__ */ new Date()).toISOString() }, root);
}
function processIsAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
function processCommandLine(pid) {
  try {
    if (process.platform === "win32") {
      const out2 = (0, import_child_process.execFileSync)(
        "wmic",
        ["process", "where", `processid=${pid}`, "get", "commandline", "/format:list"],
        { encoding: "utf-8", timeout: 5e3, stdio: ["ignore", "pipe", "ignore"] }
      );
      const line = out2.split("\n").find((l) => l.trim().toLowerCase().startsWith("commandline="));
      return line ? line.slice(line.indexOf("=") + 1).trim() || null : null;
    }
    const out = (0, import_child_process.execFileSync)("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf-8",
      timeout: 5e3,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}
function verifyIsOurBackend(record, commandLine = processCommandLine(record.pid)) {
  if (commandLine === null) return "unverifiable";
  const namesBackend = commandLine.includes(`--backend-id ${record.backendId}`);
  const looksLikeService = commandLine.includes("nodegx-backend") || !!record.entry && commandLine.includes(record.entry);
  return namesBackend && looksLikeService ? "verified" : "not-ours";
}
function heartbeatIsFresh(record, now = Date.now()) {
  if (!record.heartbeatAt) return true;
  const beat = Date.parse(record.heartbeatAt);
  if (!Number.isFinite(beat)) return true;
  return now - beat < HEARTBEAT_STALE_MS;
}
function ownerIsLive(record, now = Date.now()) {
  return processIsAlive(record.owner?.pid) && heartbeatIsFresh(record, now);
}
var selfOwnerStartedAtCache;
function selfOwnerStartedAt() {
  if (selfOwnerStartedAtCache === void 0) {
    selfOwnerStartedAtCache = new Date(Date.now() - Math.round(process.uptime() * 1e3)).toISOString();
  }
  return selfOwnerStartedAtCache;
}
function isOwnedBySelf(record, self) {
  const owner = record.owner;
  if (!owner) return false;
  return owner.kind === self.kind && owner.pid === self.pid && owner.startedAt === self.startedAt;
}

// packages/noodl-mcp/src/backend/reaper.ts
var STOP_GRACE_MS = 3e3;
var POLL_MS = 100;
function defaultKill(pid, signal) {
  process.kill(pid, signal);
}
var sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
async function terminate(pid, isAlive, kill) {
  try {
    kill(pid, "SIGTERM");
  } catch {
    return "SIGTERM (already gone)";
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return "SIGTERM";
    await sleep(POLL_MS);
  }
  try {
    kill(pid, "SIGKILL");
  } catch {
    return "SIGKILL (already gone)";
  }
  await sleep(POLL_MS);
  return isAlive(pid) ? "escaped" : "SIGKILL";
}
async function reapOrphanedBackends(options = {}) {
  const root = options.root ?? backendsRoot();
  const selfPid = options.selfPid ?? process.pid;
  const selfStartedAt = options.selfStartedAt ?? selfOwnerStartedAt();
  const now = options.now ?? Date.now();
  const isAlive = options.isAlive ?? processIsAlive;
  const commandLineOf = options.commandLineOf ?? processCommandLine;
  const kill = options.kill ?? defaultKill;
  const rows = [];
  for (const record of listRuntimeRecords(root)) {
    const row = (outcome, detail) => ({
      backendId: record.backendId,
      backendName: record.backendName,
      pid: record.pid,
      port: record.port,
      ownerKind: record.owner?.kind ?? "unknown",
      ownerPid: record.owner?.pid ?? 0,
      outcome,
      ...detail ? { detail } : {}
    });
    if (isOwnedBySelf(record, { pid: selfPid, startedAt: selfStartedAt, kind: "noodl-mcp" })) {
      rows.push(row("self"));
      continue;
    }
    if (isAlive(record.owner?.pid ?? 0) && heartbeatIsFresh(record, now)) {
      rows.push(row("owner-alive"));
      continue;
    }
    if (!isAlive(record.pid)) {
      deleteRuntimeRecord(record.backendId, root);
      rows.push(row("already-gone"));
      continue;
    }
    const verdict = verifyIsOurBackend(record, commandLineOf(record.pid));
    if (verdict === "not-ours") {
      deleteRuntimeRecord(record.backendId, root);
      rows.push(row("stale-record", `pid ${record.pid} is no longer our backend \u2014 record dropped, nothing signalled`));
      continue;
    }
    if (verdict === "unverifiable") {
      rows.push(
        row(
          "unverifiable",
          `could not read the command line of pid ${record.pid}; left running and left recorded rather than signalling a pid we cannot prove is ours`
        )
      );
      continue;
    }
    const how = await terminate(record.pid, isAlive, kill);
    deleteRuntimeRecord(record.backendId, root);
    rows.push(
      row(
        "reaped",
        `owner (${record.owner?.kind} pid ${record.owner?.pid}) is gone; stopped with ${how}`
      )
    );
  }
  return rows;
}

// packages/noodl-mcp/src/backend/provision.ts
var READY_PREFIX = "NODEGX_BACKEND_READY ";
var READY_TIMEOUT_MS = 3e4;
var STOP_GRACE_MS2 = 3e3;
var FIRST_PORT = 8578;
function generateBackendId() {
  return "backend_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
function resolveServiceEntry() {
  const probed = [];
  const push = (p) => {
    probed.push(p);
    return fs3.existsSync(p) ? p : null;
  };
  if (process.env.NODEGX_BACKEND_ENTRY) {
    const found = push(process.env.NODEGX_BACKEND_ENTRY);
    if (found) return { entry: found, probed };
  }
  const candidates = [
    // Monorepo sibling, from src/backend/ and from dist/.
    path3.resolve(__dirname, "..", "..", "..", "nodegx-backend", "dist", "cli.js"),
    path3.resolve(__dirname, "..", "..", "nodegx-backend", "dist", "cli.js"),
    // An installed copy.
    path3.resolve(__dirname, "..", "..", "node_modules", "nodegx-backend", "dist", "cli.js"),
    // P112 OWN-015 — the npm install: `prepack` copies the service bundle into this package's own
    // `dist/backend/cli.js` (`build-backend-copy.mjs`), so `npx @nodegx/mcp` can start a backend with nothing else
    // installed. Bundled, `__dirname` is `dist/`. (The candidate above names a package that has never existed on npm.)
    path3.resolve(__dirname, "backend", "cli.js")
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}
function portIsFree(port) {
  return new Promise((resolve2) => {
    const server = net.createServer();
    server.once("error", () => resolve2(false));
    server.once("listening", () => server.close(() => resolve2(true)));
    server.listen(port, "127.0.0.1");
  });
}
async function allocatePort(root = backendsRoot()) {
  const used = /* @__PURE__ */ new Set();
  for (const b of listBackends()) if (typeof b.port === "number") used.add(b.port);
  for (const id of safeReaddir(root)) {
    const record = readRuntimeRecord(id, root);
    if (record) used.add(record.port);
  }
  for (let port = FIRST_PORT; port < FIRST_PORT + 500; port++) {
    if (used.has(port)) continue;
    if (await portIsFree(port)) return port;
  }
  throw new ToolError("backend-error", `No free port found between ${FIRST_PORT} and ${FIRST_PORT + 500}.`);
}
function safeReaddir(dir) {
  try {
    return fs3.readdirSync(dir);
  } catch {
    return [];
  }
}
function configPath(root, id) {
  return path3.join(root, id, "config.json");
}
function listBackendConfigs(root = backendsRoot()) {
  return safeReaddir(root).map((id) => readBackendConfig(id, root)).filter((c) => !!c);
}
function readBackendConfig(id, root = backendsRoot()) {
  try {
    return JSON.parse(fs3.readFileSync(configPath(root, id), "utf-8"));
  } catch {
    return null;
  }
}
function findReusableBackend(existing, name, projectId) {
  if (!projectId) return void 0;
  const wanted = name.trim().toLowerCase();
  return existing.find((b) => b.name.trim().toLowerCase() === wanted && (b.projectIds ?? []).includes(projectId));
}
function explainReuse(existing, name, projectId, identity = {}) {
  const wanted = name.trim().toLowerCase();
  const sameName = existing.filter((b) => b.name.trim().toLowerCase() === wanted);
  const namesakes = sameName.map((b) => b.id);
  if (projectId && sameName.some((b) => (b.projectIds ?? []).includes(projectId))) {
    return { verdict: "reused", note: "", namesakes };
  }
  if (sameName.length === 0) {
    return { verdict: "none-of-that-name", note: "", namesakes };
  }
  if (!projectId) {
    return {
      verdict: "project-has-no-id",
      note: `${sameName.length} backend(s) named "${name}" already exist (${namesakes.join(", ")}), but this project cannot prove it owns one \u2014 ${identity.reason ?? "it has no id in nodegx.project.json"}. A NEW backend was created rather than adopting one on its name alone, because two different projects may legitimately share a backend name. Fix the identity and the next provision will reuse.`,
      namesakes
    };
  }
  if (identity.minted) {
    return {
      verdict: "identity-only-just-minted",
      note: `This project had no id until this call, and ${sameName.length} backend(s) named "${name}" already exist (${namesakes.join(", ")}). A NEW backend was created, because a backend is only ever taken on proof of ownership and there was none. \u26A0\uFE0F If one of the existing ones is really this project's \u2014 stranded when its id went missing \u2014 stop the new one, add "${projectId}" to that backend's config.json \u2192 projectIds, and re-point the project at its endpoint. Nothing here guesses at that for you.`,
      namesakes
    };
  }
  const unowned = sameName.filter((b) => (b.projectIds ?? []).length === 0);
  if (unowned.length > 0) {
    return {
      verdict: "unowned-namesake",
      note: `${unowned.length} backend(s) named "${name}" exist with no owner at all (${unowned.map((b) => b.id).join(", ")}). They were NOT adopted: taking a backend on its name alone is the defect ownership exists to prevent. If one of them is really this project's, add this project's id to its config.json \u2192 projectIds, or delete it.`,
      namesakes
    };
  }
  return {
    verdict: "owned-by-another-project",
    note: `${sameName.length} backend(s) named "${name}" exist but belong to other projects (${namesakes.join(", ")}). A new one was created \u2014 this is correct, not a failure: two projects with the same name must not share a database.`,
    namesakes
  };
}
function censusBackends(existing) {
  const byName = /* @__PURE__ */ new Map();
  for (const b of existing) {
    const key = b.name.trim().toLowerCase();
    byName.set(key, (byName.get(key) ?? 0) + 1);
  }
  return existing.map((b) => {
    const projectIds = b.projectIds ?? [];
    const shared = (byName.get(b.name.trim().toLowerCase()) ?? 0) > 1;
    if (projectIds.length === 0) {
      return {
        id: b.id,
        name: b.name,
        port: b.port,
        projectIds,
        verdict: "unowned",
        note: "No project claims this backend, so no provision can ever reuse it. Adopt it by adding a project id to its config.json \u2192 projectIds, or delete the directory if its data is not wanted. Nothing here deletes it for you."
      };
    }
    return {
      id: b.id,
      name: b.name,
      port: b.port,
      projectIds,
      verdict: shared ? "owned-namesake" : "owned",
      note: shared ? "Shares its name with another backend but has its own owner. This is the ownership rule working, not a fault \u2014 two different projects may be called the same thing." : ""
    };
  });
}
async function createBackendDir(name, projectId, root = backendsRoot()) {
  const id = generateBackendId();
  const dir = path3.join(root, id);
  fs3.mkdirSync(path3.join(dir, "data"), { recursive: true });
  fs3.mkdirSync(path3.join(dir, "workflows"), { recursive: true });
  const config = {
    id,
    name,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    port: await allocatePort(root),
    projectIds: projectId ? [projectId] : []
  };
  fs3.writeFileSync(configPath(root, id), JSON.stringify(config, null, 2));
  fs3.writeFileSync(path3.join(dir, "schema.json"), JSON.stringify({ tables: [] }, null, 2));
  return config;
}
var owned = /* @__PURE__ */ new Map();
function ownedBackendIds() {
  return [...owned.keys()];
}
async function startBackend(config, options = {}) {
  const root = options.root ?? backendsRoot();
  const { entry, probed } = resolveServiceEntry();
  if (!entry) {
    throw new ToolError(
      "backend-error",
      "The nodegx-backend service bundle was not found, so no backend can be started. Installed from npm, it ships inside @nodegx/mcp from version 0.2.0 on; an older version has none, so run npx -y @nodegx/mcp@latest. In a source checkout, build it with `npm run build` in packages/nodegx-backend, or set NODEGX_BACKEND_ENTRY. Probed:\n  " + probed.join("\n  ")
    );
  }
  const dataDir = path3.join(root, config.id);
  const args = [
    entry,
    "serve",
    "--data-dir",
    dataDir,
    "--port",
    String(config.port),
    "--backend-id",
    config.id,
    "--backend-name",
    config.name,
    // Orphan guard #1. See the reaper's module note for what it does and does
    // not cover; `verifyIsOurBackend` also reads `--backend-id` back off this
    // very command line, so the shape of this argv is load-bearing twice.
    "--parent-pid",
    String(process.pid)
  ];
  if (options.projectDir) args.push("--project-dir", options.projectDir);
  const child = (0, import_child_process2.spawn)(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], detached: false });
  const logRing = [];
  const appendLog = (stream, chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (!line.trim()) continue;
      logRing.push(`[${stream}] ${line}`);
      if (logRing.length > 200) logRing.shift();
    }
  };
  child.stderr?.on("data", (c) => appendLog("err", c));
  const ready = await new Promise((resolve2, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
      }
      reject(
        new ToolError(
          "backend-error",
          `The backend "${config.name}" did not become ready within ${READY_TIMEOUT_MS / 1e3}s.
Last output:
${logRing.slice(-15).join("\n")}`
        )
      );
    }, READY_TIMEOUT_MS);
    child.stdout?.on("data", (chunk) => {
      appendLog("out", chunk);
      const line = chunk.toString().split("\n").find((l) => l.startsWith(READY_PREFIX));
      if (!line || settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve2(JSON.parse(line.slice(READY_PREFIX.length)));
      } catch {
        resolve2({ port: config.port });
      }
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ToolError("backend-error", `Failed to spawn nodegx-backend: ${err.message}`));
    });
    child.on("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new ToolError(
          "backend-error",
          `The backend "${config.name}" exited before becoming ready (code=${code}, signal=${signal}).
Last output:
${logRing.slice(-15).join("\n")}`
        )
      );
    });
  });
  const port = ready.port || config.port;
  const record = {
    version: 1,
    backendId: config.id,
    backendName: config.name,
    pid: child.pid,
    port,
    endpoint: `http://127.0.0.1:${port}`,
    entry,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    owner: {
      kind: "noodl-mcp",
      pid: process.pid,
      // This session's start time, not this record's — see `selfOwnerStartedAt`.
      // Stamping `new Date()` here would give two records from one session two
      // different owner identities, so the reaper could not recognise its own.
      startedAt: selfOwnerStartedAt(),
      ...options.projectDir ? { projectDir: options.projectDir } : {}
    },
    heartbeatAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  writeRuntimeRecord(record, root);
  const heartbeat = setInterval(() => touchRuntimeRecord(config.id, root), HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
  owned.set(config.id, { child, heartbeat, logRing });
  child.on("exit", () => {
    const entryOwned = owned.get(config.id);
    if (entryOwned) clearInterval(entryOwned.heartbeat);
    owned.delete(config.id);
    deleteRuntimeRecord(config.id, root);
  });
  return { backendId: config.id, name: config.name, port, endpoint: record.endpoint, pid: child.pid };
}
async function stopBackend(backendId, root = backendsRoot()) {
  const mine = owned.get(backendId);
  if (mine) {
    clearInterval(mine.heartbeat);
    owned.delete(backendId);
    const how2 = await terminateChild(mine.child);
    deleteRuntimeRecord(backendId, root);
    return { stopped: true, how: how2 };
  }
  const record = readRuntimeRecord(backendId, root);
  if (!record) return { stopped: false, how: "no runtime record \u2014 it was not running" };
  if (!processIsAlive(record.pid)) {
    deleteRuntimeRecord(backendId, root);
    return { stopped: false, how: "the recorded process is already gone; stale record removed" };
  }
  const verdict = verifyIsOurBackend(record);
  if (verdict !== "verified") {
    throw new ToolError(
      "backend-error",
      `Refusing to signal pid ${record.pid}: it ${verdict === "not-ours" ? "no longer belongs to this backend (pid reuse)" : "could not be verified"}. Nothing was signalled.` + (verdict === "not-ours" ? " The stale record has been removed." : "")
    );
  }
  const how = await terminatePid(record.pid);
  deleteRuntimeRecord(backendId, root);
  return { stopped: true, how };
}
var sleep2 = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
function exitedWithin(child, ms) {
  return new Promise((resolve2) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve2(true);
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve2(false);
    }, ms);
    function onExit() {
      clearTimeout(timer);
      resolve2(true);
    }
    child.once("exit", onExit);
  });
}
async function terminateChild(child) {
  if (child.exitCode !== null) return "already exited";
  try {
    child.kill("SIGTERM");
  } catch {
    return "already gone";
  }
  if (await exitedWithin(child, STOP_GRACE_MS2)) return "SIGTERM";
  try {
    child.kill("SIGKILL");
  } catch {
  }
  return await exitedWithin(child, 1e3) ? "SIGKILL" : "escaped";
}
async function terminatePid(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return "already gone";
  }
  const deadline = Date.now() + STOP_GRACE_MS2;
  while (Date.now() < deadline) {
    if (!processIsAlive(pid)) return "SIGTERM";
    await sleep2(100);
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
  }
  await sleep2(100);
  return processIsAlive(pid) ? "escaped" : "SIGKILL";
}
async function stopOwnedBackends(root = backendsRoot()) {
  const ids = [...owned.keys()];
  for (const id of ids) {
    try {
      await stopBackend(id, root);
    } catch {
    }
  }
  return ids;
}
var exitHooksInstalled = false;
function installExitHooks(root = backendsRoot()) {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      void stopOwnedBackends(root).then(() => process.exit(0));
    });
  }
  process.on("exit", () => {
    for (const [id, entry] of owned) {
      try {
        entry.child.kill("SIGTERM");
      } catch {
      }
      deleteRuntimeRecord(id, root);
    }
  });
}
async function provisionBackend(request) {
  const root = request.root ?? backendsRoot();
  const name = request.name.trim();
  if (!name) throw new ToolError("invalid-argument", "The backend needs a name.");
  await reapOrphanedBackends({ root });
  const warnings = [];
  const configs = listBackendConfigs(root);
  const reusable = findReusableBackend(configs, name, request.projectId);
  const explanation = explainReuse(configs, name, request.projectId, request.identity ?? {});
  let started;
  let reused = false;
  let adopted = false;
  if (reusable) {
    reused = true;
    const record = readRuntimeRecord(reusable.id, root);
    if (record && processIsAlive(record.pid) && verifyIsOurBackend(record) === "verified") {
      adopted = true;
      started = {
        backendId: record.backendId,
        name: record.backendName,
        port: record.port,
        endpoint: record.endpoint,
        pid: record.pid
      };
    } else {
      const config = readBackendConfig(reusable.id, root);
      if (!config) throw new ToolError("backend-error", `Backend ${reusable.id} has no readable config.json.`);
      installExitHooks(root);
      started = await startBackend(config, { root, projectDir: request.projectDir });
    }
  } else {
    const config = await createBackendDir(name, request.projectId, root);
    installExitHooks(root);
    started = await startBackend(config, { root, projectDir: request.projectDir });
  }
  if (request.projectDir) {
    const projectPolicy = path3.join(request.projectDir, "nodegx.security.json");
    const backendPolicy = path3.join(root, started.backendId, "security.json");
    if (fs3.existsSync(projectPolicy) && fs3.existsSync(backendPolicy)) {
      const same = (p) => {
        try {
          return JSON.stringify(JSON.parse(fs3.readFileSync(p, "utf-8")));
        } catch {
          return null;
        }
      };
      const fromProject = same(projectPolicy);
      if (fromProject !== null && fromProject !== same(backendPolicy)) {
        warnings.push(
          `This project ships a security policy (nodegx.security.json) but backend "${started.name}" is running a different one, and an existing security.json is never overwritten. The backend's policy is what is enforced. Compare ${projectPolicy} with ${backendPolicy} and copy it across deliberately if the project's is the one you want.`
        );
      }
    }
  }
  const created = [];
  const client = new BackendClient({
    id: started.backendId,
    name: started.name,
    port: started.port,
    dir: path3.join(root, started.backendId),
    adminToken: readAdminToken(path3.join(root, started.backendId))
  });
  for (const collection of request.collections) {
    try {
      const { json } = await client.request("POST", "/admin/schema", {
        action: "createTable",
        table: collection.name,
        columns: collection.columns
      });
      created.push(collection.name);
      if (json && typeof json === "object" && json.created === false) {
        warnings.push(
          `"${collection.name}" already existed \u2014 its columns were left as they are. Check them in the Data Browser if the types matter.`
        );
      }
    } catch (error) {
      warnings.push(
        `"${collection.name}" was not created (${error instanceof Error ? error.message : String(error)}). The backend will create it the first time something writes to it.`
      );
    }
  }
  return {
    backendId: started.backendId,
    name: started.name,
    endpoint: started.endpoint,
    port: started.port,
    pid: started.pid,
    reused,
    adopted,
    collections: created,
    // A reuse that could not happen is a fact about this provision, so it rides
    // out with the warnings rather than only in a field a caller may not read.
    warnings: explanation.note ? [...warnings, explanation.note] : warnings,
    reuseVerdict: explanation.verdict,
    reuseNote: explanation.note
  };
}
function readAdminToken(dir) {
  try {
    return JSON.parse(fs3.readFileSync(path3.join(dir, "secrets.json"), "utf-8")).adminToken || null;
  } catch {
    return null;
  }
}

// packages/noodl-mcp/src/backend/projectIdentity.ts
var crypto = __toESM(require("crypto"));
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var PROJECT_FILE = "nodegx.project.json";
function mintProjectId() {
  return crypto.randomUUID();
}
function projectFilePath(projectDir) {
  return path4.join(projectDir, PROJECT_FILE);
}
function ensureProjectId(projectDir) {
  const file = projectFilePath(projectDir);
  let raw;
  try {
    raw = fs4.readFileSync(file, "utf-8");
  } catch {
    return {
      outcome: "unavailable",
      reason: `there is no readable ${PROJECT_FILE} in ${projectDir}, so this project has no identity to bind a backend to`
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      outcome: "unavailable",
      reason: `${PROJECT_FILE} is not valid JSON, so no project id could be read or written`
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { outcome: "unavailable", reason: `${PROJECT_FILE} is not a JSON object` };
  }
  const existing = parsed.id;
  if (typeof existing === "string" && existing.trim()) {
    return { id: existing, outcome: "present" };
  }
  const id = mintProjectId();
  try {
    writeJsonAtomic(file, withIdAfterName(parsed, id));
  } catch (error) {
    return {
      // The id is still returned: it is correct for *this* call, and a provision
      // that stamps it onto the backend is better than one that stamps nothing.
      // The outcome says it did not persist, so the caller can say so too.
      id,
      outcome: "unavailable",
      reason: `${PROJECT_FILE} could not be written (${error instanceof Error ? error.message : String(error)}), so this project will not be able to prove it owns the backend next time`
    };
  }
  return { id, outcome: "minted" };
}
function withIdAfterName(project, id) {
  const out = {};
  let inserted = false;
  for (const [key, value] of Object.entries(project)) {
    if (key === "id") continue;
    out[key] = value;
    if (key === "name" && !inserted) {
      out.id = id;
      inserted = true;
    }
  }
  if (!inserted) out.id = id;
  return out;
}
function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs4.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs4.renameSync(tmp, file);
}

// packages/nodegx-backend-contract/src/backends.ts
var BACKEND_TYPES = Object.freeze([
  "nodegx",
  "parse",
  "directus",
  "supabase",
  "pocketbase",
  "custom"
]);
var BACKEND_DISPLAY_NAMES = Object.freeze({
  nodegx: "Built-in",
  parse: "Parse Server",
  directus: "Directus",
  supabase: "Supabase",
  pocketbase: "PocketBase",
  custom: "Custom API"
});

// packages/nodegx-backend-contract/src/capabilities.ts
var CAPABILITY_KEYS = Object.freeze([
  "data.query",
  "data.count",
  "data.distinct",
  "data.aggregate",
  "data.fetch",
  "data.create",
  "data.save",
  "data.increment",
  "data.delete",
  "data.acl",
  "data.search",
  "relations.pointerRead",
  "relations.relatedTo",
  "relations.addRemove",
  "files.upload",
  "files.sign",
  "files.delete",
  "files.private",
  "files.progress",
  "auth.password",
  "auth.signUp",
  "auth.signUpProperties",
  "auth.emailVerify",
  "auth.passwordReset",
  "auth.oauth",
  "auth.magicLink",
  "realtime.subscribe"
]);
var POSITIVE_PROBE_TTL_MS = 5 * 60 * 1e3;

// packages/nodegx-backend-contract/src/data.ts
var FILE_URL_KINDS = Object.freeze(["signed", "token", "public"]);
var DATA_ADAPTER_METHODS = Object.freeze([
  "query",
  "count",
  "distinct",
  "aggregate",
  "fetch",
  "create",
  "save",
  "increment",
  "delete",
  "addRelation",
  "removeRelation",
  "uploadFile",
  "signFileUrl",
  "deleteFile"
]);

// packages/nodegx-backend-contract/src/auth.ts
var AUTH_ADAPTER_METHODS = Object.freeze([
  "logIn",
  "logOut",
  "signUp",
  "fetchCurrentUser",
  "verifyEmail",
  "sendEmailVerification",
  "resetPassword",
  "requestPasswordReset",
  "signInWithProvider",
  "requestMagicLink"
]);
var AUTH_EVENTS = Object.freeze([
  "loggedIn",
  "loggedOut",
  "sessionGained",
  "sessionLost",
  "sessionChanged"
]);

// packages/nodegx-backend-contract/src/realtime.ts
var REALTIME_EVENT_TYPES = Object.freeze([
  "init",
  "create",
  "update",
  "delete",
  "resync"
]);
var REALTIME_FAILURE_KINDS = Object.freeze({
  TRANSPORT_UNAVAILABLE: "fatal",
  CONNECT_FAILED: "retryable",
  CONNECT_TIMEOUT: "retryable",
  AUTH_FAILED: "fatal",
  SUBSCRIPTION_REJECTED: "retryable",
  HEARTBEAT_MISSED: "retryable",
  CAPABILITY_UNAVAILABLE: "fatal"
});
var REALTIME_TIMING = Object.freeze({
  reconnectBaseMs: 1e3,
  reconnectMaxMs: 3e4,
  connectTimeoutMs: 15e3
});
var REALTIME_ADAPTER_METHODS = Object.freeze(["subscribe"]);
var PROBE = "bcn-008-realtime-probe.mjs, 2026-07-31";
var DRIVER = "bcn-008-realtime-driver.ts + bcn-008-node-driver.ts, 2026-08-01";
var DIRECTUS_RT = {
  type: "directus",
  transport: "websocket",
  streamPath: "/websocket",
  subscribe: "{type:'auth',access_token} \u2192 {type:'auth',status:'ok'} \u2192 {type:'subscribe',collection,uid}",
  confirmation: "{type:'subscription',event:'init',data:[\u2026rows],uid}",
  // ⚠️ THE finding this file exists for. `id: 1` (integer pk) deletes as `["1"]`.
  deleteEvent: { carries: "keys-only", wireKeyType: "string", coercedFromRest: true },
  keepalive: {
    rule: "server-ping-client-pong",
    intervalMs: 3e4,
    observedForMs: 45e3,
    // One ignored ping, then gone. Measured, code 1005, empty reason.
    disconnectsSilentClientAfterMs: 6e4
  },
  connectFailure: "open in single-digit ms on success; a bad token gives {type:'auth',status:'error',error:{code:'AUTH_FAILED'}} ~10ms after the send, then close ~2ms later",
  measured: true,
  evidence: `${PROBE}: numeric pk 2 arrived as data:["2"]; ping at 30016ms; silent client closed at 60035ms, code 1005. ${DRIVER}: \`docker restart uba-e2e-directus-1\` under a live subscription \u2192 interrupted \u2192 subscribed \u2192 a row written AFTER the restart was delivered, at the transport AND through a real Query Records node. 72s of client silence did NOT drop the subscription (removing the pong makes exactly that check fail).`
};
var POCKETBASE_RT = {
  type: "pocketbase",
  transport: "sse",
  streamPath: "/api/realtime",
  subscribe: "GET the stream \u2192 PB_CONNECT gives clientId \u2192 POST /api/realtime {clientId, subscriptions:['coll']} \u2192 204",
  // ⚠️ A 204 is NOT a confirmation that anything will arrive — see the note below.
  confirmation: "204 on the subscription POST (delivery is gated separately, at event time)",
  deleteEvent: { carries: "full-record", wireKeyType: "string", coercedFromRest: false },
  // Nothing at all on an idle stream for 130s. Not "there is no keepalive" —
  // "none was observed within the window", which is what the field says.
  keepalive: { rule: "none-observed", intervalMs: null, observedForMs: 13e4 },
  connectFailure: 'the stream is plain fetch/EventSource: a dead host rejects the request. An unknown clientId on the subscription POST is 404 {"message":"Missing or invalid client id."}',
  measured: true,
  evidence: `${PROBE}: SSE event name is the COLLECTION name, not "change"; data is {record,action}; a superuser-only collection accepted an anonymous subscription with 204 and then delivered nothing. ${DRIVER}: \`docker restart uba-e2e-pocketbase-1\` under a live subscription \u2192 reconnected, re-POSTed the subscription set with the fresh clientId, and delivered a row written after the restart. The accepted-then-silent case was re-measured through the shipped transport: it reports \`subscribed\` and receives nothing.`
};
var NODEGX_RT = {
  type: "nodegx",
  transport: "sse",
  streamPath: "/realtime",
  subscribe: "GET the stream \u2192 'connected' gives clientId \u2192 POST /realtime/subscriptions {clientId, subscriptions:[{collection, filter?}]}",
  confirmation: "200 with a non-empty `accepted[]` \u2014 the body, not the status: a rejection also answers 200",
  deleteEvent: { carries: "full-record", wireKeyType: "string", coercedFromRest: false },
  keepalive: { rule: "server-comment", intervalMs: 25e3, observedForMs: 3e4 },
  connectFailure: "fetch rejects for an unreachable host; an unknown clientId is 404; an unsupported filter is 200 with rejected[].reason",
  measured: true,
  evidence: `${PROBE}: heartbeat comment ": heartbeat" at 25026ms; a Last-Event-ID reconnect answers connected then resync{reason:"reconnect"} with a FRESH clientId. ${DRIVER}: the backend process killed and relaunched under a live subscription (the rig has no nodegx-backend container) \u2192 reconnected, re-registered, delivered a row written after the restart, and raised 2 resync frames. Also confirmed live that a 200 carrying rejected[] is NOT a subscription.`
};
var SUPABASE_RT = {
  type: "supabase",
  transport: "phoenix-channel",
  streamPath: "/realtime/v1/websocket",
  subscribe: "phx_join on a topic, with a postgres_changes config \u2014 DOCUMENTED, NOT PROBED",
  confirmation: "phx_reply with status 'ok' \u2014 DOCUMENTED, NOT PROBED",
  // Documented: `old_record` carries the primary key only unless the table is set
  // to REPLICA IDENTITY FULL. Recorded as unknown rather than guessed, because
  // guessing this exact field is what cost RUN-003 a rewrite on Directus.
  deleteEvent: { carries: "keys-only", wireKeyType: "unknown", coercedFromRest: false },
  keepalive: null,
  connectFailure: "unknown \u2014 nothing was listening to fail against",
  measured: false,
  evidence: `${PROBE}: ws://localhost:8056/realtime/v1/websocket \u2192 error@5ms; /realtime/v1/api/tenants/realtime/health \u2192 404; ports 4000 and 54321 silent. No Supabase Realtime exists in this rig.`
};
var PARSE_RT = {
  type: "parse",
  transport: "none",
  streamPath: null,
  subscribe: "{op:'connect',applicationId,\u2026} then {op:'subscribe',requestId,query} \u2014 on a LiveQuery server, if one is running",
  confirmation: "{op:'connected'} then {op:'subscribed'} \u2014 never reached here",
  deleteEvent: null,
  keepalive: null,
  connectFailure: 'error at 20ms, "Received network error or non-101 status code"; `close` never fires',
  measured: true,
  evidence: `${PROBE}: /parse/serverInfo advertises no liveQuery; ws://localhost:8092/parse errors in 20ms and a raw upgrade request is answered 403 by the ordinary Express app. This is a measurement that LiveQuery is ABSENT, not that it works.`
};
var REALTIME_TRANSPORT_PROFILES = Object.freeze({
  nodegx: NODEGX_RT,
  parse: PARSE_RT,
  directus: DIRECTUS_RT,
  supabase: SUPABASE_RT,
  pocketbase: POCKETBASE_RT
});

// packages/nodegx-backend-contract/src/filter.ts
var FILTER_OPERATORS = Object.freeze([
  "equalTo",
  "notEqualTo",
  "lessThan",
  "greaterThan",
  "lessThanOrEqualTo",
  "greaterThanOrEqualTo",
  "containedIn",
  "notContainedIn",
  "exists",
  "matchesRegex",
  "contains",
  "notContains",
  "containsIgnoreCase",
  "startsWith",
  "notStartsWith",
  "startsWithIgnoreCase",
  "endsWith",
  "notEndsWith",
  "endsWithIgnoreCase",
  "between",
  "notBetween",
  "isEmpty",
  "isNotEmpty",
  "textSearch",
  "pointsTo",
  "relatedTo",
  "path",
  "idEqualTo",
  "idContainedIn",
  "nearSphere",
  "withinBox",
  "withinPolygon"
]);
var LOWERED_OPERATORS = Object.freeze([
  "contains",
  "notContains",
  "containsIgnoreCase",
  "startsWith",
  "notStartsWith",
  "startsWithIgnoreCase",
  "endsWith",
  "notEndsWith",
  "endsWithIgnoreCase",
  "between",
  "notBetween"
]);
var MAX_PATH_DEPTH = 8;
var NAME_RULE = /^[A-Za-z_][A-Za-z0-9_]*$/;
function pathProblem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "a path must be an object with from, hops and maxDepth";
  const p = value;
  for (const k of Object.keys(p)) if (k !== "from" && k !== "hops" && k !== "maxDepth") return `a path has no "${k}"`;
  const from = p.from;
  if (!from || typeof from !== "object" || Array.isArray(from)) return 'a path needs "from": { collection, where? }';
  if (typeof from.collection !== "string" || !NAME_RULE.test(from.collection))
    return `the path's "from.collection" must name a collection`;
  for (const k of Object.keys(from)) if (k !== "collection" && k !== "where") return `"from" has no "${k}"`;
  if (from.where !== void 0 && (!from.where || typeof from.where !== "object" || Array.isArray(from.where)))
    return '"from.where" must be a filter object';
  if (from.where && hasPath(from.where)) return "a path inside a path is not allowed";
  if (!Number.isInteger(p.maxDepth) || p.maxDepth < 1 || p.maxDepth > MAX_PATH_DEPTH)
    return `"maxDepth" must be a whole number from 1 to ${MAX_PATH_DEPTH}`;
  if (!Array.isArray(p.hops) || p.hops.length === 0) return "a path needs at least one hop";
  if (p.hops.length > p.maxDepth)
    return `the path has ${p.hops.length} hops and "maxDepth" allows ${p.maxDepth}`;
  let repeats = 0;
  for (let i = 0; i < p.hops.length; i++) {
    const h = p.hops[i];
    const at = `hop ${i + 1}`;
    if (!h || typeof h !== "object" || Array.isArray(h)) return `${at} must be an object`;
    const isFollow = "follow" in h;
    const isBack = "from" in h || "by" in h;
    if (isFollow === isBack) return `${at} must be { follow } or { from, by }, not both and not neither`;
    const allowed = isFollow ? ["follow", "to", "where", "repeat"] : ["from", "by", "where", "repeat"];
    for (const k of Object.keys(h)) if (!allowed.includes(k)) return `${at} has no "${k}"`;
    if (isFollow && (typeof h.follow !== "string" || !NAME_RULE.test(h.follow)))
      return `${at}: "follow" must name a field`;
    if (isFollow && h.to !== void 0 && (typeof h.to !== "string" || !NAME_RULE.test(h.to)))
      return `${at}: "to" must name a collection`;
    if (!isFollow && (typeof h.from !== "string" || !NAME_RULE.test(h.from)))
      return `${at}: "from" must name a collection`;
    if (!isFollow && (typeof h.by !== "string" || !NAME_RULE.test(h.by))) return `${at}: "by" must name a field`;
    if (h.where !== void 0 && (!h.where || typeof h.where !== "object" || Array.isArray(h.where)))
      return `${at}: "where" must be a filter object`;
    if (h.where && hasPath(h.where)) return "a path inside a path is not allowed";
    if (h.repeat !== void 0 && h.repeat !== true) return `${at}: "repeat" is true or absent`;
    if (h.repeat === true) repeats += 1;
  }
  if (repeats > 1) return "only one hop of a path may repeat";
  return null;
}
function hasPath(where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "path" || k === "$path") return true;
    if (Array.isArray(v)) {
      for (const x of v) if (x && typeof x === "object" && hasPath(x)) return true;
    } else if (v && typeof v === "object" && hasPath(v)) return true;
  }
  return false;
}
var DIRECTUS_OPERATOR_MIGRATION = Object.freeze({
  _eq: { operator: "equalTo" },
  _neq: { operator: "notEqualTo" },
  _gt: { operator: "greaterThan" },
  _gte: { operator: "greaterThanOrEqualTo" },
  _lt: { operator: "lessThan" },
  _lte: { operator: "lessThanOrEqualTo" },
  _contains: { operator: "contains" },
  _ncontains: { operator: "notContains" },
  _icontains: { operator: "containsIgnoreCase" },
  _starts_with: { operator: "startsWith" },
  _nstarts_with: { operator: "notStartsWith" },
  _istarts_with: { operator: "startsWithIgnoreCase" },
  _ends_with: { operator: "endsWith" },
  _nends_with: { operator: "notEndsWith" },
  _iends_with: { operator: "endsWithIgnoreCase" },
  _in: { operator: "containedIn" },
  _nin: { operator: "notContainedIn" },
  _null: { operator: "exists", value: "false" },
  _nnull: { operator: "exists", value: "true" },
  _between: { operator: "between" },
  _nbetween: { operator: "notBetween" },
  _empty: { operator: "isEmpty" },
  _nempty: { operator: "isNotEmpty" },
  _regex: { operator: "matchesRegex" }
});

// packages/nodegx-backend-contract/src/descriptors/helpers.ts
var supported = (evidence) => ({ state: "supported", evidence });
var unsupported = (reason, evidence) => ({
  state: "unsupported",
  reason,
  evidence
});
var degraded = (reason, evidence) => ({
  state: "degraded",
  reason,
  evidence
});
var conditional = (reason, probe, evidence) => ({
  state: "conditional",
  reason,
  probe,
  evidence
});
function filterTable(fallback, overrides) {
  const table = {};
  for (const operator of FILTER_OPERATORS) {
    table[operator] = overrides[operator] ?? fallback;
  }
  return Object.freeze(table);
}

// packages/nodegx-backend-contract/src/descriptors/custom.ts
var DECLARE = (thing) => `NodeGX doesn't know whether your API can ${thing}. Tell it in the backend's Capabilities tab, and this will work.`;
var NOT_DECLARED = "Default floor for an undeclared custom backend. The user overrides this per instance.";
var customDescriptor = {
  type: "custom",
  // A custom backend's token lifecycle is the user's to declare too. `eternal`
  // is the floor because it schedules nothing: assuming a refresh loop against
  // an endpoint that may not exist would produce background 404s on every
  // custom backend that does not need one.
  tokenLifecycle: { kind: "eternal" },
  declarable: true,
  capabilities: Object.freeze({
    // The four a REST API has to have for the preset form to be worth filling
    // in at all — they are the endpoints the Backend Services panel asks for by
    // name (list, get, create, update, delete), so configuring a custom backend
    // is already a claim that these exist.
    "data.query": supported("the list endpoint is required by the custom preset form"),
    "data.fetch": supported("the get endpoint is required by the custom preset form"),
    "data.create": supported("the create endpoint is required by the custom preset form"),
    "data.save": supported("the update endpoint is required by the custom preset form"),
    "data.delete": supported("the delete endpoint is required by the custom preset form"),
    "data.count": unsupported(DECLARE("count records"), NOT_DECLARED),
    "data.distinct": unsupported(DECLARE("list distinct values"), NOT_DECLARED),
    "data.aggregate": unsupported(DECLARE("total or average records"), NOT_DECLARED),
    "data.increment": unsupported(DECLARE("add to a number in one step"), NOT_DECLARED),
    "data.acl": unsupported(DECLARE("set permissions per record"), NOT_DECLARED),
    "data.search": unsupported(DECLARE("search"), NOT_DECLARED),
    "relations.pointerRead": unsupported(DECLARE("resolve related records"), NOT_DECLARED),
    "relations.relatedTo": unsupported(DECLARE("filter by related records"), NOT_DECLARED),
    "relations.addRemove": unsupported(DECLARE("add and remove related records"), NOT_DECLARED),
    "files.upload": unsupported(DECLARE("store files"), NOT_DECLARED),
    "files.sign": unsupported(DECLARE("make temporary file links"), NOT_DECLARED),
    "files.delete": unsupported(DECLARE("delete files"), NOT_DECLARED),
    "files.private": unsupported(DECLARE("keep files private"), NOT_DECLARED),
    "files.progress": unsupported(DECLARE("report upload progress"), NOT_DECLARED),
    "auth.password": unsupported(DECLARE("sign people in"), NOT_DECLARED),
    "auth.signUp": unsupported(DECLARE("let people sign up"), NOT_DECLARED),
    "auth.signUpProperties": unsupported(DECLARE("save profile details at sign-up"), NOT_DECLARED),
    "auth.emailVerify": unsupported(DECLARE("verify email addresses"), NOT_DECLARED),
    "auth.passwordReset": unsupported(DECLARE("reset passwords"), NOT_DECLARED),
    "auth.oauth": unsupported(DECLARE("sign people in with Google or GitHub"), NOT_DECLARED),
    "auth.magicLink": unsupported(DECLARE("send magic-link logins"), NOT_DECLARED),
    "realtime.subscribe": unsupported(DECLARE("push live updates"), NOT_DECLARED)
  }),
  // Equality is the one filter a list endpoint can be assumed to answer, since
  // the custom preset asks for query-parameter conventions. Everything else the
  // user declares.
  filters: filterTable(unsupported(DECLARE("filter this way"), NOT_DECLARED), {
    equalTo: supported("the custom preset form configures query-parameter equality"),
    idEqualTo: supported("the get endpoint takes an id by definition")
  })
};

// packages/nodegx-backend-contract/src/descriptors/directus.ts
var WILDCARD_DEGRADED = (() => {
  const wildcards = "The characters % and _ act as wildcards here, so searching for text containing one will match more than you asked for.";
  const bothWays = `${wildcards} Matching also ignores capitals.`;
  const evidence = 'BCN-003 live: LIKE with no ESCAPE clause; contains "100%" also returned "1000 words"';
  return {
    contains: degraded(bothWays, evidence),
    notContains: degraded(bothWays, evidence),
    containsIgnoreCase: degraded(wildcards, evidence),
    startsWith: degraded(bothWays, evidence),
    notStartsWith: degraded(bothWays, evidence),
    startsWithIgnoreCase: degraded(wildcards, evidence),
    endsWith: degraded(bothWays, evidence),
    notEndsWith: degraded(bothWays, evidence),
    endsWithIgnoreCase: degraded(wildcards, evidence)
  };
})();
var directusDescriptor = {
  type: "directus",
  // Directus issues a 15-minute access token with a refresh token beside it.
  // This is the lifecycle Parse never had, and the reason BCN-006 exists.
  tokenLifecycle: {
    kind: "refresh",
    accessTtlSeconds: 900,
    refreshEndpoint: "/auth/refresh",
    refreshBeforeExpirySeconds: 60
  },
  capabilities: Object.freeze({
    "data.query": supported("RUN-003: GET /items/articles with a filter returned 4 records"),
    "data.count": supported('BCN-001: aggregate[count]=* returned {"count":4}'),
    "data.distinct": supported("BCN-001: groupBy alone returns one row per distinct value"),
    "data.aggregate": supported("BCN-001: count/sum/avg, groupBy, and a composed filter all answered \u2014 no opt-in"),
    "data.fetch": supported("RUN-003: GET /items/{collection}/{id}"),
    "data.create": supported("RUN-003: POST /items/articles returned 200, id=4"),
    "data.save": supported("PATCH /items/{collection}/{id} \u2014 byob-update-record.ts ships against it"),
    "data.delete": supported("DELETE /items/{collection}/{id} \u2014 byob-delete-record.ts ships against it"),
    "data.increment": degraded(
      "Directus has no way to add to a number in one step, so NodeGX reads the value and writes it back. If two people increment the same record at the same moment, one of the changes can be lost.",
      "No atomic increment in the Directus items API; read-modify-write is the only route."
    ),
    "data.acl": unsupported(
      "Directus controls access with roles and permissions, set up in your Directus admin \u2014 not per record from here.",
      "Directus permissions are role-scoped policy, not a per-record ACL field."
    ),
    // Verified and genuinely surprising: ?search= matched articles whose
    // *status* was "published" when the term was "Published", returning titles
    // that do not contain the word at all.
    "data.search": degraded(
      "Directus searches every field in the record, not just the text ones, and does not rank the results. Expect matches you did not intend. For ranked search, use the built-in backend.",
      "BCN-001: ?search=Published returned three articles matched on their status field, unranked"
    ),
    "relations.pointerRead": supported(
      "BCN-005 live: ?fields=*,author.* nests the author. An M2M needs two hops (tags.tag_id.*) because one hop returns junction rows; the adapter emits the two-hop path and flattens the result"
    ),
    // RUN-003's recorded residual, closed for reading and writing; `relatedTo`
    // is the one relation cell that stays refused, and for a different reason
    // from before — see below.
    "relations.relatedTo": unsupported(
      'Filtering by "records related to this one" is not available on Directus. Filter on a field of the related record instead, such as author \u2192 name.',
      "BCN-005 live: filtering across a relation works via a nested path ({author:{city:{_eq}}}) and across an M2M via the junction, but Parse's $relatedTo asks for members of one record's relation set, which has no Directus spelling. The dotted-path filter is the replacement and it is measured working"
    ),
    "relations.addRemove": degraded(
      "Adding a related record writes a row in a join table, and Directus join tables allow the same pair twice. NodeGX checks first so you will not get duplicates, but if two people add the same one at the same moment you can.",
      'BCN-005 live: POST junction row 200; the same pair posted twice creates a second row, so addRelation reads before it writes. DELETE of a pair that never existed answers 204, so a remove cannot report "was not there"'
    ),
    // ── Files — BCN-007 steps 2/5/7, every cell measured ─────────────────
    // Probes: BCN-004-FILES-PROBE-OUTPUT.txt (16 checks) and
    // BCN-007-FILES-PROBE-OUTPUT.txt §1 / BCN-007-FILES-PROBE2-OUTPUT.txt §1.
    "files.upload": supported(
      "BCN-007 live: POST /files multipart answers 200 (not 201) with the stored file; the field map is filename_download / type / filesize and `id` is the handle"
    ),
    "files.sign": degraded(
      "A Directus file link carries your own sign-in rather than a signature, so it works for you and not for anyone you send it to \u2014 and it stops working when you sign out. The Sign File URL node reports this on its URL Kind output.",
      "BCN-007 live: Directus has no per-asset token to mint. /assets/{id} answers 403 with no credential and 200 with ?access_token=<the session JWT>; a tampered token is 403. The JWT declares a 900s life, which is the SESSION's expiry, not the link's"
    ),
    "files.delete": supported(
      "BCN-007 live: DELETE /files/{id} answers 204. \u26A0\uFE0F The spec's claim that Directus refuses to delete a REFERENCED file is FALSE \u2014 measured with a real directus_files relation created via POST /relations, the delete succeeds and the referencing row's field becomes null. Reading a deleted file is 403, the same answer as for a file that never existed, so an adapter cannot report which happened"
    ),
    "files.private": degraded(
      "Files on Directus are only as private as the role permissions on directus_files, which NodeGX does not set for you. A file uploaded through NodeGX is readable by whoever your Directus roles say it is.",
      "BCN-007 live: /assets/{id} is 403 for an anonymous caller on a default install, so files are NOT public by default \u2014 but there is no per-file privacy flag for an upload to set, unlike the X-NodeGX-File-Private header ours takes"
    ),
    "files.progress": degraded(
      "The upload works but the progress bar will not move on this backend.",
      '\u26A0\uFE0F CORRECTED by BCN-007. This cell read `supported` with the evidence "XHR upload path is client-side", which was written before RestDataAdapter existed \u2014 that adapter is built on `fetch`, and `fetch` has no upload-progress event. Nothing synthetic is emitted: a bar that jumps 0\u2192100 tells an author their instrumentation works when it does not'
    ),
    "auth.password": supported("POST /auth/login"),
    "auth.signUp": conditional(
      "Letting people sign themselves up needs public registration turned on in your Directus settings. It is off by default.",
      { method: "POST", path: "/users/register", expect: "anything other than 403 FORBIDDEN" },
      "Directus public registration is opt-in per project."
    ),
    "auth.signUpProperties": degraded(
      "Directus stores the login and the profile separately, so signing up takes two steps. If the second one fails the account still exists, without the profile details.",
      "directus_users holds credentials; profile fields typically live in a separate collection."
    ),
    "auth.emailVerify": conditional(
      "Verification emails need email set up in your Directus instance.",
      { method: "GET", path: "/server/info", expect: "a project mail configuration" },
      "Directus EMAIL_TRANSPORT is deployment configuration."
    ),
    "auth.passwordReset": conditional(
      "Password reset emails need email set up in your Directus instance.",
      { method: "POST", path: "/auth/password/request", expect: "anything other than a mail-transport error" },
      "Same EMAIL_TRANSPORT dependency."
    ),
    // ⚠️ **`conditional` → `unsupported`, and the change is a correction rather
    // than a retreat.** `conditional` says *"your instance decides"*. That was
    // the wrong question: even on an instance with three SSO providers
    // configured, NodeGX cannot complete a Directus single sign-on, and no probe
    // of that instance would discover it.
    //
    // The reason is the shape of the return leg. `/auth/login/{provider}` sends
    // the browser to the provider and Directus hands the session back as an
    // **httpOnly cookie**, with nothing in the URL and nothing in a response body
    // — there is no mode that answers with tokens the way `POST /auth/login`
    // does. Consuming that needs a cookie-carried session: `credentials:
    // 'include'` on every request and a `mode: 'cookie'` refresh, which is a
    // second session model beside `SessionStore` rather than a fifth redirect
    // shape. Password sign-in on the same instance is unaffected and is
    // `supported` above.
    //
    // Measured, on the way to this: `GET /auth` answers `{"data":[]}` on an
    // instance with no provider configured, and `GET /auth/login/google` on that
    // instance is a **404 ROUTE_NOT_FOUND** — so a start leg written anyway would
    // navigate the user off the app onto Directus's error JSON.
    "auth.oauth": unsupported(
      "NodeGX cannot complete a Directus single sign-on yet. Directus returns the session as a browser cookie rather than in the response, which needs a different kind of session than NodeGX stores. Use email and password on this backend.",
      'MEASURED 2026-08-01 on Directus 11: GET /auth -> {"data":[],"disableDefault":false}; GET /auth/login/google -> 404 ROUTE_NOT_FOUND. The blocker is the cookie-carried session, not the provider list \u2014 GET /auth is still read by listAuthProviders so a builder can see what the instance offers.'
    ),
    "auth.magicLink": unsupported(
      "Directus has no magic-link login. Use email and password, or an OAuth provider.",
      "No passwordless flow in the Directus auth API."
    ),
    // ⚠️ The probe moved from `/server/info` to the handshake itself, because
    // BCN-008 measured what `/server/info` actually returns on an instance with
    // `WEBSOCKETS_ENABLED=true`: `{data:{project:{…},setupCompleted:true}}` and
    // no websocket section of any kind. The old probe would have reported
    // `unsupported` on a server where realtime works perfectly.
    "realtime.subscribe": conditional(
      "Live updates need WebSockets enabled on your Directus instance. They are off by default.",
      {
        method: "GET",
        kind: "websocket",
        path: "/websocket",
        expect: "a 101 upgrade. Nothing else settles it \u2014 /server/info says nothing about websockets even when they are on. Give up after a deadline: a Directus server that does not upgrade a path fires NEITHER error NOR close (measured silent for 20s)."
      },
      'BCN-008, live against Directus 11 with WEBSOCKETS_ENABLED=true: open in single-digit ms, auth ok, subscribe confirmed by an `init` frame. A delete on an INTEGER primary key arrives as data:["1"] \u2014 keys only, coerced to string. Server pings every 30s and closes a client that does not pong (measured at 60s, code 1005).'
    )
  }),
  filters: filterTable(supported("native Directus filter operator"), {
    // The neutral vocabulary was chosen partly because Directus covers most of
    // it natively — these are its own operators, one rename away. The
    // exceptions below were measured by BCN-003's live equivalence pass against
    // Directus 11, and three of them contradict what this table said when it
    // was written from the documentation.
    // ⚠️ BCN-003, live: Directus 11 answers a `_regex` filter on a string field
    // with `400 Invalid query. "string" field type does not contain the
    // "_regex" filter operator.` Documented, but not served for ordinary text
    // columns — precisely the "documented, not probed" distinction this package
    // exists to make.
    matchesRegex: unsupported(
      'Directus cannot match text with regular expressions. Use "contains", "starts with" or "ends with" instead.',
      'BCN-003 live: 400 \u2014 "string field type does not contain the _regex filter operator"'
    ),
    // ⚠️ BCN-003, live: `_contains` is `LIKE '%value%'` with no escape
    // available — a `%` or `_` the user typed acts as a wildcard, and a
    // backslash is matched literally rather than honoured. Searching for "100%"
    // also returns "1000 words". Degraded rather than unsupported because the
    // condition *is* applied; it is broader than asked, not absent.
    ...WILDCARD_DEGRADED,
    // ⚠️ BCN-003, live: `_empty` matches a NULL as well as an empty string, so
    // it answers a different question from the neutral `isEmpty` — which exists
    // precisely because "empty" and "not set" are not the same question.
    isEmpty: degraded(
      'On Directus, "is empty" also matches records where the field was never set.',
      "BCN-003 live: _empty returned both the empty-string row and the NULL row"
    ),
    isNotEmpty: degraded(
      'On Directus, "is not empty" also excludes records where the field was never set.',
      "BCN-003 live: the complement of the above"
    ),
    // P116 ONT-004. Directus's deep filter IS a path filter, and BCN-005
    // measured it one hop deep (and the junction spelling a many-to-many
    // needs). A five-hop path has not been driven, and the translator does
    // not write one; unsupported until it does.
    path: unsupported(
      "Following several links in one request is not available on Directus yet. Filter one link at a time with a nested field.",
      "BCN-005 live: one hop works as a nested path ({author:{city:{_eq}}}); deeper paths not driven, no translator"
    ),
    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on Directus yet.',
      "Needs a junction-table query. BCN-005."
    ),
    textSearch: degraded(
      "Directus searches every field in the record and does not rank the results.",
      "BCN-001: ?search= is substring-across-all-fields"
    ),
    nearSphere: unsupported(
      "Location filters aren't available on Directus.",
      "No geo operators in the Directus filter syntax."
    ),
    withinBox: unsupported("Location filters aren't available on Directus.", "No geo operators."),
    withinPolygon: unsupported("Location filters aren't available on Directus.", "No geo operators.")
  })
};

// packages/nodegx-backend-contract/src/descriptors/nodegx.ts
var WIRE = "nodegx-backend/src/server/parse-wire.ts";
var SQL = "noodl-runtime/src/api/adapters/local-sql/QueryBuilder.ts";
var DRIVEN = "; driven live in BCN-002";
var nodegxDescriptor = {
  type: "nodegx",
  // Parse-style session tokens, and ours do not expire either. BCN-006 has
  // nothing to schedule here — which is exactly why the token lifecycle had to
  // be declared rather than discovered: the backend we develop against is the
  // one backend that would never have revealed the problem.
  tokenLifecycle: { kind: "eternal" },
  capabilities: Object.freeze({
    "data.query": supported(`POST/GET /classes/:c \u2014 ${WIRE}:6${DRIVEN}, including a $gt filter`),
    "data.count": supported(`GET /classes/:c with count=1 \u2014 ${WIRE}:7${DRIVEN}`),
    // Verified in BCN-001's probe work by reading the handler, and it settles
    // README footnote 2: there is no master-key check anywhere in parse-wire.ts.
    // Both routes are governed by the `find` permission and the read ACL, so
    // they reveal exactly what find reveals and work from a browser. Upstream
    // Parse restricts the same route to the master key, which is the whole
    // reason `nodegx` and `parse` are separate rows in this package.
    "data.distinct": supported(`GET /aggregate/:c \u2014 ${WIRE}:246-284, ACL-governed, no master key${DRIVEN} with the app id alone, where upstream Parse refuses`),
    "data.aggregate": supported(`GET /aggregate/:c \u2014 ${WIRE}:246-284, ACL-governed, no master key${DRIVEN} with the app id alone, where upstream Parse refuses`),
    "data.fetch": supported(`GET /classes/:c/:id \u2014 ${WIRE}:8${DRIVEN}`),
    "data.create": supported(`POST /classes/:c \u2014 ${WIRE}:6${DRIVEN}`),
    "data.save": supported(`PUT /classes/:c/:id \u2014 ${WIRE}:9${DRIVEN}`),
    "data.increment": supported(`PUT with __op: 'Increment' \u2014 ${WIRE}:88, atomic${DRIVEN}`),
    "data.delete": supported(`DELETE /classes/:c/:id \u2014 ${WIRE}:10${DRIVEN}`),
    "data.acl": supported("BAK-003: CLP + row-level ACL, filtered in SQL"),
    "data.search": supported("BAK-008: FTS5 ranking on a dedicated `search` parameter \u2014 parse-wire.ts:126"),
    "relations.pointerRead": supported("Pointer columns resolve via include"),
    "relations.relatedTo": supported(`junction-table subquery on _Join_<key>_<class> \u2014 ${SQL}:254`),
    "relations.addRemove": supported(`PUT with __op AddRelation/RemoveRelation \u2014 ${WIRE}:90${DRIVEN}, both directions`),
    "files.upload": supported(`BAK-006 file storage v2${DRIVEN} with the app id alone, where a stock Parse Server refuses outright`),
    // ⚠️ BCN-007 step 6 drove the expiry, which nothing had. With
    // `signedUrlTtlSeconds` set to 3 and enforcement on, the link served
    // anonymously, a tampered signature was refused (403), the bare URL with
    // the signature stripped was refused, and the link answered 403 "This file
    // is private" once the ttl passed. That is the whole claim, verified.
    //
    // ⚠️ …and one thing an author has to know, which the same run found: an
    // EXPIRED signature on a **public** file still serves 200, because the file
    // was never gated. Signing a public file produces a link with an expiry
    // that does nothing. Reported on the Sign File URL node rather than only
    // here — see its `URL Kind` output.
    "files.sign": supported(
      `BAK-006: SigV4 presign, or a local signed URL${DRIVEN}, returning a url with exp and sig. BCN-007 live: the signature really expires (403 after the ttl) and a tampered one is refused \u2014 but on a file that was never private, an expired link still serves`
    ),
    // BCN-007 step 5, for the one backend whose delete route is in this repo and
    // could be read line by line. Three semantics, all from
    // `nodegx-backend/src/server/files.ts`'s `delete`, and each one is something
    // an app author would otherwise discover from a broken image:
    //
    //  - It is **permanent and immediate** — blob, `_Files` metadata row and
    //    cached thumbnails all go. There is no trash and no restore.
    //  - It is **idempotent**: an unknown stored name answers 200 `{}` rather
    //    than 404, deliberately, matching WF-004. So a Delete File that reports
    //    success is not evidence the file existed.
    //  - It **does not touch records that point at the file**. A File-typed
    //    property persists as `{__type:'File', url, name}` and nothing scans for
    //    those, so the record keeps a link that now 404s. (The orphan sweep runs
    //    the other way — blobs with no metadata row — and does not help here.)
    //
    // These stay `supported` rather than becoming `degraded`: none of them is a
    // capability the backend lacks, and a `degraded` cell puts a warning in front
    // of the user in BCN-010's gating, which would be wrong for behaviour that is
    // both intended and normal.
    "files.delete": supported(
      `BAK-006${DRIVEN} with the app id alone, where upstream Parse needs the master key. Permanent (blob + _Files row + cached thumbnails), idempotent on an unknown name (200, not 404), and leaves File-typed record properties pointing at a URL that now 404s \u2014 files.ts delete()`
    ),
    // ⚠️ **Degraded, not supported, and BCN-007's live pass is why.** A private
    // upload is ACL'd to `ctx.principal.kind === 'user' ? principal.userId :
    // null` (`files.ts::upload`), so an upload made by anything that is not a
    // signed-in end user — an admin token, a master key, a cloud function, a
    // deploy script — stores a record marked private **with no owner**. Nothing
    // then excludes anybody, and the file serves to anonymous callers.
    // Measured both ways in one run: uploaded as the admin, the plain URL served
    // 200 to an anonymous caller; uploaded as a signed-in user, the same request
    // was 403 and a second signed-in user was 403 too.
    //
    // The header works. What it cannot do is make a file private on behalf of
    // nobody, and an author reading "supported" would not expect that.
    "files.private": degraded(
      "A private upload is locked to the person who made it, so a file uploaded by anything other than a signed-in user \u2014 an admin tool, a cloud function \u2014 ends up private with no owner, and stays readable by everyone. Upload File's Readers names roles that may read it too, such as role:member; a file with Readers is never readable by everyone.",
      "BCN-007 live, security enforced: uploaded as a signed-in user, the plain URL is 403 for anonymous AND for a second signed-in user. Uploaded with the master key, the identical request with X-NodeGX-File-Private: true serves 200 to anonymous \u2014 files.ts::upload sets owner=null for a non-user principal. P121-TWO001-MEMBERSPHOTO: X-NodeGX-File-Readers adds read-only role entries to the file's ACL; uploaded with the master key and role:crew, anonymous and a user without the role are 403 (files-http.test.ts)"
    ),
    "files.progress": supported("XHR upload path reports progress"),
    "auth.password": supported("nodegx-backend/src/server/users.ts"),
    "auth.signUp": supported("nodegx-backend/src/server/users.ts"),
    "auth.signUpProperties": supported("the user is a record in a collection, so profile fields write in the same call"),
    "auth.emailVerify": supported("BAK-002: SMTP + templates"),
    "auth.passwordReset": supported("BAK-002"),
    "auth.oauth": supported("BAK-004"),
    "auth.magicLink": supported("BAK-004 passwordless"),
    // Not Parse LiveQuery — parse-wire.ts:13 says live queries are explicitly
    // not implemented. BAK-001 shipped Server-Sent Events over a generic
    // ChangeBus instead. Same capability from a node's point of view, entirely
    // different transport, which is BCN-008's problem rather than this file's.
    "realtime.subscribe": supported(
      'BAK-001: SSE at GET /realtime, not Parse LiveQuery. BCN-008 measured it live: `connected` frame carries a server-minted clientId, POST /realtime/subscriptions answers 200 {accepted:[\u2026]}, create/update/delete all arrive as `change` frames carrying the WHOLE record (a delete included). Heartbeat is a `: heartbeat` comment every 25s, which the client owes nothing back. A Last-Event-ID reconnect answers `connected` with a fresh clientId then `resync{reason:"reconnect"}`.'
    )
  }),
  filters: filterTable(supported(`translated to SQL \u2014 ${SQL}`), {
    // ── The two silent-wrong-answer cells, both closed by BCN-003 ──────────
    //
    // Both were found by reading the SQL translator during BCN-001, and both
    // were worse than an unsupported operator because nothing failed: the
    // query succeeded and returned the wrong rows. Richard assigned both here
    // on 2026-07-31.
    //
    // What made them fixable rather than merely declarable is that
    // `node:sqlite` exposes `db.function()`, so SQLite can call back into
    // JavaScript. The regular expression is now the same engine the user's
    // browser would use, and the geometry is ordinary JavaScript rather than
    // an approximation in SQL.
    // Was `LIKE '%value%'` (QueryBuilder.ts:366), so `^Ada$` searched for that
    // literal text. Now `nodegx_regexp(pattern, flags, column)`, a real
    // RegExp, with `$options` read from its sibling key rather than as an
    // operator of its own.
    matchesRegex: supported(
      `${SQL} \u2014 a registered SQL function evaluating a real RegExp; probed live in BCN-003, where ^Ada$ matched "Ada" and not "Adam"`
    ),
    // Unchanged, and still honest. `$text` in a *filter* is a different thing
    // from the `search` query option, which is real FTS5 ranking (BAK-008).
    // Only the filter-operator form lowers to a contains match.
    textSearch: degraded(
      "Full-text search in a filter falls back to a plain contains match. For ranked search use the Search input on the Query node instead.",
      `${SQL} \u2014 $text lowers to LIKE; the ranked path is BAK-008's separate 'search' parameter`
    ),
    // ── Geo: no longer dropped on the floor ────────────────────────────────
    //
    // All three used to warn to the console and return null, and a null
    // condition is never added to the WHERE clause — so a "within 5 km" query
    // returned every record in the collection with nothing in the app to see.
    //
    // A GeoPoint is stored as its Parse tagged object, JSON-encoded, which is
    // why the box test reads through `json_extract` and the other two hand the
    // column to a registered function. What we own by fixing rather than
    // gating these is one performance characteristic — there is no spatial
    // index, so all three scan — and that is stated rather than implied.
    nearSphere: degraded(
      "Distance filters work, but the results are not ordered by how close they are, and the whole collection is checked \u2014 so a large collection will be slow.",
      `${SQL} \u2014 nodegx_distance_km(), haversine; Parse reads a bare $nearSphere as a proximity *sort*, and sorting is out of BCN-003's scope`
    ),
    withinBox: supported(
      `${SQL} \u2014 two range comparisons on json_extract'd coordinates; exact, but unindexed`
    ),
    // P116 ONT-004. A path through several links, compiled into the same
    // statement as the rest of the query — nested id subqueries for fixed hops,
    // a recursive common table expression for a repeated one — with the
    // caller's row ACL applied at every hop. Proven on both engines by the
    // suite, which asserts the rows and never the SQL (BRG-003 §3.3).
    path: supported(
      `${SQL} buildPathPredicate \u2014 conformance/cases/paths.ts on SQLite and PostgreSQL: a membership business's four paths (depth 1, 2, 4 and 5), a repeated hop bounded at 3, dedupe, the ACL at every hop, and five refusals by name; ceiling ${"8"} hops`
    ),
    withinPolygon: supported(
      `${SQL} \u2014 nodegx_point_in_polygon(), ray casting. Planar, which is what Mongo's legacy $polygon is too, so this agrees with Parse rather than diverging from it`
    )
  })
};

// packages/nodegx-backend-contract/src/descriptors/parse.ts
var SHIPPED = "cloudstore.js has spoken this wire since Noodl; documented, not probed";
var PROBED = "BCN-002 live pass against parse-server 7.3.0, app id only";
var parseDescriptor = {
  type: "parse",
  // Parse session tokens do not expire. This is the reason there is no
  // `refresh` method among the ten auth methods: the interface was extracted
  // from a codebase that had only ever talked to Parse.
  tokenLifecycle: { kind: "eternal" },
  capabilities: Object.freeze({
    "data.query": supported(`${PROBED}; filtered read with $gt returned the matching row only`),
    "data.count": supported(PROBED),
    // The one place Parse and the built-in backend genuinely part company, and
    // the reason BCN-001 gave them separate columns. It is no longer a reading
    // of the docs: asked with the app id alone, Parse answers
    // `unauthorized: master key is required`; asked with the master key, it
    // answers 200 with the total. The master key must never be in a browser, so
    // this is not "hard from the client", it is closed to it. `unsupported`
    // rather than `conditional` because no per-instance setting opens it up.
    "data.aggregate": unsupported(
      "Parse Server only allows totals and averages from a trusted server, not from your app. Query the records and calculate in your app, or switch this node to the built-in backend.",
      `${PROBED}: 403 "unauthorized: master key is required"; the same call with the master key returns 200 and the total`
    ),
    "data.distinct": unsupported(
      "Parse Server only allows distinct values from a trusted server, not from your app.",
      `${PROBED}: /aggregate?distinct= is refused without the master key and answers 200 with it`
    ),
    "data.fetch": supported(PROBED),
    "data.create": supported(PROBED),
    "data.save": supported(PROBED),
    "data.increment": supported(`__op: 'Increment' is atomic on Parse. ${PROBED}, and the response carried the new value`),
    "data.delete": supported(PROBED),
    "data.acl": supported(`Parse ACLs are the model BAK-003 was built to match. ${SHIPPED}`),
    // BAK-008's `search` parameter is ours. Parse has $text, which is a filter
    // operator and is indexed only if someone created the index — see the
    // filter table below. There is no ranked-search parameter to map onto.
    "data.search": unsupported(
      'Parse Server has no ranked search. Use a "contains" filter on the field you want to search, or switch this node to the built-in backend.',
      "The search parameter is BAK-008, ours. Parse offers $text as a filter operator only."
    ),
    "relations.pointerRead": supported(SHIPPED),
    "relations.relatedTo": supported(`$relatedTo is Parse's own operator. ${SHIPPED}`),
    "relations.addRemove": supported(`__op AddRelation/RemoveRelation. ${PROBED}, both directions, app id only`),
    // Corrected in BCN-002, and the correction is the argument for probing.
    // Parse Server disables file upload by default for *everyone* — public,
    // anonymous and authenticated alike — so an out-of-the-box server answers
    // the Upload File node with `File upload by public is disabled.` The
    // documentation reads as though upload is simply available; it is not, and
    // the difference is per deployment, which is what `conditional` means.
    "files.upload": conditional(
      "Whether your Parse Server accepts uploads depends on how it was set up \u2014 new servers turn file uploads off. Ask whoever hosts yours to enable them.",
      {
        method: "POST",
        path: "/files/probe.txt",
        expect: 'a 201 with a name and url, rather than error code 130 "File upload by public is disabled"'
      },
      `${PROBED}: a server started with Parse's defaults answers 400 code 130; the same server with fileUpload.enableForPublic accepts it`
    ),
    // Corrected in BCN-002 from `conditional`. The probe BCN-001 wrote asked
    // whether Parse's file adapter presigns URLs, which is a real question —
    // but the contract's `signFileUrl` calls `GET /files/:name/sign`, and that
    // route is BAK-006's, ours. Parse has no route there at all: it answers 403
    // code 119 "Invalid application ID" *even with the master key*, which is
    // what a missing route looks like from behind Parse's router.
    "files.sign": unsupported(
      "Parse Server has no way to mint a temporary link to a file. Store files on the built-in backend if you need links that expire.",
      `${PROBED}: GET /files/:name/sign answers 403 code 119 with the master key as well as without \u2014 the route is BAK-006's, not Parse's`
    ),
    // Corrected in BCN-002. The old cell read `supported`, with "master key is
    // not required for file delete on most deployments" — the opposite of what
    // a real server does, and a confident wrong answer about a delete.
    "files.delete": unsupported(
      "Parse Server only allows a file to be deleted from a trusted server, not from your app.",
      `${PROBED}: DELETE /files/:name answers 403 "unauthorized: master key is required", and 200 with the master key`
    ),
    "files.private": unsupported(
      "Parse Server files are public to anyone with the link. To keep a file private, store it on the built-in backend instead.",
      "The private flag is the X-NodeGX-File-Private header \u2014 ours, not Parse's."
    ),
    "files.progress": supported("the XHR upload path is client-side and works against any wire"),
    "auth.password": supported(SHIPPED),
    "auth.signUp": supported(SHIPPED),
    "auth.signUpProperties": supported(`the Parse user is a row in _User, so profile fields write in the same call. ${SHIPPED}`),
    "auth.emailVerify": conditional(
      "Email verification needs your Parse Server to have an email adapter configured. Many do not.",
      { method: "POST", path: "/verificationEmailRequest", expect: 'anything other than a "no email adapter" error' },
      "Parse Server verifyUserEmails requires a configured mail adapter. Documented, not probed."
    ),
    "auth.passwordReset": conditional(
      "Password reset emails need your Parse Server to have an email adapter configured. Many do not.",
      { method: "POST", path: "/requestPasswordReset", expect: 'anything other than a "no email adapter" error' },
      "Same mail-adapter dependency as verification. Documented, not probed."
    ),
    "auth.oauth": conditional(
      "Signing in with Google, GitHub and the rest depends on which providers your Parse Server was set up with.",
      { method: "GET", path: "/serverInfo", expect: "an auth section listing configured providers" },
      "Parse authDataManager providers are server configuration. Documented, not probed."
    ),
    "auth.magicLink": unsupported(
      "Parse Server has no magic-link login. Use email and password, or an OAuth provider.",
      "No passwordless flow exists in the Parse REST API."
    ),
    // The cell that justifies the four-state model existing at all. A user
    // enables realtime, gets nothing, and there is no error anywhere because
    // the node never managed to connect.
    // ⚠️ The `/serverInfo` half of the old probe does not work and has been
    // dropped. Measured against Parse Server 7.3.0 with the master key:
    // `/serverInfo` lists `globalConfig, hooks, cloudCode, logs, push, schemas,
    // settings` and mentions LiveQuery nowhere at all — so it cannot tell an
    // instance that runs LiveQuery from one that does not, and a probe built on
    // it answers "no" on every Parse server in the world.
    //
    // The socket settles it, and settles it fast: 20ms to an `error` on this
    // server. `conditional` costs almost nothing to resolve, which was BCN-001's
    // argument for the four-state model and is now a number.
    "realtime.subscribe": conditional(
      "Live updates need a Parse LiveQuery server, which most Parse setups do not run. Check with whoever hosts yours.",
      {
        method: "GET",
        kind: "websocket",
        path: "/",
        expect: 'a 101 upgrade on the ws:// endpoint, followed by a {"op":"connected"} reply to a connect op. The HTTP API cannot answer this question. Deadline the attempt \u2014 an absent LiveQuery server is SILENT in every place a client would look.'
      },
      'BCN-008, live against Parse Server 7.3.0: /parse/serverInfo advertises no liveQuery of any kind; ws://\u2026/parse errors in 20ms with "Received network error or non-101 status code" and `close` never fires. That is a measurement that LiveQuery is ABSENT here, not that the protocol was exercised \u2014 no NodeGX code has ever spoken to a running LiveQuery server.'
    )
  }),
  filters: filterTable(supported(SHIPPED), {
    // P116 ONT-004. Parse can nest inner queries ($inQuery, $select), which is a
    // path one hop per nesting — but that lowering is not written, and a cell
    // flipped on the strength of the documentation is the hole this table
    // exists to close. Refused by name until a live pass proves it.
    path: unsupported(
      'Following several links in one request is not available on Parse yet. Filter one link at a time with "points to" or "related to".',
      "Not driven. Parse spells it as nested $inQuery / $select; no translator writes that yet"
    ),
    // Parse has no native contains/startsWith/endsWith or between. They are
    // NOT gated: `contains` is `$regex`, `between` is two comparisons under an
    // `and`, and Parse's regex is a real regex so the lowering is exact. See
    // LOWERED_OPERATORS — greying these out on a backend that can plainly
    // answer them would read as the product being broken.
    contains: supported("lowered to $regex"),
    notContains: supported("lowered to an anchored $regex with a negative lookahead \u2014 Parse has no $not"),
    containsIgnoreCase: supported("lowered to $regex with the i option"),
    startsWith: supported("lowered to an anchored $regex"),
    notStartsWith: supported("lowered to an anchored $regex with a negative lookahead"),
    startsWithIgnoreCase: supported("lowered to an anchored $regex with the i option"),
    endsWith: supported("lowered to an anchored $regex"),
    notEndsWith: supported("lowered to an anchored $regex with a negative lookahead"),
    endsWithIgnoreCase: supported("lowered to an anchored $regex with the i option"),
    between: supported("lowered to $gte + $lte on one field, which Parse allows"),
    notBetween: supported("lowered to $lt + $gt under $or"),
    // Parse has no operator for "empty string or empty array" as distinct from
    // null, and no way to synthesise one: $exists answers the null question
    // only. This is a genuine gap rather than a lowering opportunity.
    isEmpty: unsupported(
      `Parse Server can't tell an empty value from a missing one. Use "is not set" instead, or compare the field to an empty string.`,
      "No $empty equivalent; $exists answers presence only."
    ),
    isNotEmpty: unsupported(
      `Parse Server can't tell an empty value from a missing one. Use "is set" instead.`,
      "No $nempty equivalent."
    ),
    textSearch: conditional(
      "Full-text search on Parse needs a text index on the field, created in your database.",
      { method: "GET", path: "/classes/{collection}", expect: "a $text query returning without an index error" },
      "Parse $text requires a MongoDB text index. Documented, not probed."
    )
  })
};

// packages/nodegx-backend-contract/src/descriptors/pocketbase.ts
var WILDCARD_DEGRADED2 = (() => {
  const wildcards = "The characters % and _ act as wildcards here, so searching for text containing one will match more than you asked for.";
  const bothWays = `${wildcards} Matching also ignores capitals.`;
  const evidence = "BCN-003 live: ~ is LIKE with no ESCAPE clause; a backslash is matched literally";
  return {
    contains: degraded(bothWays, evidence),
    notContains: degraded(bothWays, evidence),
    containsIgnoreCase: degraded(wildcards, evidence),
    startsWith: degraded(bothWays, evidence),
    notStartsWith: degraded(bothWays, evidence),
    startsWithIgnoreCase: degraded(wildcards, evidence),
    endsWith: degraded(bothWays, evidence),
    notEndsWith: degraded(bothWays, evidence),
    endsWithIgnoreCase: degraded(wildcards, evidence)
  };
})();
var IGNORED = "BCN-001 probe: PocketBase returns 200 and un-aggregated rows for every spelling tried; an invented parameter behaves identically. Nothing fails at runtime.";
var pocketbaseDescriptor = {
  type: "pocketbase",
  tokenLifecycle: {
    kind: "refresh",
    // PocketBase tokens are longer-lived than Directus's but still expire, and
    // the refresh is an explicit call rather than a cookie the browser handles.
    accessTtlSeconds: 1209600,
    refreshEndpoint: "/api/collections/{collection}/auth-refresh",
    refreshBeforeExpirySeconds: 3600
  },
  capabilities: Object.freeze({
    "data.query": supported("GET /api/collections/{c}/records with filter/sort/expand"),
    "data.count": supported("BCN-001 probe: totalItems and totalPages on every list response"),
    "data.aggregate": unsupported(
      "PocketBase can't total or average records on the server. Query the records and calculate in your app, or make a view collection in the PocketBase admin that does the grouping.",
      IGNORED + " A `view` collection wrapping a GROUP BY query does work and was verified \u2014 but that is schema authored by hand in the admin UI, not something a node can express."
    ),
    "data.distinct": unsupported(
      "PocketBase can't list the distinct values of a field. Query the records and reduce them in your app.",
      "BCN-001 probe: ?distinct=status silently returned all seven rows \u2014 the same ignore-the-parameter behaviour."
    ),
    "data.fetch": supported("GET /api/collections/{c}/records/{id}"),
    "data.create": supported("POST /api/collections/{c}/records"),
    "data.save": supported("PATCH /api/collections/{c}/records/{id}"),
    "data.delete": supported("DELETE /api/collections/{c}/records/{id}"),
    "data.increment": supported("PocketBase has the +/- field modifier: {'rating+': 1} is applied server-side"),
    "data.acl": unsupported(
      "PocketBase controls access with API rules, written per collection in the PocketBase admin \u2014 not per record from here.",
      "API rules are collection-level filter expressions, not a per-record ACL field."
    ),
    "data.search": degraded(
      "PocketBase has no ranked search. NodeGX searches by looking for your text inside each field, which finds matches but cannot order them by relevance.",
      "Lowered to a filter of ORed ~ (contains) conditions. No FTS index exists."
    ),
    "relations.pointerRead": supported(
      'BCN-005 live: ?expand=author,tags nests both under `expand`. Filtering across a relation that can hold several records needs the "any of" form of the operator, which the adapter emits from the schema'
    ),
    "relations.relatedTo": unsupported(
      'Filtering by "records related to this one" is not available on PocketBase. Filter on a field of the related record instead, such as author \u2192 name.',
      "BCN-005 live: dotted-path filters work (author.city='London', tags.label?='algebra'), but Parse's $relatedTo has no PocketBase spelling"
    ),
    "relations.addRemove": supported(
      'BCN-005 live: PATCH {"tags+": id} and {"tags-": id} are applied server-side in one request and are set-shaped \u2014 appending a value already present leaves the list unchanged. \u26A0\uFE0F On a relation that holds only one record, "+" replaces what is there and "-" clears it whichever id you name'
    ),
    // ── Files — BCN-007 steps 2/3/5/7, every cell measured ───────────────
    // Probe: BCN-007-FILES-PROBE-OUTPUT.txt §3 and
    // BCN-007-FILES-PROBE2-OUTPUT.txt §2.
    "files.upload": degraded(
      "On PocketBase a file is a field on a record, not a thing of its own \u2014 so the Upload File node needs a Collection and a Field, and a Record ID if it should attach to a record that already exists rather than creating one. Leave them blank and the upload has nowhere to go.",
      "BCN-007 live: a multipart POST to the RECORD endpoint answers 200 and the field holds a bare filename string. The handle is (collection, record id, filename) and FileRef.target carries it \u2014 the contract expresses it rather than approximating it, and this cell is degraded because the target is something the app author has to supply and cannot be guessed"
    ),
    "files.sign": degraded(
      "A PocketBase file link carries a token rather than a signature. It expires quickly (about three minutes on a default install) and it works for whoever holds it until then, so treat it as short-lived rather than shareable.",
      "BCN-007 live: POST /api/files/token answers 200 with a JWT whose exp is 180s ahead, and ?token= serves a protected file. The token is per-CALLER, not per-file \u2014 its payload names a collection and an auth-record id, not the file"
    ),
    "files.delete": degraded(
      "Deleting a file on PocketBase edits the record it belongs to \u2014 the file goes and the record stays. Deleting the record instead takes its files with it.",
      'BCN-007 live: PATCH {field: null} answers 200, the field reads "" afterwards, and the file URL becomes 404. DELETE of the record also 404s the file. Neither is symmetric with our own DELETE /files/{name}, which removes a file and leaves records pointing at it'
    ),
    "files.private": degraded(
      'PocketBase files are protected by the same rule as the record they belong to, so a file is private only if its record is. Marking a field "protected" on a collection anyone can read does nothing.',
      "\u26A0\uFE0F BCN-007 live, and stronger than this cell previously claimed: a field created with protected:true \u2014 confirmed round-tripped as true by reading the collection back \u2014 SERVED WITH NO CREDENTIAL AT ALL when the collection's view rule was public. The same field on an admin-only collection answered 404. So `protected` defers to the record rule rather than being an independent file-level control"
    ),
    "files.progress": degraded(
      "The upload works but the progress bar will not move on this backend.",
      '\u26A0\uFE0F CORRECTED by BCN-007. This cell read `supported` with the evidence "multipart upload goes over the XHR path". It does not: RestDataAdapter is built on `fetch`, which has no upload-progress event'
    ),
    "auth.password": supported("POST /api/collections/{c}/auth-with-password"),
    "auth.signUp": supported("POST /api/collections/{c}/records on an auth collection"),
    "auth.signUpProperties": supported("the PocketBase user is a record in an auth collection, so profile fields write in the same call"),
    "auth.emailVerify": conditional(
      "Verification emails need SMTP set up in your PocketBase admin. Without it PocketBase only logs the mail.",
      { method: "GET", path: "/api/settings", expect: "an smtp section with enabled: true" },
      "PocketBase falls back to logging mail rather than erroring, so a missing SMTP setup looks like success."
    ),
    "auth.passwordReset": conditional(
      "Password reset emails need SMTP set up in your PocketBase admin.",
      { method: "GET", path: "/api/settings", expect: "an smtp section with enabled: true" },
      "Same silent-log fallback as verification."
    ),
    // ⚠️ **The probe named the wrong field, and the field it named is `null`.**
    // Measured on PocketBase 0.30.0: `auth-methods` answers
    // `{password:{…}, oauth2:{providers:[], enabled:false}, otp:{…}, authProviders:null}`.
    // `authProviders` is the ≤0.22 spelling, kept as a deprecated alias — and on
    // an instance with OAuth **switched off** it is not an empty array, it is
    // `null`. A probe reading it would have thrown rather than reported "no
    // providers", which is the failure mode a probe exists to avoid. `oauth2` is
    // the live field and `oauth2.enabled` is the switch.
    //
    // The cell stays `conditional`, and now for a reason that was measured rather
    // than assumed: the *implementation* exists and has been driven end to end
    // (BCN-006 step 5 — a stub OIDC provider was stood up so a real round trip
    // could be observed), but whether any provider is configured is this
    // instance's business. `RestAuthAdapter.signInWithProvider` asks
    // `auth-methods` before it navigates anywhere, so this probe and the runtime
    // check are the same question asked of the same endpoint.
    "auth.oauth": conditional(
      "Signing in with Google, GitHub and the rest depends on which providers you have set up in your PocketBase admin.",
      { method: "GET", path: "/api/collections/{collection}/auth-methods", expect: "oauth2.enabled true, with at least one entry in oauth2.providers" },
      'MEASURED 2026-08-01 against PocketBase 0.30.0: with a provider configured, auth-methods returns oauth2.providers[] carrying a per-attempt state, codeVerifier and an authURL ending in a bare `redirect_uri=`; POST /api/collections/{c}/auth-with-oauth2 {provider, code, codeVerifier, redirectURL} answers 200 with {token, record, meta.isNew}. With OAuth off the same POST answers 403 "The collection is not configured to allow OAuth2 authentication."'
    ),
    "auth.magicLink": unsupported(
      "PocketBase has no magic-link login. Use email and password, or an OAuth provider.",
      "OTP exists in recent versions but is a code-entry flow, not a link. Revisit if BCN-006 adds an OTP node."
    ),
    // Supported, and measured — but read the second half of the evidence before
    // reusing this cell to justify anything. PocketBase accepts a subscription
    // it will never deliver, which is the same "a 200 is not a yes" shape
    // BCN-001 found in its aggregate probe.
    "realtime.subscribe": supported(
      'GET /api/realtime is Server-Sent Events, on by default \u2014 the same transport shape as BAK-001. BCN-008 measured it live against 0.30.0, anonymously and with no token anywhere: `PB_CONNECT` carries a clientId, POST /api/realtime {clientId, subscriptions:["coll"]} answers 204, and events arrive under an SSE event name that is the COLLECTION NAME rather than "change", with data {action, record}. A delete carries the whole record. Nothing at all arrived on an idle stream in 130s, so there is no observed keepalive. \u26A0\uFE0F Subscribing to a collection the caller cannot list is ALSO 204 \u2014 acceptance is not gated, delivery is, so a wrong subscription is silent rather than refused.'
    )
  }),
  filters: filterTable(supported("native PocketBase filter expression"), {
    // PocketBase's filter syntax is an expression language (`status = "x" &&
    // rating > 3`) rather than a JSON operator tree, so most of the vocabulary
    // maps onto an operator symbol. `~` covers the contains family.
    matchesRegex: unsupported(
      `PocketBase can't match text with regular expressions. Use "contains", "starts with" or "ends with" instead.`,
      "The filter language has ~ (contains) but no regex operator."
    ),
    // ⚠️ BCN-003, live: PocketBase has no NULL for a text field — an unset
    // value *is* the empty string — so "is empty" and "is not set" are the same
    // question here and cannot be separated. All three cells say so.
    isEmpty: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is empty" also matches records that were never given a value.',
      'BCN-003 live: = "" returned both the empty-string row and the row seeded without a value'
    ),
    isNotEmpty: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is not empty" also excludes records that were never given a value.',
      "BCN-003 live: the complement of the above"
    ),
    exists: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is set" and "is not empty" are the same question here.',
      "BCN-003 live: = null also matched the empty-string row"
    ),
    ...WILDCARD_DEGRADED2,
    // P116 ONT-004. PocketBase's dotted-path filter is measured one hop deep
    // (BCN-005, with the ?= cardinality trap); deeper paths not driven.
    path: unsupported(
      "Following several links in one request is not available on PocketBase yet. Filter one link at a time with a dotted field.",
      "BCN-005 live: one hop works (author.city='London', tags.label?='algebra'); deeper paths not driven, no translator"
    ),
    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on PocketBase yet.',
      "BCN-005."
    ),
    textSearch: degraded(
      "PocketBase has no ranked search \u2014 this looks for your text inside the field instead.",
      "Lowered to ~ (contains)."
    ),
    nearSphere: unsupported(
      "Location filters aren't available on PocketBase.",
      "No geo types or operators in the records API."
    ),
    withinBox: unsupported("Location filters aren't available on PocketBase.", "No geo operators."),
    withinPolygon: unsupported("Location filters aren't available on PocketBase.", "No geo operators.")
  })
};

// packages/nodegx-backend-contract/src/descriptors/supabase.ts
var supabaseDescriptor = {
  type: "supabase",
  tokenLifecycle: {
    kind: "refresh",
    accessTtlSeconds: 3600,
    refreshEndpoint: "/auth/v1/token?grant_type=refresh_token",
    refreshBeforeExpirySeconds: 120
  },
  capabilities: Object.freeze({
    "data.query": supported("RUN-003 drove the real parser against a live PostgREST OpenAPI spec"),
    // Answered by the Content-Range header under `Prefer: count=exact`, which
    // is a different mechanism from the aggregate machinery entirely — it
    // worked on the server with aggregates disabled. This is the concrete
    // reason data.count and data.aggregate are separate keys.
    "data.count": supported("BCN-001: Prefer: count=exact + Range: 0-0 returned content-range 0-0/7 with aggregates OFF"),
    // The cell BCN-001 was sent to resolve.
    "data.aggregate": conditional(
      "Totals and averages have to be switched on for your Supabase project. If this stays unavailable after connecting, enable aggregate functions in your project settings.",
      { method: "GET", path: "/{collection}?select=count()", expect: '200 with [{"count":N}] \u2014 a 400 carrying code PGRST123 means it is off' },
      'BCN-001: stock PostgREST 12.2.3 answers PGRST123 "Use of aggregate functions is not allowed"; the same binary with db-aggregates-enabled=true answers count/sum/avg, groupBy and composed filters. Per-instance setting, and Supabase sets it independently of the PostgREST default.'
    ),
    "data.distinct": unsupported(
      "Supabase has no way to list the distinct values of a column from here. Make a database view for it, or fetch the records and reduce them in your app.",
      "BCN-001: no query-string form. Both plausible spellings are PGRST100 parse errors."
    ),
    "data.fetch": supported("GET /{table}?{pk}=eq.{id}"),
    "data.create": supported("POST /{table} with Prefer: return=representation"),
    "data.save": supported("PATCH /{table}?{pk}=eq.{id}"),
    "data.delete": supported("DELETE /{table}?{pk}=eq.{id}"),
    "data.increment": degraded(
      "Supabase has no way to add to a number in one step from here, so NodeGX reads the value and writes it back. If two people increment the same record at the same moment, one of the changes can be lost. A database function would avoid this.",
      "PostgREST can only do this atomically through an RPC the user has to author. BCN-004 may offer to detect one."
    ),
    "data.acl": unsupported(
      "Supabase controls access with Row Level Security, set up in your Supabase dashboard \u2014 not per record from here.",
      "RLS is database policy; there is no per-record ACL field on the wire."
    ),
    "data.search": conditional(
      "Ranked search needs a text-search index on the table in your Supabase database.",
      { method: "GET", path: "/{collection}?select={pk}&{field}=fts.test", expect: "200 rather than a missing-index or unknown-operator error" },
      "PostgREST exposes Postgres full-text search via fts/plfts/phfts operators, which need a tsvector column or index to be useful."
    ),
    "relations.pointerRead": supported(
      "BCN-005 live: ?select=*,author:authors(*) nests the author under the name you asked for. A filter on the related record needs the embed marked !inner or the parent rows are not narrowed \u2014 measured both ways, and the adapter emits it"
    ),
    "relations.relatedTo": unsupported(
      'Filtering by "records related to this one" is not available on Supabase. Filter on a field of the related record instead, such as author \u2192 name.',
      "BCN-005 live: a dotted filter with an !inner embed narrows the parent correctly, but Parse's $relatedTo has no PostgREST spelling"
    ),
    "relations.addRemove": degraded(
      "Adding a many-to-many relation needs the join table to use both of its links as its key. Where it uses a separate id column instead, Supabase cannot see the relation at all and NodeGX will say so rather than write to the wrong place.",
      'BCN-005 live: with PRIMARY KEY (article_id, tag_id) the M2M embed answers 200 and POST with Prefer: resolution=merge-duplicates makes the add idempotent; with a surrogate id primary key the identical two tables answer PGRST200 "no matches were found" and no request recovers the relation'
    ),
    // ── Files — BCN-007 steps 2/5/7 ──────────────────────────────────────
    //
    // ⚠️ **These five were the only Supabase cells in the descriptor written
    // from documentation that BCN-007 could turn into measurements.** The rig
    // has never had a Storage service — `:8056` is plain PostgREST and answers
    // every `/storage/v1/*` with a bare `404 {}` — and BCN-006 hit the same wall
    // on auth and correctly refused to flip anything, moving four cells to
    // `conditional` instead. Rather than repeat that here, BCN-007 stood a real
    // `supabase/storage-api` up against the rig's existing `supabase-db` and
    // probed it; the service is in `docker-compose.yml` under the `supabase`
    // profile so the measurement is reproducible.
    //
    // Probe: `BCN-007-SUPABASE-STORAGE-OUTPUT.txt`, 14 checks, 0 failures.
    "files.upload": degraded(
      "Supabase keeps files in a Storage bucket, so the Upload File node needs a Bucket and a Path. There is no default bucket, and a bucket name that does not exist fails with a message that does not say so.",
      "BCN-007 live: POST /storage/v1/object/{bucket}/{path} answers 200 with {Key, Id} \u2014 and NOTHING ELSE. No url, no size, no content type; those exist only on a second call to POST /object/list/{bucket}, so an upload reports them absent rather than making a round trip to dress the answer up"
    ),
    "files.sign": supported(
      `BCN-007 live: POST /storage/v1/object/sign/{bucket}/{path} with {expiresIn} answers 200 and the link EXPIRES \u2014 verified by waiting it out, after which it answers 400 InvalidJWT "jwt expired". \u26A0\uFE0F The signedURL it returns is RELATIVE (/object/sign/\u2026), so it resolves against the app's own origin and 404s there unless the adapter puts the origin and the /storage/v1 mount back`
    ),
    "files.delete": degraded(
      "Deleting a file that is not there is an error on Supabase rather than a no-op, so a Delete File node that runs twice reports a failure the second time.",
      'BCN-007 live: DELETE /storage/v1/object/{bucket}/{path} answers 200 {"message":"Successfully deleted"} and the public URL then 400s. A path that never existed answers 400 with statusCode 404 "Object not found" \u2014 NOT idempotent, unlike nodegx-backend, which answers 200 for an unknown name by design'
    ),
    "files.private": supported(
      `BCN-007 live: a bucket created public:false serves 400 on /object/public/{bucket}/{path} while an identical public:true bucket serves 200 with the bytes. Privacy is the bucket's, not the file's, and row-level security applies on top \u2014 an upload with the anon key was refused with "new row violates row-level security policy"`
    ),
    "files.progress": degraded(
      "Upload progress isn't reported by Supabase \u2014 the file still uploads, the bar just won't move.",
      "The Storage endpoint is consumed over fetch, which has no upload-progress event."
    ),
    // ⚠️ **The four auth cells nothing has ever verified, and which no adapter serves.**
    // Two separate facts, and both point the same way:
    //
    // 1. **GoTrue is not in the rig.** Like Realtime below, Supabase Auth is a separate
    //    service; the rig's "Supabase" is one Postgres and one PostgREST container, and
    //    BCN-006 measured every `/auth/v1/*` route as a plain 404 from PostgREST. So the
    //    endpoints named here are read from documentation, not asked of a server.
    // 2. **`RestAuthAdapter` does not implement Supabase.** BCN-006 shipped Directus and
    //    PocketBase and gated Supabase deliberately, on the argument that writing an auth
    //    flow from documentation is how a user gets locked out of their own app.
    //
    // They were `supported`, which claimed a capability the product does not have — flagged
    // by BCN-006 itself rather than left. `conditional` is the correct state and it is the
    // safe one: the editor treats it as unavailable until a probe says otherwise, so an
    // unverified cell cannot promise anything. **Do not promote these to `supported`
    // without both a real GoTrue to probe and an adapter that speaks to it.**
    "auth.password": conditional(
      "Signing in with an email and password needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "a settings document rather than a 404" },
      "DOCUMENTED, NOT PROBED \u2014 BCN-006 confirmed only that no GoTrue exists in this rig to probe (every /auth/v1/* is a 404 from PostgREST), and RestAuthAdapter implements Directus and PocketBase only."
    ),
    "auth.signUp": conditional(
      "Creating accounts needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "a settings document rather than a 404" },
      "DOCUMENTED, NOT PROBED \u2014 same as auth.password. POST /auth/v1/signup is read from documentation."
    ),
    "auth.signUpProperties": degraded(
      "Supabase keeps the login and the profile separately, so signing up takes two steps. If the second one fails the account still exists, without the profile details.",
      "auth.users is not writable from the client; profile rows live in a public table. DOCUMENTED, NOT PROBED \u2014 and moot while auth.signUp is conditional."
    ),
    "auth.emailVerify": conditional(
      "Confirming an email address needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "a settings document rather than a 404" },
      "DOCUMENTED, NOT PROBED. Email confirmation being on by default for new projects is a fact about Supabase, not about whether we can reach it."
    ),
    "auth.passwordReset": conditional(
      "Resetting a password needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "a settings document rather than a 404" },
      "DOCUMENTED, NOT PROBED \u2014 POST /auth/v1/recover is read from documentation."
    ),
    "auth.oauth": conditional(
      "Signing in with a provider needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "an external section listing enabled providers" },
      "DOCUMENTED, NOT PROBED \u2014 same as auth.password. Which providers a project has enabled is per-project configuration, but that is moot while nothing here can reach GoTrue at all."
    ),
    // ⚠️ **This was `supported`, and it was the last Supabase auth cell still
    // claiming a capability the product does not have.** BCN-006 corrected its
    // five neighbours and flagged that it had not touched the descriptors; this
    // one survived the sweep because its evidence string reads like a fact about
    // Supabase — and it is one. `POST /auth/v1/otp` really is a first-class
    // Supabase flow. The cell is not about Supabase, though: it is about whether
    // **NodeGX** can drive it, and `RestAuthAdapter` refuses every Supabase auth
    // call with `SUPABASE_AUTH_UNSUPPORTED` before a request is issued.
    //
    // So a builder on Supabase saw `Request Magic Link` offered as fully
    // supported, wired it up, and got a refusal at runtime — the precise failure
    // this phase's central promise exists to prevent, in the one family where the
    // spec names it: *"`Request Magic Link` on a Directus project is a disabled
    // node with a reason, not a node that emits nothing."*
    //
    // `conditional` rather than `unsupported` for the same reason as its five
    // neighbours: the editor treats it as unavailable until a probe says
    // otherwise, and the day a GoTrue is stood up and measured this is the cell
    // that gets promoted rather than rewritten.
    "auth.magicLink": conditional(
      "Sending a magic-link sign-in needs Supabase Auth, and NodeGX does not support it on this backend yet.",
      { method: "GET", path: "/auth/v1/settings", expect: "a settings document rather than a 404" },
      "DOCUMENTED, NOT PROBED \u2014 POST /auth/v1/otp is read from documentation. Magic links being first-class in Supabase is a fact about Supabase, not about whether we can reach them: every /auth/v1/* answers 404 in this rig and RestAuthAdapter issues no Supabase request at all."
    ),
    // ⚠️ **The one realtime cell nothing has ever verified.** BCN-008 tried and
    // could not: the rig's "Supabase" is one Postgres and one PostgREST
    // container, and Supabase Realtime is a separate Elixir service that is not
    // in docker-compose.yml at all. The probe established the absence rather
    // than inventing a result — /realtime/v1/api/tenants/realtime/health is a
    // plain 404 from PostgREST, ws://…/realtime/v1/websocket errors in 5ms, and
    // ports 4000 and 54321 are silent.
    //
    // ⚠️ **BCN-008 proper did not change this, and the reason is worth stating.** The
    // transports shipped for the other four backends; **none was written for Supabase**,
    // because writing a Phoenix-channel decoder from documentation is the exact habit this
    // phase exists to end. So at runtime `realtimeSupportFor('supabase')` answers
    // `unsupported`, while this cell said `conditional` — a disagreement that BCN-008
    // recorded rather than papered over, with the note that **"BCN-010 is where one of
    // them has to give."**
    //
    // ## BCN-010: it gives here, and to `unsupported`.
    //
    // The two cells were answers to different questions — "could a Supabase project have
    // realtime?" versus "can NodeGX speak to it?" — and that was a defensible split right
    // up until a *port* started reading this one. `conditional` is not a neutral hedge to a
    // gate: it is a promise that a probe can settle the question, and the editor now acts
    // on the answer. If `/realtime/v1/api/tenants/realtime/health` ever answered on a real
    // Supabase project, this cell would **enable Subscribe To Changes on a node with no
    // transport underneath it** — a port that looks available, accepts a wire, and then
    // reports `CAPABILITY_UNAVAILABLE` at runtime. That is the silent gap the phase exists
    // to prevent, manufactured by the gate itself.
    //
    // So the cell now answers the question the gate is actually asking, which is the second
    // one. Nothing was measured to make this change and nothing needed to be: the evidence
    // is `realtime/UnavailableTransport.ts` and the absence of a Phoenix decoder in the
    // repo, both of which are facts about our code rather than about anyone's server. The
    // probe is dropped with the state, because there is no question left for it to settle.
    // The reason string is unchanged — it already said the true thing.
    //
    // ⚠️ **This is a promotion of honesty, not of capability.** If a Phoenix-channel
    // transport is ever written, this goes back to `conditional` *with* its probe, and the
    // evidence line below is the reading list for whoever does it.
    "realtime.subscribe": unsupported(
      "NodeGX cannot subscribe to Supabase Realtime yet \u2014 it speaks Phoenix channels and no transport has been written for it (BCN-008). Turning Realtime on in your Supabase dashboard will not make this work.",
      "Realtime is per-table opt-in via the publication, not a project-wide switch. DOCUMENTED, NOT PROBED \u2014 BCN-008 confirmed only that no Realtime service exists in this rig to probe. The delete payload in particular (postgres_changes sends old_record with the primary key alone unless the table is REPLICA IDENTITY FULL) is unmeasured, and that is exactly the field RUN-003 got wrong on Directus by reading rather than asking. BCN-010 moved this from `conditional` to `unsupported` so that no probe can enable a port with no transport behind it; the probe it used to carry was GET /realtime/v1/api/tenants/realtime/health."
    )
  }),
  filters: filterTable(supported("native PostgREST operator"), {
    // PostgREST covers the comparison and set operators natively, and its
    // like/ilike cover the string family. The gaps are the interesting rows.
    matchesRegex: supported("PostgREST match/imatch operators"),
    isEmpty: unsupported(
      `Supabase can't tell an empty value from a missing one from here. Use "is not set" instead, or compare the field to an empty string.`,
      "No _empty equivalent; is.null answers presence only."
    ),
    isNotEmpty: unsupported(
      `Supabase can't tell an empty value from a missing one from here. Use "is set" instead.`,
      "No _nempty equivalent."
    ),
    // P116 ONT-004. PostgREST embeds with `!inner` filter across one link
    // (BCN-005); a chain of embeds is a path on paper and has not been driven.
    path: unsupported(
      "Following several links in one request is not available on Supabase yet. Filter one link at a time with an embedded field.",
      "BCN-005 live: one hop works as a dotted filter with an !inner embed; deeper paths not driven, no translator"
    ),
    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on Supabase yet.',
      "BCN-005."
    ),
    textSearch: conditional(
      "Full-text search needs a text-search index on the table in your Supabase database.",
      { method: "GET", path: "/{collection}?{field}=fts.test", expect: "200 rather than a missing-index error" },
      "PostgREST fts/plfts/phfts operators."
    ),
    // ⚠️ These three were `conditional` on a `/rpc/postgis_version` probe.
    // BCN-003 corrected them, and the correction is an instance of this
    // package's own rule #1 — *probe the exact thing*. Whether PostGIS is
    // installed is a real question with a real answer, but it is **not the
    // question**: PostgREST's filter grammar has no distance or containment
    // operator either way, so a distance query has to be a database function
    // reached through `/rpc`. The old probe would have reported `supported` on
    // an instance where the filter still could not be written.
    nearSphere: unsupported(
      "Location filters aren't available on Supabase from here. Even with PostGIS installed, a distance search has to be written as a database function.",
      "PostgREST exposes no geo operator in its filter grammar; PostGIS reaches the query only through /rpc. BCN-003."
    ),
    withinBox: unsupported(
      "Location filters aren't available on Supabase from here. Compare latitude and longitude as numbers instead.",
      "PostgREST exposes no geo operator in its filter grammar. BCN-003."
    ),
    withinPolygon: unsupported(
      "Location filters aren't available on Supabase from here. Even with PostGIS installed, a polygon search has to be written as a database function.",
      "PostgREST exposes no geo operator in its filter grammar. BCN-003."
    )
  })
};

// packages/nodegx-backend-contract/src/descriptors/index.ts
var BACKEND_DESCRIPTORS = Object.freeze({
  nodegx: nodegxDescriptor,
  parse: parseDescriptor,
  directus: directusDescriptor,
  supabase: supabaseDescriptor,
  pocketbase: pocketbaseDescriptor,
  custom: customDescriptor
});

// packages/nodegx-backend-contract/src/wire.ts
var DIRECTUS = {
  type: "directus",
  listPath: "/items/{collection}",
  recordPath: "/items/{collection}/{id}",
  createPath: "/items/{collection}",
  auth: "bearer",
  dataPath: "data",
  // Directus wraps a single record in `data` too, so these agree here.
  recordDataPath: "data",
  // ⚠️ `filter_count`, NOT `total_count`. Measured: three rows, two matching
  // `tag = x`, and the response says `{"total_count":3,"filter_count":2}`.
  // The preset says `meta.total_count` and is wrong; RUN-003 fixed this once
  // already in `pickTotalCount` and the comment there says the same thing.
  totalCount: { kind: "body-path", path: "meta.filter_count" },
  pagination: { kind: "offset", offsetParam: "offset", limitParam: "limit" },
  createResponse: { kind: "record" },
  idField: "id"
};
var SUPABASE = {
  type: "supabase",
  listPath: "/rest/v1/{collection}",
  recordPath: "/rest/v1/{collection}",
  createPath: "/rest/v1/{collection}",
  auth: "bearer",
  // Supabase authenticates with the anon key in `apikey` as well as a bearer.
  tokenHeaders: ["apikey"],
  // A bare array. There is no envelope and no path into one.
  dataPath: "",
  recordDataPath: "",
  totalCount: { kind: "content-range" },
  countRequestHeaders: { Prefer: "count=exact" },
  pagination: { kind: "offset", offsetParam: "offset", limitParam: "limit" },
  createResponse: { kind: "array-of-one" },
  createRequestHeaders: { Prefer: "return=representation" },
  idField: "id"
};
var POCKETBASE = {
  type: "pocketbase",
  listPath: "/api/collections/{collection}/records",
  recordPath: "/api/collections/{collection}/records/{id}",
  createPath: "/api/collections/{collection}/records",
  auth: "bearer",
  dataPath: "items",
  // ⚠️ A single record comes back at the TOP LEVEL, not under `items`.
  recordDataPath: "",
  // Measured filter-aware: `totalItems` is 2 of 3 under `tag='x'`.
  totalCount: { kind: "body-path", path: "totalItems" },
  // ⚠️ 1-based, measured: page=1 -> Ada, page=2 -> Alan, and page=0 CLAMPS to
  // page 1 rather than erroring. The preset calls this an `offsetParam`, which
  // invites passing a row offset straight through — correct-looking on the first
  // page and wrong on every one after it.
  pagination: { kind: "page", pageParam: "page", perPageParam: "perPage", firstPage: 1 },
  createResponse: { kind: "record" },
  idField: "id"
};
var REST_WIRE_PROFILES = Object.freeze({
  directus: DIRECTUS,
  supabase: SUPABASE,
  pocketbase: POCKETBASE
});

// packages/nodegx-backend-contract/src/nodeCapabilities.ts
var NODE_CAPABILITIES = Object.freeze({
  // ── Data ────────────────────────────────────────────────────────────────
  //
  // The clearest case in the phase, and the one BCN-001's probe was written to
  // catch: PocketBase answers every aggregate spelling with HTTP 200 and
  // ordinary un-aggregated rows. An Aggregate Records node pointed at PocketBase
  // returns wrong numbers with nothing to catch — so the node carries the gate,
  // not one of its ports.
  "noodl.cloud.aggregate": Object.freeze({ node: "data.aggregate" }),
  // Query Records. The node itself needs nothing beyond `data.query`, which
  // every backend in the descriptor supports, so there is no node-level row —
  // a gate that can never fire is noise on screen and a lie in a table.
  //
  // `realtime` is BCN-008's fold of Subscribe To Changes onto the query. The
  // port is declared whatever the backend is, deliberately (see the comment at
  // its push site), and this is what puts the reason under it.
  DbCollection2: Object.freeze({ ports: Object.freeze({ realtime: "realtime.subscribe" }) }),
  // FH-021's standalone Subscribe To Changes. A **`node:`** row, not a `ports:` one, and
  // the difference is the whole reason both spellings exist: on Query Records realtime is
  // one optional port on a node that queries perfectly well without it, whereas this node
  // *is* the subscription — there is nothing left of it on a backend that cannot push. The
  // `noodl.cloud.aggregate` precedent above, for the same reason.
  //
  // ⚠️ This marks the node with a sentence; it does not hide it and it does not gate a
  // port. That is TALK-005's shipped correction, and the runtime says the same thing twice
  // over on purpose: `realtimeSupportFor` answers again at connect time and the reason
  // lands on `Realtime Error`, because a canvas warning is not reachable from a running app.
  SubscribeToChanges: Object.freeze({ node: "realtime.subscribe" }),
  // Access Control Rules is a Parse-family idea. Directus has roles, Supabase
  // has RLS and PocketBase has API rules — all three configured in that
  // backend's own admin, none of them reachable from a per-record rule list.
  // The descriptor's reason says exactly that, per backend.
  NewDbModelProperties: Object.freeze({ ports: Object.freeze({ accessControl: "data.acl" }) }),
  SetDbModelProperties: Object.freeze({ ports: Object.freeze({ accessControl: "data.acl" }) }),
  // Relations. `addRemove` is `degraded` on Directus and Supabase rather than
  // unsupported — BCN-005 measured both, and a caveat is the right rendering:
  // the node works, but only against a join table shaped the way the reason
  // describes.
  AddDbModelRelation: Object.freeze({ node: "relations.addRemove" }),
  RemoveDbModelRelation: Object.freeze({ node: "relations.addRemove" }),
  // ── Files ───────────────────────────────────────────────────────────────
  //
  // ⚠️ The `files.*` descriptor **rows** belong to BCN-007. These are bindings
  // onto those rows, which is the other side of the seam: nothing here asserts
  // what a backend can do, only which node asks.
  "Upload File": Object.freeze({ node: "files.upload" }),
  "Sign File URL": Object.freeze({ node: "files.sign" }),
  // ── Auth ────────────────────────────────────────────────────────────────
  //
  // ⚠️ Same seam: the `auth.*` rows belong to BCN-006.
  //
  // Log Out, User and Set User Properties have no row. Ending a session is not
  // a capability any descriptor cell describes, and gating "who is signed in"
  // on a password cell would disable the node that reports *no one is* — which
  // is the state the gate is supposed to be reachable from.
  "net.noodl.user.LogIn": Object.freeze({ node: "auth.password" }),
  "net.noodl.user.SignUp": Object.freeze({ node: "auth.signUp" }),
  "net.noodl.user.RequestMagicLink": Object.freeze({ node: "auth.magicLink" }),
  "net.noodl.user.SignInWith": Object.freeze({ node: "auth.oauth" }),
  "net.noodl.user.VerifyEmail": Object.freeze({ node: "auth.emailVerify" }),
  "net.noodl.user.SendEmailVerification": Object.freeze({ node: "auth.emailVerify" }),
  "net.noodl.user.ResetPassword": Object.freeze({ node: "auth.passwordReset" }),
  "net.noodl.user.RequestPasswordReset": Object.freeze({ node: "auth.passwordReset" })
});
var DELIBERATELY_UNBOUND = Object.freeze({
  "Cloud File": "It holds a file reference and reads its url. It does not upload, sign or delete, so no cell describes what it needs.",
  "net.noodl.user.LogOut": "Ending a session is not a descriptor cell, and every backend with auth can do it.",
  "net.noodl.user.User": 'Reports who is signed in \u2014 including "no one", which is the state a gate must stay readable from.',
  "net.noodl.user.SetUserProperties": "Writes user columns through the same save path as any record; `auth.signUpProperties` is about sign-up, not later edits.",
  DbModel2: "Fetch and save are `data.fetch`/`data.save`, supported on every backend in the descriptor.",
  DeleteDbModelProperties: "`data.delete` is supported on every backend in the descriptor.",
  FilterDBModels: "Filters an in-memory collection; its per-operator gating is BCN-003b's, on the filter port."
  // ⚠️ `DbConfig` had a row here until FH-025. The node type was deleted by
  // FH-018 and its last instances by FH-023, and the row outlived both — this
  // package cannot see the node catalog (it must not: a contract package that
  // imports the editor's catalog inverts BCN-001's dependency), so nothing here
  // could ever have said so. The guard that now does live in the editor, in
  // `tests-unit/aib-007/backendRequirement.test.ts`, which already imports both
  // this table and the catalog.
});

// packages/nodegx-backend-contract/src/targetGoes.ts
var WHEN_TARGET_GOES = Object.freeze(["goes-too", "stays-unlinked", "blocks"]);
var WHEN_TARGET_GOES_BY_BACKEND = Object.freeze({
  nodegx: {
    state: "supported",
    evidence: "kept at delete time above both engines (`AdapterFacade.rawDelete` \u2192 `deleteKeepingLinks`); graded on SQLite and PostgreSQL by nodegx-backend tests/ont-003-claims and tests/ont-003-target-goes"
  },
  parse: {
    state: "unsupported",
    reason: "Parse keeps a pointer to a deleted object and has no rule for it; a Cloud Code beforeDelete trigger written for this app is the only way, and NodeGX does not write one."
  },
  directus: {
    state: "unsupported",
    reason: "Directus keeps this in its own relation settings (on delete: nullify, cascade or prevent), which NodeGX does not write; set it there."
  },
  supabase: {
    state: "unsupported",
    reason: "NodeGX does not write a foreign key for a link on Supabase; an ON DELETE rule written in the database itself is kept by Postgres, not by NodeGX."
  },
  pocketbase: {
    state: "unsupported",
    reason: "PocketBase keeps this as a relation field\u2019s own option (cascade delete), which NodeGX does not write; set it there."
  },
  custom: {
    state: "unsupported",
    reason: "A backend NodeGX did not ship says for itself what happens to a link when its record goes; NodeGX cannot keep it there."
  }
});

// packages/nodegx-backend/src/security/model.ts
var CLP_OPS = ["find", "get", "create", "update", "delete"];
var RULE_ATOMS = /* @__PURE__ */ new Set(["public", "authenticated", "nobody"]);
function isPathRule(atom) {
  return !!atom && typeof atom === "object" && !Array.isArray(atom) && "path" in atom;
}
function validateRuleAtom(atom, paths) {
  if (isPathRule(atom)) {
    if (!paths) return "a path rule is allowed only on find, get, update and delete of a collection";
    const keys = Object.keys(atom);
    if (keys.length !== 1) return `a path rule has only "path", not ${keys.filter((k) => k !== "path").join(", ")}`;
    const inner = atom.path;
    if (!inner || typeof inner !== "object" || Array.isArray(inner)) return 'a path rule is { "path": { "hops": [\u2026], "maxDepth": n } }';
    for (const k of Object.keys(inner)) if (k !== "hops" && k !== "maxDepth") return `a path rule has no "${k}"`;
    const problem = pathProblem({ from: { collection: "_User" }, hops: inner.hops, maxDepth: inner.maxDepth });
    return problem ? `path rule: ${problem}` : null;
  }
  if (typeof atom !== "string") return `rule must be a string, got ${typeof atom}`;
  if (RULE_ATOMS.has(atom)) return null;
  if (atom.startsWith("role:")) {
    return atom.length > "role:".length ? null : "role: rule is missing the role name";
  }
  return `unknown rule value "${atom}" (expected public | authenticated | nobody | role:<name>)`;
}
function validateFunctionRateLimit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "must be an object { ratePerMinute, burst }";
  }
  const v = value;
  for (const key of Object.keys(v)) {
    if (key !== "ratePerMinute" && key !== "burst") return `unknown key "${key}" (expected ratePerMinute, burst)`;
  }
  for (const field of ["ratePerMinute", "burst"]) {
    const n = v[field];
    if (n === void 0) return `${field} is required`;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return `${field} must be a number >= 0`;
  }
  return null;
}
function validateFunctionIdempotency(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "must be an object { enabled, requireKey?, hashBody? }";
  }
  const v = value;
  for (const key of Object.keys(v)) {
    if (key !== "enabled" && key !== "requireKey" && key !== "hashBody") {
      return `unknown key "${key}" (expected enabled, requireKey, hashBody)`;
    }
  }
  if (typeof v.enabled !== "boolean") return "enabled is required and must be a boolean";
  for (const field of ["requireKey", "hashBody"]) {
    if (v[field] !== void 0 && typeof v[field] !== "boolean") return `${field} must be a boolean`;
  }
  if (v.enabled === false && (v.requireKey === true || v.hashBody === true)) {
    return "enabled is false, so requireKey/hashBody would never apply \u2014 remove them or enable it";
  }
  return null;
}
function validateRuleValue(value, paths = false) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty rule arrays are not allowed (use "nobody")';
    for (const atom of value) {
      const err = validateRuleAtom(atom, paths);
      if (err) return err;
    }
    return null;
  }
  return validateRuleAtom(value, paths);
}
var UNHIDEABLE_FIELDS = /* @__PURE__ */ new Set(["objectId", "createdAt", "updatedAt", "ACL"]);
function validateFieldRules(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["must be an object { <field>: { read } }"];
  const errors = [];
  const entries = Object.entries(value);
  if (entries.length === 0) errors.push('is empty: name a field, or leave "fields" out');
  for (const [field, rule] of entries) {
    if (UNHIDEABLE_FIELDS.has(field)) {
      errors.push(`"${field}" is the record's own bookkeeping and is read by every reader; it cannot be hidden`);
      continue;
    }
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(`${field} must be an object { read }`);
      continue;
    }
    const r = rule;
    for (const k of Object.keys(r)) {
      if (k !== "read") errors.push(`${field}: unknown key "${k}" (only "read" is ruled; who may change a field is not)`);
    }
    if (r.read === void 0) errors.push(`${field}.read is required`);
    else {
      const err = validateRuleValue(r.read, true);
      if (err) errors.push(`${field}.read: ${err}`);
    }
  }
  return errors;
}
var ONLY_WHILE_REFUSED_KEYS = /* @__PURE__ */ new Set(["$path", "$relatedTo", "$inQuery", "$notInQuery", "$select", "$dontSelect"]);
function onlyWhileWhereProblem(where) {
  if (!where || typeof where !== "object" || Array.isArray(where)) return "where must be an object (a filter on the record's own fields)";
  const keys = Object.keys(where);
  if (keys.length === 0) return "where is empty: a condition that says nothing would bind nothing";
  const walk = (w) => {
    for (const [k, v] of Object.entries(w)) {
      if (ONLY_WHILE_REFUSED_KEYS.has(k)) return `where may not use ${k}: it is a condition on the record's own values`;
      if ((k === "$and" || k === "$or") && Array.isArray(v)) {
        for (const sub of v) {
          if (!sub || typeof sub !== "object" || Array.isArray(sub)) return `${k} takes a list of filters`;
          const p = walk(sub);
          if (p) return p;
        }
      }
    }
    return null;
  };
  return walk(where);
}
function validateOnlyWhile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["must be an object { update?, delete? }"];
  const errors = [];
  const entries = Object.entries(value);
  if (entries.length === 0) errors.push("is empty: name update, delete or both");
  for (const [op, rule] of entries) {
    if (op !== "update" && op !== "delete") {
      errors.push(`"${op}": only update and delete can depend on the record's values (a record being made has none yet)`);
      continue;
    }
    if (op === "delete" && rule === "never") continue;
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(op === "delete" ? 'delete must be "never" or an object { where, says? }' : `${op} must be an object { where?, except?, says?, moves?, frozen? }`);
      continue;
    }
    const r = rule;
    const keys = op === "update" ? ["where", "except", "says", "moves", "frozen"] : ["where", "except", "says"];
    for (const k of Object.keys(r)) {
      if (!keys.includes(k)) errors.push(`${op}: unknown key "${k}" (expected ${keys.join(", ")})`);
    }
    if (r.where !== void 0 || op === "delete" || r.moves === void 0 && r.frozen === void 0) {
      const wp = onlyWhileWhereProblem(r.where);
      if (wp) errors.push(`${op}.${wp}`);
    }
    if (op === "update") {
      if (r.moves !== void 0) for (const err of validateMoves(r.moves)) errors.push(`update.moves${err}`);
      if (r.frozen !== void 0) for (const err of validateFrozen(r.frozen, r.except)) errors.push(`update.frozen${err}`);
    }
    if (r.except !== void 0) {
      if (op === "delete") errors.push("delete.except: a delete removes every field, so nothing can be excepted");
      else if (!Array.isArray(r.except) || r.except.length === 0 || r.except.some((f) => typeof f !== "string" || !f)) {
        errors.push(`${op}.except must be a non-empty list of field names`);
      }
    }
    if (r.says !== void 0 && (typeof r.says !== "string" || !r.says.trim())) errors.push(`${op}.says must be a sentence`);
  }
  return errors;
}
function validateMoves(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    return [' must be an object naming at least one field: { "<field>": { "<old value>": { "to": [...] } } }'];
  }
  const errors = [];
  for (const [field, byOld] of Object.entries(value)) {
    if (UNHIDEABLE_FIELDS.has(field)) errors.push(`.${field}: the record's own bookkeeping is not a value a person moves`);
    if (!byOld || typeof byOld !== "object" || Array.isArray(byOld) || Object.keys(byOld).length === 0) {
      errors.push(`.${field} must be an object naming at least one old value`);
      continue;
    }
    for (const [old, move] of Object.entries(byOld)) {
      const at = `.${field}.${JSON.stringify(old)}`;
      if (!move || typeof move !== "object" || Array.isArray(move)) {
        errors.push(`${at} must be an object { to, by?, says? }`);
        continue;
      }
      const m = move;
      for (const k of Object.keys(m)) if (k !== "to" && k !== "by" && k !== "says") errors.push(`${at}: unknown key "${k}" (expected to, by, says)`);
      if (!Array.isArray(m.to) || m.to.some((v) => typeof v !== "string")) errors.push(`${at}.to must be a list of values ([] = it never moves)`);
      else if (m.to.includes(old)) errors.push(`${at}.to names ${JSON.stringify(old)} itself: staying is not a move, and is always allowed`);
      if (m.by !== void 0) {
        const err = validateRuleValue(m.by, true);
        if (err) errors.push(`${at}.by: ${err}`);
      }
      if (m.says !== void 0 && (typeof m.says !== "string" || !m.says.trim())) errors.push(`${at}.says must be a sentence`);
    }
  }
  return errors;
}
function validateFrozen(value, except) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [" must be an object { fields, unless?, says? }"];
  const errors = [];
  const f = value;
  for (const k of Object.keys(f)) if (k !== "fields" && k !== "unless" && k !== "says") errors.push(`: unknown key "${k}" (expected fields, unless, says)`);
  if (f.fields !== "*") {
    if (!Array.isArray(f.fields) || f.fields.length === 0 || f.fields.some((x) => typeof x !== "string" || !x)) {
      errors.push('.fields must be a non-empty list of field names, or "*" for the whole record');
    } else {
      for (const x of f.fields) if (UNHIDEABLE_FIELDS.has(x)) errors.push(`.fields: "${x}" is the record's own bookkeeping, kept by the backend`);
      const both = Array.isArray(except) ? f.fields.filter((x) => except.includes(x)) : [];
      if (both.length) errors.push(`.fields: ${both.map((x) => `"${x}"`).join(", ")} cannot be both frozen and excepted from the condition`);
    }
  }
  if (f.unless !== void 0) {
    const wp = onlyWhileWhereProblem(f.unless);
    if (wp) errors.push(`.unless: ${wp.replace(/^where/, "unless")}`);
  }
  if (f.says !== void 0 && (typeof f.says !== "string" || !f.says.trim())) errors.push(".says must be a sentence");
  return errors;
}
function validateSecurityConfig(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ["security config must be a JSON object"];
  }
  const cfg = raw;
  const TOP_KEYS = /* @__PURE__ */ new Set(["version", "devOpen", "defaults", "collections", "functions", "files", "signup"]);
  for (const key of Object.keys(cfg)) {
    if (!TOP_KEYS.has(key)) errors.push(`unknown top-level key "${key}"`);
  }
  if (cfg.version !== 1) errors.push(`unsupported version ${JSON.stringify(cfg.version)} (expected 1)`);
  if (typeof cfg.devOpen !== "boolean") errors.push("devOpen must be a boolean");
  const defaults = cfg.defaults;
  if (!defaults || typeof defaults !== "object") {
    errors.push("defaults must be an object");
  } else {
    for (const key of Object.keys(defaults)) {
      if (key !== "permissions" && key !== "creatorOwns") errors.push(`unknown defaults key "${key}"`);
    }
    const perms = defaults.permissions;
    if (!perms || typeof perms !== "object") {
      errors.push("defaults.permissions must be an object");
    } else {
      for (const op of CLP_OPS) {
        if (perms[op] === void 0) {
          errors.push(`defaults.permissions.${op} is required`);
        } else {
          const err = validateRuleValue(perms[op], op !== "create");
          if (err) errors.push(`defaults.permissions.${op}: ${err}`);
        }
      }
      for (const key of Object.keys(perms)) {
        if (!CLP_OPS.includes(key)) errors.push(`unknown operation "${key}" in defaults.permissions`);
      }
    }
    if (typeof defaults.creatorOwns !== "boolean") errors.push("defaults.creatorOwns must be a boolean");
  }
  const collections = cfg.collections;
  if (!collections || typeof collections !== "object") {
    errors.push("collections must be an object");
  } else {
    for (const [name, entry] of Object.entries(collections)) {
      if (name.startsWith("_")) {
        errors.push(`collections.${name}: system collections have a fixed posture and cannot carry CLP entries`);
        continue;
      }
      if (!entry || typeof entry !== "object") {
        errors.push(`collections.${name} must be an object`);
        continue;
      }
      const e = entry;
      for (const key of Object.keys(e)) {
        if (key !== "permissions" && key !== "creatorOwns" && key !== "onlyWhile" && key !== "fields") {
          errors.push(`unknown key "${key}" in collections.${name}`);
        }
      }
      if (e.onlyWhile !== void 0) {
        for (const err of validateOnlyWhile(e.onlyWhile)) errors.push(`collections.${name}.onlyWhile: ${err}`);
      }
      if (e.fields !== void 0) {
        for (const err of validateFieldRules(e.fields)) errors.push(`collections.${name}.fields: ${err}`);
      }
      if (e.permissions !== void 0) {
        if (!e.permissions || typeof e.permissions !== "object") {
          errors.push(`collections.${name}.permissions must be an object`);
        } else {
          for (const [op, rule] of Object.entries(e.permissions)) {
            if (!CLP_OPS.includes(op)) {
              errors.push(`unknown operation "${op}" in collections.${name}.permissions`);
            } else {
              const err = validateRuleValue(rule, op !== "create");
              if (err) errors.push(`collections.${name}.permissions.${op}: ${err}`);
            }
          }
        }
      }
      if (e.creatorOwns !== void 0 && typeof e.creatorOwns !== "boolean") {
        errors.push(`collections.${name}.creatorOwns must be a boolean`);
      }
    }
  }
  const functions = cfg.functions;
  if (!functions || typeof functions !== "object") {
    errors.push("functions must be an object");
  } else {
    for (const [name, entry] of Object.entries(functions)) {
      if (!entry || typeof entry !== "object") {
        errors.push(`functions.${name} must be an object`);
        continue;
      }
      const e = entry;
      for (const key of Object.keys(e)) {
        if (key !== "call" && key !== "runAs" && key !== "rateLimit" && key !== "timeoutMs" && key !== "idempotency") {
          errors.push(`unknown key "${key}" in functions.${name}`);
        }
      }
      if (e.call !== void 0) {
        const err = validateRuleValue(e.call);
        if (err) errors.push(`functions.${name}.call: ${err}`);
      }
      if (e.rateLimit !== void 0) {
        const err = validateFunctionRateLimit(e.rateLimit);
        if (err) errors.push(`functions.${name}.rateLimit: ${err}`);
      }
      if (e.timeoutMs !== void 0 && (typeof e.timeoutMs !== "number" || !Number.isFinite(e.timeoutMs) || e.timeoutMs < 0)) {
        errors.push(`functions.${name}.timeoutMs must be a number >= 0 (0 = no limit)`);
      }
      if (e.idempotency !== void 0) {
        const err = validateFunctionIdempotency(e.idempotency);
        if (err) errors.push(`functions.${name}.idempotency: ${err}`);
      }
      if (e.runAs !== void 0 && e.runAs !== "system") {
        errors.push(
          e.runAs === "caller" ? `functions.${name}.runAs: "caller" is defined by the model but not yet supported by this build \u2014 refusing to accept a security setting that would not be enforced` : `functions.${name}.runAs: unknown value ${JSON.stringify(e.runAs)}`
        );
      }
    }
  }
  const files = cfg.files;
  if (!files || typeof files !== "object") {
    errors.push("files must be an object");
  } else {
    for (const key of Object.keys(files)) {
      if (key !== "upload" && key !== "read" && key !== "delete") errors.push(`unknown key "${key}" in files`);
    }
    for (const op of ["upload", "read", "delete"]) {
      if (files[op] === void 0) {
        errors.push(`files.${op} is required`);
      } else {
        const err = validateRuleValue(files[op]);
        if (err) errors.push(`files.${op}: ${err}`);
      }
    }
  }
  if (cfg.signup === void 0) {
    errors.push("signup is required");
  } else {
    const err = validateRuleValue(cfg.signup);
    if (err) errors.push(`signup: ${err}`);
  }
  return errors;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  RUNTIME_FILE,
  allocatePort,
  backendsRoot,
  censusBackends,
  createBackendDir,
  deleteRuntimeRecord,
  ensureProjectId,
  explainReuse,
  findReusableBackend,
  heartbeatIsFresh,
  installExitHooks,
  isOwnedBySelf,
  listBackendConfigs,
  listRuntimeRecords,
  ownedBackendIds,
  ownerIsLive,
  portIsFree,
  processCommandLine,
  processIsAlive,
  provisionBackend,
  readBackendConfig,
  readRuntimeRecord,
  resolveServiceEntry,
  selfOwnerStartedAt,
  startBackend,
  stopBackend,
  stopOwnedBackends,
  touchRuntimeRecord,
  validateSecurityConfig,
  verifyIsOurBackend,
  writeRuntimeRecord
});
