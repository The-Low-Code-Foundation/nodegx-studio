Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85, new), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none, new),
`check:editor` (128/128), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (64/64 with the template
bundle: import/exports/template is present, gitignored), `check:app` (34/34). Kit pieces and the phrasebook come from
the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`), and wait for another
session's jest/vitest to finish first; `check:editor` takes about 3.5 minutes and `--shots` rewrites every
docs/look/s2-*.png (restore the tracked ones after: `git ls-files -m docs/look | xargs git checkout --`). The server
reads studio.html on every request: do not edit it while a gate runs.

Where it stands (2026-10-19, s5; main is ahead of GitHub, unpushed until Richard says). Richard looked at s4's pictures
(the Conditional tab, grouping, Make it reusable): "Looks right, carry on." Built this session (SCOPE.md):
- STU-044 (M5 section): the importer graded against the community's Bubble→Noodl dictionary through the real converter;
  51/14/24 → 65 covered / 2 wrong (filed STU-044-FORMATNUMBER) / 22 missing. Operator names and operand places from
  bubble_ex 5f1c480 (vocabulary.ex, compiler.ex): split by / find & replace / extract / rounded down read `properties`;
  date formats, JSON-safe dates, month clamping, field reads off a list, :filtered and :sorted fixed or added.
- STU-052 (after STU-051 in "Next"): the composer's "Then…" menu by the chip's type, phrases from the phrasebook,
  slots for the other values. Pictures docs/look/s5/ (composer-then-menu, composer-slot) were opened for Richard at
  the end of s5; ask what he thinks if he has not said.

Next, in order: (1) STU-051's rest: what still sits in More, Bubble's image popover, adding a hover / pressed look from
the Conditional tab. (2) The Bubble elements with no NodeGX node of their own (GroupFocus, FloatingGroup, Popup,
RepeatingGroup cells, dynamic Dropdown choices, Input formats): check the importer's coverage. (3) Renaming a reusable
in Studio. (4) STU-044's missing 22 want Bubble's internal names: look in Richard's real app export when he gives one
(not in this repo); the same payload settles STU-044-FORMATNUMBER's property keys. Then his second sitting: data.

Not to forget: a chip from a record field (page data `prop-*`) has no type yet, so the composer reads it as any value;
in the element list a page's copies all read "Group …" (three "Horizontal Buttons" copies cannot be told apart); a new
rule starts with its value equal to the otherwise; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look); row searches still asked once per row; rulings R4–R6 open; 17 covered dictionary rows rest on
the importer's own operator names (no payload has shown them); the unknown no-argument operator still falls back to a
guessed field read (`stats.fieldReadsGuessed`), which is how rounded_down hid.
