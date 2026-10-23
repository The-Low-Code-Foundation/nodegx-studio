Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s20), on
the tree that became 12b6691: `check:editor` **187/187**, `check:app` 46/46, `check:data` 80/80, `check:timeline`
46/46; on e192d83: `check:import` **90/90**, `check:dictionary` 65 covered / 2 wrong (filed) / 22 missing. Not rerun
in s20 (nothing they test changed): `check:publish` 34/34, `check:pagedata` 33/33, `check:reusable` 12/12,
`check:rules` 20/20, `check:vendor` PASS (s18); `check:phrases` 85/85 (s13). 🔴 `check:app`, `check:editor`,
`check:data` and `check:timeline` load studio.html: run them after any studio.html change. One heavy gate at a time
(`nice -n 19`, ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, and **stop if the mkdir fails**; remove it
only if YOU made it). Wait for another session's jest/vitest first, matching node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:editor -- --shots`. `--shots` rewrites every picture that gate takes (`s2-*.png` for editor,
`stu-06x-*.png` for data): `git checkout --` the ones you did not mean to change. Three untracked
docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are not yours to commit.
Keep each gate's output in a file. 🔴 In `check:editor`, a write to the project from outside Studio before the "files
changed outside Studio (STU-002)" section fails its first check: drive Studio's own UI there.

🔴 **Another session works in this repo** (STU-070, *Studio inside a conversation*: editor/serve.mjs, editor/hosted/;
in s20 it committed 698faff, fd4c49f, 2832647). Before each commit, `git diff` every file you add and commit only your
own hunks.

**s20, in order** (SCOPE, each marked s20):
- *R5's Set step gated* (1e470c4) and *a recording that leaves the page gives that page's cards* (2f5dd07), as the
  first handoff of s20 said.
- Richard's answers, same day: R5's importer half **yes** ("Yep reusables get one state per copy"), R4 **yes** ("Yep
  for R4"), push and run the package workflow **yes** ("Sure"), the secrets "Working on it", the pictures opened in
  Preview for him (stu-062-rename, s2-workflow-card, s2-workflow-branch, stu-061-required, stu-063-users). Rulings
  recorded (9b0c0a7). **main pushed** to 9b0c0a7; the package workflow ran by hand (run 39930130086): macOS, Windows,
  Linux all success (macOS ad hoc: no secrets yet).
- *R5, the importer's half* (e192d83). **s19's handoff was wrong here:** a compiled read of a state never read the
  Variable; it read a field off the element (`el_Card?.mood`), empty on pages too, and "Display data" set a Variable
  nothing read. Now every state is registered before compiling; in a reusable a state, a Show / Hide and displayed
  data are Component Object properties; a page reads a copy's state through a Component Outputs port and sets one
  copy's through an input. `check:import` 90/90 (11 new, 4 in the running app via preview-solo); mutant 81/90.
- *R4 / STU-025, rejoin* (12b6691). The card reads the first step both sides reach as the rejoin, draws it once under
  "Then, after Yes or No"; *Then, after Yes or No* / *Branch after both* make one; a step added at a side's end goes
  before the shared step. Deleting a step now heals the chain (what ran it goes on to what followed; before, the rest
  fell off the card). `check:editor` 187/187 (7 new, one in the app); mutant 182/187.
  [look/s2-workflow-rejoin.png](look/s2-workflow-rejoin.png) is for Richard.
- Item 1 still blocked: npm read 2026-10-23 has `@nodegx/preview` 0.2.4 and `@nodegx/mcp` 0.2.5, neither with
  BACKENDPUBLIC.

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 5 main pushed, 6 Data: done.
2 signed, packaged on all three in CI (s20 run); notarising waits on the five secrets. 4 waits on a NodeGX npm release
with BACKENDPUBLIC. **main is ahead of origin** by e192d83, 12b6691, this handoff's docs commit and the other
session's 698faff, fd4c49f, 2832647: Richard's "Sure" was for the commits then; ask before pushing these.

Next buildable, in order:
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. Seen in s20, cheap: a Go to page with no target never says Done in the app (RouterNavigate settles only on
   arriving), so a step after it never runs, and the card does not say so: a line on the step ("pick a page: until
   then nothing after it runs") would be honest. The toast after Undo still says what was undone's own words.
3. R5's limits (SCOPE): a page setting a copy's state to the value its Variable already holds does nothing; Toggle is
   "set to shown"; a state in a reusable nested in one converted before it is reported, not wired.
4. M6's small follow-ups, if wanted: `_User` in Data types; Export of people once the backend's `_User` export is read
   for password hashes.
5. From "Not to forget": a step's In list names a record's data type by its parameter (`collectionName "Task"`).
The M4 timeline's remaining gap (overlapping runs) waits on NodeGX's trace `cause` (P123-STU030-SIGNALCAUSE).

Waiting on Richard (ask in plain words):
- Pushing e192d83 and 12b6691 (and the other session's commits that ride with them).
- His look at docs/look/s2-workflow-rejoin.png (R4 on the card), and what he made of the five pictures opened for
  him in s20.
- The five notarisation secrets made visible to this repository ("Working on it").
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements; now also whether his reusables'
  states behave per copy). Filed and open in NodeGX's ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX,
  P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND, P123-STU030-SIGNALCAUSE.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
