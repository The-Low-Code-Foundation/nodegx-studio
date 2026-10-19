Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:editor` (105/105),
`check:pagedata` (33/33), `check:reusable` (12/12, new), `check:import` (50/50 without the template bundle, 58/58 with it:
import/exports/template is present, gitignored), `check:app` (34/34). Kit pieces come from the NodeGX checkout at
../OpenNoodl (lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`); `check:editor` takes about 3.5 minutes.

Where it stands (2026-10-19, s3; main is ahead of GitHub, unpushed until Richard says): Richard looked at the new panel
on his app — "Holy shit it looks great" — and asked whether looking like Bubble gets us in trouble (answered in SCOPE.md
"Richard's look", rule added to "Writing about Bubble": their structure is fine, their words / icons / pictures never;
three phrases reworded). Built since: STU-015 (a reusable opened on its own: page picker "Reusable elements", a copy's
⤢ / double-click / "Edit <name>"; the app shows one copy on an in-memory canvas page); STU-015-PAGENAV (Studio's page
picker never changed pages: the runtime strips its base URL on read and not on write — Studio no longer navigates: the
preview's files make the shown page the router's start page, and Studio only follows the app's own redirect, read off
the Router; NodeGX half filed as P123-STU015-BASEURL in OpenNoodl's ledger); STU-050's last line (Make it reusable on a group's panel,
`editor/reusable.mjs`); the importer's grouping (`import/group.mjs`; on the template: "Horizontal Buttons" ×6, the
pricing columns and logo blocks left alone for a different hover look; same 227 elements drawn as ungrouped).

Next, in order: (1) show Richard Make it reusable and the grouped template (pictures: his template converted again —
the six feature rows are one reusable — and the todo Sign-in card made reusable); (2) STU-051's rest: a Conditional tab
(his app's "page narrower than 768" rules show as a cut-off chip today — they are Expressions wired into the property),
what still sits in More, Bubble's image popover; (3) the Bubble elements with no NodeGX node of their own (GroupFocus,
FloatingGroup, Popup, RepeatingGroup cells, dynamic Dropdown choices, Input formats) — check the importer's coverage;
(4) renaming a reusable in Studio (Make it reusable names it after the group; there is no rename yet). Then his second
sitting: data.

Not to forget: STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing; wants Richard's look before switching
on), row searches still asked once per row, rulings R4–R6 open, the grouping not yet measured on the real app (its
export is not in this repo).
