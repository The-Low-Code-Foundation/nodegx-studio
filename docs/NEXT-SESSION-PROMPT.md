Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:editor` (77/77),
`check:pagedata` (33/33), `check:import` (50/50 without the template bundle, more with it: import/exports/template is
now present, gitignored), `check:app` (34/34). Kit pieces come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs).

Where it stands (2026-10-19, main = GitHub): page data (STU-010–013), STU-013-NAVLOOP (workflow conditions test only when
their workflow runs), STU-014 (R8 ruled: a reusable's data asks while that copy is shown; copies' shown/hidden reaches
their reusable; visibility conditions that restate the default are skipped). SCOPE.md has the measurements.

This session: Richard's first play test, on his Bubble template app converted into
`~/vscode_projects/NodeGX test projects/Bubble template (Studio)` (open it with `node app/launch.mjs <dir>`, or "Reopen
last"). His two points are SCOPE.md "Next — Richard's first play test": **STU-050** (a condensed element list grouped
into components, like the NodeGX editor's component tree, instead of Bubble's one giant tree per page) and **STU-051**
(a properties panel with typed controls instead of free-text fields — "bring the NodeGX props panel magic", or use
Bubble's panel as the guide). He will play-test data in a second sitting; do these first.

Start by looking, not building:
1. Open the template app in Studio and screenshot Design as it is now (tree on the left, props on the right) —
   Studio's tree is `renderTree()` and its panel `renderProps()` in editor/studio.html.
2. Read the NodeGX editor's property editor:
   ../OpenNoodl/packages/noodl-editor/src/editor/src/views/panels/propertyeditor (DataTypes/: NumberWithUnits,
   MarginPaddingType, SizeModeType, AlignTools, ColorPicker, FontType, EnumType, …; propertyPanelTiers/Hints/Filter) and
   its component tree (views/panels/componentspanel, ComponentsPanelNew). Decide what can run in Studio's page as is,
   what must be re-made, and say which with a reason.
3. Ask Richard for the Bubble property-panel screenshots he offered (every element's) before settling STU-051's grouping.
Then propose STU-050's shape and STU-051's first slice to Richard with a mockup or a screenshot of a working spike,
in plain words, before the full build. Every claim about what the app draws is read off the app, not the editor.

Not to forget: STU-015 (open a reusable in Studio), STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look before switching on), row searches still asked once per row, rulings R4–R6 open.
