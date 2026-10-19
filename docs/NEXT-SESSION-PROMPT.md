Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(151/151), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (73/73 with the template bundle:
import/exports/template is present, gitignored), `check:app` (34/34). All eight read on 2026-10-19 on the code at
1334249: editor and app after the last change; rules, phrases, pagedata, reusable, dictionary and import earlier, and
none of them reads studio.html or serve.mjs, the only files changed since. Kit pieces and the phrasebook
come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`), and wait for
another session's jest/vitest to finish first; `check:editor` takes about 4 minutes and `--shots` rewrites every
docs/look/s2-*.png (restore the tracked ones after: `git ls-files -m docs/look | xargs git checkout --`). The server
reads studio.html on every request: do not edit it while a gate runs (serve.mjs is read once at the gate's start).

Where it stands (2026-10-19, s6; main is ahead of GitHub, unpushed until Richard says). Built this session (SCOPE.md):
- STU-051 is done against its done-when line: nothing is left in More for a Group, Text, Button, Text Input or Image
  (the gate asserts each). The image popover (upload into assets/, the project's images, an address, No image). "A look
  when hovered, pressed…" and "Another property" on a look, offering only the node library's visualStates and
  allowVisualStates ports. Two defects fixed on the way: project images never drew in Studio's app frame (its
  Noodl.baseUrl is /runtime/); Studio's port list dropped allowVisualStates (the kit's spec ports come first).
- STU-053 (new, M5): the Bubble elements with no NodeGX node of their own. FloatingGroup fixed on its layer (the
  template's Floating Mobile Nav Menu sat in the page's flow), Popup fixed in the middle, a cell grid of N columns,
  a Dropdown's records made into choices (they drew empty); GroupFocus and the popup's backdrop said in the report.
  Filed STU-053-DROPDOWNVALUE: a Dropdown's value is the chosen item's id, so "Dropdown's value's name" reads nothing.
- Renaming a reusable: ✎ beside its name when one is open; every copy and every setting naming it follow; one undo.

Where the s5 handoff was wrong or short: "what still sits in More" was more than the five it named. A Text Input had
the whole Text group, its label's text style (ten fields) and run-on-change there, and Position sat in More whenever it
was "in the flow". And the "Input formats" coverage item needed no change (password, email, number, tel and url were
already mapped).

Next, in order: (1) Show Richard the pictures, s5's (docs/look/s5: the composer's Then… menu and a slot; he has not
answered) and s6's (docs/look/s6: the Text Input panel and Label text, the image popover, the look menu and a look
added, the rename field), and ask what he thinks. (2) His second sitting: data (M2's remaining work). (3) When he gives
his real app export (not in this repo): STU-044's 22 missing operator names and STU-044-FORMATNUMBER's keys, and
STU-053's unread keys (a dropdown's caption expression, a popup's backdrop and Esc, a group focus's reference element).
(4) STU-053-DROPDOWNVALUE: read a field off a dropdown's value through a look-up of the chosen item.

Waiting on Richard: the pictures (1); the data sitting (2); his real app export (3); pushing main; rulings R4–R6.

Not to forget: in the reusable list, Commands/* logic components are offered as reusables (and so get ✎); a look's
property list is long (73 on a Button) and names some ports raw ("zIndex"); the look menu has no "1 inherited from
Style" count; a chip from a record field (page data `prop-*`) has no type yet, so the composer reads it as any value; in
the element list a page's copies all read "Group …" (three "Horizontal Buttons" copies cannot be told apart); a new rule
starts with its value equal to the otherwise; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look); row searches still asked once per row; 17 covered dictionary rows rest on the importer's own
operator names; the unknown no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`).
