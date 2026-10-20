Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(170/170), `check:timeline` (24/24, new in s10), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import`
(79/79 with the template bundle: import/exports/template is present, gitignored), `check:app` (34/34). Read on
2026-10-20 (s10) on the STU-031 tree: timeline, editor, app, rules, phrases, pagedata, reusable; import and dictionary
last read in s9 (the importer is untouched since). 🔴 `check:app` and `check:editor` both load studio.html: run both
after any studio.html change. Kit pieces and the phrasebook come from the NodeGX checkout at ../OpenNoodl
(lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`, take ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with
mkdir), and WAIT for another session's jest/vitest first (`pgrep -fl "jest|vitest"`; s10 waited for a peer's noodl-mcp
jest). `check:editor` takes about 4 minutes, `check:timeline` about 1; `check:editor --shots` rewrites every
docs/look/s2-*.png: restore the ones you did not mean to change (`git ls-files -m docs/look | grep -v <yours> | xargs
git checkout --`). The server reads studio.html and probe.js on every request: do not edit them while a gate runs.
Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are
not its to commit.

Built in s10 (2026-10-20): **STU-031, Record / Stop and the run timeline** (SCOPE.md "Done (STU-031)"). Record in the
bar; a drawer under every tab with three lanes on one axis (page data = the probe's requests, each query named by the
node whose `items` came out with the answer in the trace; workflows = the trace's signals made into runs of the
page's and its reusables' cards; the screen = a MutationObserver the probe now starts with the frame,
`window.__studioScreen`, each change given to the page element holding it); "Record the page opening" rebuilds and
records from 0 ms. Rows link to the element, the card (a reusable's opens that reusable) or the page data item. New:
editor/timeline.mjs (pure), editor/timeline-check.mjs (`TIMELINE_DUMP=1` prints every row), probe.js's screen
witness, studio.html's `drawnElements` (a copy draws through its roots) and `timelineCards`. Mutants: no screen
witness 22/24, copies draw nothing 23/24, the page's cards only 23/24. Pictures: docs/look/stu-031-timeline.png
(the Todo page opening), stu-031-timeline-add.png (a task added, recorded from now).

Filed in NodeGX's ledger (OpenNoodl a93f0d2ed): P123-STU031-COPYBOX — kit: `preview.elementsOf(copyId)` is `[]` for a
copy of a component. By the code, Design therefore draws no box for a selected copy and a click on one selects the
group around it. Not looked at on screen: do that before fixing it in Studio (or wait for the kit fix, which would let
`drawnElements` go).

Next buildable while Richard is away, in order:
1. STU-032: inputs and outputs per step (the trace has every value with its ports; a step's inputs are the values
   into it just before its signal), and screenshots per point with a scrubber ("scrubbing to a step shows the screen
   as it was then"). The screen witness keeps elements, not pictures: screenshots need another source (a canvas
   capture of the frame, or CDP from the desktop app). Measure the cost before choosing.
2. STU-033: step mode for one card, marked as not real timing.
3. Timeline gaps from s10 (SCOPE.md "Not built"): a recording that crosses pages (Sign in → Todo) names cards only for
   the page shown at Stop; the text sample is the DOM as inserted ("TextTextTextLabel · 1 · …").
Still open from s9: a branch whose condition is a constant `false` says "Set the condition…"; a card's name and hover
read only its first lane; port names a component gives without words show raw ("When pickList").

Show Richard: docs/look/stu-031-timeline.png and stu-031-timeline-add.png (the timeline), and from s9
s2-workflow-card.png (lanes), s2-workflow-index.png, s2-workflow-branch.png. Worth telling him from the recording:
the Todo page draws nothing until "reads the signed-in user" answers (23 ms in one run, 326 ms in another), then
draws empty, and Open tasks fills ~20 ms after the Task query answers; four of its requests come from JavaScript.

Waiting on Richard: his second sitting on data (M2's remaining work); his real app export (STU-044's 22 missing
operator names and STU-044-FORMATNUMBER's keys; STU-053's unread keys; the real app's 16 split elements for STU-024);
pushing main (ahead of GitHub, unpushed until he says); rulings R4 (rejoin, STU-025), R5, R6.

Not to forget: a look's property list is long (73 on a Button); the look menu has no "1 inherited from Style" count; a
chip from a record field (page data `prop-*`) has no type yet; a dropdown's value read through `chosen` is typed
nothing; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing; wants Richard's look); row searches
still asked once per row; 17 covered dictionary rows rest on the importer's own operator names; the unknown
no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`). His worry from s7, under
STU-052: people mixing composed phrases with typed JavaScript in one box; watch for it at a play test.
