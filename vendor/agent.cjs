var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js
var require_resolveMcpServer = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var MCP_SERVERS = {
      "noodl-mcp": {
        label: "Authoring",
        what: "Reads and writes this project\u2019s components and files on disk. Does not need the editor running."
      },
      "nodegx-observe": {
        label: "Observe",
        what: "Watches and drives your running app over the editor\u2019s relay. Needs the editor running, with the preview started."
      }
    };
    function defaultPackagesRoots() {
      return [
        path.resolve(__dirname, "..", "..", ".."),
        // from the bundle: packages/noodl-editor/src/main
        path.resolve(__dirname, "..", "..", "..", "..", "..")
        // from source: …/src/main/src/mcp
      ];
    }
    function resolveMcpServer(name, options) {
      if (!Object.prototype.hasOwnProperty.call(MCP_SERVERS, name)) {
        throw new Error(`Unknown MCP server "${name}". Known: ${Object.keys(MCP_SERVERS).join(", ")}`);
      }
      const probed = [];
      const file = `${name}.cjs`;
      const override = process.env[name === "noodl-mcp" ? "NOODL_MCP_ENTRY" : "NODEGX_OBSERVE_ENTRY"];
      if (override) {
        probed.push(override);
        if (fs.existsSync(override)) return { entry: override, probed };
      }
      const candidates = [];
      const roots = options && options.packagesRoots || defaultPackagesRoots();
      for (const root of roots) candidates.push(path.join(root, name, "dist", file));
      try {
        const { app } = require("electron");
        if (app) candidates.push(path.join(app.getAppPath(), "..", name, file));
      } catch (e) {
      }
      if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, name, file));
      }
      for (const candidate of candidates) {
        probed.push(candidate);
        if (fs.existsSync(candidate)) return { entry: candidate, probed };
      }
      return { entry: null, probed };
    }
    function resolveMcpServers(options) {
      const result = {};
      for (const name of Object.keys(MCP_SERVERS)) {
        result[name] = Object.assign({ name }, MCP_SERVERS[name], resolveMcpServer(name, options));
      }
      return result;
    }
    module2.exports = { MCP_SERVERS, resolveMcpServer, resolveMcpServers };
  }
});

// packages/noodl-editor/src/main/src/mcp/probeBinary.js
var require_probeBinary = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/probeBinary.js"(exports2, module2) {
    var { spawnSync } = require("child_process");
    var LOGIN_SHELL_TIMEOUT_MS = 5e3;
    var loginShellCache = /* @__PURE__ */ new Map();
    function resetProbeCache(binary) {
      if (binary) loginShellCache.delete(binary);
      else loginShellCache.clear();
    }
    function probeProcessPath(binary, env, validate) {
      try {
        const result = spawnSync(binary, ["--version"], { encoding: "utf8", env, windowsHide: true });
        if (result.error || result.status !== 0) return false;
        const stdout = (result.stdout || "").trim();
        return validate ? validate(stdout) : stdout.length > 0;
      } catch (e) {
        return false;
      }
    }
    function probeLoginShell(binary, env, platform) {
      if (platform === "win32") return { path: null, probed: [] };
      const shell = env && env.SHELL || "/bin/sh";
      const attempt = `${shell} -lic 'command -v ${binary}'`;
      try {
        const result = spawnSync(shell, ["-lic", `command -v ${binary}`], {
          encoding: "utf8",
          env,
          timeout: LOGIN_SHELL_TIMEOUT_MS,
          windowsHide: true
        });
        if (result.error || result.status !== 0) return { path: null, probed: [attempt] };
        const lines = (result.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean);
        const found = lines.length ? lines[lines.length - 1] : "";
        return { path: found.startsWith("/") ? found : null, probed: [attempt] };
      } catch (e) {
        return { path: null, probed: [attempt] };
      }
    }
    function probeLoginShellCached(binary, env, platform) {
      if (!loginShellCache.has(binary)) loginShellCache.set(binary, probeLoginShell(binary, env, platform));
      return loginShellCache.get(binary);
    }
    module2.exports = {
      LOGIN_SHELL_TIMEOUT_MS,
      probeProcessPath,
      probeLoginShell,
      probeLoginShellCached,
      resetProbeCache
    };
  }
});

