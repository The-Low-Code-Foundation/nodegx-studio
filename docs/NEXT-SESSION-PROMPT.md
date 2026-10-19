Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`): `npm run check:rules` (20/20),
`check:phrases` (85/85), `check:dictionary` (PASS 65 covered / 2 wrong filed / 22 missing / 5 none), `check:editor`
(159/159), `check:pagedata` (33/33), `check:reusable` (12/12), `check:import` (74/74 with the template bundle:
import/exports/template is present, gitignored), `check:app` (34/34). Read on 2026-10-19: editor, import and
dictionary on the code at be15e66 / b8a21de (s7); rules, phrases, pagedata, reusable and app in s6 at 1334249, and
none of them reads app-to-nodegx.mjs or studio.html, the only code changed since. Kit pieces and the phrasebook
come from the NodeGX checkout at ../OpenNoodl (lib/nodegx.mjs). One heavy gate at a time (`nice -n 19`), and wait for
another session's jest/vitest to finish first; `check:editor` takes about 4 minutes and `--shots` rewrites every
docs/look/s2-*.png (restore the tracked ones after: `git ls-files -m docs/look | xargs git checkout --`). The server
reads studio.html on every request: do not edit it while a gate runs (serve.mjs is read once at the gate's start).

Built in s8 (2026-10-19, de7892e): M3's first two, STU-020 and STU-021 (SCOPE.md). A ⚡ on every element with a
workflow, on the canvas and in the element list; hover names each event's steps in order; a click opens that event's card
alone, full screen; ← <element> or Esc returns to Design with it selected. `check:editor` 159/159 on de7892e; mutant
(summary reversed) 158/159. Not mutant-tested: the "reaches a step" rule (no signal wired only into values on the gate's
page). Fixed on the way: a draft event outlived its page and threw on a reusable's canvas. No pictures taken for Richard
yet (`--shots` writes docs/look/s2-workflow-card.png, new).

Next buildable while Richard is away: STU-023 (names from steps; a renamed card keeps its name — decide where the name
lives, e.g. the element's metadata per port), then STU-022 (the tree as the index, filters by effect / trigger, search
over step names and targets), then STU-024 (importer merges split workflows; needs a fixture with overlapping lanes).

Where it stood after s7 (2026-10-19, s7; main is ahead of GitHub, unpushed until Richard says). Built this session (SCOPE.md):
- STU-053-DROPDOWNVALUE fixed: "Dropdown's value's name" looks the chosen record up among the dropdown's choices (one
  Expression per dropdown) and reads the field; "Dropdown's value" alone still wires the id. Mutant 73/74.
- Components that draw nothing are no longer reusables: the todo template's Commands and Logic say "visual" and draw
  nothing; `componentDraws()` now answers for the palette, the page picker and `isVisualType('/…')`, so a Command copy
  on a page is logic. Mutant 152/153 (the copy-is-logic half not mutant-tested).
- A port with no name of its own is said in words ("zIndex" → "Layer (z-index)"; the kit's spec labels it by its name).
- Left as it is, on purpose: a new rule's value starts as the property's value now (as a look does, `lookStart`).

Where the s6 handoff was short: "copies all read Group …" is not a Studio fault as measured — the template's six
"Horizontal Buttons" copies carry Bubble's own names ("Group Horizontal Buttons", "… copy", "… copy 2", twice, in two
sections). Not looked at on screen; if the tree hides the "copy 2" suffix, that is the fault.

Richard looked at s5's and s6's pictures (s7): good; "Then…" read oddly, so the composer's button now says "more…"
(his pick, Bubble's word). His worry, recorded in SCOPE.md under STU-052: people mixing up composed phrases with typed
JavaScript in the same box. Watch for it at a play test; nothing built for it.

Next, in order: (1) His second sitting: data (M2's remaining work). (2) When he gives his real app export (not in
this repo): STU-044's 22 missing operator names and STU-044-FORMATNUMBER's keys, and STU-053's unread keys (a
dropdown's caption expression, a popup's backdrop and Esc, a group focus's reference element).

Waiting on Richard: the data sitting (1); his real app export (2); pushing main; rulings R4–R6.

Not to forget: a look's property list is long (73 on a Button); the look menu has no "1 inherited from Style" count; a
chip from a record field (page data `prop-*`) has no type yet, so the composer reads it as any value; a dropdown's value
read through `chosen` is typed nothing either; STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing;
wants Richard's look); row searches still asked once per row; 17 covered dictionary rows rest on the importer's own
operator names; the unknown no-argument operator still falls back to a guessed field read (`stats.fieldReadsGuessed`).
