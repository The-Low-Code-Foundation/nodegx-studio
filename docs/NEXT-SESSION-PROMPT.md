Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-22 (s16), on the
working tree that became the s16 commit: `check:data` **64/64**, `check:editor` 170/170, `check:app` 45/45,
`check:publish` 31/31, `check:pagedata` 33/33, `check:reusable` 12/12, `check:timeline` 43/43, `check:rules` 20/20,
`check:vendor` PASS (884 files). Not rerun in s16: `check:phrases` (85/85), `check:dictionary`, `check:import` (79/79),
s13's numbers. 🔴 `check:app`, `check:editor` and `check:data` all load studio.html: run them after any studio.html change.
One heavy gate at a time (`nice -n 19`, ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, remove it only if
YOU made it), and wait for another session's jest/vitest first. 🔴 `pgrep -f "jest|vitest"` is the wrong wait: other
sessions leave zsh wait-loops whose command text contains "jest", and it waits forever. Match node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:data -- --shots`. `--shots` rewrites docs/look/stu-06x-*.png: put back the ones you did not mean to
change. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and
are not yours to commit.

**This file was three sessions stale when s16 opened it** (written in s14; the STU-007 signing, the backend map tab and
M6 were committed after it without rewriting it). SCOPE.md was right; trust it over this file when they disagree.

**s16 built STU-062, M6's last task** (SCOPE.md "Done (s16)"): a field or a type renamed in Data follows into the app.
`editor/rename.mjs` (pure) finds the readers in two kinds: *sure* (Record nodes on the type, a query's filter and sort,
page data's first record and the chips wired from it) are rewritten; *maybe* (code reading `.F` / `?.F` / `['F']`, an
Object node of no known type) are listed by node and line in the drawer's **Used by**, and change only when ticked.
A type rename goes through the backend's `renameTable` (checks and indexes lifted and put back), moves its rule on the
backend and in `nodegx.security.json`, and renames the Links that point at it. While a live database exists, renames
are kept in `metadata.cloudservicesLive.renames`, and Deploy to live (and Publish's schema step) applies them on live as
renames before the diff, so live keeps its values; the page clears the list after a deploy.

Where M6 and the alpha stand (SCOPE "The alpha (0.2) — the line"): items 1 Publish, 3 Import, 6 Data (STU-060–065,
and now 062) are done. 2: signed with the Developer ID and gated 46/46 on the package; notarising waits on the five
secrets being visible to the repository; Windows and Linux built and smoke-opened in CI. 4: waits on NodeGX, read
2026-10-22: `@nodegx/preview` 0.2.4, `@nodegx/mcp` 0.2.5 on npm, neither with BACKENDPUBLIC's fix (OpenNoodl 490361c22);
Studio still pins preview 0.2.3 and mcp 0.2.2. 5: main is ahead of origin/main (bc5fb85) by the backend map, M6 and s16.

Next buildable, in order:
1. M6's "Not in it yet": Required on an existing field (the backend's `applyRequired` exists; say how many rows lack a
   value first); `_User` in App data.
2. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate.
3. Publish's open edges (SCOPE "Done (STU-008)"): say that a path-routed app's deep links need the host's index.html
   fallback; a site under a sub-path waits on P123-STU015-BASEURL.
4. Timeline gaps (SCOPE "Not built" under STU-031..033) and s9's leftovers: a constant-`false` branch says "Set the
   condition…"; a card's name and hover read only its first lane; port names without words show raw ("When pickList").

Waiting on Richard (ask in plain words):
- Whether main can be pushed (three commits ahead), then whether the package workflow should run once by hand.
- The five notarisation secrets made visible to this repository.
- His look at docs/look/stu-062-rename.png, and one question it raises: the todo app reads fields in JavaScript, so a
  common name has hundreds of maybes (`RoutineCheck.date`: 206). Is a tick per line right, or should Studio offer
  "tick every line in nodes that also name this type"? Studio cannot know from the code alone, so it asks.
- Rulings R4, R5, R6, R10 (R10's leaning: a Linux VM over SSH, NodeGX's phase 89, not started).
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements). Filed and open in NodeGX's
  ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX, P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