// packages/noodl-editor/src/main/src/mcp/resolveNodeRuntime.js
var require_resolveNodeRuntime = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/resolveNodeRuntime.js"(exports2, module2) {
    var { probeProcessPath, probeLoginShellCached, resetProbeCache } = require_probeBinary();
    var NODE_BINARY = "node";
    var isNodeVersion = (stdout) => /^v\d+\./.test(stdout);
    function resetNodeRuntimeCache() {
      resetProbeCache(NODE_BINARY);
    }
    function resolveNodeRuntime(options) {
      const opts = options || {};
      const env = opts.env || process.env;
      const platform = opts.platform || process.platform;
      const electron = opts.execPath || process.execPath;
      const probed = ["node (on this process\u2019s PATH)"];
      if (probeProcessPath(NODE_BINARY, env, isNodeVersion)) {
        return { hasNode: true, nodePath: null, electron, detection: "path", probed };
      }
      if (opts.skipLoginShell) {
        return { hasNode: false, nodePath: null, electron, detection: "none", probed };
      }
      const loginShellResult = probeLoginShellCached(NODE_BINARY, env, platform);
      probed.push(...loginShellResult.probed);
      return loginShellResult.path ? { hasNode: true, nodePath: loginShellResult.path, electron, detection: "login-shell", probed } : { hasNode: false, nodePath: null, electron, detection: "none", probed };
    }
    function warmNodeRuntime(options) {
      return new Promise((resolve) => {
        setImmediate(() => {
          try {
            if (resolveNodeRuntime({ ...options, skipLoginShell: true }).hasNode) return resolve();
            resolveNodeRuntime(options);
          } catch (e) {
          }
          resolve();
        });
      });
    }
    module2.exports = { resolveNodeRuntime, warmNodeRuntime, resetNodeRuntimeCache };
  }
});

// packages/noodl-editor/src/main/src/mcp/resolveClaudeCli.js
var require_resolveClaudeCli = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/resolveClaudeCli.js"(exports2, module2) {
    var { probeProcessPath, probeLoginShellCached, resetProbeCache } = require_probeBinary();
    var CLAUDE_BINARY = "claude";
    var isClaudeCode = (stdout) => /claude\s+code/i.test(stdout);
    function resetClaudeCliCache() {
      resetProbeCache(CLAUDE_BINARY);
    }
    function resolveClaudeCli(options) {
      const opts = options || {};
      const env = opts.env || process.env;
      const platform = opts.platform || process.platform;
      const probed = ["claude (on this process\u2019s PATH)"];
      if (probeProcessPath(CLAUDE_BINARY, env, isClaudeCode)) {
        return { found: true, exec: CLAUDE_BINARY, detection: "path", probed };
      }
      if (opts.skipLoginShell) {
        return { found: false, exec: null, detection: "none", probed };
      }
      const loginShell = probeLoginShellCached(CLAUDE_BINARY, env, platform);
      probed.push(...loginShell.probed);
      return loginShell.path ? { found: true, exec: loginShell.path, detection: "login-shell", probed } : { found: false, exec: null, detection: "none", probed };
    }
    function warmClaudeCli(options) {
      return new Promise((resolve) => {
        setImmediate(() => {
          try {
            if (resolveClaudeCli({ ...options, skipLoginShell: true }).found) return resolve();
            resolveClaudeCli(options);
          } catch (e) {
          }
          resolve();
        });
      });
    }
    module2.exports = { CLAUDE_BINARY, resolveClaudeCli, warmClaudeCli, resetClaudeCliCache };
  }
});

