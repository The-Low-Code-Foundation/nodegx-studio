Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:editor` (77/77),
`check:pagedata` (33/33), `check:import` (50/50 without the template bundle, more with it: import/exports/template is
now present, gitignored), `check:app` (34/34). Kit pieces come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs).

Where it stands (2026-10-19, main = GitHub): page data (STU-010–013), STU-013-NAVLOOP (workflow conditions test only when
their workflow runs), STU-014 (R8 ruled: a reusable's data asks while that copy is shown; copies' shown/hidden reaches
their reusable; visibility conditions that restate the default are skipped). SCOPE.md has the measurements.

Richard's first play test (STU-050, STU-051; SCOPE.md "Next — Richard's first play test"): LOOKED and SPIKED
2026-10-19 s2 — SCOPE.md has the measurements, what of the NodeGX editor can come (pure modules only; every control is
re-made), the defects found, and the spike. The spike is on branch `spike/stu-050-051` (not merged, not pushed): the
page as its 9 parts with wrappers folded in, the ⚡ inline, a line-break-keeping text box, the app's colours behind the
swatch, margin/padding as one box. Pictures: docs/look/playtest-1/. It waits on Richard: (1) does the list's shape
match what he meant, and should "two clicks" hold through the tree (opening a part opens all of it) or through the
page; (2) does a page's parts become reusables by hand from the list ("Make reusable") or by the importer; (3) his
Bubble property-panel screenshots, which settle STU-051's grouping. Build from his answers; the template app has no
tokens and no Input, so STU-051's acceptance needs an app with both.

Not to forget: STU-015 (open a reusable in Studio), STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look before switching on), row searches still asked once per row, rulings R4–R6 open.
