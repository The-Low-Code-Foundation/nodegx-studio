Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s18), on the
working tree that became the s18 commit: `check:editor` **172/172**, `check:data` **78/78**, `check:app` **46/46**,
`check:publish` **34/34**, `check:timeline` 43/43, `check:pagedata` 33/33, `check:reusable` 12/12, `check:rules` 20/20,
`check:vendor` PASS (884 files). Not rerun since s13: `check:phrases` (85/85), `check:dictionary`, `check:import`
(79/79); nothing they test changed. 🔴 `check:app`, `check:editor`, `check:data` and `check:timeline` load studio.html:
run them after any studio.html change; `check:publish` uses lib/publish.mjs and lib/live.mjs. One heavy gate at a time
(`nice -n 19`, ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, remove it only if YOU made it), and wait for
another session's jest/vitest first (s18 waited ~30 min in all on OpenNoodl's conformance jest). 🔴 `pgrep -f "jest|vitest"`
is the wrong wait: other sessions leave zsh wait-loops whose command text contains "jest". Match node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:data -- --shots`. `--shots` rewrites every picture that gate takes (`docs/look/stu-06x-*.png` for data,
`s2-*.png` for editor): `git checkout --` the ones you did not mean to change. Three untracked
docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are not yours to commit
(back them up before an editor `--shots` run, which writes `s2-*`). 🔴 In a gate, a scripted click leaves the focus in the
app's frame once the gate has typed there, so `el.blur()` fires nothing: dispatch `new Event('blur')`. Keep each gate's
output in a file (s18 lost a run's detail by piping it through `grep -v ok`).

**s18 took the handoff's buildable items 3, 4 and a piece of 1** (SCOPE.md, each under its milestone, marked s18):
- *Publish's deep links* (STU-008). Every NodeGX template and every imported app is `navigationPathType: "path"`, so
  nearly every published app has pages at their own addresses. The publish window now says a link to a page, or a
  reload on one, needs the host to answer every unknown address with index.html (`routingOf` in lib/publish.mjs, with
  the first Page's `urlPath` as the example). Measured both ways in `check:publish`: a plain static server 404s
  `/sign-in`, one with the fallback opens it.
- *The workflow card leftovers* (STU-022–024). A card's name and its ⚡ hover read every lane ("Sign in → Go to the
  list, and Put the old error away"; "Lane 1: … / Lane 2: …"). A Condition saved as a fixed Yes / No with nothing wired
  reads "Always No — a fixed value: only No runs", not "Set the condition…". A component port without words is spelled
  out ("When Pick list"). Not asked for, done because the lanes' name made it plain: a branch label reads as a test
  ("If …") only when it ends in "?"; otherwise it is the branch's name as written, so imported "Only when X" no longer
  reads "If Only when X". Mutant (all three reverted): 168/172, exactly the four new or rewritten checks fail.
- *Required is drift* (M6). `driftOf` now names a field required in the project and not on the development database,
  or the other way, as a card with both ways to agree; making it required on the backend counts the empty rows first and
  offers *Show them in App data* instead of asking the backend to refuse.
- Where the s17 handoff stood: accurate. Item 2 still blocked (npm read 2026-10-23: `@nodegx/preview` 0.2.4,
  `@nodegx/mcp` 0.2.5, unchanged since 2026-10-20; neither carries BACKENDPUBLIC's fix, OpenNoodl 490361c22).

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 6 Data done. 2 signed with the
Developer ID; notarising waits on the five secrets; Windows / Linux built and smoke-opened in CI. 4 waits on a NodeGX
npm release with BACKENDPUBLIC; Studio still pins preview 0.2.3, mcp 0.2.2. 5 main is ahead of origin/main (bc5fb85)
by the backend map, M6, s16, s17 and s18.

Next buildable, in order:
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. M6's remaining small follow-ups, if wanted: `_User` in Data types (add a field to users from Studio: the backend's
   `addColumn` on `_User` works, measured s17); Export of people once the backend's `_User` export is read for password
   hashes. The map's "a signed-in learner" is NodeGX's word (`@nodegx/backend-map`), not Studio's.
3. Timeline gaps (SCOPE M4 "Not built"): a recording that crosses pages gives card rows only for the page shown at Stop;
   two overlapping runs of one card told apart only by start; a record's fields named by their ports ("prop-title").
4. The branch "Seen, not fixed" left in STU-023: a branch made in Studio has no label, so a card whose first step is one
   reads "Branch"; the composed condition ("If 1 > 2") would say more.

Waiting on Richard (ask in plain words):
- Whether main can be pushed (now five sessions ahead), then whether the package workflow should run once by hand.
- The five notarisation secrets made visible to this repository.
- His look at the s18 card (docs/look/s2-workflow-card.png: the Sign in click, both lanes in its name, Lane 2's
  "Always No") and the branch-label rule (a label is a test only when it asks). His look at s17's
  docs/look/stu-061-required.png and stu-063-users.png, and at stu-062-rename.png with its question: the todo app reads
  fields in JavaScript, so a common name has hundreds of maybes (`RoutineCheck.date`: 206). Is a tick per line right, or
  should Studio offer "tick every line in nodes that also name this type"?
- Rulings R4, R5, R6, R10 (R10's leaning: a Linux VM over SSH, NodeGX's phase 89, not started).
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements). Filed and open in NodeGX's
  ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX, P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
