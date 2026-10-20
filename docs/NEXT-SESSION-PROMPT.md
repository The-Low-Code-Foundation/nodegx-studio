Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(170/170), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (79/79 with the template bundle:
import/exports/template is present, gitignored), `check:app` (34/34). Read on 2026-10-20 (s9) at dcf8b11: editor,
import, app, dictionary. 🔴 `check:app` DOES load studio.html (s8's note said none but editor did): run it after any
studio.html change. Kit pieces and the phrasebook come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs).
One heavy gate at a time (`nice -n 19`, take ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir), and WAIT
for another session's jest/vitest first (`pgrep -fl "jest|vitest"`; s9 ran one trace beside a peer's jest by
mistake). `check:editor` takes about 4 minutes; `--shots` rewrites every docs/look/s2-*.png: restore the ones you
did not mean to change (`git ls-files -m docs/look | grep -v <yours> | xargs git checkout --`; s2-workflow-*.png are
tracked now). The server reads studio.html on every request: do not edit it while a gate runs.

Built in s9 (2026-10-20), each with its gate, mutant and SCOPE.md "Done" paragraph:
- STU-023 (4ac29ac): a card is named by its steps ("Sign in → Go to the list") until renamed; the name lives on the
  element, `metadata.cardNames[port]`; Rename / double-click; empty = back to the steps.
- STU-022 (d4a8d78): Workflow's list is the page's index — cards under their elements in tree order; filters "What it
  does" (Goes to a page, Changes <type / state>, …; a component copy counts what is inside it) and "What starts it";
  a search over steps and targets. Gate on the Todo page (62 cards; "Changes Task" = 15, todoSelected = 11), with the
  page's sign-in redirect cut from outside for the section.
- STU-024 (dcf8b11): one card per event. Importer: "Only when A" + "Only when not A" on one event → one Condition "A?"
  (Yes = first, No = second); "not logged in" now reads `authenticated` like "logged in". Overlapping ones stay two
  wires; Studio draws an event with more than one first step as lanes side by side (A1… B1…). Done on a fixture: the
  real app's 16 split elements wait for its export.
- STU-030 (ea71834): the trace measured (editor/trace-inventory.mjs, docs/look/stu-030-trace.json): on, cheap, one
  clock with the probe and the screen; signals in order but every `cause` 0 (filed P123-STU030-SIGNALCAUSE in
  OpenNoodl's ledger, 7da13f613); wired queries start/end to the ms; JS requests and drawing are not in it.

Next buildable while Richard is away: STU-031 (Record / Stop and the timeline: three lanes on one axis — the trace's
signals for workflows, the probe's requests matched to query nodes for page data, a MutationObserver for the screen;
names from the files, not the trace dictionary). Then STU-032 (inputs/outputs per step, screenshots + scrubber).
STU-025 waits on ruling R4. Show Richard docs/look/s2-workflow-card.png (lanes), s2-workflow-index.png, s2-workflow-branch.png.

Seen, not fixed (s9): a branch whose condition is a constant `false` says "Set the condition…"; a card's name and
hover read only its first lane; port names a component gives without words show raw ("When pickList"); the hover's
"(+1 more)" is the second lane.

Where it stood after s7 (2026-10-19, s7; main is ahead of GitHub, unpushed until Richard says). Built this session (SCOPE.md):
- STU-053-DROPDOWNVALUE fixed: "Dropdown's value's name" looks the chosen record up among the dropdown's choices (one
  Expression per dropdown) and reads the field; "Dropdown's value" alone still wires the id. Mutant 73/74.
- Components that draw nothing are no longer reusables: the todo template's Commands and Logic say "visual" and draw
  nothing; `componentDraws()` now answers for the palette, the page picker and `isVisualType('/…')`, so a Command copy
  on a page is logic. Mutant 152/153 (the copy-is-logic half not mutant-tested).
- A port with no name of its own is said in words ("zIndex" → "Layer (z-index)"; the kit's spec labels it by its name).
- Left as it is, on purpose: a new rule's value starts as the property's value now (as a look does, `lookStart`).

Where the s6 handoff was short: "copies all read Group …" is not a Studio fault as measured — the template's six
"Horizontal Buttons" copies carry Bubble's own names ("Group Horizontal Buttons", "… copy", "… copy 2", twice, in two
sections). Not looked at on screen; if the tree hides the "copy 2" suffix, that is the fault.

Richard looked at s5's and s6's pictures (s7): good; "Then…" read oddly, so the composer's button now says "more…"
(his pick, Bubble's word). His worry, recorded in SCOPE.md under STU-052: people mixing up composed phrases with typed
JavaScript in the same box. Watch for it at a play test; nothing built for it.

Next, in order: (1) His second sitting: data (M2's remaining work). (2) When he gives his real app export (not in
this repo): STU-044's 22 missing operator names and STU-044-FORMATNUMBER's keys, and STU-053's unread keys (a
dropdown's caption expression, a popup's backdrop and Esc, a group focus's reference element).

Waiting on Richard: the data sitting (1); his real app export (2); pushing main; rulings R4–R6.

Not to forget: a look's property list is long (73 on a Button); the look menu has no "1 inherited from Style" count; a
chip from a record field (page data `prop-*`) has no type yet, so the composer reads it as any value; a dropdown's value
read through `chosen` is typed nothing either; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look); row searches still asked once per row; 17 covered dictionary rows rest on the importer's own
operator names; the unknown no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`).
