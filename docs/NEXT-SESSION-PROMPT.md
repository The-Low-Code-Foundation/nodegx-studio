Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:vendor` (PASS,
883 files), `check:rules` (20/20), `check:phrases` (85/85), `check:dictionary` (PASS 65 / 2 / 22 / 5), `check:editor`
(170/170), `check:timeline` (43/43), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (79/79 with the
gitignored template bundle), `check:app` (45/45), `check:publish` (27/27, new in s14). check:editor, check:app and
check:publish were read on 2026-10-20 (s14); the others are s13's numbers on the same kit. 🔴 `check:app` and
`check:editor` both load studio.html: run both after any studio.html change. One heavy gate at a time (`nice -n 19`,
~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, remove it only if YOU made it), and WAIT for another
session's jest/vitest first. The safe shape is a wrapper: wait on `pgrep -f "jest|vitest"`, `until mkdir LOCK`,
`trap 'rm -rf LOCK' EXIT`, then `nice -n 19 npm run --silent "$@"`. 🔴 npm eats a gate's own flags:
`npm run check:app -- --shots`, not `npm run check:app --shots`. `--shots` rewrites docs/look/stu-003-*.png: put back
the ones you did not mean to change. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png,
s2-panel-group.png predate s10 and are not yours to commit.

**The alpha (0.2) has a line now** (SCOPE.md "The alpha (0.2) — the line"): someone who is not Richard downloads
Studio, opens or imports an app, changes it, and publishes it. Proposed by Claude in s14; Richard's answer was
*"Rock out"*. Of its five items, s14 built three:
1. **STU-008 Publish: done.** lib/publish.mjs, File → Publish… and the header's Publish. NodeGX's production deploy
   engine into a folder Studio guards (`.nodegx-publish.json`), cloud functions through the MCP server's own
   `deploy_cloud_functions` over stdio. Filed in NodeGX: **P123-STU008-BACKENDPUBLIC** (OpenNoodl 08bb41532): the
   engine also publishes `nodegx.security.json` and `backend/`, and Publish names them to the person until the kit's
   default ignore rules keep them out.
2. **STU-007: macOS ad hoc, gated.** `npm run package` / `dist` (DMG 141 MB) / `dist:signed`. The whole desktop gate
   runs on the package with `NODEGX_STUDIO_BINARY=…/NodeGX Studio.app/Contents/MacOS/NodeGX Studio npm run
   check:app` (40/40 before STU-040's checks were added; not rerun on the package since). Gatekeeper rejects a
   downloaded ad-hoc copy. `.github/workflows/package.yml` (macOS, Windows, Linux + smoke) is written and has never run.
3. **STU-040: done.** The welcome screen's import guide (copy through the content-authoring skill's offline checks),
   then the report in a drawer beside the app, and an Import report button in the header.
4. Waits on NodeGX: an npm release carrying UNWIREDSIGNAL and BACKENDPUBLIC, then bump the pins and `npm run vendor`.
5. Waits on Richard: pushing main (ahead of GitHub, now with the s14 commits too).

Ask Richard (in plain words): his Apple Developer credentials for `dist:signed` (a Developer ID certificate in the
keychain, then APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID); whether main can be pushed (then run the package
workflow by hand once); whether the alpha's line is right; ruling R10. Show him docs/look/stu-003-import-guide.png and
stu-003-import-report.png, then the earlier pictures (docs/look/stu-032-scrub.png, stu-032-step.png,
s2-workflow-card.png, s2-workflow-index.png, s2-workflow-branch.png). Tell him about the "Text" flash
(P123-STU032-TEXTFLASH).

Next buildable while Richard is away:
1. Run the package gate again on a fresh `npm run package` (STU-040 is in it; the 40/40 was before).
2. Publish's open edges (SCOPE "Done (STU-008)", Not in it): say that a path-routed app's deep links need the host's
   index.html fallback; a site under a sub-path waits on P123-STU015-BASEURL.
3. The import's Data-tab exports into the backend from Studio (`data-to-nodegx.mjs` writes the files and the
   commands; nothing runs them).
4. Timeline gaps (SCOPE "Not built" under STU-031..033), and s9's leftovers: a constant-`false` branch says "Set the
   condition…"; a card's name and hover read only its first lane; port names without words show raw ("When pickList").

Waiting on Richard, unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real
app export (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements); rulings R4, R5, R6,
R10. Filed and open in NodeGX's ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX, P123-STU008-BACKENDPUBLIC.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