// packages/noodl-editor/src/main/src/mcp/connectBootstrapServer.js
var require_connectBootstrapServer = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/connectBootstrapServer.js"(exports2, module2) {
    var fs = require("fs");
    var os = require("os");
    var path = require("path");
    var { spawnSync } = require("child_process");
    var { resolveClaudeCli } = require_resolveClaudeCli();
    var BOOTSTRAP_SERVER_NAME = "nodegx";
    var MCP_SCOPE = "user";
    var CLI_TIMEOUT_MS = 2e4;
    function claudeConfigPath(homedir) {
      return path.join(homedir || os.homedir(), ".claude.json");
    }
    function removeCommand() {
      return `claude mcp remove --scope ${MCP_SCOPE} ${BOOTSTRAP_SERVER_NAME}`;
    }
    function readClaudeConfig(configPath, io) {
      if (!io.existsSync(configPath)) return { ok: true, existing: {}, detail: null };
      let raw;
      try {
        raw = io.readFileSync(configPath, "utf8");
      } catch (e) {
        return { ok: false, existing: {}, detail: `Could not read ${configPath}: ${e.message}` };
      }
      if (!raw.trim()) return { ok: true, existing: {}, detail: null };
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return {
          ok: false,
          existing: {},
          detail: `${configPath} is not valid JSON, so NodeGX will not write to it \u2014 replacing it would discard whatever else is in there. Run the command below instead, or repair the file.`
        };
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, existing: {}, detail: `${configPath} does not contain a JSON object.` };
      }
      return { ok: true, existing: parsed, detail: null };
    }
    function readExistingRegistration(configPath, options) {
      const opts = options || {};
      const io = opts.fs || fs;
      const read = readClaudeConfig(configPath, io);
      if (!read.ok) return { readable: false, entry: null, detail: read.detail };
      const servers = read.existing.mcpServers;
      const entry = servers && typeof servers === "object" ? servers[BOOTSTRAP_SERVER_NAME] : void 0;
      const isObject = entry !== null && typeof entry === "object" && !Array.isArray(entry);
      return { readable: true, entry: isObject ? entry : null, detail: null };
    }
    function sameRegistration(a, b) {
      if (!a || !b) return false;
      if ((a.type || "stdio") !== (b.type || "stdio")) return false;
      if (a.command !== b.command) return false;
      const argsA = Array.isArray(a.args) ? a.args : [];
      const argsB = Array.isArray(b.args) ? b.args : [];
      if (argsA.length !== argsB.length || argsA.some((arg, i) => arg !== argsB[i])) return false;
      const envA = a.env && typeof a.env === "object" ? a.env : {};
      const envB = b.env && typeof b.env === "object" ? b.env : {};
      const keys = /* @__PURE__ */ new Set([...Object.keys(envA), ...Object.keys(envB)]);
      for (const key of keys) {
        if (String(envA[key]) !== String(envB[key])) return false;
      }
      return true;
    }
    function cliArgs(registration) {
      const env = Object.entries(registration.env || {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
      return ["mcp", "add", "--scope", MCP_SCOPE, BOOTSTRAP_SERVER_NAME, ...env, "--", registration.command, ...registration.args];
    }
    function registerViaCli(exec, registration, options) {
      const opts = options || {};
      const spawn = opts.spawnSync || spawnSync;
      try {
        const result = spawn(exec, cliArgs(registration), {
          encoding: "utf8",
          timeout: CLI_TIMEOUT_MS,
          windowsHide: true,
          env: opts.env || process.env
        });
        if (result.error) return { ok: false, detail: result.error.message };
        if (result.status !== 0) {
          const said = `${result.stderr || ""}${result.stdout || ""}`.trim();
          return { ok: false, detail: said || `The CLI exited with status ${result.status}.` };
        }
        return { ok: true, detail: null };
      } catch (e) {
        return { ok: false, detail: e && e.message ? e.message : String(e) };
      }
    }
    function removeViaCli(exec, options) {
      const opts = options || {};
      const spawn = opts.spawnSync || spawnSync;
      try {
        const result = spawn(exec, ["mcp", "remove", "--scope", MCP_SCOPE, BOOTSTRAP_SERVER_NAME], {
          encoding: "utf8",
          timeout: CLI_TIMEOUT_MS,
          windowsHide: true,
          env: opts.env || process.env
        });
        if (result.error) return { ok: false, detail: result.error.message };
        if (result.status !== 0) {
          const said = `${result.stderr || ""}${result.stdout || ""}`.trim();
          return { ok: false, detail: said || `The CLI exited with status ${result.status}.` };
        }
        return { ok: true, detail: null };
      } catch (e) {
        return { ok: false, detail: e && e.message ? e.message : String(e) };
      }
    }
    function registerViaConfigFile(configPath, registration, options) {
      const opts = options || {};
      const io = opts.fs || fs;
      const read = readClaudeConfig(configPath, io);
      if (!read.ok) return { ok: false, backupPath: null, detail: read.detail };
      const existing = read.existing;
      let backupPath = null;
      if (io.existsSync(configPath)) {
        backupPath = `${configPath}.nodegx-backup`;
        try {
          io.copyFileSync(configPath, backupPath);
        } catch (e) {
          return { ok: false, backupPath: null, detail: `Could not back up ${configPath}: ${e.message}` };
        }
      }
      const servers = existing.mcpServers && typeof existing.mcpServers === "object" ? existing.mcpServers : {};
      const next = { ...existing, mcpServers: { ...servers, [BOOTSTRAP_SERVER_NAME]: registration } };
      const tempPath = `${configPath}.nodegx-tmp`;
      try {
        io.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}
`, { encoding: "utf8", mode: 384 });
        io.renameSync(tempPath, configPath);
      } catch (e) {
        try {
          if (io.existsSync(tempPath)) io.unlinkSync(tempPath);
        } catch (cleanupError) {
        }
        return { ok: false, backupPath, detail: `Could not write ${configPath}: ${e.message}` };
      }
      return { ok: true, backupPath, detail: null };
    }
    function connectBootstrapServer(registration, command, options) {
      const opts = options || {};
      const configPath = opts.configPath || claudeConfigPath(opts.homedir);
      const cli = (opts.resolveClaudeCli || resolveClaudeCli)(opts);
      const base = {
        serverName: BOOTSTRAP_SERVER_NAME,
        configPath,
        removeCommand: removeCommand(),
        backupPath: null,
        command,
        probed: cli.probed,
        replaced: false
      };
      if (!registration) {
        return {
          ...base,
          ok: false,
          method: null,
          message: "NodeGX could not work out what to register.",
          detail: "The authoring server bundle was not found, so there is no command to run."
        };
      }
      const existing = readExistingRegistration(configPath, opts);
      if (existing.entry && sameRegistration(existing.entry, registration)) {
        return {
          ...base,
          ok: true,
          method: "already-registered",
          message: `Claude Code is already connected. The server is registered as \u201C${BOOTSTRAP_SERVER_NAME}\u201D for your user account, so it is available in every folder \u2014 there was nothing to change.`,
          detail: null
        };
      }
      const replacing = Boolean(existing.entry);
      if (cli.found) {
        if (replacing) {
          const removed = removeViaCli(cli.exec, opts);
          if (!removed.ok) {
            return {
              ...base,
              ok: false,
              method: "cli",
              replaced: false,
              message: `Claude Code\u2019s CLI declined to replace the existing \u201C${BOOTSTRAP_SERVER_NAME}\u201D registration.`,
              detail: removed.detail
            };
          }
        }
        const viaCli = registerViaCli(cli.exec, registration, opts);
        if (viaCli.ok) {
          return {
            ...base,
            ok: true,
            method: "cli",
            replaced: replacing,
            message: replacing ? `Claude Code can now build NodeGX apps. An earlier \u201C${BOOTSTRAP_SERVER_NAME}\u201D registration pointed somewhere else and was replaced; the new one is registered for your user account, so it is available in every folder.` : `Claude Code can now build NodeGX apps. The server is registered as \u201C${BOOTSTRAP_SERVER_NAME}\u201D for your user account, so it is available in every folder \u2014 you do not have to be anywhere in particular to use it.`,
            detail: null
          };
        }
        return {
          ...base,
          ok: false,
          method: "cli",
          message: "Claude Code\u2019s CLI declined to add the server.",
          detail: viaCli.detail
        };
      }
      const viaFile = registerViaConfigFile(configPath, registration, opts);
      if (viaFile.ok) {
        return {
          ...base,
          ok: true,
          method: "config-file",
          backupPath: viaFile.backupPath,
          replaced: replacing,
          message: (replacing ? `Claude Code can now build NodeGX apps. An earlier \u201C${BOOTSTRAP_SERVER_NAME}\u201D registration pointed somewhere else and was replaced; the new one is registered for your user account, so it is available in every folder. ` : `Claude Code can now build NodeGX apps. The server is registered as \u201C${BOOTSTRAP_SERVER_NAME}\u201D for your user account, so it is available in every folder. `) + `Restart Claude Code if it is already open \u2014 it reads this when it starts.`,
          detail: null
        };
      }
      return {
        ...base,
        ok: false,
        method: "config-file",
        backupPath: viaFile.backupPath,
        message: "NodeGX could not add the server to Claude Code\u2019s configuration.",
        detail: viaFile.detail
      };
    }
    module2.exports = {
      BOOTSTRAP_SERVER_NAME,
      claudeConfigPath,
      cliArgs,
      connectBootstrapServer,
      readExistingRegistration,
      registerViaConfigFile,
      sameRegistration
    };
  }
});

// packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js
var require_mcpFrontDoor = __commonJS({
  "packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { resolveMcpServers } = require_resolveMcpServer();
    var { resolveNodeRuntime, warmNodeRuntime } = require_resolveNodeRuntime();
    var { warmClaudeCli } = require_resolveClaudeCli();
    var { claudeConfigPath, connectBootstrapServer } = require_connectBootstrapServer();
    var USER_PROFILE_ENV2 = "NODEGX_USER_PREFERENCES";
    var ELECTRON_AS_NODE_KEY = "ELECTRON_RUN_AS_NODE";
    var USER_PROFILE_FILE = "PREFERENCES.md";
    function userProfilePath() {
      try {
        const { app } = require("electron");
        if (!app) return null;
        return path.join(app.getPath("userData"), USER_PROFILE_FILE);
      } catch (e) {
        return null;
      }
    }
    function describeProject(projectDir) {
      if (!projectDir) return null;
      const dir = path.resolve(projectDir);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return { dir, format: "missing", message: `Project directory does not exist: ${dir}` };
      }
      const isV2 = fs.existsSync(path.join(dir, "components", "_registry.json")) || fs.existsSync(path.join(dir, "nodegx.project.json"));
      if (isV2) return { dir, format: "v2" };
      if (fs.existsSync(path.join(dir, "project.json"))) {
        return {
          dir,
          format: "legacy",
          message: `${dir} holds a legacy monolithic project.json. Migrate it to the v2 format (NodeGX editor: project settings \u2192 migrate) before using the MCP server.`
        };
      }
      return {
        dir,
        format: "not-a-project",
        message: `${dir} is not a NodeGX v2 project (no nodegx.project.json or components/_registry.json).`
      };
    }
    function describeMcpFrontDoor2(projectDir, options) {
      return {
        servers: resolveMcpServers(options),
        project: describeProject(projectDir),
        runtime: resolveNodeRuntime(options),
        // FIX-021 slice B. Reported so the renderer can render the *displayed* `claude
        // mcp add -e …` line and write it into a project's `.mcp.json`. 🔴 What the
        // renderer sends back is NOT trusted for the one route that spawns — see
        // `rejectUntrustedRegistration` and the connect handler below.
        userProfilePath: options && "userProfilePath" in options ? options.userProfilePath : userProfilePath(),
        isPackaged: options && typeof options.isPackaged === "boolean" ? options.isPackaged : isPackagedApp()
      };
    }
    function isPackagedApp() {
      try {
        const { app } = require("electron");
        return Boolean(app && app.isPackaged);
      } catch (e) {
        return false;
      }
    }
    var MCP_FRONT_DOOR_CHANNEL = "mcp:front-door";
    var MCP_CONNECT_BOOTSTRAP_CHANNEL = "mcp:connect-bootstrap";
    function rejectUntrustedRegistration(registration, options) {
      if (!registration || typeof registration !== "object") return "No registration was supplied.";
      const { command, args } = registration;
      if (typeof command !== "string" || !Array.isArray(args) || args.length === 0) {
        return "The registration was malformed.";
      }
      if (command !== "node" && command !== process.execPath) {
        return "The registration named a runtime NodeGX did not resolve.";
      }
      const authoring = resolveMcpServers(options)["noodl-mcp"];
      if (!authoring || !authoring.entry || args[0] !== authoring.entry) {
        return "The registration did not point at NodeGX\u2019s own authoring server.";
      }
      if (args.slice(1).some((arg) => arg !== "--allow-writes")) {
        return "The registration carried arguments NodeGX does not emit.";
      }
      const env = registration.env;
      if (env !== void 0 && (typeof env !== "object" || env === null || Array.isArray(env))) {
        return "The registration carried a malformed environment.";
      }
      const allowedEnv = /* @__PURE__ */ new Set([ELECTRON_AS_NODE_KEY, USER_PROFILE_ENV2]);
      const unknown = Object.keys(env || {}).find((key) => !allowedEnv.has(key));
      if (unknown) {
        return `The registration carried an environment variable NodeGX does not emit (${unknown}).`;
      }
      return null;
    }
    function setupMcpIPC(ipcMain) {
      ipcMain.handle(MCP_FRONT_DOOR_CHANNEL, (_event, projectDir) => describeMcpFrontDoor2(projectDir));
      ipcMain.handle(MCP_CONNECT_BOOTSTRAP_CHANNEL, (_event, payload) => {
        const { registration, command } = payload || {};
        const refusal = rejectUntrustedRegistration(registration);
        if (refusal) {
          return {
            ok: false,
            method: null,
            serverName: "nodegx",
            configPath: claudeConfigPath(),
            removeCommand: `claude mcp remove --scope user nodegx`,
            backupPath: null,
            message: "NodeGX would not register that.",
            detail: refusal,
            command: typeof command === "string" ? command : null,
            probed: [],
            replaced: false
          };
        }
        const profilePath = userProfilePath();
        const trusted = {
          ...registration,
          env: {
            ...Object.fromEntries(Object.entries(registration.env || {}).filter(([key]) => key !== USER_PROFILE_ENV2)),
            ...profilePath ? { [USER_PROFILE_ENV2]: profilePath } : {}
          }
        };
        return connectBootstrapServer(trusted, typeof command === "string" ? command : null);
      });
      warmNodeRuntime();
      warmClaudeCli();
    }
    module2.exports = {
      USER_PROFILE_ENV: USER_PROFILE_ENV2,
      userProfilePath,
      MCP_FRONT_DOOR_CHANNEL,
      MCP_CONNECT_BOOTSTRAP_CHANNEL,
      describeProject,
      describeMcpFrontDoor: describeMcpFrontDoor2,
      rejectUntrustedRegistration,
      setupMcpIPC
    };
  }
});

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  AGENT_CONFIG_PATHS: () => AGENT_CONFIG_PATHS,
  backfillAgentConfig: () => backfillAgentConfig,
  buildProjectRegistration: () => buildProjectRegistration,
  describeMcpFrontDoor: () => import_mcpFrontDoor.describeMcpFrontDoor,
  quoteArg: () => quoteArg
});
module.exports = __toCommonJS(stdin_exports);
var import_mcpFrontDoor = __toESM(require_mcpFrontDoor());

// packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts
var MAX_SLUG_LENGTH = 40;
function pathHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}
function basename(dir) {
  const parts = dir.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
function projectSlug(projectDir) {
  const slug = basename(projectDir).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
  if (!slug) return pathHash(projectDir);
  if (slug === "observe") return `observe-${pathHash(projectDir)}`;
  return slug;
}
function authoringServerName(projectDir) {
  return `nodegx-${projectSlug(projectDir)}`;
}
function quoteArg(value) {
  if (/^[A-Za-z0-9_@%+=:,.\\/-]+$/.test(value)) return value;
  const isWindowsPath = /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
  const escaped = isWindowsPath ? value.replace(/"/g, '\\"') : value.replace(/(["`$\\])/g, "\\$1");
  return `"${escaped}"`;
}
var ELECTRON_AS_NODE_ENV = "ELECTRON_RUN_AS_NODE=1";
var USER_PROFILE_ENV = "NODEGX_USER_PREFERENCES";
function withUserProfile(chosen, userProfilePath) {
  if (!userProfilePath) return chosen;
  return { ...chosen, env: [...chosen.env, `${USER_PROFILE_ENV}=${userProfilePath}`] };
}
function chooseRuntime(runtime, preference) {
  if (preference === "prefer-node" && runtime.hasNode) {
    return { exec: "node", env: [], isElectron: false };
  }
  return { exec: runtime.electron, env: [ELECTRON_AS_NODE_ENV], isElectron: true };
}
function buildProjectRegistration(frontDoor, projectDir) {
  const serverName = authoringServerName(projectDir);
  const authoring = frontDoor.servers["noodl-mcp"];
  if (!authoring?.entry) return { serverName, registration: null };
  const chosen = withUserProfile(chooseRuntime(frontDoor.runtime, "prefer-node"), frontDoor.userProfilePath);
  return {
    serverName,
    registration: {
      type: "stdio",
      command: chosen.exec,
      args: [authoring.entry, projectDir, "--allow-writes"],
      env: Object.fromEntries(chosen.env.map((pair) => splitEnvPair(pair)))
    }
  };
}
function splitEnvPair(pair) {
  const at = pair.indexOf("=");
  return at === -1 ? [pair, ""] : [pair.slice(0, at), pair.slice(at + 1)];
}

// packages/noodl-editor/src/editor/src/models/template/agentConfig.ts
var AGENT_CONFIG_PATHS = Object.freeze({
  mcp: ".mcp.json",
  claude: "CLAUDE.md",
  agents: "AGENTS.md",
  gitignore: ".gitignore"
});
var V2_PROJECT_MARKERS = Object.freeze(["components/_registry.json", "nodegx.project.json"]);
var DOCS_BRIEF = "docs/BRIEF.md";
var GITIGNORE_BLOCK = [
  "",
  "# Machine-specific MCP registration: absolute paths to this install of NodeGX.",
  // P112-OWN023-READONLYOPEN: "created or opened" read as "the MCP server writes on open" to a careful agent, which
  // then refused open_project on a read-only task. The editor writes it on open; the server never does.
  "# Each developer gets their own, written when the project is created or opened in the NodeGX editor.",
  ".mcp.json",
  ""
].join("\n");
var HOLD_FILE = ".nodegx-hold.json";
var GITIGNORE_HOLD_BLOCK = [
  "",
  "# A pause on this machine: NodeGX Studio writes it while the person holds the agent, and removes it on release.",
  HOLD_FILE,
  ""
].join("\n");
function renderMcpJson(serverName, registration) {
  return JSON.stringify({ mcpServers: { [serverName]: registration } }, null, 2) + "\n";
}
function renderClaudeMd(options) {
  return renderAgentNote(options, "claude");
}
function renderAgentsMd(options) {
  return renderAgentNote(options, "agents");
}
function commandLine(registration) {
  const quote = (a) => /[\s"']/.test(a) ? JSON.stringify(a) : a;
  const isFolder = (a) => (a.startsWith("/") || /^[A-Za-z]:[\\/]/.test(a)) && !/\.c?js$/.test(a);
  const env = Object.entries(registration.env ?? {}).map(([k, v]) => `${k}=${quote(v)} `);
  const args = registration.args.map((a) => isFolder(a) ? "<this folder>" : quote(a));
  return env.join("") + [quote(registration.command), ...args].join(" ");
}
function renderAgentNote(options, audience) {
  const { projectName, serverName, summary, hasDocs, registration } = options;
  const lines = [`# ${projectName}`, ""];
  if (summary && summary.trim()) {
    lines.push(summary.trim(), "");
  } else if (hasDocs) {
    lines.push("What this app is for is written up in `docs/BRIEF.md`.", "");
  }
  lines.push(
    "## How to change this app",
    "",
    // ⚠️ The highest-value line in the file. A capable agent finds JSON in a
    // folder and edits it; every validation, every diagnostic and every
    // `registeredPages` side effect lives above the files, so a hand-edit
    // produces a project that loads and is quietly wrong.
    "The component graphs under `components/` are generated files. Editing that JSON by hand skips schema validation, the semantic checks, and the bookkeeping that keeps the registry and the router in step \u2014 the result usually loads, which is what makes it expensive to find later.",
    ""
  );
  if (registration && audience === "agents") {
    lines.push(
      `Use the \`${serverName}\` MCP server instead. Claude Code finds it in \`.mcp.json\`; any other agent needs it registered once, as a stdio server running this, with \`<this folder>\` the full path of this folder:`,
      "",
      "```",
      commandLine(registration),
      "```",
      ""
    );
  } else if (registration) {
    lines.push(
      `Use the \`${serverName}\` MCP server instead. It is registered for this folder in \`.mcp.json\`, so an agent started here is offered it and asks you to approve it once.`,
      ""
    );
  } else {
    lines.push(
      "No MCP server could be registered for this project when it was created \u2014 NodeGX could not resolve its own authoring server bundle. The editor\u2019s settings, under \u201CConnect an AI agent\u201D, reports what it looked for and can emit the registration command.",
      ""
    );
  }
  if (hasDocs) {
    lines.push(
      "## Where the decisions are",
      "",
      "- `docs/BRIEF.md` \u2014 what the app is and who opens it",
      "- `docs/ARCHITECTURE.md` \u2014 how it is put together",
      "- `docs/CONVENTIONS.md` \u2014 rules this project agreed to follow, and worth checking work against",
      "- `docs/decisions/` \u2014 what was considered and deliberately not done, with reasons",
      "",
      // P112 OWN-018 s2 — Mistral Large 4's quiz (run 7): OpenCode summarised the conversation, the summary kept
      // "Portugal → Lisbon, three answers in exact order" and dropped the answers, and the agent rebuilt them from
      // memory (Porto / Lisbon / Madrid). The person's words were in 000-initial-scope.md the whole time. This file
      // is in the system prompt, which a summary never rewrites.
      'What the person asked for is quoted word for word in `docs/decisions/000-initial-scope.md` ("What was asked',
      'for"). Build anything they spelled out (names, lists, wording, order) from that quote, and read it again after',
      "your conversation has been summarised: a summary keeps the gist and drops the exact words.",
      ""
    );
  }
  lines.push(
    "## A note on `.mcp.json`",
    "",
    // ⚠️ This paragraph must describe what the build does, not what would be
    // nice. It once promised that a teammate "generates their own by opening
    // the project in NodeGX" while nothing backfilled a cloned checkout, which
    // is the failure BST-006's rule names: a reader told to expect something
    // automatic waits instead of acting. FIX-008 B made the promise true, so
    // the paragraph says it again — and if the backfill is ever removed, this
    // sentence has to go with it.
    "It names absolute paths belonging to this machine\u2019s NodeGX install, so it is listed in `.gitignore` \u2014 committed, it would point a teammate\u2019s agent at a path that does not exist on their disk. It is written when a project is created **and whenever the project is opened in NodeGX without one**, so a checkout cloned from git gets its own on first open. Nothing here is ever overwritten: edit either file and it stays edited.",
    ""
  );
  return lines.join("\n");
}
async function installAgentConfig(host, options) {
  const files = [];
  if (!options.registration) {
    files.push({
      path: AGENT_CONFIG_PATHS.mcp,
      outcome: "skipped",
      reason: "No authoring server bundle could be resolved, so there is no command to register."
    });
  } else if (await host.exists(AGENT_CONFIG_PATHS.mcp)) {
    files.push({
      path: AGENT_CONFIG_PATHS.mcp,
      outcome: "kept-existing",
      reason: "A .mcp.json was already here and may register servers of the user\u2019s own."
    });
  } else {
    await host.write(AGENT_CONFIG_PATHS.mcp, renderMcpJson(options.serverName, options.registration));
    files.push({ path: AGENT_CONFIG_PATHS.mcp, outcome: "written" });
    files.push(await ignoreMcpJson(host));
  }
  if (await host.exists(AGENT_CONFIG_PATHS.claude)) {
    files.push({
      path: AGENT_CONFIG_PATHS.claude,
      outcome: "kept-existing",
      reason: "A CLAUDE.md was already here and is the user\u2019s to own."
    });
  } else {
    await host.write(AGENT_CONFIG_PATHS.claude, renderClaudeMd(options));
    files.push({ path: AGENT_CONFIG_PATHS.claude, outcome: "written" });
    if (await host.exists(AGENT_CONFIG_PATHS.agents)) {
      files.push({
        path: AGENT_CONFIG_PATHS.agents,
        outcome: "kept-existing",
        reason: "An AGENTS.md was already here and is the user\u2019s to own."
      });
    } else {
      await host.write(AGENT_CONFIG_PATHS.agents, renderAgentsMd(options));
      files.push({ path: AGENT_CONFIG_PATHS.agents, outcome: "written" });
    }
  }
  return { files, written: files.filter((f) => f.outcome === "written").map((f) => f.path) };
}
async function backfillAgentConfig(host, options) {
  let isV2 = false;
  for (const marker of V2_PROJECT_MARKERS) {
    if (await host.exists(marker)) {
      isV2 = true;
      break;
    }
  }
  if (!isV2) {
    const reason = "This is not a v2 project, and the authoring server refuses to open one \u2014 a registration naming a server that cannot start is worse than none. Migrate the project first.";
    return {
      files: [
        { path: AGENT_CONFIG_PATHS.mcp, outcome: "skipped", reason },
        { path: AGENT_CONFIG_PATHS.claude, outcome: "skipped", reason },
        { path: AGENT_CONFIG_PATHS.agents, outcome: "skipped", reason }
      ],
      written: []
    };
  }
  return await installAgentConfig(host, { ...options, hasDocs: await host.exists(DOCS_BRIEF) });
}
async function ignoreMcpJson(host) {
  const existing = await host.exists(AGENT_CONFIG_PATHS.gitignore) ? await host.read(AGENT_CONFIG_PATHS.gitignore) : "";
  const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const ignored = (name) => lines.has(name) || lines.has("/" + name);
  const blocks = [
    ...ignored(".mcp.json") ? [] : [GITIGNORE_BLOCK],
    ...ignored(HOLD_FILE) ? [] : [GITIGNORE_HOLD_BLOCK]
  ];
  if (blocks.length === 0) {
    return {
      path: AGENT_CONFIG_PATHS.gitignore,
      outcome: "kept-existing",
      reason: `.mcp.json and ${HOLD_FILE} were already ignored.`
    };
  }
  await host.write(AGENT_CONFIG_PATHS.gitignore, existing.replace(/\s*$/, "") + blocks.map((b) => b.replace(/\n$/, "")).join("\n") + "\n");
  return { path: AGENT_CONFIG_PATHS.gitignore, outcome: "written" };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AGENT_CONFIG_PATHS,
  backfillAgentConfig,
  buildProjectRegistration,
  describeMcpFrontDoor,
  quoteArg
});
