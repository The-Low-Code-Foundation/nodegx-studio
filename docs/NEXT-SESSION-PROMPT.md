Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20,
new, no browser), `check:editor` (114/114), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (64/64
with the template bundle: import/exports/template is present, gitignored), `check:app` (34/34). Kit pieces come from the
NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`); `check:editor` takes about
3.5 minutes. The server reads studio.html on every request: do not edit it while a gate runs.

Where it stands (2026-10-19, s4; main is ahead of GitHub, unpushed until Richard says). Built this session (SCOPE.md,
"STU-051's Conditional tab, built (s4)"): the Conditional tab (`editor/rules.mjs` reads and writes a rule:
`(when) ? value : otherwise`, chains, showing rules; one card per condition; hover / pressed / focus looks under them);
STU-051-RULECHAIN in the importer (two conditionals on one property are one chained Expression, a no-op one is not
written; template 30 → 21 Expressions); a copy's inputs read as what they feed; the reusable canvas shows the first
copy's values. STU-015-IMPORTED ran green on a quiet machine.

First: show Richard the pictures in docs/look/s4/ (not shown yet): the template's six feature rows as one reusable
(grouped-template-page, grouped-template-reusable), the todo Sign-in card made reusable (todo-sign-in-card-*), and the
Conditional tab on four template elements (cond-panels). Ask in plain words what he thinks of the tab.

Then, in order: (1) STU-044, Richard pointed at it (s4): the community Bubble→Noodl dictionary
(OpenNoodl dev-docs/tasks/phase-86-the-community-already-built-it/corpus/bubble-dictionary/, 94 operators by data type,
executed in OpenNoodl scripts/bubble-phrasebook/rows.js, the source of the docs' "Coming from Bubble" page) against the
importer's own 125 operators: compile each phrasebook row's example through the importer and compare (by name only
37/94 match, an undercount; Date 2/15, Date Range 0/11, Integer range 3/11). (2) STU-052: the composer offers the
dictionary's phrases for a chip's type, as Bubble's menu does. (3) STU-051's rest: what still sits in More, Bubble's
image popover, adding a hover look from the tab. (4) The Bubble elements with no NodeGX node of their own (GroupFocus,
FloatingGroup, Popup, RepeatingGroup cells, dynamic Dropdown choices, Input formats): check the importer's coverage.
(5) Renaming a reusable in Studio. Then his second sitting: data.

Not to forget: in the element list, a page's copies all read "Group …" (names cut off: three "Horizontal Buttons" copies
cannot be told apart); a new rule starts with its value equal to the otherwise (the person sets it; nothing marks it);
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing; wants Richard's look before switching on); row
searches still asked once per row; rulings R4–R6 open; the grouping and the rule chain not measured on the real app (its
export is not in this repo).
