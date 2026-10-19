/**
 * STU-003 — what the welcome screen does, in plain Node so the gate can run it without a window: the templates on
 * offer, a new project copied from one, an app imported through the importer, and the list of recent projects.
 * `main.cjs` asks the person where (the dialogs) and calls these; nothing here opens a window or a dialog.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { nodegxRepo, studioRoot } from '../lib/nodegx.mjs';

export const isProject = (dir) => !!dir && existsSync(join(dir, 'nodegx.project.json'));

/* ---------------------------------------------------------------- templates */

/**
 * The templates NodeGX publishes to its community shelf, with the shelf's own titles and summaries — the live rows of
 * `dev-docs/tasks/phase-78-the-templates/publish-templates-to-shelf.sh` in the NodeGX repo (the retired `planner`
 * row left out). Each is a whole project folder under the checkout's `templates/`. When the shelf changes, change
 * this list with it.
 */
const TEMPLATES = [
  { slug: 'todo-list', dir: 'todo-list', category: 'data-app', title: 'Todo list', needsBackend: true, summary: 'One list in the order you will do things, with deadlines, next actions and a history nothing is deleted from — and a Today tab for things that repeat (every day, week or month, at their times).' },
  { slug: 'planning', dir: 'planning', category: 'data-app', title: 'Planning', needsBackend: true, summary: 'A week for people who bill by the hour: hour budgets for billable, building, admin and hobby work, a strip of next moves, money that is ticked when it happens, and one sentence a night about what to do tomorrow.' },
  { slug: 'rocket-school', dir: 'rocket-school', category: 'game', title: 'Rocket School', summary: 'Maths and typing practice for ages 8 to 12, in English and French: four games, 62 skills from CE2 to 6e, and progress kept in the browser.' },
  { slug: 'pixel-dungeon', dir: 'pixel-game', category: 'game', title: 'Pixel dungeon', summary: 'A turn-based dungeon played with the arrow keys. The five rooms are one list in one node, so a sixth room is one more entry.' },
  { slug: 'story-engine', dir: 'story-engine', category: 'game', title: 'Story engine', summary: 'A branching story where choices hand you things and some only appear once you carry them. The whole story is one list you can rewrite.' }
];

const templateDir = (t) => join(nodegxRepo, 'templates', t.dir);

/** The list the welcome screen draws; a template whose folder is missing from the checkout is listed as unavailable. */
export const templates = () => TEMPLATES.map((t) => ({ ...t, needsBackend: !!t.needsBackend, available: isProject(templateDir(t)) }));

/**
 * The editor writes these into a project it opens, with paths of the machine that opened it; the shelf refuses a
 * template that carries them, so a copy never takes them either. STU-005 writes the new project's own.
 */
const NOT_COPIED = new Set(['.git', 'node_modules', '.DS_Store', '.mcp.json', 'CLAUDE.md']);

/** Refuses a destination that already holds files: both the copy and the importer would write over (the importer deletes) what is there. */
function claimEmptyFolder(dest) {
  if (!existsSync(dest)) return { created: true };
  if (!statSync(dest).isDirectory()) throw new Error(`${dest} is a file, not a folder.`);
  const inside = readdirSync(dest).filter((n) => n !== '.DS_Store');
  if (inside.length) throw new Error(`${basename(dest)} already holds ${inside.length} item${inside.length === 1 ? '' : 's'}. Choose a new folder, or an empty one.`);
  return { created: false };
}

/** A new project is called what the person named its folder (the save dialog's name field), whatever its source called it. */
function nameAfterFolder(dir) {
  const file = join(dir, 'nodegx.project.json');
  const text = readFileSync(file, 'utf8');
  const project = JSON.parse(text);
  project.name = basename(dir);
  writeFileSync(file, JSON.stringify(project, null, 2) + (text.endsWith('\n') ? '\n' : ''));
}

