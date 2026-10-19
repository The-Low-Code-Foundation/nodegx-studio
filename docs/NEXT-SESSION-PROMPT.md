Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:editor` (77/77),
`check:pagedata` (33/33), `check:import` (50/50 without the template bundle, more with it: import/exports/template is
now present, gitignored), `check:app` (34/34). Kit pieces come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs).

Where it stands (2026-10-19, main = GitHub): page data (STU-010–013), STU-013-NAVLOOP (workflow conditions test only when
their workflow runs), STU-014 (R8 ruled: a reusable's data asks while that copy is shown; copies' shown/hidden reaches
their reusable; visibility conditions that restate the default are skipped). SCOPE.md has the measurements.

Richard's first play test (STU-050, STU-051; SCOPE.md "Next — Richard's first play test"): BUILT 2026-10-19 s2b, on
main (unpushed until Richard says). He answered the three questions and sent 27 screenshots of Bubble's panel — SCOPE.md
has his answers, the panel read off them, what is built and what is not against each done-when line. The Design tab's
right panel is now Bubble's Visual / Interaction tabs and sections; the left list is the page's parts, a part opened
on its own by double-click. Pictures to show him first: run the app on his template copy and on the todo template.

Next, in order: (1) his look at the new panel — show it on his app before building more; (2) STU-015, a reusable opened
on its own, which "make a component from this group" (STU-050's last line) needs; then that action in the list and the
importer's grouping (the same structure ≥3 times, ≥5 elements, not inside another repeat — on the template: the
feature items ×6, the pricing columns ×3); (3) STU-051's rest: what still sits in More, a Conditional tab, Bubble's
image popover; (4) the Bubble elements with no NodeGX node of their own (GroupFocus, FloatingGroup, Popup,
RepeatingGroup cells, dynamic Dropdown choices, Input formats) — check the importer's coverage. Then his second
sitting: data.

Not to forget: STU-015 (open a reusable in Studio), STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look before switching on), row searches still asked once per row, rulings R4–R6 open.
