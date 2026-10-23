Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s20), each
on the tree of its commit: `check:timeline` **46/46**, `check:editor` **180/180**, `check:app` 46/46, `check:data`
80/80 (all on 2f5dd07). Not rerun in s20 (nothing they test changed): `check:publish` 34/34, `check:pagedata`
33/33, `check:reusable` 12/12, `check:rules` 20/20, `check:vendor` PASS (s18); `check:phrases` 85/85,
`check:dictionary`, `check:import` 79/79 (s13). 🔴 `check:app`, `check:editor`, `check:data` and `check:timeline` load
studio.html: run them after any studio.html change. One heavy gate at a time (`nice -n 19`,
~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, and **stop if the mkdir fails**; remove it only if YOU
made it). Wait for another session's jest/vitest first, matching node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:data -- --shots`; in a shell loop, do not put `data -- --shots` in one quoted word. `--shots` rewrites
every picture that gate takes (`docs/look/stu-06x-*.png` for data, `s2-*.png` for editor): `git checkout --` the ones
you did not mean to change. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png,
s2-panel-group.png predate s10 and are not yours to commit. Keep each gate's output in a file.

🔴 **Another session works in this repo** (STU-070, *Studio inside a conversation*: editor/serve.mjs, editor/hosted/,
committed 3f7f155). Before each commit, `git diff` every file you add and commit only your own hunks.

**s20 did items 3 and 4 of s19's list** (SCOPE, each marked s20):
- *R5's Set step, gated* (1e470c4). `check:editor` 180/180 (3 new): in Probe panel, a workflow on the Panel's click,
  *Set a custom state* → *Probe text's mood*, is a Set Component Object Properties step run by `store`; its settings
  name `mood`, "clicked" typed there is `prop-mood` on disk; on Sign in, clicking the first shown copy makes it read
  "clicked" while the second keeps "copy 1". No code change was needed: s19's Set step worked as built.
- *A recording that leaves the page* (M4 gap; 2f5dd07). Studio's page stays put during a recording (it follows the
  app only after a rebuild, `followSoon`), so a run that navigated gave only minor rows for the other page.
  `timelineCards` now also reads every other page a signal in the recording touched (`keyOf` from
  `timelineNaming`), and its reusables: "When Sign in: Did Mount, on Sign in". A card row opens its own component
  even when Studio is elsewhere (`followRow` checks the card first, then the recorded page). `check:timeline` 46/46
  (2 new: Record on Todo, the Header's Sign out; the row opens Sign in at its card). Mutant (no other page's cards)
  44/45.
- *Overlapping runs of one card: not built, on purpose.* s20 worked through rules on the files alone, on paper:
  the oldest run still waiting on that node, the run that has not had that wire yet. Each misplaces steps of runs
  that do not overlap (a branch's other side, a loop). It wants the trace's `cause` (P123-STU030-SIGNALCAUSE,
  NodeGX's).
- Where s19's handoff stood: accurate. Item 1 is still blocked: npm read 2026-10-23 (s20) has `@nodegx/preview`
  0.2.4 and `@nodegx/mcp` 0.2.5, neither with BACKENDPUBLIC.

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 5 main pushed, 6 Data: done.
2 signed; notarising waits on the five secrets. 4 waits on a NodeGX npm release with BACKENDPUBLIC; Studio still pins
preview 0.2.3, mcp 0.2.2. main is ahead of origin by s19's six commits (992afe6 … 45893a0, 3f7f155 the other
session's) plus s20's 1e470c4, 2f5dd07 and this handoff's docs commit: pushing waits on Richard.

Next buildable, in order:
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. R5's importer half, **only if Richard says so** (below): a Bubble reusable's states (`convertReusable`), its
   elements' show / hide (`<label>.mounted`) and display data (`<label>.data`) are global Variables, read and set by
   name in compiled expressions and actions (`SetCustomState`, `ShowElement`, `DisplayGroupData`). Per copy means
   compiling those reads to the copy's Component Object. Mind the catch: a For Each row component's Component Object
   is the row's item, so a state there shares the item's field names.
3. M6's small follow-ups, if wanted: `_User` in Data types (the backend's `addColumn` on `_User` works, measured s17);
   Export of people once the backend's `_User` export is read for password hashes.
4. From "Not to forget" below, the cheapest seen-in-passing ones: a step's In list names a record's data type by its
   parameter (`collectionName "Task"`); the copy-reads-a-copy's-state port (R5's "Reusable's state", a Component
   Outputs port).
The M4 timeline's remaining gap (overlapping runs) waits on NodeGX's trace `cause`, not on us.

Waiting on Richard (ask in plain words):
- Whether R5's importer half comes before the alpha (item 2): today an imported reusable's states are shared by all
  its copies.
- R4 (rejoin after a branch): his leaning is "great, n8n style, but hard to manage maybe?". Its cost in the graph and on
  the card (STU-025) is to be worked out and brought back before building.
- Whether the package workflow should run once by hand now that main is pushed; pushing s19's and s20's commits.
- The five notarisation secrets made visible to this repository (Richard, 2026-10-23: "I'll get on it").
- His look at docs/look/stu-062-rename.png (now with the one-tick box), the s18 card (s2-workflow-card.png) and the
  branch-label rule, and s17's stu-061-required.png and stu-063-users.png.
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements). Filed and open in NodeGX's
  ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX, P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND,
  P123-STU030-SIGNALCAUSE.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box. Seen in
s19: a step's In list still names a record's data type by its parameter (`collectionName "Task"`).
