Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(170/170), `check:timeline` (33/33 since s11), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import`
(79/79 with the template bundle: import/exports/template is present, gitignored), `check:app` (34/34). Read on
2026-10-20 (s11) on the STU-032 tree: timeline, editor, app, rules, phrases, pagedata, reusable; import and dictionary
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

Built in s11 (2026-10-20): **STU-032, what went in and out of each step, and the screen as it was** (SCOPE.md
"Done (STU-032)"). A workflow row's "Show the n steps" lists each step with **in** (last value into each wired input
before its signal, then the file's settings) and **out** (what it sent until the next signal into it), off the trace
(timeline.mjs `stepValues`). A playhead on the axis (drag, ← / →, Home / End, or click a row, mark or step) dims what
is to come; the pane beside the rows (or Larger, over the tab) draws the probe's copy of the page at that moment in a
script-less frame (probe.js `__studioShots`: the body without its scripts and `<noscript>`, at the next frame after a
change, a 100 ms timer in a hidden window; fields' values put back). Measured: a picture is impossible in the page
(SVG-on-canvas taints), a copy is 0.3 ms / 14 KB. Pictures: docs/look/stu-032-scrub.png, stu-032-step.png. Also
s11: **the logo** (app/icon.svg, the NodeGX wire traced as an S, Richard picked "A") on the window, Dock, welcome,
rail and tab; **ruling R9** (plugins are recreated by two Claude Code sessions, never run; STU-043 rewritten).

Filed in NodeGX's ledger (OpenNoodl 80bd3c778): P123-STU032-TEXTFLASH — runtime, low: a list's row is on screen for
a frame or two holding its Text elements' "Text" before its values arrive (found by the copies; inferred from frame
timing, not pixels). Still open from s10: P123-STU031-COPYBOX.

Not graded: the copy being taken at the next frame rather than inside the observer (that mutant passes 33/33; the
only template evidence, the "Text" flash, shows in both modes).

Next buildable while Richard is away, in order:
1. STU-033: step mode for one card, marked as not real timing ("stepping through a two-step card shows each step's
   values before it runs"). The step values (stepValues) and the copy pane are there to reuse.
2. Timeline gaps (SCOPE.md "Not built"): a recording that crosses pages names cards only for the page shown at Stop;
   the screen rows' text sample is the DOM as inserted ("TextTextTextLabel"); a copy has no canvas pixels or scroll
   positions, and a style-only change takes no copy.
3. STU-006 (runs without a NodeGX checkout), then STU-007 (packaged and signed, the icon is ready) — Richard asked
   on 2026-10-20 how far a full working Studio is: roughly 8–12 sessions (M4's end, STU-006/007, a publish path
   that has no task yet, then M5); a **Publish/deploy task is missing from SCOPE.md** — write it before STU-007.
Still open from s9: a branch whose condition is a constant `false` says "Set the condition…"; a card's name and hover
read only its first lane; port names a component gives without words show raw ("When pickList").

Show Richard: docs/look/stu-032-scrub.png and stu-032-step.png (the scrubber, a step's values), the s10 timeline
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
