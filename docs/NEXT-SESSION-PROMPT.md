Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s21), on
the tree committed after deee252: `check:editor` **191/191**, `check:import` **94/94**, `check:app` 46/46,
`check:data` 80/80, `check:timeline` 46/46. `check:dictionary` 65 covered / 2 wrong (filed) / 22 missing (s20). Not
rerun since (nothing they test changed): `check:publish` 34/34, `check:pagedata` 33/33, `check:reusable` 12/12,
`check:rules` 20/20, `check:vendor` PASS (s18); `check:phrases` 85/85 (s13). 🔴 `check:app`, `check:editor`,
`check:data` and `check:timeline` load studio.html: run them after any studio.html change. One heavy gate at a time
(`nice -n 19`, ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, and **stop if the mkdir fails**; remove it
only if YOU made it). Wait for another session's jest/vitest first, matching node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:editor -- --shots` (and never put `check:editor -- --shots` in one shell variable: npm reads it as the
script's name, and s21 lost a run to that). `--shots` rewrites every picture that gate takes (`s2-*.png` for editor,
`stu-06x-*.png` for data): `git checkout --` the ones you did not mean to change. Three untracked
docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are not yours to commit.
Keep each gate's output in a file. 🔴 In `check:editor`, a write to the project from outside Studio before the "files
changed outside Studio (STU-002)" section fails its first check: drive Studio's own UI there.

🔴 **Another session works in this repo** (STU-070, *Studio inside a conversation*: editor/serve.mjs, editor/hosted/;
in s20–s21 it committed 698faff, fd4c49f, 2832647, deee252). Before each commit, `git diff` every file you add and commit only your
own hunks.

**s21, in order** (SCOPE, each marked s21):
- Item 1 still blocked: npm read 2026-10-23 has `@nodegx/preview` 0.2.4 and `@nodegx/mcp` 0.2.5, neither with
  BACKENDPUBLIC.
- *A Go to page with no page says so on its step* (R4 section of SCOPE): "No page picked: it goes nowhere, and nothing
  after it runs." with *Pick a page…* (opens its settings). Picking a page now redraws the card (`edits()` treats
  `target` like `collectionName`); before, the file changed and the card did not. Undo now toasts *Undone* (before, the
  undone gesture's own toast stayed up). `check:editor` 191/191 (4 new); 190/191 before the redraw was added. Pictures
  retaken: [look/s2-workflow-branch.png](look/s2-workflow-branch.png), [look/s2-workflow-rejoin.png](look/s2-workflow-rejoin.png).
- *R5's limits* (R5 section of SCOPE). **s20's handoff was wrong on the first:** a page setting a copy's state to the
  value its Variable already holds DID work: Set Variable writes with `forceChange`. Now gated in the running app; it
  passes on the s20 importer too. (A signal-based rewrite was built and then reverted as redundant.) **Toggle built**:
  `!shown` from the element's holder into the set, in a reusable (per copy) and on a page. `check:import` 94/94 (4
  new); mutant (s20 importer) fails the three Toggle checks.

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 5 main pushed, 6 Data: done.
2 signed, packaged on all three in CI (s20 run); notarising waits on the five secrets. 4 waits on a NodeGX npm release
with BACKENDPUBLIC. **main is ahead of origin** by e192d83, 12b6691, the s20 and s21 commits and the other session's
698faff, fd4c49f, 2832647, deee252: ask Richard before pushing.

Next buildable, in order:
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. From "Not to forget": a step's In list names a record's data type by its parameter (`collectionName "Task"`).
   Also seen in s21: a Go to page step's head says "Navigate" (the type's name), not "Go to page" as the menu does.
3. R5's remaining limits: a state on an element inside a reusable read from the page, and a state in a reusable nested
   in one converted before it, are reported, not wired. A Toggle of an element in another component is "set to shown".
4. M6's small follow-ups, if wanted: `_User` in Data types; Export of people once the backend's `_User` export is read
   for password hashes.
The M4 timeline's remaining gap (overlapping runs) waits on NodeGX's trace `cause` (P123-STU030-SIGNALCAUSE).

Waiting on Richard (ask in plain words):
- Pushing everything since 9b0c0a7 (s20's e192d83, 12b6691, the s20/s21 docs and work, and the other session's commits).
- His look at docs/look/s2-workflow-rejoin.png (R4 on the card, now with the no-page line on No's step), and what he
  made of the five pictures opened for him in s20.
- The five notarisation secrets made visible to this repository ("Working on it").
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements; also whether his reusables'
  states behave per copy). Filed and open in NodeGX's ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX,
  P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND, P123-STU030-SIGNALCAUSE.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