/** Copies a template into `dest` (a new or empty folder) and names the project after the folder. Resolves with the project folder. */
export function createFromTemplate(slug, dest) {
  const t = TEMPLATES.find((x) => x.slug === slug);
  if (!t) throw new Error(`There is no template called ${slug}.`);
  if (!isProject(templateDir(t))) throw new Error(`The ${t.title} template is not in the NodeGX checkout at ${nodegxRepo}.`);
  dest = resolve(dest);
  const { created } = claimEmptyFolder(dest);
  try {
    cpSync(templateDir(t), dest, { recursive: true, filter: (src) => !NOT_COPIED.has(basename(src)) });
    nameAfterFolder(dest);
  } catch (err) {
    // a half-copied template looks like a project and is the next thing the person would open; only a folder this made goes
    if (created) rmSync(dest, { recursive: true, force: true });
    throw err;
  }
  return dest;
}

/* ---------------------------------------------------------------- import */

const nodeRun = (script, args) =>
  new Promise((ok) => {
    // under Electron, process.execPath is Electron itself: ELECTRON_RUN_AS_NODE makes it plain Node for the importer
    const child = spawn(process.execPath, [join(studioRoot, 'import', script), ...args], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => ok({ code, out }));
  });

/**
 * Imports an app into `dest` (a new or empty folder). `source` is an export file (.json / .bubble) or a folder of the
 * app's run-mode bundles and editor requests (docs/IMPORT.md), which `bundles-to-export.mjs` turns into an export first.
 * Resolves with the project folder and the importer's report.
 */
export async function importApp(source, dest) {
  source = resolve(source);
  dest = resolve(dest);
  if (!existsSync(source)) throw new Error(`${source} does not exist.`);
  if (dest === source || source.startsWith(dest + sep)) throw new Error('The new project cannot go in the folder you are importing from.');
  const { created } = claimEmptyFolder(dest);
  const scratch = mkdtempSync(join(tmpdir(), 'nodegx-studio-import-'));
  try {
    let exportFile = source;
    if (statSync(source).isDirectory()) {
      exportFile = join(scratch, 'app.export.json');
      const b = await nodeRun('bundles-to-export.mjs', [source, exportFile]);
      if (b.code !== 0) throw new Error(`The app's files could not be read:\n${b.out.trim().slice(-600)}`);
    }
    const c = await nodeRun('app-to-nodegx.mjs', [exportFile, dest]);
    if (c.code !== 0 || !isProject(dest)) throw new Error(`The import stopped:\n${c.out.trim().slice(-600)}`);
    nameAfterFolder(dest); // the importer names it by the source app's id, which stays in metadata.imported.appId
    return { dir: dest, report: join(dest, 'docs', 'IMPORT-REPORT.md') };
  } catch (err) {
    if (created) rmSync(dest, { recursive: true, force: true });
    throw err;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/* ---------------------------------------------------------------- recent projects */

const MAX_RECENT = 10;

const projectName = (dir) => {
  try {
    return JSON.parse(readFileSync(join(dir, 'nodegx.project.json'), 'utf8')).name || basename(dir);
  } catch {
    return basename(dir);
  }
};

/** `file` is `recent-projects.json` in the app's user data folder: `{ projects: [{ dir, name, openedAt }] }`, newest first. */
export function readRecent(file) {
  let list = [];
  try {
    list = JSON.parse(readFileSync(file, 'utf8')).projects ?? [];
  } catch { /* first run */ }
  // a project moved or deleted since is still listed (the person may have unplugged a disk), marked so the screen can say so
  return list.filter((p) => p && typeof p.dir === 'string').slice(0, MAX_RECENT).map((p) => ({ ...p, exists: isProject(p.dir) }));
}

const writeRecent = (file, list) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ projects: list.slice(0, MAX_RECENT).map(({ dir, name, openedAt }) => ({ dir, name, openedAt })) }, null, 2) + '\n');
};

/** Puts `dir` first, with its name as the project file says now. */
export function rememberRecent(file, dir) {
  dir = resolve(dir);
  writeRecent(file, [{ dir, name: projectName(dir), openedAt: new Date().toISOString() }, ...readRecent(file).filter((p) => p.dir !== dir)]);
}

export function forgetRecent(file, dir) {
  writeRecent(file, readRecent(file).filter((p) => p.dir !== dir));
}
