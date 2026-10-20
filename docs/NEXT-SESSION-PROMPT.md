Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(170/170), `check:timeline` (45/45 since s12), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import`
(79/79 with the template bundle: import/exports/template is present, gitignored), `check:app` (34/34). Read on
2026-10-20 (s12) on the STU-033 tree: timeline, editor, app (rules, phrases, pagedata, reusable in s11); import and dictionary
last read in s9 (the importer is untouched since). 🔴 `check:app` and `check:editor` both load studio.html: run both
after any studio.html change. Kit pieces and the phrasebook come from the NodeGX checkout at ../OpenNoodl
(lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`, take ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with
mkdir), and WAIT for another session's jest/vitest first (`pgrep -fl "jest|vitest"`; s10 waited for a peer's noodl-mcp
jest). `check:editor` takes about 4 minutes, `check:timeline` about 1; `check:editor --shots` rewrites every
docs/look/s2-*.png: restore the ones you did not mean to change (`git ls-files -m docs/look | grep -v <yours> | xargs
git checkout --`). The server reads studio.html and probe.js on every request: do not edit them while a gate runs.
🔴 Take the lock with mkdir and remove it only if YOU made it (s11 deleted a peer's lock with `mkdir … && …; rm -rf`,
then put it back): a wrapper that waits and removes only its own is the safe shape. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are
not its to commit.

Built in s12 (2026-10-20): **STU-033, step mode** (SCOPE.md "Done (STU-033)"). **Step through** on a card in the
Workflow tab, or on a recorded run's row in the timeline (the only way in for a command such as Add task: the page
picker lists no component without elements). A bar over every tab, "Not real timing: each step waits for you", Next
step / Run the rest / Stop stepping; each step that ran shows its out, the one waiting its in (every value into it so
far). editor/stepper.mjs wraps `_setPulseFromConnection` / `_setValueFromConnection` and the context's
`traceEdgeSend` in the app's frame. **Found:** a signal into a component goes on out of its Component Inputs as two
VALUES (true, false), so every command's run was invisible to the timeline; timeline.mjs now starts a card's run on a
`true` out of its event. Picture: docs/look/stu-033-step.png. Gates on the s12 tree: timeline 45/45, editor 170/170,
app 34/34. Mutants: signal not held 42/44 (before the last check), false not kept behind the true 44/45.
s11 before it: STU-032 (scrubber, step values, the screen as it was), the logo, ruling R9.

Filed in NodeGX's ledger (OpenNoodl 80bd3c778): P123-STU032-TEXTFLASH. Still open from s10: P123-STU031-COPYBOX.
Not filed: the Component Inputs signal-as-values is how the runtime has always forwarded a component's input; Studio
reads around it, it is not a defect the app shows.

Next buildable while Richard is away, in order:
1. M4 is done (STU-030..033). Timeline / step mode gaps (SCOPE.md "Not built"): a recording that crosses pages names
   cards only for the page shown at Stop; step mode does not go inside a reusable's copy; record ports read raw
   ("prop-title").
2. Timeline gaps (SCOPE.md "Not built"): a recording that crosses pages names cards only for the page shown at Stop;
   the screen rows' text sample is the DOM as inserted ("TextTextTextLabel"); a copy has no canvas pixels or scroll
   positions, and a style-only change takes no copy.
3. STU-006 (runs without a NodeGX checkout), then STU-007 (packaged and signed, the icon is ready) — Richard asked
   on 2026-10-20 how far a full working Studio is: roughly 8–12 sessions (M4's end, STU-006/007, a publish path
   that has no task yet, then M5); a **Publish/deploy task is missing from SCOPE.md** — write it before STU-007.
Still open from s9: a branch whose condition is a constant `false` says "Set the condition…"; a card's name and hover
read only its first lane; port names a component gives without words show raw ("When pickList").

Show Richard: docs/look/stu-033-step.png (step mode, step 3 waiting), docs/look/stu-032-scrub.png and stu-032-step.png (the scrubber, a step's values), the s10 timeline
pictures, and from s9 s2-workflow-card.png, s2-workflow-index.png, s2-workflow-branch.png. Tell him the "Text" flash.

Waiting on Richard: his second sitting on data (M2's remaining work); his real app export (STU-044's 22 missing
operator names and STU-044-FORMATNUMBER's keys; STU-053's unread keys; the real app's 16 split elements for STU-024);
pushing main (ahead of GitHub, unpushed until he says); rulings R4 (rejoin, STU-025), R5, R6.

Not to forget: a look's property list is long (73 on a Button); the look menu has no "1 inherited from Style" count; a
chip from a record field (page data `prop-*`) has no type yet; a dropdown's value read through `chosen` is typed
nothing; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing; wants Richard's look); row searches
still asked once per row; 17 covered dictionary rows rest on the importer's own operator names; the unknown
no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`). His worry from s7, under
STU-052: people mixing composed phrases with typed JavaScript in one box; watch for it at a play test.
