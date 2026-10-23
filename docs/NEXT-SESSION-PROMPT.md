Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s19), each
on the tree of its commit: `check:editor` **177/177** (ca0008c), `check:timeline` **44/44** (ca0008c), `check:app`
46/46 (ca0008c), `check:data` **80/80** (992afe6). Not rerun in s19 (nothing they test changed): `check:publish`
34/34, `check:pagedata` 33/33, `check:reusable` 12/12, `check:rules` 20/20, `check:vendor` PASS (s18); `check:phrases`
85/85, `check:dictionary`, `check:import` 79/79 (s13). 🔴 `check:app`, `check:editor`, `check:data` and
`check:timeline` load studio.html: run them after any studio.html change. One heavy gate at a time (`nice -n 19`,
~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, and **stop if the mkdir fails**; remove it only if YOU
made it). Wait for another session's jest/vitest first, matching node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:data -- --shots`; in a shell loop, do not put `data -- --shots` in one quoted word (s19 lost a run that
way: npm looked for a script called "check:data -- --shots"). `--shots` rewrites every picture that gate takes
(`docs/look/stu-06x-*.png` for data, `s2-*.png` for editor): `git checkout --` the ones you did not mean to change.
Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are not
yours to commit. Keep each gate's output in a file.

🔴 **Another session works in this repo** (STU-070, *Studio inside a conversation*: editor/serve.mjs, editor/hosted/,
committed 3f7f155). Before each commit, `git diff` every file you add and commit only your own hunks.

**s19 took over unfinished work, then items 4 and a piece of 3** (SCOPE, each marked s19):
- *One tick for the likely maybes* (STU-062, Richard's ruling 2026-10-23). It was left written but ungated, uncommitted,
  in the working tree by the session before the /clear. s19 re-measured it, fixed the label's wrap, gated and committed
  it (992afe6): `givenRows` (rename.mjs) follows the wires from every node on a type, through components' inputs and
  outputs, to code; the drawer's *Tick the N lines in code given T's rows*. Todo app: RoutineCheck.date 206 maybes → 2,
  Task.closingNote 3 → 3, Task.title 33 → 21, Routine.time 75 → 60. The same commit carries Richard's rulings R4
  (leaning), R5, R6, R10, written into SCOPE by that session.
- *R5, Studio's half* (2c3e9ff). A Variable is one value for the whole app, so a state on an element inside a reusable
  was shared by every copy. In a reusable, *New state* now writes a Component Object (`net.noodl.ComponentObject`,
  property = the state; default `value-<name>`); the ⚡ wires `value-<name>`; *Set a custom state* writes Set Component
  Object Properties (`prop-<name>`, `store`); a rename moves property, default, wires and Set steps. Measured in the
  running app: two shown Probe panel copies start at the default, 4 records, set apart they read "copy 0" / "copy 1".
  **Not gated:** the Set step. **Not built:** the importer's half (below), and reading a copy's state from the page.
- *A branch with no label says its condition* (STU-023's "Seen, not fixed", 744e457): "If 1 > 2", or the wired
  value's words; "Branch" only when nothing is wired.
- *A record's fields read as fields* (M4 timeline gap, ca0008c): a `prop-` port with no words of its own reads as its
  field ("title", not "prop-title") everywhere `portLabel` names one.
- Where the s18 handoff stood: accurate, but stale on one point. It did not know about the post-handoff rulings or the
  uncommitted given-rows work (head a352449 plus a dirty tree). Item 1 is still blocked: npm read 2026-10-23 has
  `@nodegx/preview` 0.2.4 and `@nodegx/mcp` 0.2.5, neither with BACKENDPUBLIC.

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 5 main pushed, 6 Data: done.
2 signed; notarising waits on the five secrets. 4 waits on a NodeGX npm release with BACKENDPUBLIC; Studio still pins
preview 0.2.3, mcp 0.2.2. main is ahead of origin by 992afe6, 3f7f155 (the other session's), 2c3e9ff, 744e457, ca0008c
and this handoff's docs commit: pushing waits on Richard.

Next buildable, in order:
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. R5's importer half, if Richard wants it before the alpha's real-app test: a Bubble reusable's states
   (`convertReusable`), its elements' show / hide (`<label>.mounted`) and display data (`<label>.data`) are global
   Variables, read and set by name in compiled expressions and actions (`SetCustomState`, `ShowElement`,
   `DisplayGroupData`). Per copy means compiling those reads to the copy's Component Object. Mind the catch: a For
   Each row component's Component Object is the row's item, so a state there shares the item's field names.
3. A gate for R5's Set step (a workflow inside Probe panel that sets `mood`, one copy clicked, the other unchanged).
4. Timeline gaps still open (SCOPE M4): a recording that crosses pages gives card rows only for the page shown at Stop;
   two overlapping runs of one card are told apart only by start.
5. M6's small follow-ups, if wanted: `_User` in Data types (the backend's `addColumn` on `_User` works, measured s17);
   Export of people once the backend's `_User` export is read for password hashes.

Waiting on Richard (ask in plain words):
- Whether R5's importer half comes before the alpha (item 2): today an imported reusable's states are shared by all
  its copies.
- R4 (rejoin after a branch): his leaning is "great, n8n style, but hard to manage maybe?". Its cost in the graph and on
  the card (STU-025) is to be worked out and brought back before building.
- Whether the package workflow should run once by hand now that main is pushed; pushing s19's commits.
- The five notarisation secrets made visible to this repository (Richard, 2026-10-23: "I'll get on it").
- His look at docs/look/stu-062-rename.png (now with the one-tick box), the s18 card (s2-workflow-card.png) and the
  branch-label rule, and s17's stu-061-required.png and stu-063-users.png.
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements). Filed and open in NodeGX's
  ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX, P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box. Seen in
s19: a step's In list still names a record's data type by its parameter (`collectionName "Task"`).
