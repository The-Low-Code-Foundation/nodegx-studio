Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-22 (s17), on the
working tree that became the s17 commit: `check:data` **74/74**, `check:editor` 170/170, `check:app` 45/45,
`check:publish` 31/31. From s16 (files they test unchanged since): `check:pagedata` 33/33, `check:reusable` 12/12,
`check:timeline` 43/43, `check:rules` 20/20, `check:vendor` PASS (884 files). Not rerun since s13: `check:phrases`
(85/85), `check:dictionary`, `check:import` (79/79). 🔴 `check:app`, `check:editor` and `check:data` all load studio.html:
run them after any studio.html change; `check:publish` uses lib/live.mjs. One heavy gate at a time (`nice -n 19`,
~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, remove it only if YOU made it), and wait for another
session's jest/vitest first. 🔴 `pgrep -f "jest|vitest"` is the wrong wait: other sessions leave zsh wait-loops whose
command text contains "jest", and it waits forever. Match node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:data -- --shots`. `--shots` rewrites every docs/look/stu-06x-*.png: `git checkout --` the ones you did
not mean to change. Three untracked docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png
predate s10 and are not yours to commit. 🔴 In a gate, a scripted click leaves the focus in the app's frame once the
gate has typed there, so `el.blur()` fires nothing: dispatch `new Event('blur')` (s17 lost a run to it).

**s17 finished M6's two leftovers** (SCOPE.md "Done (s17)"; the s16 handoff was current, unlike s14's):
- *Required on a stored field.* The field drawer's Required tick now shows for a field with values; ticked on, it
  counts development's rows with nothing in it (`$exists: false` = the backend's own NULL count), Save waits, and
  *Show them in App data* filters App data to those rows. `setRequired` runs last in Save. Deploy to live (and
  Publish's schema step) carries Required too, because the backend's diff ignores it (`lib/live.mjs`
  `requiredChanges`); live rows without a value hold it back, said under "Not on live yet".
- *`_User` in App data.* A **User** row heads App data (development or live), through the backend's Users API
  (`/admin/users`): paged, searched, the account fields and the app's own, a cell edited, New person with a password
  (signs in), ticked people deleted. No Export / Import (the `_User` export's handling of password hashes is unread),
  no sort, no group changes, no `_User` in Data types.

Where M6 and the alpha stand (SCOPE "The alpha (0.2) — the line"): items 1 Publish, 3 Import, 6 Data (STU-060–065,
and now 062) are done. 2: signed with the Developer ID and gated 46/46 on the package; notarising waits on the five
secrets being visible to the repository; Windows and Linux built and smoke-opened in CI. 4: waits on NodeGX, read
2026-10-22: `@nodegx/preview` 0.2.4, `@nodegx/mcp` 0.2.5 on npm, neither with BACKENDPUBLIC's fix (OpenNoodl 490361c22);
Studio still pins preview 0.2.3 and mcp 0.2.2. 5: main is ahead of origin/main (bc5fb85) by the backend map, M6, s16 and s17.

Next buildable, in order:
1. M6 is done but for the map's "a signed-in learner" (a NodeGX `@nodegx/backend-map` word, not Studio's). Small
   follow-ups if wanted: `_User` in Data types (add a field to users from Studio: the backend's `addColumn` on
   `_User` works, measured), Export of people once the backend's `_User` export is read for password hashes, and
   drift that names a Required the project and the backend disagree on (`driftOf` compares types only).
2. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate.
3. Publish's open edges (SCOPE "Done (STU-008)"): say that a path-routed app's deep links need the host's index.html
   fallback; a site under a sub-path waits on P123-STU015-BASEURL.
4. Timeline gaps (SCOPE "Not built" under STU-031..033) and s9's leftovers: a constant-`false` branch says "Set the
   condition…"; a card's name and hover read only its first lane; port names without words show raw ("When pickList").

Waiting on Richard (ask in plain words):
- Whether main can be pushed (four commits ahead), then whether the package workflow should run once by hand.
- The five notarisation secrets made visible to this repository.
- Richard's look at docs/look/stu-061-required.png and stu-063-users.png (s17). His look at docs/look/stu-062-rename.png, and one question it raises: the todo app reads fields in JavaScript, so a
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
