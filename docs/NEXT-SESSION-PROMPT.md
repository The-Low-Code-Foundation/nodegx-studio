Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:vendor` (PASS,
884 files), `check:rules` (20/20), `check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22
missing / 5 none), `check:editor` (170/170), `check:timeline` (43/43), `check:pagedata` (33/33), `check:reusable`
(12/12), `check:import` (79/79 with the template bundle: import/exports/template is present, gitignored), `check:app`
(34/34). ALL read on 2026-10-20 (s13) on the vendored kit (commit 320aa19's tree). 🔴 `check:app` and `check:editor`
both load studio.html: run both after any studio.html change. One heavy gate at a time (`nice -n 19`, take
~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, remove it only if YOU made it), and WAIT for another
session's jest/vitest first (`pgrep -fl "jest|vitest"`). The safe shape is a wrapper that waits for both and traps
its own lock (s13 wrote one: wait on pgrep, `until mkdir LOCK`, `trap 'rm -rf LOCK' EXIT`, then the gate).
`check:editor` takes about 4 minutes, `check:timeline` about 1; `check:editor --shots` rewrites every docs/look/s2-*.png:
restore the ones you did not mean to change. The server reads studio.html and probe.js on every request: do not edit
them while a gate runs. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png
predate s10 and are not yours to commit.

🔴 **Since s13 the kit no longer comes from ../OpenNoodl** (STU-006, SCOPE.md "Done (STU-006)"). `lib/nodegx.mjs`
names every piece: npm at exact pins (`@nodegx/preview` 0.2.2: the deploy runtime; `@nodegx/mcp` 0.2.2: the MCP
server and the backend service) and the committed `vendor/` (templates, phrasebook, look.js, specs.js, backend.cjs,
agent.cjs, and preview/noodl-preview-in-page.js), built from NodeGX `f8250d803` by `NODEGX_REPO=../OpenNoodl npm run
vendor`, which refuses when a bundle's sources differ from that commit. `NODEGX_REPO=../OpenNoodl` before any command
uses the checkout's pieces as built there (for a kit change you need now). A kit fix you want in Studio: commit it in
NodeGX, then `npm run vendor`, then every gate, and commit vendor/ with a message naming the NodeGX commit.

Built in s13 (2026-10-20): **STU-006**, done-when met. A `git clone` into a scratch folder, every command run under
`sandbox-exec` with OpenNoodl reads denied: `npm install`, smoke (welcome, 5 templates; a todo copy draws), `check:app`
34/34, Connect Claude Code → the clone's own MCP server answers with 21 tools. **Found:** npm's `@nodegx/preview` 0.2.2
(2026-10-15) carries P123-S2-VARIANTLOST (fixed 10-16, never published): `check:editor` 169/170 on it, so vendor.mjs
builds the in-page bundle with the package's own build.mjs in a temporary sparse worktree of the commit (outside the
checkout; links removed before the worktree). Noted on the bug in NodeGX's ledger (OpenNoodl 1bc0b8a65). Also written
into SCOPE.md: **STU-008 Publish** (`nodegx-deploy` to a folder; the production engine npm ships) and ruling **R10**
(where else a site and its backend go). **Done vs written:** measured on this Mac, the checkout hidden by a sandbox,
not absent; not on Windows/Linux; the clone's Studio runs npm's 0.2.2 runtime, which lacks NodeGX's runtime fixes since
10-15 (e.g. UNWIREDSIGNAL 3026899d4).

Next buildable while Richard is away, in order:
1. STU-007 (packaged and signed; the icon is ready): electron-builder; `node_modules/@nodegx/mcp` must sit outside the
   asar (`extraResources`) because Claude Code runs it with an external `node`; signing/notarising needs Richard's
   Apple credentials, so build an unsigned package first and gate on it opening a project.
2. STU-008 Publish to a folder (SCOPE row): needs a deploy with VARIANTLOST's fix — vendor `nodegx-deploy.cjs` from the
   same worktree build as the in-page bundle, or wait for a release. Done-when: the todo copy published, served
   statically, sign in, add a todo, the row is on the backend.
3. Timeline gaps (SCOPE.md "Not built" under STU-031..033): cross-page recordings, raw record ports ("prop-title"),
   "TextTextTextLabel" samples, copies without canvas pixels/scroll, an app that never goes quiet.
Still open from s9: a constant-`false` branch says "Set the condition…"; a card's name and hover read only its first
lane; port names without words show raw ("When pickList").

Ask Richard (in plain words): **publish NodeGX's npm packages** — a `@nodegx/preview` / `@nodegx/mcp` release newer
than 0.2.2 (the 0.2.3 tarballs are packed in OpenNoodl-worktrees/npm-0.2.3-tarballs) would let Studio drop its
vendored in-page bundle and pick up the runtime fixes; then set PREVIEW_FIXED_IN in scripts/vendor.mjs and re-pin.
Ruling R10. Show him docs/look/stu-032-scrub.png and stu-032-step.png, the s10 timeline pictures, and from s9
s2-workflow-card.png, s2-workflow-index.png, s2-workflow-branch.png. Tell him the "Text" flash (P123-STU032-TEXTFLASH).

Waiting on Richard: how the one-run Record feels on his own app (the 1.5 s quiet and the 30 s timer hold are
guesses); his second sitting on data (M2's remaining work); his real app export (STU-044's 22 missing operator names
and STU-044-FORMATNUMBER's keys; STU-053's unread keys; the real app's 16 split elements for STU-024); pushing main
(ahead of GitHub, unpushed until he says); rulings R4 (rejoin, STU-025), R5, R6, R10; an npm release (above).
Filed and open in NodeGX's ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX.

Not to forget: a look's property list is long (73 on a Button); the look menu has no "1 inherited from Style" count; a
chip from a record field (page data `prop-*`) has no type yet; a dropdown's value read through `chosen` is typed
nothing; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing; wants Richard's look); row searches
still asked once per row; 17 covered dictionary rows rest on the importer's own operator names; the unknown
no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`). His worry from s7, under
STU-052: people mixing composed phrases with typed JavaScript in one box; watch for it at a play test.
