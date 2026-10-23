# NodeGX Studio — the scope

Written 2026-10-19 from Richard's brief (four points, below) and what NodeGX Studio already does. This is the plan
of record: each task has an id (`STU-nnn`), the reason it exists, and what "done" means. When a task changes shape,
change it here.

## What it is, in one paragraph

NodeGX Studio is a visual app builder for people who think in **pages, elements and workflows** — the way six years
of Bubble taught Richard, and a great many other builders, to think. Underneath, every app is a NodeGX project: a folder
of plain files, a graph of nodes, a real runtime. Studio shows that app the familiar way and keeps the good parts of
the Bubble model while **refusing to carry over its bad habits**: searches copied onto every element, a workflow tab
nobody can navigate, a debugger that cannot be trusted. And it runs **on your own machine** as a desktop app, so the
app is yours, it sits in git, and Claude Code can work on it alongside you through the NodeGX MCP server.

## Principles

1. **The app is the files.** Studio holds no state of its own. Anything it shows can be read from the project
   folder; anything it writes, a person or an agent could have written. Edits made outside Studio (VS Code, Claude
   Code, `git pull`) appear in Studio.
2. **The screen is the real app.** Design draws the running app, not a picture of it. Nothing is simulated.
3. **The right habit is the easy one.** Where Bubble let you do the expensive thing silently, Studio makes the cheap
   thing the only path, rather than warning you after the fact.
4. **Measure on real apps.** Every concept here was counted on a real production Bubble app before it was written
   down, and each importer change is measured the same way.
5. **Built from the NodeGX kit.** Studio draws no element and runs no node itself: the store, the preview, the node
   specs and the runtime are NodeGX's. If Studio needs something the kit cannot do, the kit grows.

## Where it stands (0.1)

| part | state | gate |
|---|---|---|
| Design tab — palette, element tree, click / drag-reorder / resize on the real app, property editor, red spacing guide | works | `check:editor` |
| Workflow tab — events, steps as the signal chain, add / delete a step, a Yes/No branch, the expression composer (chips, JavaScript, or both) | works | `check:editor` |
| Data tab (M6) — Data types in NodeGX's words on the running backend and the project together, drift named with both ways to agree (a type, a field, a Required); Privacy through the backend map; App data paged, searched, edited by kind, exported and imported; option sets; the Map; a development and a live database, Deploy to live, Copy rows; a field or a type renamed with what reads it in the app, and on live as a rename; Required on a stored field, on development and live; the people with an account (`_User`) in App data | works (2026-10-22, s15; STU-062 s16; Required and User s17; Required as drift s18) | `check:data` 78/78, `check:editor` 172/172 |
| Live with outside edits — a file changed by Claude Code (MCP), VS Code or `git pull` is drawn without a reload; a clash with Studio's own edit asks | works (2026-10-19) | `check:editor` 46/46 |
| Styles — global styles as NodeGX variants | works | `check:editor` |
| Bubble importer — pages, elements, styles, workflows, expressions, option sets, reusables, custom states, data types, privacy rules → `nodegx.security.json`, backend workflows → cloud functions, Data-tab rows | spike, measured on a real 17-page app (0 validation errors); its searches arrive as page data (STU-013), a reusable's while that copy is shown (STU-014); its workflow conditions test only when the workflow runs (STU-013-NAVLOOP) | `check:import` 50/50 |
| Run timeline (M4) — Record / Stop, page data, workflows and the screen on one axis, each row linked to its element, card or item; each step's values in and out; a scrubber with the screen as it was at the playhead; one run per Record, stopping by itself when it is over, its steps gone through one by one | STU-031 (2026-10-20, s10), STU-032 (s11), STU-033 (s12) work | `check:timeline` 43/43 |
| Desktop app — Electron window, a welcome screen (recent projects, NodeGX's templates, Import an app), File → Open Recent, a smoke mode; packaged for macOS as a DMG and a zip, signed ad hoc (STU-007's first cut) | first cut (2026-10-19), package (2026-10-20, s14) | `check:app` 39/39, 40/40 on the package, `smoke` |
| The project's backend — started (or adopted) on open, stopped on close, shown in the status bar; a template that needs one gets one; Data's "Start a backend" for an app with none | works (2026-10-19) | `check:app` 34/34 |
| Claude Code — "Connect Claude Code" in the header (and File) registers the NodeGX MCP server for the folder with the NodeGX editor's own writer and shows the command that starts a session there | works (2026-10-19) | `check:editor` 56/56 |
| Publish — File → Publish… and the header's Publish write the app as a static site with NodeGX's own deploy (npm's production engine), into a new folder or the one this app went to last; its cloud functions go to its backend through NodeGX's `deploy_cloud_functions`; the window says where the site is, what it talks to, and that a backend on 127.0.0.1 works on this computer only, and that a page's own address needs the host's `index.html` fallback (s18) | works (2026-10-20, s14) | `check:publish` 34/34, `check:app` 46/46 |
| Runs without a NodeGX checkout — the kit from npm at pinned versions (`@nodegx/preview` 0.2.3, `@nodegx/mcp` 0.2.2) and `vendor/` at one NodeGX commit; `NODEGX_REPO` for working on the kit and Studio together | works (2026-10-20, s13) | `check:vendor`, every gate on the vendored kit |
| Page data — a search is a named item on the page (Design → Page data), read by any element as dynamic data; made or reused through one form, never twice; readers, last run and "N queries on open" counted off the app's own requests; a workflow refreshes an item | works (2026-10-19), R7 ruled | `check:pagedata` 26/26, `check:editor` 71/71 |
| Workflows on their element (M3) — a ⚡ on every element with a workflow, on the canvas and in the element list; its steps in order on hover; its card full screen from the badge, Back (or Esc) to the element; a card named by its steps until someone renames it; the page's cards under their elements, filtered by what they change or what starts them, searched over their steps; one card per event — imported A / not A splits are one branch, overlapping ones lanes side by side | STU-020, STU-021 (2026-10-19, s8), STU-023, STU-022, STU-024 (2026-10-20, s9) work | `check:editor` 172/172, `check:import` 79/79 |

## The alpha (0.2) — the line

Written 2026-10-20 (s14): proposed by Claude; Richard's answer was *"Rock out"*, and asked whether the line is right, *"Yep"*. **Someone who is not Richard downloads
Studio, opens or imports an app, changes it, and publishes it.** What that needs, in order:

| | what | state |
|---|---|---|
| 1 | **STU-008 Publish** to a folder | done (s14) |
| 2 | **STU-007 a downloadable build**: signed and notarised with NodeGX's Developer ID; Windows and Linux | signed locally with the Developer ID and gated 46/46 (s14); notarising waits on the five secrets being visible to this repository; Windows / Linux built and smoke-opened in CI |
| 3 | **STU-040 Import an App…** with the report shown in the app | done (s14) |
| 4 | **A NodeGX npm release** carrying P112-OWN020-UNWIREDSIGNAL and P123-STU008-BACKENDPUBLIC, then Studio's pins bumped and `npm run vendor` at that commit | waits on NodeGX: read 2026-10-22, `@nodegx/preview` 0.2.4 and `@nodegx/mcp` 0.2.5 are on npm (UNWIREDSIGNAL is in the 0.2.4 cut); BACKENDPUBLIC's fix (OpenNoodl 490361c22, 13:11) landed after 0.2.5 was published, so no release has it yet |
| 5 | **main pushed** | done 2026-10-23 (Richard's yes; origin/main fb31c9f) |
| 6 | **STU-065 a development and a live database** (M6), and the Data tab it sits in (STU-060, 061, 063, 064). Richard, 2026-10-22: *"Alpha please"* | done (s15) |

Not in the alpha: STU-041–043 (the converter's one home, the fidelity gate, plugins), the timeline's gaps, rulings
R4–R6, and R10 beyond a folder on this machine.

[history/](history/) is how it started (NodeGX phase 123, working title "Open Bubble"): the brief, the look, the
first play test and every ruling taken.

---

## The four things Richard asked for

> 1. *Can we make it an Electron app like the real NodeGX editor? Bubble people would lose their shit if they
>    realised it was local development.*
> 2. *"Do a search for"… The inexperienced Bubbler would put "Do a search for" everywhere, on every element,
>    repeating the same DB query dozens of times across one page… If you can solve that problem you're a hero.*
> 3. *Having a workflow tab is ridiculous. Looking through a list of "When Button A is clicked" a hundred times over
>    a hundred visual element names is completely unworkable.*
> 4. *A big plus of Bubble was the step-by-step evaluator… In practice [it] is stupid because workflows can't be
>    truly async, race conditions… but it gave you a view of "when the user loads my page, this happens first, then
>    this, then that, ok now I see why their profile shows blank for a few seconds".*

### What a real app says

Counted on the pages of a real production Bubble app imported during phase 123 (18 pages, 3,941 elements):

| | count |
|---|---|
| searches written on pages | **153** |
| …distinct within their own page | **70** — 54 % are repeats |
| the busiest page | 96 searches, 38 distinct; one identical search written **7 times** |
| "When … is clicked" workflows | 246, on 227 elements |
| elements whose click is split over 2+ workflows (the logged-in / logged-out split) | 16 |
| workflows carrying an "Only when" | 54 |

---

## Next — Richard's first play test (2026-10-19): a Design tab a person can use

Richard opened Studio on his Bubble template app (converted, `~/vscode_projects/NodeGX test projects/Bubble template
(Studio)`) and said, in his words: *"I hated the way Bubble listed out all the components in one giant tree on the left
for each page. It would be nice if we could group them into components like in the NodeGX editor and make the page
level list of elements more condensed."* And: *"The properties panel on the right is pretty much an unusable list of
free text fields. We need to bring the NodeGX props panel magic into Bubble, or at least go look at how Bubble
structures it and use them as a guide. I can take screenshots of all the elements' props panels if you need them."*
These two come before M2's remaining work and M3: he will play-test data in a second sitting.

| id | task | done when |
|---|---|---|
| STU-050 | **A condensed element list, grouped into components.** The page's list shows the page as a few named parts (its components and top-level groups), each opening into its own elements, the way the NodeGX editor's component tree does, instead of every element of the page in one tree. A group of elements can be made into a component from the list. | on the converted template app the page list fits without scrolling at 1000 px tall, every element is still reachable in two clicks, and "make a component from this group" writes a component the app draws the same |
| STU-052 | **Typed follow-ups in the composer, from the community's Bubble→Noodl dictionary** (`dev-docs/tasks/phase-86-the-community-already-built-it/corpus/bubble-dictionary/`, 94 operators by data type; executed in `scripts/bubble-phrasebook/rows.js`, which found 18 wrong rows). After a chip, the composer offers the phrases for that value's type, as Bubble's menu does: a list of texts `:count`, `:first item`, `contains`; a date `+(days)`, `:formatted as`; a number `:rounded to`. Each writes the phrasebook's executed JavaScript. | a chip of each of the dictionary's seven types offers exactly that type's rows, and each inserted phrase runs to the phrasebook's answer |
| STU-051 | **A properties panel with real controls.** Typed controls in place of free text: sizes with units, colours and spacing from the project's tokens, alignment and layout pickers, fonts, images, enums as choices, grouped and ordered the way Bubble's panel is (Appearance / Layout / Conditional) and the NodeGX editor's is. Reuse the NodeGX editor's property editor types where they can run in Studio's page; Bubble's own panel (Richard offered screenshots of every element's) is the guide for grouping. | every property of a Group, Text, Button, Input and Image on the template app is edited through a typed control, and a token-valued colour reads as the token's name |

**Looked (2026-10-19, s2), on a copy of the template app; pictures in `docs/look/playtest-1/`.** The page is one
`Page` holding 208 elements up to 10 deep: 9 named sections (Header, Hero, Color Data, Benefit, Feature, Pricing and
Stuff, Contact Holder, Footer, Floating Mobile Nav Menu), 8 of them a single "Group Margin" wrapper around the content.
The element list drew all 209 rows: 5,944 px against 956 px of room, six screens. The panel drew 90 rows for a Group
(2,634 px), 85 for a Button, 72 for an Image, 54 for a Text (2,679 px): the controls are partly typed already (enums,
number + unit, a swatch), but every field carried a second "Insert dynamic data" line, margins and padding were eight
plain text fields, Border Style ×5 and Corner Radius ×5 are five same-named rows each (one per side, not said), two
groups are both called "Style", colours read `rgba(9, 23, 71, 1)`. The template has **no design tokens** (its Bubble
export predates colour tokens; the importer already turns `color_tokens` into project tokens, `app-to-nodegx.mjs:91`)
and **no Input element**, so STU-051's "token reads as its name" and "Input" need another app or an added element.
Defects found: a multi-line text (3 on the page) shown in a one-line field, which drops the line break on the first
keystroke; an icon's `{ class, code }` source shown as `[object Object]`; no list in Studio ever showed its selection
(`h()` wrote `aria-selected=""`) — fixed on main, 6229716.

**What of the NodeGX editor can come.** None of its property editor or component tree runs in Studio's page: every
control is React + SCSS modules + `@noodl-core-ui` (whose `Icon` needs webpack's `require.context`), wired to
`ProjectModel` / `UndoQueue` / `EventDispatcher`. Its pure modules can be bundled as an ES module and used as they are:
`propertyPanelTiers` (group tiers and order: basic groups `General` first, then Dimensions, Layout, Alignment, …, the
"Advanced CSS" groups folded into one), `propertyPanelFilter` (a filter box from 12 rows), `propertyPanelHints`,
`model/sizeModeAxes`, `model/alignRows` + `alignToolsIcons` (SVG strings), `model/colorField`,
`components/marginPaddingEdit` (one import to cut), `readNumberFieldEdit` (copy out of its React file),
`nodegx-project-contract/tokens.ts` (`DEFAULT_TOKENS`), and for the list `layersTree`, `componentSections`,
`componentUsage`, `folderDisplay`. The controls themselves are re-made in Studio's DOM.

**The spike (branch `spike/stu-050-051`, gates 77/33/34 green), shown to Richard before the build.** The list opens on
the page's 9 parts (10 rows, 274 px); a wrapper with one container child folds into its parent's row as a "› n" mark;
a row says what it holds (a text's words, how many elements); clicking an element in the page opens the tree to it.
By the tree alone 89 of 209 elements are two opens or fewer away and the deepest six — "two clicks" is not met by
the tree, only by the page. The panel: the ⚡ at the row's end (Text panel 2,679 → 1,981 px), a text box that keeps
line breaks, an icon's name, font weight by name, the app's colours (13, most used first) behind the swatch, margin and
padding as one box. Not in it: "make a component from this group" (it needs STU-015, opening a reusable on its own),
the grouping (waits for Richard's Bubble screenshots), size-mode and alignment pickers, fonts, images.

**Richard's answers (2026-10-19).** (1) The list: deep Bubble trees end up showing only the first letter of a name;
he wants the NodeGX way — click into a part and see only its inside, "as an option". (2) Making components: the
importer should group elements into components "but not too aggressively"; otherwise Claude Code through the MCP
server tidies up after an import (which it will have to do anyway, remaking the plugins). (3) 27 screenshots of
Bubble's new property panel (GroupFocus, FloatingGroup, Popup, Image, Dropdown, Input, RepeatingGroup, Button, Text;
the colour, border, shadow, style, choices and auto-binding popovers; the Conditional and Interaction tabs). Not
committed (they are Bubble's UI); what they say is here.

**Bubble's panel, read off the screenshots.** Header: the element's icon and name, a ⋯ menu. Tabs: Visual,
Interaction (count badge), Conditional (count badge). Visual, in this order: **Content** (per type: Text's text box
with "Add dynamic ⌘/"; Button's type and text; Image's "Select image" popover — upload, generate with AI, crop,
search free, ALT; Input's placeholder, auto-binding, initial content; Dropdown's placeholder, auto-binding, choices
Static/Dynamic, default; a container's type of content and data source), **Configure** (per type: Text's links /
BBCode / nofollow toggles; Input's format, character limit, autofill, password check; RepeatingGroup's scroll
direction, rows/columns fixed/fit/fill, min sizes, separators, masonry; Popup's grayout colour and blur; FloatingGroup's
float relative to and z-index; GroupFocus's reference element and offsets), **Size** (width and height each Fixed /
Fill / Fit and a value; min and max beside), **Layout** (Position X/Y in a fixed parent; Alignment; Container layout
Column / Row / Align / Fixed; Container alignment, five icons; Spacing: gap, padding ↕ ↔ ⛶, margin ↕ ↔ ⛶), **Style**
(the style chip, edit, detach, "Overridden"), **Text** (font, weight "400 (Regular)", size, align L/C/R, B I U, ⋯,
the colour chip "Primary contrast" + ⚡), **Appearance** (closed: opacity %, rotation, radius ⛶ four corners),
**Border / Background / Shadow** ("+", "No border added yet", "−"; border style + width + ⛶ each side + colour;
background colour / gradient / image; shadow summary "Outside 2,2,4px,0px" opening X, Y, blur, spread, colour). The
colour popover: a picker, hex and %, "Variables" (the app's colour tokens) with search. Interaction: Workflows
("This element is clicked" → its actions), Visibility, Options (make clickable), Transitions, SEO heading tag,
Advanced tooltip. Conditional: rules WHEN … THEN a property, "1 inherited from Style".
Bubble elements in them NodeGX draws with no one node of its own: **GroupFocus, FloatingGroup, Popup,
RepeatingGroup's cell grid, a Dropdown's dynamic choices, an Input's formats** — for the importer's coverage list.

**Built (s2b, `spike/stu-050-051` 3950fcd; check:editor 95/95, pagedata 33/33, app 34/34).** STU-051: the Visual
tab as above for every visual element (not Page, not a reusable's copy: they keep the old panel), each section
claiming its ports by name and More holding the rest with the plain field; Interaction holds the element's workflows
(opening Workflow), visibility, options, drag/drop/scroll and its custom states. A colour reads as Bubble writes it
or as its token's name, its swatch the colour the app draws — read off the running app, because a dark theme's values
are not in the project file (the todo app's `--surface` is #1f2022 on screen, light in the file). STU-050: double-click
a part, or its ⤢ at the row's end, and the list shows only what it holds, with crumbs back. Two defects fixed on the
way: `__ob.shows` counted a redraw before the page was shown again (a gate could measure the old app), and an
invisible ⤢ mid-row caught a click meant to select.
Against the done-when lines: STU-051 — the gate grades a Group, Text, Button and Text Input on the todo app
(no bare text field outside Content, Configure and More) and "a token-valued colour reads as the token's name" (the
card's Surface); **More still holds plain fields** (transform origin, Pos X/Y, Scale, z-index on some types, a Text
Input's label styling), and there is **no Conditional tab** (Studio has no conditionals to show yet). STU-050 — the
page list fits (10 rows, 274 px, on the Bubble template); "two clicks" is now "open a part, then its element", per
Richard's answer; **"make a component from this group" is not built**: it needs STU-015 (a reusable opened on its
own). The importer's candidates, measured on the template (the same structure ≥3 times, ≥5 elements, not inside
another repeat): "Group Horizontal Buttons" ×6 of 7 elements (the feature items) and the pricing columns ×3 of 14.

**Richard's look (2026-10-19, s3).** Shown on a copy of his template app and the todo app (the page's parts, a part
opened, a Text, a Group, a Button, the Interaction tab): *"Holy shit it looks great."* He asked whether looking so
like Bubble gets us in trouble. Read for the answer: Bubble's terms (bubble.io/terms, read that day) have no clause
against a competing product or a similar look; §8(b) lets a user reuse their own workflows and design elsewhere;
§3(b)(ii) bans decompiling the Platform, which reading the panel as a user is not; their lever is suspending the
account (§3, §13(b)). A panel's structure is a way of working, not something owned. What stays out of Studio: their
name, icons, screenshots, help text, colours, and "a Bubble clone" in anything we publish. Three of their phrases had
come in word for word and were reworded the same day ("No border added yet" → "No border. + adds one.", "Insert
dynamic data" → the ⚡ "Take this value from…" / "Insert a value"). Correction to the line above: the imported app
**does** have conditionals to show — Bubble's "when the page is narrower than 768" rules arrive as an Expression wired
into the property (`Text C: marginTop when Current Page Width's less_than 768`), which the panel can only show as a
cut-off chip until there is a Conditional tab.

**STU-050's last line, built (s3).** *Make it reusable*, on a selected group's panel: the group and what it holds, and
the logic only they use, move into `Reusable/<its name>`; a copy takes its place (same parent, same place among its
siblings); page data stays on the page. A wire across the group's edge becomes an input or output of the reusable,
named after the element inside ("Email onTextChanged", "Sign in onClick", typed a signal where the node library says
so), bare only for the group itself; two page values into one inside port are one input with two wires. One gesture,
one undo. The pure part is `editor/reusable.mjs` (`extractReusable`), which the importer uses too.
- `check:reusable` 12/12 (new, no browser): on the todo app's Sign in page, every node and every one of the 21 wires
  is accounted for; the page's sign-in, sign-up and navigation stay on the page; page data stays (with the control
  that it would move without `stays`); `validate_project` finds no new error or warning, and, as the control, does
  report a broken wire put inside the new reusable.
- `check:editor`: the card made reusable on Sign in, then signed in wrongly *through the copy*: the typed email and
  password go out through its outputs, its Sign in click reaches the page's Log In, and the page's error and its
  showing come back in. The copy shows "Invalid username/password.".

**The importer's grouping, built (s3).** `import/group.mjs`: the same shape (each element's type and style, its
children's shapes, in order) at least 3 times on a page, at least 5 elements, largest first, nothing inside a taken one
taken again. Everything but the settings must match (keys besides `parameters`, and the wires among their own elements),
or the shape is left alone and the report says why. Settings that differ between the occurrences become inputs each copy
sets; the same everywhere stays inside. The page's logic never moves (each copy keeps its own workflows through its
outputs). The report gets a section, "Repeated structures → reusables". On Richard's template: **"Horizontal Buttons",
6 copies** (the feature rows; each copy sets its top and bottom margin and its icon), and two shapes left as they were:
the 3 pricing columns ("Button H" has a different hover / pressed look in one of them) and 4 logo blocks ("Text AZ"
likewise). The look, measured: the template converted with and without grouping (`NODEGX_STUDIO_NO_GROUPING=1`), both
drawn by `preview-solo` at 1280 px — the same 227 elements with the same text, place, size, colours and font size, the
same page height; the screenshots differ only in the two phone-mockup images, and the control (the same project drawn
twice) differs there too (907 rows). `check:import` 58/58 with the template bundle (two new checks, validate_project 0
errors). Not measured: the real app (its export is not in this repo).

**STU-051's Conditional tab, built (s4).** A third tab beside Visual and Interaction, its badge the element's rules
and looks. A rule is read off the graph (`editor/rules.mjs`, pure): an Expression wired into a property whose text is
`(when) ? value : otherwise`, a chain of them when several rules set one property (the first that holds wins, the
newest first, as Bubble's last rule in the list wins), or a condition wired into Visible / Mounted (`(when)` shows,
`!(when)` hides). The tab draws one card per condition, the condition its heading in words and chips ("When
[Screen's Width] < 768"), then each property it changes with the property's own control (a length, a colour chip,
yes/no, shown/hidden) and the otherwise; a computed value shows as its code. Clicking the condition opens the composer
on it (only the condition: the composer hands back its text and chips and writes nothing itself); − takes a rule out,
× one property, "Another property" puts one more under the same condition, "New rule" composes a condition and then
picks a property — onto a property that has a rule already, it becomes that Expression's new first arm, never a
second wire. A property two values feed at once says so in red. Under the rules, "When hovered / pressed / focused":
the element's own looks, editable and removable (`set_state_parameter`, a ninth edit), and its style's, marked as
coming from it. In Visual, a property a rule sets shows "A rule · Conditional" (it opens the tab) instead of the
Expression's name cut off.
- On the template (looked, not graded; `docs/look/s4/cond-panels.png`): Text C reads "When Screen's Width < 768 ·
  Margin Top 16 otherwise 64"; Text Z its font size and side margins under "< 504"; Button F its hover background and
  pressed shadow; Group B "Mounted hidden". (Before the importer fix below, Text C also had a Width rule 100% → 100%.)
- Gates: `check:rules` 20/20 (new, Node): the importer's shapes read and written back, a size object's colon and a
  string's `?` skipped, one card for one condition on two Expressions, and every edit the tab makes *run*. `check:editor`
  114/114: a rule written the importer's way on Sign in's Top right is listed, drawn (24 px), changed in the tab (the file
  says 40, the app draws 40 px), a second rule chains into the same Expression (one wire, two cards), removed again; a
  hover look on Create account is listed and removed from the file. Mutant (a new rule always a new Expression): 112/114.
- **STU-051-RULECHAIN (found by the tab, fixed in the importer):** Text Z on the template showed "Width takes 3 values at
  once". The importer wrote one Expression per conditional and property, so two conditionals on one property were two
  wires into one port, and whichever changed last showed; Bubble's later conditional wins. It now chains them into the
  one Expression (`ruleInto`, through `rules.mjs`'s `addArm`, the tab's own shape), and does not write a conditional whose
  value is the element's own (Text Z's three were 100% → 100%). Template: 30 → 21 Expressions, ports fed twice 2 → 0
  (all nine were no-ops; nothing to chain there). `check:import` 64/64 with a fixture where it is not: margin 30 when
  signed in and 10 narrower than 768 is one Expression, run, narrow and signed in gives 10, wide 30; two hiding rules on
  a group are one Expression hidden when either holds; the report counts both.
- Also this session: a copy's panel named its inputs by port name, cut off ("Why it did not ..." twice, "MaterialIcon A
  ..."); an input with no name of its own now reads as what it feeds inside the reusable, grouped under that element
  with that property's name and control. The reusable canvas's copy now takes the first placed copy's settings (the
  feature row's icon was blank; gate: its query asks with n = 1, mutant 105/106). STU-015-IMPORTED run green on a quiet
  machine (105/105): the three timing checks needed nothing.
- **Not built:** adding a hover / pressed look from the tab (only the ones there are edited), Bubble's "1 inherited from
  Style" count on the badge, a rule on a reusable's copy (its inputs are wires already), and conditions the composer
  should offer by type (STU-052).
- **Richard looked (2026-10-19, s5)** at `docs/look/s4/` (the tab on four template elements, the six feature rows as one
  reusable, the todo Sign-in card made reusable): *"Looks right, carry on."*

**STU-052's typed follow-ups, built (s5).** In the composer, clicking a chip (or inserting one) marks it and shows
"After [the value] as [its type] · Then…". The type is the chip's port's, read as the dictionary's (text, number, list,
date; anything else is "any value") and the person can change it, since NodeGX does not always know (a custom state is
any value; the dictionary's number range and date range are no port type of NodeGX's). "Then…" lists exactly that type's
rows of the phrasebook and the Any ones, in its order, by Bubble's name, each with the code it writes. A row the
phrasebook answers with an expression, or with a Function whose whole work is one `Outputs.x = …`, inserts its executed
JavaScript (`editor/phrases.mjs`, pure; served as `/phrasebook.json` from the NodeGX checkout's `rows.js`): the chip, with
the chain it already ends with (Bubble's "state :uppercase is …"), becomes the row's subject, and each other value the row
needs is a **slot**, an empty dashed box named for what it holds ("▢ text"), which the note asks for and which a click
fills from the ⚡ list. A row NodeGX answers with a node (Date Add, Date To String, Date Parts…) or not at all is listed
greyed, and says so when clicked. Per type, insert / instead: String 11/9, Integer 7/1, Integer range 11/0, Date 4/11,
Date Range 11/0, List 21/3, Any 4/1.
- Gates: `check:phrases` 85/85 (new, Node): every type offers exactly its rows; every one of the 69 phrases that insert is
  inserted on a chip, its slots given the phrasebook's values, and run to the phrasebook's executed answer (with the
  Expression node's Math names); a phrase goes where the chip is, takes its chain, balances brackets, never takes a name
  already used. Mutant (the wrong variable as the subject): 80/83. `check:editor` 128/128: on the todo app's title, a
  custom state's chip reads as any value; as each of the seven types the menu lists exactly the phrasebook's rows;
  ":uppercase" writes `state.toUpperCase() + " world"` and the app shows "HELLO world"; ":is" leaves "▢ text", filled
  with the state, and the app shows "false world". Pictures: `docs/look/s5/`.
- **Not built:** a chip's type from a record's field (page data's `prop-*` ports carry no type yet, so they read as any
  value), the slot for a Function or node row (they say what to use instead), and inserting a phrase at the caret
  rather than on the marked chip.
- **Richard looked (2026-10-19, s7)** at `docs/look/s5/` and `s6/`: *"It's good, but 'then...' is a weird way to
  introduce it … I hope people won't be confused between the composer with then... then... then... and mixing that up
  with manually typed JS values, though I think it's a very cool idea and I would have killed to be able to part
  compose part manually type my Bubble expressions back in the day."* Ruled: the button says **"more…"**, Bubble's own
  word for extending an expression (chosen from more… / + an operator / Do more with it…). His worry, composed
  phrases against typed JavaScript in the same box, is a thing to watch for at a play test: nothing built for it yet.

**STU-051's rest, built (s6).** STU-051's done-when line holds on the todo app: **nothing is left in More** for a Group,
a Text, a Button, a Text Input or an Image (the gate asserts it for each). Placed: Position always in Layout (it was
shown only when not "in the flow", so the default sat in More), Lines (`alignContent`) once the container wraps, Box
sizing under Spacing; Offset X / Y (NodeGX's "Pos X / Y" are a transform: they move the element from where the layout
put it) and Origin in Appearance; a Text Input's content format, max length, keyboard, enter key, text to insert,
placeholder opacity and label spacing in Configure, its initial content in Content, its label's font, size, weight,
colour and the rest as a **Label text** section with the Text section's own controls (once the label is on), and
run-on-change in Interaction › Options. Text style is a choice of the project's `textStyles`. The **image popover**:
the image as it is, *Upload an image…* (into `assets/`, made unique before the extension, `dot-1.png`, as the NodeGX
editor's `projectAssets.ts` does), the project's own images, an address, *No image*; on an Image's source and a
background image. **A look when hovered, pressed…**: the states the node library gives the element's type
(`visualStates`), then the properties it lets a state change (`allowVisualStates`), the look starting as what the
element shows now; *Another property* on each look.
- Defects found on the way: **a project image never drew in Studio's app** (the frame's `Noodl.baseUrl` is `/runtime/`,
  so `assets/x.png` was asked for as `/runtime/assets/x.png`, which only the runtime folder was searched for; the
  starter imagery under `noodl_modules/` too); and **Studio's port list dropped `allowVisualStates`** (the kit's spec
  ports are taken first and carry none), so a Button's look menu had 26 properties and not Background Color; it has 73.
  Both by a gate run before the fix.
- Gates: `check:editor` 146/146 (18 new): the five elements' More empty; Offset X 12 written as 12 px and drawn as
  `matrix(1, 0, 0, 1, 12, 0)`; an Image placed from the palette, a picture uploaded (in `assets/`, in the file, loaded
  by the app at 1×1), the same name again `dot-1.png`, one picked from the project's, cleared, the Image deleted; the
  look menu's states and properties against the node library, a hover look added, set to #00FF00 and drawn so by the
  runtime in its hover state (driven by `setVisualStates`, not a pointer) and its own colour after, then removed.
- **Not built:** Bubble's "1 inherited from Style" count on the badge; a look on a reusable's copy; a property the
  person might want in a state that the node library does not allow (it is not offered: the runtime would not draw it).

**Renaming a reusable, built (s6).** With a reusable open on its own, ✎ beside its name opens a field ("Every copy of
it, on every page, takes the new name."). The rename stays in the reusable's folder: its three files are written under
the new key and the old ones removed (the kit's store, `writeComponent` + `deleteComponent`), and in every other
component each copy's type `/<key>` and any setting holding the path (a For Each's template, a list of components) is
rewritten. The NodeGX editor gets this from its model (a node's type is the component object); Studio's model is the
files, so each reference is rewritten. A name another component in the folder has is refused before anything is
written. One gesture, one undo, and the undo reopens it under its old name (undo used to keep a page key the files no
longer had).
- Gate: `check:editor` 151/151 (5 new): the Sign-in card made reusable, a For Each naming it written from outside, then
  renamed Login card: files, registry, the copy and the template follow, the page still draws it; "Probe panel" refused
  with nothing written; one undo restores all of it. Not mutant-tested.
- Pictures for Richard, s6: `docs/look/s6/` (the Text Input panel and its Label text, the image popover, the look menu
  and a hover look added, the rename field).

**Two of s6's leftovers, fixed (s7).**
- **Logic components offered as reusables.** The todo template's 19 Commands and 8 Logic components say `"visual"` in
  their component.json and draw nothing; the palette skipped only a registry type of `logic`, and the page picker's
  draw test (`reusableKeys`) took a Command for drawing because it holds a Write history copy, whose type said visual
  too. Now `componentDraws(key)` answers for both and for `isVisualType('/…')`: a component draws when it lists top
  elements or a top-level node draws, a copy of another component counting only if that one draws (a cycle draws
  nothing). So a Command copy placed on a page is logic in the tree and the Workflow tab, not an element.
- **A property with no name said raw.** The kit's spec labels some ports with their own name ("zIndex"), which Studio
  took as the label; the look menu and the Visual tab now say a camelCase name in words, and zIndex as "Layer
  (z-index)".
- Gate: `check:editor` 153/153 (2 new: the palette and the picker offer Task row and none of four Commands / Logic; no
  look-menu entry is camelCase and zIndex reads "Layer (z-index)"). Mutant (`reusableKeys` back to the registry type):
  152/153, the palette listing Write history, Add task, Move task… The copy-is-logic half on a page is not
  mutant-tested.
- **Left as it is:** a new rule's value starting as the property's value now. It is the choice a look makes too
  (`lookStart`: adding one changes nothing on screen until it is set), and the toast says "set what it becomes".

---

## M1 — The desktop app

**Why.** Local development is the pitch: your app is files on your disk, versioned in git, edited by you in Studio
and by Claude Code through MCP at the same time, deployed where you choose. Cloud builders cannot offer that, and it
is cheaper and more durable for everyone.

**Done (STU-001, 2026-10-19).** `npm start` opens an Electron window (the same Electron as the NodeGX editor, 43.2)
on a project folder; File → Open Project… picks another; the editor server listens on 127.0.0.1 only and runs on
Electron's own Node; `npm run smoke -- <dir>` opens a project headless and exits 0 once the app has drawn.

| id | task | done when |
|---|---|---|
| STU-002 | **Files changed outside Studio appear in Studio.** Watch the project folder; when a file changes that Studio did not write (Claude Code through MCP, VS Code, `git pull`), reload the project into the store and redraw, keeping the selection and the open tab. A change that conflicts with an unsaved Studio edit asks. | Claude Code adds a button through the NodeGX MCP server and it appears in Design within 2 s, without a manual reload; the gate does the same with a plain file write |
| STU-003 | **Welcome screen and recent projects.** Open, New from a template (NodeGX's templates), Import an app, and the last ten projects. | a first run with no argument shows it; reopening the app offers the last project |
| STU-004 | **The project's backend, from the app.** A project that names a local backend gets it started on open (`nodegx-backend serve` on that backend's own data folder, where NodeGX keeps it) and stopped on close; the status bar says where it is. | open the todo template copy, add a row in Data, quit, reopen: the row is there |
| STU-005 | **Work with Claude Code.** "Connect Claude Code" writes the project's `.mcp.json` entry for the NodeGX MCP server (the same writer the NodeGX editor uses, never a second one) and shows the one command to start a session in the folder. | from a fresh project, the button then `claude` in the folder lists the NodeGX tools |
| STU-006 | **Runs without a NodeGX checkout.** A build step copies the kit pieces Studio uses (deploy runtime, in-page preview, look and specs modules, backend, MCP server) into `vendor/` at pinned NodeGX versions; `lib/nodegx.mjs` prefers `vendor/`. | a fresh clone + `npm install` + `npm start` works on a machine with no OpenNoodl folder |
| STU-007 | **Packaged and signed.** electron-builder for macOS (signed, notarised), Windows and Linux, on NodeGX's release workflow. | a downloadable build opens a project on all three |
| STU-008 | **Publish.** File → **Publish…** writes the app as a static site with NodeGX's own deploy — `@nodegx/preview`'s `nodegx-deploy`, the `deployToFolder` the NodeGX editor's *Deploy to Folder* runs, with the production engine npm ships (1.7 MB; a checkout's development engine is refused) — to a folder the person picks, and deploys the app's cloud functions to its backend when it has any (NodeGX's `deploy_cloud_functions`). The window then says where the site is and which backend it talks to; an app bound to a backend on 127.0.0.1 works on this machine only, and says so before it is published. Where else a site and its backend can go is R10. A site under a sub-path waits on P123-STU015-BASEURL. The deploy must carry P123-S2-VARIANTLOST's fix: npm's 0.2.3 `nodegx-deploy` does (STU-006). | the todo template's copy published to a folder, served by any static server and opened in a browser: sign in, add a todo, and the row is on the backend |

**Done (STU-002, 2026-10-19).** `serve.mjs` watches the project folder and keeps every file as Studio last read or
wrote it, so Studio's own saves are recognised by their content and dropped; anything else goes to the page over
`/api/events` (server-sent events), which writes it into the kit's store and redraws, keeping the page, the
selection and the tab (a field being typed in keeps its caret and redraws on blur). Every save carries the text each
file had when Studio last saw it; if the disk says otherwise the server answers 409 and Studio asks **Keep mine /
Take theirs**. Saves go one at a time, so a quick second edit never trips over the first. Undo never takes back a
change made outside. A second Studio window on the same project hears the first one's saves the same way. Measured:
Claude Code's `update_component` through the NodeGX MCP server added a button to the todo template's Sign in page
and it was on Studio's screen and in the element tree **713 ms** after the file was written; the gate does the same
with an atomic rename (`check:editor` 46/46, 8 new checks).

**Done (STU-003, 2026-10-19).** With no folder named, the window opens on a welcome screen (`app/welcome.html`): the
last project first with **Reopen**, the other recent ones (up to ten, newest first, kept in the app's user data
folder as `recent-projects.json`; one moved or deleted is shown as *not found* with a ✕ to drop it), **Open a
project…**, **Import an app…**, and **Start from a template** — the five templates NodeGX publishes to its community
shelf, with the shelf's titles and summaries, copied from the checkout's `templates/` into a new folder the person
names (the project takes the folder's name; the editor-written `.mcp.json` / `CLAUDE.md` are not copied). File gets
**Welcome**, **Open Recent** and **Import an App…**. A destination that already holds files is refused before
anything is written: the importer starts by deleting its output folder, so this guard is what stands between a
mis-picked folder and its contents. An import runs the bundler when given a folder, then the converter, and names
the project after its folder too (the source app's id stays in `metadata.imported.appId`); the report and the guided
path are STU-040's. `app/check.mjs` drives the real Electron window over CDP with its dialogs answered by
`NODEGX_STUDIO_TEST_PICKS` and a recent list of its own (`NODEGX_STUDIO_USER_DATA`), and reads the files and the
list on disk: 23/23; with the progress message's guard removed it fails (a refusal used to be painted over by the
"Copying…" message that travels on another channel and lands after it). Stopping the app with Ctrl-C / SIGTERM now
takes its editor server with it. Not in it: a blank project (NodeGX's own blank, `hello-world`, is an object inside
the editor's code, not a folder), and templates come from the checkout until STU-006 vendors them.

**Done (STU-004, 2026-10-19).** Studio runs a project's backend with NodeGX's own backend code, not a copy of it:
`lib/backend.mjs` bundles the MCP server's `packages/noodl-mcp/src/backend/` from the checkout on every start
(esbuild, 0.2 s, into the ignored `.kit/`), so a backend Studio starts is the same kind, in the same place
(`~/.noodl/backends/<id>/`, or `NODEGX_BACKENDS_DIR`), under the same ownership rule (the project's id in the
backend's `projectIds`) as one the NodeGX editor or Claude Code starts, and each one sees the others' runtime record:
a backend that is already running is **adopted** and left running on close, never started twice on one database. On
open, `serve.mjs` reads `metadata.cloudservices`; a local backend is started with `--project-dir` (the project's
`nodegx.security.json` is the policy a new backend starts on) and `--parent-pid` (a killed Studio takes it with it),
and the server follows a binding that changes while it runs (Claude Code's `provision_backend`, a `git pull`). Quitting
or closing the project stops a backend Studio started, and the app waits for that before it quits or opens anything
else. The header says **Backend · 127.0.0.1:8584** (starting, adopted, a remote backend and a failure each say so);
clicking it opens Data. A new project from a template that needs a backend — NodeGX's own rule, read off the folder: a
security policy or a cloud function — gets one created, owned and bound at creation and started when it opens, as in
the NodeGX editor (`ensureTemplateBackend`). An app bound to nothing gets **Start a backend for this app** in Data
(NodeGX's provision, seeded with the declared types). Data now also lists the types the app's Record nodes use and
the ones the running backend holds — the todo template declares none, so before this its Data tab was empty — and
reads rows as the backend's admin (its own `secrets.json`, read by the server, never sent to the page), as the NodeGX
editor's Data Browser does: the todo template's policy refuses rows to anyone not signed in. Measured: the todo copy's
row added in Data is on the backend, still there after quit and reopen, and a visitor with no sign-in gets 403
(`check:app` 34/34, 11 new; `check:editor` 46/46). Not graded: the wait on quit — with it removed the gate still
passes, because the server and the backend stop well before Electron exits on this machine. Kit notes: the runtime
record's `owner.kind` has no value for Studio, so Studio's records say `noodl-mcp`; the bundled kit cannot find the
backend service from `.kit/`, so Studio sets `NODEGX_BACKEND_ENTRY` to the checkout's `nodegx-backend/dist/cli.js`
(that build is the checkout's, of 2026-10-12, older than some of its sources).

**Done (STU-005, 2026-10-19).** The header has a **Claude Code** button beside the backend (File → **Connect Claude
Code…** opens the same panel). On a folder with no `.mcp.json` it reads **Connect Claude Code**; pressing it writes the
three files the NodeGX editor writes when it opens a project — `.mcp.json` registering the NodeGX MCP server for this
folder as `nodegx-<folder>`, `CLAUDE.md`, `AGENTS.md`, and the `.mcp.json` line in `.gitignore` — and the panel then
shows the one command, `cd <folder> && claude`, with Copy. It is NodeGX's writer, not a second one: `lib/agent.mjs`
bundles the editor's front door (`main/src/mcp/mcpFrontDoor.js` — where the server bundle is, whether `node` runs it
or Electron as Node), `buildProjectRegistration` (`mcpCommands.ts`) and `backfillAgentConfig` (`agentConfig.ts`) from
the checkout on every start, as `lib/backend.mjs` does for the backend. Studio's own part is the filesystem under the
writer and reading a `.mcp.json` that is already there, because the writer keeps one and the panel must say what it
does: one registering NodeGX **for another folder** (a copied project — NodeGX's own test projects have them) is named
and left alone, with "delete it, then connect again"; one with only the person's own servers is left alone, with the
entry to add; in neither case is a `CLAUDE.md` written that claims a server is registered. Measured: from a fresh copy
of the todo template, the button, then in that folder `claude mcp get nodegx-my-todo` → *Project config (shared via
.mcp.json) · Pending approval (run `claude` to approve)* — Claude Code finds it and asks once, as `CLAUDE.md` says;
the gate starts the registered command itself and the server answers `tools/list` with its 21 tools on that project.
`check:editor` 56/56 (10 new); with the guard on "only a folder with no `.mcp.json`" removed, 2 fail; with Studio's
own writes not recorded as its own, 2 fail (`CLAUDE.md` comes back as an outside edit and redraws the app). Not in it:
the user profile (`NODEGX_USER_PREFERENCES`, the NodeGX editor's `PREFERENCES.md`) is not passed — Studio has no
profile of its own and does not reach into the editor's user data; Studio does not write the files on open as the
NodeGX editor does (`backfillProjectAgentConfig`), only on the button — the shared `CLAUDE.md` says they are written
"whenever the project is opened in NodeGX", which is the NodeGX editor's behaviour, not Studio's. One gate run of five
this session failed in Workflow ("Add a branch" picked the card's *Did Mount* event), not reproduced; noted, not chased.

**Done (STU-006, 2026-10-20, s13).** A fresh clone needs nothing but Node 22: `npm install`, `npm start`. The kit
comes from two pinned places (`lib/nodegx.mjs` says where each piece is): **npm** for what NodeGX publishes —
`@nodegx/preview` 0.2.3 (the deploy runtime, the in-page bundle) and `@nodegx/mcp` 0.2.2 (the MCP server and the
backend service), exact versions in `package.json` — and **`vendor/`** (committed, 883 files, 7.7 MB) for what it does not: the five shelf
templates and the phrasebook (`git archive` at the commit, so a peer's uncommitted template edit is never taken),
look.js and specs.js (as the Orbit `build.sh` bundles them), and `backend.cjs` / `agent.cjs`, the bundles
`lib/backend.mjs` and `lib/agent.mjs` used to make from the checkout on every start (so a clone needs no esbuild).
`npm run vendor` (with `NODEGX_REPO` set) rebuilds it from that checkout's HEAD and **refuses when any file a bundle
was built from differs from that commit** (esbuild's own list of its inputs, 229 files); `vendor/NODEGX.json` names
the commit (NodeGX `6cba197ad`), the npm versions beside it and every file's hash; `npm run check:vendor` (first in
`npm run check`) checks them and that every kit piece is there. `NODEGX_REPO=<checkout>` makes Studio and every gate
use the checkout's pieces as built there, as before; nothing looks for a sibling `OpenNoodl` any more. The MCP
server is named to the NodeGX editor's own front door through its escape hatch (`NOODL_MCP_ENTRY`), so Connect
Claude Code registers `node_modules/@nodegx/mcp/dist/noodl-mcp.cjs`.
- **Found: npm's `@nodegx/preview` 0.2.2 carried P123-S2-VARIANTLOST.** It was published on 2026-10-15, the fix
  landed on the 16th: on its in-page bundle `check:editor` was 169/170 (the Sign in button went from
  `rgb(138, 169, 242)` to black once it wore its style). For an hour Studio vendored that bundle too, built by
  `@nodegx/preview`'s own `build.mjs` in a sparse worktree of the commit (the code is in `scripts/vendor.mjs` at
  `320aa19`). Then **0.2.3 was published (2026-10-20 15:26)** with the fix in its in-page bundle and in its
  `nodegx-deploy` (`node.variantName || void 0`); Studio pins it and vendors no bundle of its own. Noted on the bug
  in NodeGX's ledger. `@nodegx/mcp` is still 0.2.2 on npm, so its `render_report` should still draw without Looks
  (read off the shared exporter, not measured); Studio does not use it.
- **Measured on the vendored kit** (first with the vendored bundle, again on preview 0.2.3; see the s13 prompt for
  the last numbers): vendor PASS, rules 20/20, phrases 85/85, dictionary 65/2/22/5, editor 170/170, timeline 43/43,
  app 34/34, pagedata 33/33, reusable 12/12, import 79/79 (its `validateSecurityConfig` check now
  runs from `vendor/backend.cjs`; it used to skip when the checkout's backend was not built). **The done-when:** a
  `git clone` into a scratch folder with no OpenNoodl beside it, every command run under `sandbox-exec` with reads of
  `~/vscode_projects/OpenNoodl` and `OpenNoodl-worktrees` denied (control: `head` of OpenNoodl's `package.json` in it
  → *Operation not permitted*): `npm install`; `npm run smoke` → *ready welcome · 5 templates*; smoke on a copy of
  the vendored todo template → *ready todo pages=2 visual=13*; `check:app` 34/34 (a template with its backend,
  reopen, an import); Connect Claude Code on a fresh copy → `.mcp.json` registers the clone's
  `node_modules/@nodegx/mcp`, and that server answers `tools/list` with 21 tools. Electron 43 has no install script:
  it downloads its binary the first time `require('electron')` runs (`npm start` does), so the first start needs the
  network. Inside `sandbox-exec` Chromium's own sandbox cannot start, so those runs set `ELECTRON_DISABLE_SANDBOX=1`;
  a normal start does not.
- **Gained:** npm's deploy engine is the production build (1.75 MB in 0.2.3); a checkout's is the development one, which
  `nodegx-deploy` refuses without `--allow-development-engine` — STU-008 starts from the right engine.
- **Not in it:** the runtime is npm's 0.2.3, packed before P112-OWN020-UNWIREDSIGNAL's fix (`3026899d4`): its
  marker (`codeSignals`) is in the checkout's build twice and in neither npm release, so a clone's Studio lacks it
  until NodeGX publishes again; the vendored pieces
  and npm's are from different days (both named in `NODEGX.json`). Measured on this Mac only, with the checkout hidden
  rather than absent; not on Windows or Linux. `check:editor` and `check:timeline` ran in the main clone on the same
  vendored files (same hashes), not in the scratch clone. STU-007 must put `node_modules/@nodegx/mcp` outside the
  asar archive (`extraResources`): Claude Code runs that file with an external `node`.

**STU-007, first cut (2026-10-20, s14): an ad-hoc macOS package, gated; signing and the other two systems not yet.**
`npm run package` (the unpacked app) and `npm run dist` (a DMG and a zip) run electron-builder 26.15.3, the version the
NodeGX editor builds with; the config is `build` in package.json.
- **No asar archive** (`asar: false`): Claude Code runs the bundled MCP server
  (`Contents/Resources/app/node_modules/@nodegx/mcp/dist/noodl-mcp.cjs`) with an outside `node`, which cannot read
  inside one, and the editor server, the importer, the deploy engine and the backend are all spawned from files.
  **No native rebuild** (`npmRebuild: false`): the only native code is `fsevents`, so the package is the exact tree that
  works in development.
- **Signed with NodeGX's own Developer ID (s14, after Richard asked *"Can you not use the same ones we use for NodeGX
  signing?"*):** the certificate, *Developer ID Application: Osborne Solutions (Y35J975HXR)*, is in this Mac's keychain.
  `CSC_NAME="Osborne Solutions (Y35J975HXR)" npm run dist:signed -- --dir` signs with it (hardened runtime,
  `codesign --verify --deep --strict` passes), and the desktop gate on that build is **46/46**. It is not notarised:
  the Apple ID, app-specific password and team id are repository secrets on NodeGX, which GitHub never gives back, and
  they are not on this machine. `package.yml` uses the same five secret names, gives them to the macOS job only, drops
  the empty ones as NodeGX's build does, and checks `spctl` says *Notarized Developer ID* when they are there. They
  must be set on this repository, or moved to the organisation and shared with it.
- **Signed ad hoc with the hardened runtime** and the NodeGX editor's entitlements (`build/entitlements.mac.plist`,
  plus library validation off, which an ad-hoc signature needs). `npm run dist:signed` drops the ad-hoc identity, so
  electron-builder takes a Developer ID from the keychain (or `CSC_LINK`) and notarises when `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` are set. **Not run: it needs Richard's Apple credentials.**
- **Measured (arm64, this Mac):** the DMG is 141 MB and the zip 143 MB (the app is 378 MB: 275 MB is Electron's framework,
  73 MB is `@nodegx/mcp` and `@nodegx/preview`). Copied out of the mounted DMG: `codesign --verify --deep --strict`
  passes, and `--smoke` reaches *ready welcome · 0 recent · 5 templates* and *ready todo pages=2 visual=13*.
  `NODEGX_STUDIO_BINARY=<the packaged binary> npm run check:app` runs the whole desktop gate on the package: **40/40**
  (39, plus the editor server's command line being the `.app`'s own `Contents/Resources/app/editor/serve.mjs`).
  Connect Claude Code through the package's own `lib/agent.mjs` writes a `.mcp.json` naming the `.app`'s MCP server,
  and that server, started as the registration says, answers `tools/list` with 21 tools.
- **Found: Gatekeeper rejects it once downloaded.** A copy carrying `com.apple.quarantine` (as a browser download
  does) gets `spctl -a -t exec` → *rejected*. A tester has to open it from System Settings → Privacy & Security →
  Open Anyway. A notarised build is what makes it open with a double-click. (The quarantined copy was assessed,
  not launched.)
- **`.github/workflows/package.yml`, green on all three (run 39446021051, 2026-10-20):** it builds on macOS 14, Windows
  and Ubuntu, opens each unpacked app with `--smoke` (the welcome screen, then a copy of the todo template; `xvfb-run`
  on Linux) and keeps the installers as artifacts; `workflow_dispatch` and `v*` tags. All three print *ready welcome ·
  0 recent · 5 templates* and *ready todo pages=2 visual=30*. That is Studio's first start on Windows and Linux, and
  it is a smoke, not the desktop gate. The first run (39445060768) failed three ways, all fixed: electron-builder
  tried to publish a GitHub release (`--publish never` now), and Windows' checkout turned `vendor/` into CRLF so
  `check:vendor` failed every file (`.gitattributes`: `vendor/** -text`). Not explained yet: the same smoke on this Mac
  reads *visual=13* for a fresh copy. The macOS job had no signing secrets, so it was ad hoc.
- **Not in it:** an Intel (x64) or universal macOS build; auto-update; NodeGX's release workflow (the scope says
  "on NodeGX's release workflow"; this repository has its own instead, since Studio is released from here).

**Done (STU-008, 2026-10-20, s14).** File → **Publish…** (enabled with a project open) and a **Publish** button at the
right of the header (the desktop app only: in a browser, `npm run serve`, there is no main process to ask) run one flow
in `app/main.cjs`, and `lib/publish.mjs` does the work:
- **The site is NodeGX's deploy.** `@nodegx/preview`'s engine (`dist/nodegx-deploy.cjs`, which its `nodegx-deploy`
  bin runs) under Electron-as-Node: `<project> <out>`, one JSON report. npm's engine is the production one (1,753,200
  bytes); the engine itself refuses a development one, so Studio adds no check of its own. The site carries the
  project's backend binding (`metadata.cloudservices`), so it talks to the backend Studio runs.
- **The folder is Studio's.** The engine writes over what is there and deletes nothing (measured: an old bundle and a
  stray file both survived a second deploy), and it deploys happily into the project's own folder, which the next
  publish would then copy as part of the app. So Publish refuses a folder inside the project or holding it, and any
  folder with files in it unless this project was published there: `.nodegx-publish.json` beside the site names the
  project id and every file that publish wrote, and a republish deletes exactly those (never a path outside the site,
  whatever the marker says) before the new deploy. A file the person put there (a `CNAME`) stays. The last folder
  per project is kept in the user data folder (`published-sites.json`), and the next Publish offers it first.
- **Before anything is written**, an app whose backend is on 127.0.0.1 is said to work on this computer only, and
  only while its backend runs (R10 is where else it can go). **After**, the window says how many files went where,
  which backend the site talks to, and what happened to the cloud functions, with a button to show the folder.
- **Cloud functions** go to the backend through the NodeGX MCP server's own `deploy_cloud_functions`, one stdio call
  (`initialize`, `tools/call`) to `node_modules/@nodegx/mcp`'s server bound to the project: the bundle is built and
  pushed by the code the editor's Deploy button runs. The server writes nothing into the project (measured). A
  backend that is not on this machine is said, not attempted.
- **Found: the engine also publishes the backend's own files** — `nodegx.security.json` (the whole access policy,
  which the runtime never reads) on every app with a backend, and `backend/` (the importer's
  `triggers.imported.json`; a template's seed and fixtures). Filed in NodeGX as **P123-STU008-BACKENDPUBLIC**
  (the fix is two default ignore rules; `digital-bricks-training` has its own `.noodlignore` for it since L183).
  Until it is fixed and published, Publish names those files to the person and says a `.noodlignore` keeps them
  out; it does not delete them behind the engine.
- **The done-when, measured** (`npm run check:publish`, 27/27, plain Node and headless Chrome): the todo template's
  copy, its backend started, published; the folder served by a plain `http` file server (nothing NodeGX in it) and
  opened in a browser: the sign-in page; *Create account*; *Buy bread* added; the backend holds one `Task`,
  *Buy bread*; *Sign out*, reload, *Sign in*: the todo is read back. A republish replaces only the last publish's
  files; another app into that folder is refused. The importer's backend-workflow fixtures: four functions
  deployed, a second publish finds all four `unchanged`, and one called over HTTP answers from its own Request node
  (*Unauthenticated requests not accepted*, 500) where an unknown name gets 404. `check:app` 39/39 clicks Publish in
  the real window (with its dialogs answered by the gate) and reads the site, the warning, and the remembered folder.
- **Not in it:** a site under a sub-path (P123-STU015-BASEURL); ~~Publish saying that a path-routed app's deep link
  needs the host's `index.html` fallback~~ (s18, below); hosting anywhere but this machine (R10); Windows and Linux not run.
- **s18 (2026-10-23): a page's own address.** `settings.navigationPathType` is `"path"` in every NodeGX template and in
  every app the importer writes, so a page has an address of its own (`/sign-in`), which reaches the server; unset or
  `"hash"` keeps it after a `#`, which never does. For a path-routed app the publish window now says: *"Its pages have
  addresses of their own (such as /sign-in). Opening the site’s first address works on any web server; for a link to a
  page, or a reload on one, the server must answer every address it has no file for with index.html. Most hosts have a
  setting for that (often called a single-page app’s fallback or rewrite)."* (`routingOf` in `lib/publish.mjs`; the
  example is the first Page with a `urlPath`). The deploy's `index.html` loads its scripts from `%baseUrl%`, the root,
  so the fallback is all a deep link needs. Measured, `check:publish` **34/34**: the plain static server answers
  `/sign-in` with 404; one that answers other addresses with `index.html` opens the sign-in page there; a project
  without the setting reads as hash. `check:app` **46/46** reads the line in the real window's report.

Order: STU-002 first (it is what makes "local" feel alive, and STU-005 depends on it), then STU-003–005, then
STU-006–007 when someone outside the team needs to run it, and STU-008 so that what they build can leave the machine.

---

## M2 — Page data: the end of "Do a search for" everywhere

**The problem.** In Bubble a search is an expression, so it can be written inside any field of any element, and
beginners write it in every one. Bubble quietly merges identical searches at run time, which hides the cost and so
the habit is never unlearned. Experienced Bubblers do one search on page load and park it on an "anchor" element's
custom state, which means a pile of page-load workflows doing nothing but filling states. Noodl let the app slow
down until you noticed, which taught the right shape (one query at page level, elements read its result) the hard
way.

**The idea.** A search can only exist as **named page data**. Nowhere else.

- A page (and a reusable) has a **Data** section of named items:
  `org = first Org where Creator is Current User, sorted by Created, newest first`.
  Elements read `org's name`, `org's logo`. One item is one query, however many elements read it.
- The expression composer's **"Do a search for…"** no longer builds a search inside the field. It lists the page's
  data items and offers **"+ New page data…"**; if an identical item already exists, it picks that one instead of
  making a second.
- Page data **loads when the page opens and re-runs when what it depends on changes** (Current User, a dropdown's
  value, another item). That replaces the page-load workflows whose only job was to fill custom states. A workflow
  can still refresh an item explicitly.
- Each item shows **how many elements read it, when it last ran, how long it took and how many rows it returned**,
  and the page header says **"this page runs N queries on open"**. The cost Noodl made you feel is a number you
  can see.

**In NodeGX.** One page data item is one Query Records node at the page's root, its result wired to every element
that reads it, which is exactly what an experienced Noodl builder makes by hand; Studio makes it for you and draws
it as a named item rather than a node. Measured 2026-10-19: Query Records already re-runs on its own when its
collection, filter or search changes (the NDA-017 rewrite), and patches its rows live from the store's
create/save/delete notifications, so "re-runs when its inputs change" needs no runtime work. A single-record item
("first Org where…") is a Query Records with limit 1 and its first item.

| id | task | done when |
|---|---|---|
| STU-010 | **Page data model.** Define where items live (page/reusable root, `metadata.pageData` naming the Query Records node), what an item is (collection, constraints, sort, first-item or list), and how an element reads one (a wire from the item's output, named in the composer as a chip). | ruling R7 taken; the format writes and reads an item round-trip |
| STU-011 | **The Data section** in Design's left column: the page's items, add / edit / delete, reader count and last-run numbers. | an item made there shows on screen through two text elements, and the page header reads "1 query on open" |
| STU-012 | **The composer** offers page data instead of an inline search, reuses an identical item, and creates one through "+ New page data…". | there is no path in the editor that writes a second identical query on a page |
| STU-013 | **The importer merges repeated searches** into page data items: identical searches on a page become one item; elements and steps read it. | the real app's pages convert with 70 queries instead of 153 and still render the same |
| STU-014 | **A reusable's own data** (R8: pages and reusables, not rows or popups). A reusable's item asks while that copy is shown, never because the page opened; a copy's shown / hidden reaches its reusable. | ruling R8 taken; four copies, two hidden: two queries on open, each hidden copy asks once when shown |
| STU-015 | **Open a reusable** in Design as Bubble does: its own canvas, its elements, and its Data section, where a new item asks while shown. | an item made on a reusable is written in the STU-014 form, and two copies on a page each ask once |

**Done (STU-010, 2026-10-19; R7 ruled the same day).** `editor/pagedata.mjs` is the format, pure, nodes and wires in and
items or edits out. An item is one Query Records node (`DbCollection2`) in the page's own component, inside no element,
with `metadata.pageData = { name, first }`; the NodeGX editor, the MCP server and the runtime read it as the ordinary
node it is. What it asks is `collectionName`, `visualFilter` in the shape the NodeGX editor writes (`{type, conditions}`,
neutral operators), `visualSort` and a limit. A condition's value is typed (`valueSource: 'static'`) or comes from the
page (`'connected'`, a wire into `qp-<field>`). Studio writes `runOnChange-…: true` for every input it uses: the NodeGX
editor's migration (NDA-017, SBR-016) writes `false` into a node whose `Do` is wired, and a workflow may wire `Do`. A
"first" item is the same query with a limit of 1, plus one Object node (`Model2`, `metadata.pageDataRecord`) bound to
`firstItemId`; an element reads "org's name" from its `prop-name`, and the record node learns each field as it is
read. A list item is read whole (`items`, `count`, `isEmpty`). Readers are counted off the wires (a composed Expression
counts as the element it feeds), and two items asking the same thing are found by `signature` whatever the order of
their conditions. `check:pagedata` 26/26: a list item, a first item with a page value, readers, twins, an update
(renamed, list ↔ first, a condition dropped) and a removal, each written, saved and read back from disk; then
`validate_project` says nothing about the items' nodes and nothing new about the page. It cannot grade the value
wires: Query Records takes any wired input name (the runtime keeps an unknown one as a setting), so a wire to
`qp-nope` validates clean (measured). That is why the round-trip asserts them, and `check:editor` runs the app.

**Done (STU-011, 2026-10-19).** Design's left column has **Page data** above the element tree: one row per item with
its name, how many elements read it, what it asks as a sentence ("first Note where title is set, by title"), and its
last run in the app on screen ("1 row · 5 ms · 0.2 s after the app opened"). Clicking a row opens the item on the right:
type, every match or the first one, conditions (a field, an operator, a typed value or ⚡ a value from the page),
sort, a limit, its readers (click one to select it) and its last run. A field's **⚡ (take this value from)** lists the page
data first ("latest note's title", "notes · count"), and its chip is green. The header beside the page name reads
**"N queries on open"**. Both numbers are counted off **the requests the app made**, never off the nodes: `serve.mjs`
puts `editor/probe.js` first in the frame's runtime page (in the frame only, never the deployed app), and it logs
every backend request with its body, timing and row count, and every move between pages. "On open" is from the
app's arrival at the page until the network has been quiet for a second. An item's last run is the newest logged
query with its collection, order, limit and filter fields. Measured in `check:editor` (71/71, 15 new): on the Sign in
page, "0 queries on open" before; an item made through the panel is one Query Records node on disk; two Texts wired
to "latest note's title" both show "Buy milk"; the header reads "1 query on open"; the row says 2 readers and 1 row.

**Done (STU-012, 2026-10-19).** No path in the editor writes a second identical query on a page:
- **New page data**, from the left column and from a field's **⚡ → New page data…** (Bubble's "Do a
  search for…", in the composer too), is one form: name, type, every / first, one optional condition. When an item
  already asks that, it says so as you type ("notes already asks this … Create uses it") and the button reads **Use
  notes**: the field reads that item, and no node is written.
- An edit that would make an item ask exactly what another asks is refused with the other's name.
- The Workflow tab's "Fetch records (query)" is gone, and so is Query Records from "Every other node". In their place,
  **Refresh page data** wires the step's signal into an existing item's `Do`. A refresh ends its chain: a step after
  it would hang on the item's `fetched`, which fires on every run of the item, page open included. Deleting the
  step removes the wire, never the item.
`check:editor`: a different question is a second item; the same one from a button's field reuses it (2 queries, the
label wired from `notes.items`); a condition makes a third; removing that condition is refused and the file keeps it;
the action list has Refresh and no query; Refresh → notes is one wire. With the form's and the edit's twin checks
both removed, 4 of those lines fail.

**Done (STU-013, 2026-10-19).** The importer writes every *Do a search for* on a page, in a row or in a reusable as a
page data item in the R7 format, through `queryParameters` from `editor/pagedata.mjs`, so it is the node Studio's own
form writes: `{type, conditions}` with the neutral operators, `visualSort`, `runOnChange-…: true`,
`metadata.pageData = { name, first: false }`. The same search again in that component reads the item already there.
"The same" is what Bubble wrote, byte for byte, plus where a value read off the element comes from: *This element* is
that element, *Parent group's thing* is the nearest group holding data (or the row), a workflow's parameter is that
workflow. Nothing wires an item's Do any more: it runs when the page opens and again when a value it reads changes.
A search inside a backend workflow stays an ordinary query in the function, not page data.

The operators changed with the format, and that fixed a silent drop: the old shape (`{combinator, rules}`) only knows
the English names in `VISUAL_OPERATORS`, and the importer wrote `contains`, `does not contain` and `exists`, which are
not among them (`contain` is), so the runtime dropped those conditions and the search asked for everything (25 of the
real app's 256 searches had one). `is_empty` was written as "exists"; `is_not_empty` was not mapped at all. Now a text
field's "contains" is `containsIgnoreCase`, a list field's is `equalTo` (the Parse wire's array membership), "is in"
is `containedIn` over the other list's ids, and empty / not empty are `exists` false / true.

Measured on the real app (17 pages, 3,933 elements): queries **236 → 111**; on the pages and their rows **137 → 60**.
The export holds 153 searches on pages, 70 distinct within their page; 19 sit in a conditional's data source, which the
importer reports and does not convert, so 137 is what it reached. `validate_project`: 2 errors before, **0** after,
warnings unchanged at 5,328. The 2 were older defects that made the preview refuse the whole app, fixed on the way:
STU-013-GROUPCOLOR (a Text with a background is a Group around a Text, and a conditional font colour was wired to the
Group: it goes to the Text now) and STU-013-CLOUDRESULT ("Result of step" after *Schedule API workflow* read `result`,
which a Cloud Function node does not have; it reads as empty now, with a finding). Rendered
in `preview-solo` with no backend: index, the page with the most searches (90 queries before, 37 now), draws the same
260 elements and three byte-identical 1440×900 screenshots (before, before again, after). The other pages could not be
compared, which is the next finding: **STU-013-NAVLOOP** (found, not fixed) — the converted app pushes
`/user_dashboard` and `/trybeup` (index, named after its title) by turns, about 8 times a second from its first 100 ms,
before and after alike (156–173 pushes in 20 s; counted by wrapping the frame's `history.pushState`), so every path
lands back on index, and with every query failing for want of a backend the page's main thread is saturated
(`render_report` never answered on it). Six "Go to page user_dashboard" steps on index are the candidates; which one
loops, and why "Only when" does not stop it, is the next session's question.
`check:import` 38/38 (12 new): six searches on a page are three items that `readItems` reads back, three Texts read
the one item, a value from the page is one wire into `qp-owner`, nothing wires `fetch`, a "Parent group's thing"
search is one item per group (not per Text), and a boxed Text's conditional colour lands on its Text. With the merge
off, 5 of them fail; keyed on the element instead of the group, 3; with no key for the group at all, 3; with the colour
going to the Group, 1.

Not settled, for STU-014: a condition whose page value is empty is **dropped** by the runtime, not left unmatched
(`dropUnresolvedConnected`, "every graph relies on it", read in `queryutils.ts`, not measured here). So "first Org
where creator is Current User" before anyone signs in asks for every Org the backend lets that visitor see. An item
that depends on a value may need to wait for it. Two smaller things the gate found and fixed on the way: the Workflow
section read a branch's file 300 ms after drawing it and sometimes before the save landed (it now waits for the
file); the right panel's header CSS never matched the header (`.props .head`, but the header sits beside `.props`).

**Fixed (STU-013-NAVLOOP, 2026-10-19).** Neither "Go to page user_dashboard" step was the loop. Reading the runtime's
own trace at each `pushState` named the node: a **click** workflow on each page, "Only when Current User is logged
out → Go to page index", fired with no click as the page opened, on index and on user_dashboard alike. NodeGX re-tests
a Condition whenever its value changes, Evaluate wired or not (NDA-017 made that the default: wiring Evaluate *adds* a
trigger and never stops the old one), so `!(userId)` arriving as `true` ran the step. The importer wrote 392 such
Conditions on the real app; it now writes `runOnChange-condition: false` on every one (a workflow's Only when, a
step's Only when, a Do when). Studio's own Workflow tab had the same trap: **Add a branch** now writes the switch off,
and wiring a value into a step (the composer, "⤷ from…", a page data field) unticks that input's switch whenever the
node has one and its trigger is wired — a Run JavaScript step's inputs too, whose switches the runtime makes from the
script. Measured on the real app, same probe both times: before, 12 pushes in the first 2.2 s; after, **0 in 15 s**,
and Blog, FAQs and Terms each open and stay where they land. user_dashboard opens and goes back to index once, as in
the original: its Page is loaded sends a signed-out visitor home. The pre-fix app cannot even be driven to try (the
probe's time limit expires; the page is saturated). `check:editor` 74/74: the gate's branch now hangs off the card's
*Click*, the app's trace shows its value arriving at open with neither Yes nor No running, then a click in the app
runs No; with the branch's switch and `stepOnly` both removed, No runs at open and 2 checks fail. `check:import`
41/41: three gated workflows convert to four Conditions (a Do when also gets an Only when from the same condition,
redundant and harmless), each run by Evaluate and none on a change; without the switch, 1 fails.


**Done (STU-014, 2026-10-19; R8 ruled the same day).** Measured first, on four copies of one reusable holding a query (two
shown, one hidden itself, one inside a hidden group): **all four asked as the page opened**. NodeGX runs a hidden
component's logic all the same, so Richard's reason for the ruling needed building, not just allowing. And the copy
hidden "itself" was drawn anyway: a component instance takes only the inputs its Component Inputs node declares, so
`mounted: false` on a copy reached nothing (STU-014-INSTANCEHIDE). On the real app that was 27 copies whose visibility
was wired (popups among them, so a Show popup step did nothing) plus 89 copies the validator already called interfaceless.

- **The format** (`editor/pagedata.mjs`): a reusable's item carries `metadata.pageData.whenShown`. Its query has every
  run-on-change box off, so it never runs by itself, and two helpers decide when it asks: a Switch
  (`metadata.pageDataShown`) turned on by the reusable's top element's **Did Mount** and off by its **Will Unmount**,
  and an Expression (`metadata.pageDataAsk`, `shown === true && [v_<value>…].length > 0`) reading that switch and each
  of the item's page values, whose On True Event is the query's Do. So it asks once each time the copy is shown, again
  when a value changes while shown, and a value that changes while hidden waits for the next show. `createEdits(item,
  { root })` writes it, `readItems` reads it back (`whenShown`, `shownId`, `askId`), `updateEdits` keeps the ask
  reading the same values as the query, `removeEdits` takes the helpers with the item. Studio hides both helpers (no
  phantom "When Panel: Did Mount" workflow, no "Refresh" step).
- **The importer**: a search inside a reusable is written that way; one on a page is an ordinary page data item.
  Every reusable gets a Component Inputs node (`copy_<id>`, "From the copy") whose `mounted` and `visible` drive its
  top element, plus every other port some page wires into a copy (a conditional width or margin, a "scroll to"): the
  validator had never seen those wires, because a component with no declared inputs is not checked, and turned up 7
  of them once the inputs existed. What a copy *sets* without a wire (its own size and margins) still reaches nothing:
  **STU-014-INSTANCELAYOUT** (open, 445 `instance-unknown-parameter` warnings on the real app — applying them would
  change the look of 122 copies, which wants a look first).
- **STU-014-VISDEFAULT** (found here, fixed): Bubble's conditional is "the condition's value while it holds, else the
  element's own". The importer wrote every visibility condition as "shown when X" or "shown when not X", so "hidden when
  X" on an element already hidden on load came out as "shown when not X": the real app's home page drew the booking
  request and listing details sections (and a hidden copy of the sign-up form inside one, which the reusable's own
  hidden setting had been masking until copies could be shown). A condition that restates the default is now skipped:
  44 of the real app's 498.

Measured on the real app's index with a backend, same probe (Studio's `probe.js` injected into every frame): queries on
open **58 → 37** (Listing 18 → 9, User 13 → 7, Legal 4 → 1), elements drawn 243 → 142, and the visible text is the home
page alone. `validate_project`: 0 errors before and after; warnings change in two codes only, `interfaceless-instance`
89 → 0 and `instance-unknown-parameter` 0 → 445. Gates: `check:editor` 77/77 runs the four copies in the app against a
backend — the shown two ask at open, a value change on a shown copy asks again and on a hidden one waits, each hidden
copy asks once when shown with its current value; with the query's own run-on-change left on, the hidden copies ask
at open and the shown ones twice (2 fail). `check:pagedata` 33/33 round-trips a reusable's item on the todo template's
Money bar (written, read back, a value added, removed back to the nodes it started with, the validator silent).
`check:import` 50/50: four mutants (searches asking on open, no copy inputs, no default rule, no wired ports) fail
2, 1, 1 and 2 checks.

Not done here: rows (R8 gives them no data of their own, yet the importer still writes a search inside a row as an
item in the row's component, 6 on the real app, each row asking); an item that depends on another item; and Studio
cannot open a reusable yet (STU-015), so a reusable's items come from the importer, MCP or by hand for now. Still
not settled from STU-013: a condition whose page value is empty is dropped by the runtime.

**Done (STU-015, 2026-10-19, s3).** A reusable opens on its own, as Bubble opens one: from the page picker (pages
first, then a "Reusable elements" group: every component a page can place that draws something), by double-clicking a
copy's row in the element list or its ⤢, or from a copy's panel (**Edit <name>** — "every copy changes with it").
Design then edits the reusable's own graph; the list says "Elements in this reusable", the Data section "Data". The
app on screen is the project plus one page Studio adds in memory, `__studio/Reusable canvas` at `/__studio-reusable`,
holding a single copy (given `mounted`/`visible` true when the reusable declares them, as imported ones do). That page
is only in what the preview is given (`previewFiles()`): never in the project folder, never in its router file. New data
made on a reusable is written in STU-014's form (`createEdits(…, { root })`), so each copy asks while it is shown; the
query count reads "N queries when shown".

- **STU-015-PAGENAV (found here, fixed):** Studio's page picker never really changed pages. It navigated by path, and
  the runtime cuts its base URL ("/runtime/", 9 characters) off every path it reads but never adds it to one it writes:
  "/sign-in" read as "" and every page but the start page landed on the start page (the todo app's own redirect hid
  it). The runtime half is filed in NodeGX's ledger as **P123-STU015-BASEURL** (a deploy in a sub-folder should have the
  same fault; read, not measured).
- **The fix, after three that were not enough:** Studio no longer navigates the app at all. What the preview is given
  (`previewFiles()`) makes every router that lists the page Studio shows *start* there (the canvas, while a reusable is
  open), so the app opens on it; switching pages is a rebuild. Studio then only follows the app's own redirect (Todo
  sends a visitor to Sign in), once the Router's current page has not changed for 400 ms (at most 3 s), read off the
  Router and never the address bar. What did not hold, measured on the gate: navigating by component at once raced the
  app's own redirect and all four of STU-014's copies asked at open (3 runs of 3; navigating to the page already shown,
  once or twice, made no copy ask — not the cause); settling 350 ms first fixed that but followed a redirect still in
  flight to the wrong page under load and dropped the open page data item (3 runs, three different page data steps;
  the state dump on the gate's failure showed Design had switched to Todo); following only once the app had reached the
  asked page missed a page that redirects at once. With the start page: `check:editor` 105/105 twice in a row. A bonus:
  the app no longer draws the start page first, so a page's "N queries on open" are its own.

Gate (`check:editor`): the picker lists the reusables; opened, the list is the reusable's own two elements and the app
shows one copy alone on Studio's canvas page (the Router's current page; queries counted "when shown"); the canvas is in neither the project folder nor its router; a click in the
canvas selects the element; New data there is written into the reusable in STU-014's form (read back with `readItems`:
`whenShown`, its switch and its ask), not into a page; the canvas's copy asks it once, and back on Sign in the two shown
copies ask it once each and the two hidden ones not at all. One gate flake of the same shape as the branch one fixed:
"Set a custom state" read the file 500 ms after the click (failed 1 run) and now waits for it.
- **STU-015-IMPORTED (found by the pictures for Richard, fixed):** the picker's "Reusable elements" missed every
  reusable the importer wrote (it writes no `visualRoots`), Richard's Bubble reusables and the grouping's alike. It now
  counts a top-level element as Design does (cached per component file). The gate's test reusable is written the
  importer's way; with the old filter as a mutant the gate fails 5 checks (100/105). Not yet run green after the fix:
  at the time the machine's load average was 64–88 (three video encodes and another session), and under that load the
  committed code fails the same three gate checks as the fix (control): two steps that read the file 500 ms after a
  click, and the clash test, which races an outside write against an edit by design. Re-run when the machine is quiet.
---

## M3 — Workflows that live on their element

**The problem.** Bubble's Workflow tab is a flat list of triggers: "When Button A is clicked", "When Button B is
clicked"… hundreds of rows named after elements. One element's click is often split into two or more workflows
("Only when logged in", "Only when logged out") that sit in different places in the list. Experienced builders
hand-label everything; beginners find a workflow by finding the element in Design and clicking "Edit workflow", which
makes the tab a detour. Noodl's answer, logic nodes beside the visual nodes on one canvas, keeps them together but
gets crowded. Bubble's real strength is seeing one workflow alone, full screen.

**The idea.** One **card** per element event, reached from the element, viewed full screen; no master list.

- **One card per event.** "Button A — Click" holds every condition inside it as branches (the Yes/No branch that
  already exists). There is never a second card for the same event.
- **Design shows behaviour.** An element with workflows wears a small ⚡ badge; hovering it shows a one-line summary
  ("Create Org → Go to dashboard"); clicking it opens the card full screen. Back returns to the element.
- **The element tree is the index.** "All workflows" is the element tree filtered to elements that have events, plus
  the page's own triggers (page open, data changed, a timer). Filters ask the useful question: *everything that
  changes Org*, *everything that navigates*, *everything that runs on page open*.
- **A card is named by what it does**, from its steps, unless someone names it. Nobody labels 300 workflows by hand.

**In NodeGX.** An element event is a signal output; a card is the chain of nodes that signal reaches (the Workflow
tab already reads it that way). A badge is "this visual node has a wired signal output". Nothing new in the format.

| id | task | done when |
|---|---|---|
| STU-020 | **Badges and hover summaries** on Design. | every element with a wired event wears one; the summary names the steps in order |
| STU-021 | **The full-screen card**, opened from a badge, from the tree, or from search; Back returns to the element. | the editor gate opens a card from a badge and returns |
| STU-022 | **The tree as the index**, with the filters (by effect, by trigger kind) and a search over step names and targets. | "changes Org" lists exactly the cards with a step writing Org |
| STU-023 | **Names from steps.** | a card with no name reads its steps; a renamed card keeps its name |
| STU-024 | **The importer merges split workflows** into one card per event. Where the conditions are exact opposites (A / not A) they become one Yes/No branch. Where they overlap and both can run, they stay as **two lanes that run side by side**, because folding them into either/or would change what the app does. | the real app's 16 split elements become 16 cards; a fixture with overlapping conditions keeps both lanes and both still run |
| STU-025 | **Rejoin** (open ruling R4): after a branch, may both sides continue into one shared next step? | ruling R4 taken and built or closed |

**Done (STU-020 and STU-021, 2026-10-19, s8).** An element with a workflow wears a **⚡** in Design: on the canvas, in
its top right corner (Design mode only, not while using the app), and on its row of the element list (a row that folds
wrappers into it wears theirs too). A number beside the ⚡ is how many events, when more than one. Hovering it names
each event's steps in order, one line per event: *"Click: Sign in (+1 more) → Go to the list"* (a step's own name when
it has one, else what it does: "Go to Home", "Set signInCard.state", "Refresh tasks"; a branch reads
"If … : Yes → …; No → …"; "+1 more" is a second step wired from the same signal, as the card says). Clicking it opens
that event's card **alone, full screen**, with no list beside it (an element with several events asks which first); the
Interaction tab's workflow rows open the same way. **← <element>** (or Esc) returns to Design with the element selected
and scrolled into view; "All workflows on this page" and the Workflow rail button show the list as before.

- **What counts as a workflow:** an event that reaches a step. On the todo template's Sign in page five elements wear
  one: the page (Did Mount), the card (the gate's own branch), Password (its Enter signs in), Sign in, Create account.
  Email wears none, but not because of that rule: its Text Changed is a value output (type `*`), never an event. The
  rule only bites on a signal wired solely into values, which this page has none of, so it is **not mutant-tested**
  (with it removed the gate still passes).
- **Found and fixed here:** a draft event (New in the Workflow list, before its first step) outlived its page: it is
  only cleared when the event is *not* wired yet, so once wired it stayed in the list for good, and on another page
  or a reusable its element is not there. Reading it there threw (the reusable canvas drew an empty list, 4 gate
  checks); the Workflow list on another page would have thrown the same way. A draft now only counts on the
  component that holds its element.

Gate (`check:editor`): the elements that should wear one are read off the files and the runtime's own node library
(a drawn element with a wire into another node's signal input), not off Studio's reading of events, and the canvas's
badges are exactly that set; the list wears it on Sign in and Create account and not on App name or Email; the hover
names the Sign in click's steps in the order its card draws them; a real click on the canvas ⚡ opens the card full
screen (the list 0 px wide) and Back selects the button again; the ⚡ on the Create account row opens its card and Esc
returns. `check:editor` 159/159 (153 + 6). Mutant (the summary's steps reversed): 158/159, the hover check fails.

**Done (STU-023, 2026-10-20, s9).** A card is **named by what it does**: its top-level steps in a few words, joined by
→ (*"Sign in → Go to the list"*); a branch reads as its test ("If …", or "Branch" when its Condition has no label);
past three steps, the first two, "…", the last; a card with no steps yet says *"No steps yet"*. **Rename** (or a
double-click on the name) names it; Enter keeps it, Esc leaves it; an emptied name gives the card back to its steps.
The name leads wherever a card is listed: the card's head, the Workflow list, the Interaction tab, the ⚡ menu (and
the hover, before the steps); the event (*"When Sign in: Click · Button"*) is the line under it.

- **Where the name lives:** on the element the event starts at, `metadata.cardNames` by port
  (`{ "onClick": "Check the card" }`). It follows the element through a rename, is undone like any edit, needs no
  new format, and the runtime never reads it. A step can be deleted or moved without touching it.
- **Not built:** the importer names no card. Bubble's run-mode bundle carries no workflow name (0 of the template's
  14 workflows; `event_color` on one); if Richard's paid export does, it goes into `cardNames`.
- **Seen, not fixed:** a branch made in Studio has no label, so a card whose first step is one reads "Branch"; the
  composed condition (*"If 1 > 2"*) would say more.

Gate (`check:editor`): a new workflow with no steps reads "No steps yet", its event under it; Rename → "Check the
card" is in the head, the list row and on disk on the element; after a branch and two steps it is still the name;
emptied, it reads "Branch" again and leaves the file; the Sign in click, never named, reads "Sign in → Go to the
list", its card's own steps. `check:editor` 164/164 (159 + 5). Mutant (the given name ignored): 162/164, both rename
checks fail.

**Done (STU-022, 2026-10-20, s9).** Workflow's list is the page's **index**: every card under its element, the
elements in the order the element list draws them (logic after), each card by its name with its event under it
(*"When Click · 2 step(s)"*). Above it, a search over **step names and what they change** and two filters:

- **What it does:** *Goes to a page*, *Signs in, up or out*, *Changes <data type>*, *Changes <state or variable>*,
  *Runs <backend function>*, *Refreshes <page data>*, each with how many cards do it, only those the page has.
- **What starts it:** *When the page opens* (the page's Did Mount), *When an element appears*, *On a click*, *On
  typing, Enter or a change*, *A reusable's own event*, *From logic*, *Other events*.
- The heading says *"11 of 62 workflows"* while a filter or search is on; nothing left offers *Show them all*.
- **What a card does** is everything its signal reaches: its steps, both sides of a branch, a second wire from the
  same signal, what a step's own signals go on to (a refresh ends it, as on the card). **A copy of a component
  does what the nodes inside it do**, its own copies too: on the todo template every record write is inside a
  Command, so "Changes Task" reads Add task → Write history → its writes. This over-counts on purpose: a write
  inside the component counts whichever of its inputs the card fires.
- **Not read:** a write made in JavaScript (a Function node's own `fetch`) changes nothing as far as the filter
  knows. ~~Port names a component gives without words show as they are ("When pickList")~~: spelled out since s18
  ("When Pick list"), the words the node library's own ports already got (`portWords`).

Gate (`check:editor`, on the todo template's Todo page, 62 cards): "Changes Task" lists exactly the 15 cards whose
signal reaches a Task write, and "Changes todoSelected" exactly the 11 that set it, both read off the files and
the runtime's own node library (a copy's signal inputs off its Component Inputs), not off Studio; the heading says
"11 of 62 workflows"; a search for "Go to sign in" lists the one card that reaches it; 18 element headers, each
once, in the page's order. The page sends a signed-out visitor to Sign in and Design follows the app, so the gate
cuts that one wire from outside Studio for the section and puts it back. `check:editor` 169/169 (164 + 5).
Mutant (a copy counts nothing inside it): 168/169, "Changes Task" fails.

**Done (STU-024, 2026-10-20, s9), on a fixture: the real app's 16 split elements wait for its export.** One card per
event, from both ends:

- **The importer** merges *"Only when A"* and *"Only when not A"* on the same event into **one branch**: one
  Condition labelled *"A?"* (Studio reads it as "If A"), the first workflow's steps on Yes, the second's on No.
  Opposite means the compiled conditions are exactly `X` and `!(X)` (or `E` and `!E`); found on the way, *not
  logged in* read the user's `id` while *logged in* read `authenticated`, so the commonest pair never compared —
  it now reads `authenticated` too. Every other pair stays as it was: **two wires from the same signal**, which the
  runtime runs both of, as Bubble did (one with no condition, the same condition twice, conditions that overlap).
- **Studio** draws an event wired to more than one first step as **lanes side by side** ("Sign in's Click runs these
  2 side by side: each one runs, in no set order"), each lane its own chain with its own Add an action, numbered
  A1, A2 … B1; where the step said "+ 1 more wired from the same signal" the second lane was hidden. The todo
  template's Sign in click is such a card: Log In → Go to the list, and beside it the branch that puts the old
  error away. A branch shows its own name when it has one. Inside a lane, Yes and No stack.
- ~~A card's name and hover still read the first lane~~ (s18): named from every lane (*"Sign in → Go to the list, and
  Put the old error away"*; three or more: the first, "and 2 more side by side"), and the hover says each lane on a
  line of its own ("Lane 1: …", "Lane 2: …", as the card heads them). A branch's label reads as its test only when it
  asks ("Signed in?" → "If Signed in"); any other is its name as written, so the importer's "Only when …" no longer
  reads "If Only when …", and a branch with no label fixed at Yes or No reads "Always No". **Not built:** R4
  (rejoin, STU-025) is untouched. More than two opposite-looking workflows: the first opposite pair merges, the
  rest stay lanes.
- ~~Seen, not fixed: a constant-`false` Condition's card says "Set the condition…"~~ (s18): a Condition saved as a
  fixed Yes or No with nothing wired reads *"Always No — a fixed value: only No runs"*, with *Use a value instead…*.

Gate (s18, `check:editor` **172/172**, 2 new and 2 rewritten): the Sign in ⚡'s hover reads both lanes in the order the
card draws them, with no "+1 more"; the card's name is both lanes'; the second lane's branch (the file's `condition:
false`, nothing wired into it) reads "Always No"; Todo's Header row reads "Pick list" (Header's Component Outputs
declares `pickList` with no display name). Mutant (all three reverted): 168/172, exactly those four fail.

Gates: `check:import` (a fixture page: logged in / not logged in on one button → one Condition from the click,
other page on Yes and third on No, labelled with "?"; logged in beside no condition → two wires, a Condition and a
Navigate; logged in twice → two Conditions, both "Only when") 79/79 (74 + 5); mutant (no pair ever opposite)
78/79. `check:editor` (the Sign in click: the file has two wires from its Click into signal inputs, and its card
draws two lanes, the first Sign in → Go to the list, the second a branch) 170/170; mutant (never lanes) 169/170.
`check:app` 34/34 (it loads studio.html), `check:dictionary` PASS 65 / 2 / 22 / 5.

---

## M4 — The run timeline: record and replay

**The problem.** Bubble's step-by-step mode pauses one workflow while everything else carries on — queries already in
flight, other workflows, the page drawing — so what it showed was often not what happens. But the question it
answered is the right one: *in what order do things happen when my page opens, and why is the profile blank for two
seconds?*

**The idea.** Don't pause the app: **record a run, then scrub through it**.

- Press **Record**, use the app (or just open the page), press **Stop**. The timeline has lanes — **page data**,
  **workflows**, **the screen** — on one time axis:
  *0 ms page opens → 40 ms Profile name draws **empty** → `org` query returns at 1.8 s → Profile name fills.*
- Each step shows what went in and what came out. A screenshot is kept at each point, so dragging the scrubber
  plays the screen back alongside the steps.
- Every row links to its element, card or data item. Named page data (M2) and one card per event (M3) are what make
  the timeline readable.
- ~~A **step mode** for one card ("pause before each step")~~ — ruled out 2026-10-20 (STU-033): a recorded run gone
  through step by step instead.

**In NodeGX.** The NodeGX editor already has a trace channel (OBS-002, `TraceSession`): the runtime buffers trace
events while recording and the editor pulls them. In Studio the runtime runs in the same window, so the timeline
can read that buffer directly. To find out first: which events the buffer carries today (signals and values yes;
query start/end and element draws, to measure).

| id | task | done when |
|---|---|---|
| STU-030 | **Measure the trace buffer** in the in-page preview: which events, with what timing, at what cost. Write down what is missing for the three lanes. | a written inventory with a recording of the todo template's open |
| STU-031 | **Record / Stop and the timeline** with the three lanes, rows linked to their element / card / item. | recording the todo template's open shows its query's start and end and the list drawing after it |
| STU-032 | **Inputs and outputs** per step, and **screenshots** per point with a scrubber. | scrubbing to a step shows the screen as it was then |
| STU-033 | ~~**Step mode** for one card, marked as not real timing~~ — ruled 2026-10-20: **one run per Record**, stopping by itself when it is over, and its **steps gone through one by one** on the waterfall. | a recorded click's steps are marks on the lane; → goes through them with each one's in and out; a slow answer keeps the recording open |

**Done (STU-030, 2026-10-20, s9): the inventory.** Measured with `editor/trace-inventory.mjs` (the todo template, a
backend, Studio in headless Chrome; three runs: the app's open to Sign in, Create account → the Todo page opens, a
task added). The recording's numbers: [look/stu-030-trace.json](look/stu-030-trace.json).

- **It is already on.** The in-page preview arms the trace at boot (owner `noodl-preview-in-page`), so a recording
  starts with the app's open; the buffer holds 250 000 events.
- **One clock.** A trace event's `t` is the frame's `performance.now()`, the same clock as the probe's requests
  (`editor/probe.js`) and a MutationObserver in the frame, so the three lanes can sit on one time axis.
- **Cost.** Boot to Sign in: 625 events in 77 ms; sign-up to the Todo page drawn: 929–968 events in about 450 ms;
  adding a task: 430. About 160 bytes an event as JSON (~150 KB a run), pulled in 5–24 ms. No reason to sample.
- **Workflows lane: there, but without "why".** Every signal crossing a wire is an event, in order, with its ports:
  *2 ms Click → Run JavaScript, 4 ms → Create a record (store), 15 ms its Done → Write history, 29 ms → …*. But every
  signal's `cause` is 0 (12 of 12 on sign-up, 8 of 8 on Add; and 425 of 956 values), so the trace cannot say what
  made a step run — filed as P123-STU030-SIGNALCAUSE in NodeGX's bug ledger. The timeline can order steps by `seq`;
  the "why" arrow waits on that fix.
- **Names come from the files, not the trace's dictionary.** The dictionary is built from the nodes alive at the
  time: 31 at boot (Sign in), 692 after the Todo page opened, and by then Sign in's nodes are gone, so the click that
  started it all is a "?". Trace node ids are the files' node ids, so Studio names them from the project.
- **Page data lane: start and end, for a query fired by a wire.** The Todo page's five queries are refreshed through
  their component's input: a `storageFetch` pulse (sent as a value, true then false) at 86 ms, the same millisecond as
  the request; `items` out at 129–152 ms, each exactly when its request answered (Task: 86 → 146 ms), even with no
  rows. **Not in the trace:** a query that runs by itself (no wire into it), and every request made from JavaScript
  (the Projects data: 4 of the 11 requests on open, Project / MoneyItem / MoneyMark / BalanceReading, and a second
  Task request at 148 ms). The probe sees all 11, so the lane is the probe's requests, each matched to its query node
  by collection where there is one.
- **Screen lane: the trace sees values arrive, not drawing.** Adding a task: the title reaches a Text at 26 ms, is
  on screen at 43 ms (MutationObserver). A page change is one mutation (the old page's subtree out, the new one in),
  so the observer gives "the page changed" and "this text appeared", not which element drew; screenshots per point
  (STU-032) have to come from outside the trace too.

What STU-031 needs that the trace does not give: request times (probe, already in Studio), screen changes
(MutationObserver or screenshots), names (the files), causes (the runtime fix). What it gets free: every step in
order on the same clock as the other two.

**Done (STU-031, 2026-10-20, s10): Record / Stop and the timeline.** A **Record** button in the bar (beside "Use the
app") starts a recording and opens the **Run timeline**, a drawer under every tab; **Stop** reads it. In the drawer,
**Record the page opening** opens a fresh copy of the app (a rebuild) and records from its first millisecond. Nothing
is paused: Record marks a moment on the app frame's clock and Stop reads what three witnesses wrote since.
[look/stu-031-timeline.png](look/stu-031-timeline.png) is the todo template's Todo page opening;
[look/stu-031-timeline-add.png](look/stu-031-timeline-add.png) is a task added, recorded from now.

- **Three lanes on one axis**, marks above and the rows below in time order, one line each: time, lane, what, detail.
  Hovering a row lights its mark, clicking a mark finds its row. The axis runs from the first thing that happened to
  the last, not from Record to Stop (the page opening is 0.48 s of a 4.8 s recording; the bar says "nothing after").
- **Page data** = the probe's requests. A query says who asked: a page data item that asks exactly that, else the
  Query Records node on that collection whose `items` came out with the answer (the trace, to 5 ms), named with the
  page element that holds it ("Your tasks (in Your list, from the backend) asks for Task · 483 → 491 ms · 1 row");
  when the trace does not confirm it, the row says so (a query whose answer did not change publishes nothing, and
  JavaScript asks the same backend); a collection no query node asks is "JavaScript asks for Project". Writes,
  sign-in and the signed-in user are said as what they do ("The app creates an Event").
- **Workflows** = the trace's signals, made into runs of cards: a card's event starts a run, a signal into a node that
  card reaches from one already in the run is a step of it ("If Signed in · When Todo: Did Mount · 5 steps ran over
  4 ms"). Cards are the page's and those of every reusable placed on it: the Add button lives inside Open tasks
  (`Todo/Task list`), so its card is the reusable's ("When Add: Click, inside Open tasks"). Clicking a row opens the
  card, a reusable's in that reusable. A signal no card explains is hidden behind "Every signal (+n …)". The trace's
  `cause` is still 0 (P123-STU030-SIGNALCAUSE), so "a step of it" comes from the files, not the trace.
- **The screen** = a MutationObserver the probe starts with the frame (`window.__studioScreen`: elements added or
  taken away, text changed, never styles; the last 5,000–6,000), each change given to the page element it happened
  inside, changes to one element within 30 ms one row; plus the app's moves between pages. The parser building the
  page (body into html, the "enable JavaScript" notice) is not drawing and is left out.
- **What the Todo page's opening says:** the page draws empty at 479 ms ("List (0)"), the Task query answers at
  491 ms, Open tasks draws the task at 499 ms; four requests come from JavaScript (Project, MoneyItem, MoneyMark,
  BalanceReading), and Task is asked a second time, unconfirmed by the trace (STU-030 measured that one from
  JavaScript). Before all that, "The app reads the signed-in user" took 23 ms in one run and 326 ms in another:
  nothing draws until it answers.
- Found on the way: **a copy of a reusable has no element in the preview** (`preview.elementsOf(copyId)` is empty
  for `tdList`): a copy draws through its component's roots. The timeline reaches them through the runtime
  (`drawnElements`, the instance's `getRoots()`); Design does not, so by the code a copy selected in the tree draws
  no box, and a click on it selects the group around it (P123-STU031-COPYBOX, a kit gap, filed in NodeGX's bug ledger a93f0d2ed; not fixed; not looked at on
  screen).
- **Not built:** a recording that crosses pages (Sign in → Todo) gives card rows only for the page shown at Stop and
  its reusables; the others' signals are minor rows. Two runs of one card that overlap are told apart only by which
  started last. The probe's text sample is the DOM as inserted, before its values arrive ("TextTextTextLabel · 1 ·
  Read the run timeline"). Inputs and outputs per step, screenshots and a scrubber are STU-032.

Gate: `npm run check:timeline` (`editor/timeline-check.mjs`) 24/24. Eleven on fixtures (a request's start and end
from Record and its asker; before Record left out; JavaScript; a write said as itself; a card's run; a minor signal;
changes merged per element; the page and a move; time order; the axis from first to last; "an Event"); thirteen on
the todo template with a backend: a visitor signs up and adds a task in the app, Todo is opened in Studio, Record the
page opening, Stop — the Task query's row starts and ends on the probe's own milliseconds, names the query whose
`items` came out with the answer in the runtime's own trace and links to the element holding it, the task list's
row is after the answer and carries the task's title (which the copy's roots hold now, read off the runtime), the
page's Did Mount is a row linked to its card, clicking rows selects the element and opens the card; then Record from
now, a second task: the Add button's card, then the create request, then the task drawn, nothing from before Record.
Mutants: no screen witness 22/24; copies draw nothing 23/24; the page's cards only 23/24. `check:editor` 170/170,
`check:app` 34/34 (both load studio.html), `check:rules` 20/20, `check:phrases` 85/85, `check:pagedata` 33/33,
`check:reusable` 12/12; `check:import` and `check:dictionary` not run (the importer is untouched).

**Done (STU-032, 2026-10-20, s11): what went in and out of each step, and the screen as it was.**
[look/stu-032-scrub.png](look/stu-032-scrub.png) is the Todo page opening scrubbed to where Open tasks draws its task;
[look/stu-032-step.png](look/stu-032-step.png) is the Add card's step open, the screen as it was when it ran.

- **Each step, in and out.** A workflow row has **Show the n steps**; each step is a line under it: its time, the
  node and the input its signal arrived on, then **in** (the last value that came into each wired input before the
  signal, from any time, Record or not: a value set at boot is still what the step reads; then the settings the
  files give it where nothing is wired, marked "(set)", not its script and not its run-on-change boxes) and **out**
  (what it sent from its signal until the next signal into it, or Stop: a value's last preview, a signal once with
  how long after). The Add button's step reads *in text "Second task, recorded" · out text "Second task, recorded" ·
  go sent*. The values are the trace's previews (200 characters at most), never the values themselves.
- **The scrubber.** A playhead on the axis: drag it anywhere on the axis, use ← / → (row to row, steps included),
  Home and End, or click a row, a mark or a step. Rows after the playhead are dimmed, the row at it is marked. A
  screen row's click shows the screen once it has drawn (the playhead goes to its end); every other row's, its start.
- **The screen as it was**, in a pane beside the rows (or **Larger**, over the tab): the probe's copy of the page
  for the playhead's moment, drawn in a frame that runs no script, with the page's styles, its address (so pictures
  and fonts load) and what the fields held. Before the first copy: "Nothing drawn yet".
- **Why a copy, not a picture (measured).** In the page, a picture of its own HTML is not possible: Chrome taints a
  canvas that draws HTML through SVG (`toDataURL` throws). CDP screenshots exist only in the desktop app and the
  gate. A copy of the body costs about 0.3 ms: the Todo page opening, 5 copies, 40 KB, 1.4 ms in all; a task added,
  3 copies, 30 KB; plus the page's styles, 43 KB once per recording. The first measurement was 851 KB a copy: 836 KB
  of it was one inline script (the runtime's module bootstrap) in `<body>`, so the copy leaves out the page's scripts
  and its `<noscript>` notice (which, drawn without scripts, showed "You need to enable JavaScript").
- **When the copy is taken.** At the next frame after a change (`requestAnimationFrame`), the moment the browser
  paints: what a frame shows is what was on the screen. A hidden window paints no frames, so a 100 ms timer stands
  in. A copy carries the time its change began, so a screen row and its copy agree. Typing changes no element, so a
  field's input takes a copy at once. The newest are kept, up to 40 million characters (about 2,800 copies of the
  Todo page). The gate does not tell this from a copy taken inside the observer: that mutant passes 33/33.
- **Found by the copies: the list's row flashes "Text".** Open tasks inserts its row at 830 ms holding three Text
  elements reading their default "Text", and its values arrive at 853 ms, a frame later: the copy at the next frame
  holds "Text / Text / Text / Label". A person sees the placeholder for a frame or two each time a list draws a row.
  Filed as P123-STU032-TEXTFLASH (runtime, low; NodeGX 80bd3c778), measured by the frame-time copy, not in pixels.
  (A check that no copy holds "Text" was written first, on the guess that the placeholder never reached a frame;
  it failed in both modes, which is how the flash was found.) A screen row's click therefore shows the row's end.
- **Seen in the picture, not by the gate (then graded):** the first build drew "Nothing drawn yet" over a copy that
  was there (the note's `display: grid` beat its `hidden`), ran "Hide the steps" into the row's words, and cut the
  Larger button to an "L" and the copy's right edge (the pane's one grid column took its header's width, 413 px in a
  380 px pane, measured in the browser). The gate read the `hidden` attribute, not what is on screen; it now reads the
  computed display of the copy and the note, and that the Larger button is whole inside the pane. Mutants: the note's
  `[hidden]` rule taken out 32/33; the column unclamped (the tree before the fix) 32/33.
- **Not built / limits.** A copy has no canvas pixels and no scroll positions; a change made only to a style (the
  observer watches elements and text, never styles) takes no copy of its own. The styles are those at Stop, which
  only matters for a page that removes a style while it runs. Going through a run step by step is STU-033, below.

Gate: `npm run check:timeline` 33/33 (24 + 9). On fixtures: a run carries its steps on the recording's clock; a
step's inputs are the last value into each wired input before its signal (not one after it), then its settings where
nothing is wired; its outputs are what it sent before the next signal into it, a signal once however many wires; the
screen at a moment is the last copy at or before it. On the todo template: at the end of the page opening the copy
says what the app says now (its text, read off the live frame), and no script ran in it; scrubbed to the Task
query's start the list has no task on screen, to the row where the list draws it the task is there, with its values
and without the page's scripts or the no-JavaScript notice; dragging the playhead and letting go between two rows shows
the screen at that moment and dims the rows after it; recorded from now, the Add card's step shows the typed title going
in and coming out and its signal sent on (the runtime's trace has that value out of that node), and scrubbed to that
step the field holds the title and the list does not yet; at the row where the list draws it, it does.
Mutants: the pane shows the last copy whatever the playhead 31/33; a step's inputs read values that came after its
signal 31/33 (the fixture and the Add step; that run also failed the drag check, whose "nine tenths of the axis" can
fall after every row: it now lets go between two rows); the fields' values not put back 32/33; the copy taken inside the observer 33/33 (not graded, above).

**Done (STU-033, 2026-10-20, s12): one run at a time, its steps gone through one by one.** Ruled by Richard the same
day, after seeing live step mode: *"Scrub only"*, and Record *"primes for ONE click or ONE signal. The first signal
that's fired triggers recording, but when all the signals are extinguished (i.e. the action has completed) then the
recording auto stops and the user reviews … make sure that if a signal has fired and for example an API call hasn't
come back yet, or a script is still running some process, that it can't time out until that process has finished, so
you see the full end to end."* He liked the lanes (*"the waterfall network thing"*) and asked that the steps and the
waterfall be one thing: *"scrubbing back and forwards between the steps rather than doing them one by one, as long as
I can view the in out data and what happened from each step."* [look/stu-033-steps.png](look/stu-033-steps.png):
the Add task command's step 2 at the playhead.

- **Record waits for the app** ("Waiting for the app…", the last recording kept until then). The first signal that
  crosses a wire starts the recording, at that signal. It **stops by itself** once the run is over
  (editor/runwatch.mjs): quiet for 1.5 s (a Did Mount a moment after a click is the same run), and nothing it started
  still working: a request made since it began and not answered (XHR, and now `fetch`, both in the probe's log), a
  page `setTimeout` of at most 10 s made within 50 ms of a signal of the run or from inside such a timer's callback
  (a script's `await sleep`), a Timer node the run started (one that repeats for ever is not counted). While it waits
  the button says so: *"Stop · 2.09 s · waiting for an answer from the backend"*. A timer holds a run open for 30 s at
  most (one that re-arms itself for ever would hold it for ever); a request holds it until it is answered; Stop ends
  it sooner. "Record the page opening" stops by itself the same way. A script busy computing blocks the page and the
  watch with it, so a run never ends in the middle of one.
- **The steps on the waterfall.** A run is a pale bar on the Workflows lane and each of its steps a mark on it; every
  step is also a line under its run (no "Show the steps" any more). The playhead is on one line at a time: **← / →**
  (or ◀ ▶ beside the screen) go line by line, the steps of one click included, though they share a millisecond.
- **The line in full**, above the screen as it was: a step's **In** (each wired input's last value before its signal,
  then its settings, "(set)"), **Out** (what it sent, a signal with how long after), and **Then**: what happened on the
  other lanes from it until the run's next step (the create request after "Add the task", what the screen drew); a
  row's words.
- **Found on the way: a signal into a component goes on as two values.** Its Component Inputs node sends a signal on
  as `true` then `false` through `sendValue` (the runtime's `componentinstance.ts`), so every card started by a
  component's input signal (the todo template's 19 commands, each a "do") was invisible to the timeline: its steps
  were "a signal no workflow on this page starts". A `true` out of a card's event now starts that card's run, and the
  `true` and `false` are not among a step's inputs.
- **Live step mode was built first and taken out** (s12): a hold in the app's frame on `_setPulseFromConnection` and a
  bar over the tabs, then the drawer. Richard found the bar *"quite busy"* and then preferred scrubbing a real run;
  pausing the app is not real timing, and a recording is.

Gate: `npm run check:timeline` 43/43. On fixtures: a request made in the run and not answered holds it however long,
one from before the run does not; quiet for 1.5 s with nothing waiting it is over; a timer holds it for 30 s at most;
an answer after the last signal is the run's last activity; a card started through its component's inputs is a run.
On the todo template: Record waits (nothing recorded, the timeline open), the page opening records and stops by itself;
Record from now waits through 0.8 s of nothing, the click's first signal starts the recording at under 5 ms, and it
stops by itself; every step of every run is a mark on the Workflows lane and a line (18 of each), the Add task
command's run has its three steps; from its mark, ▶ three times goes step 1 (reads the typed title), step 2 (reads it,
then the create request), step 3 (reads the new record's id that step 2 sent); ← goes back one; a write whose answer
is held 3 s at the network (CDP `Fetch`) keeps the recording open, the button saying it waits for the answer, and the
list drawing the task after it is in the recording.
Mutants: a request still waiting does not hold the run 41/43 (the fixture and the 3 s write); the recording starts
when Record is pressed, not at the app's first signal, 42/43. Seen in the picture, not graded: the first layout put
the step's details above the screen in one column and squeezed the copy to a thumbnail; they are now side by side.

- **Not built / limits.** A step that is a copy of a reusable is one step (its inside is that reusable's own run, a row
  of its own when it has a card). A record's fields are named by their ports ("prop-title"). A request the app made
  before Record and still waiting does not hold the run. An app that sends a signal on its own all the time (a
  repeating timer wired to a step) never goes quiet: Stop ends it.
---

## M5 — The importer as a product

| id | task | done when |
|---|---|---|
| STU-040 | **File → Import an App…** with the guided path from [IMPORT.md](IMPORT.md) (run-mode bundles, the editor requests, the Data tab), the report shown in the app. | an import from the welcome screen ends with the project open and the report beside it |
| STU-041 | **One home for the converter.** It currently also lives in `digital-bricks/bubbleExporter` and in the NodeGX repo's phase 123 folder; this repo becomes the source and the other two point here. | both other copies carry a pointer, and nothing is edited there any more |
| STU-042 | **A fidelity gate** from Rico Trevisan's frozen cases (bubble_ex `test/support/fidelity`, fetched at a pinned commit, not vendored) — read his reply on ricotrevisan/bubble_ex#238 first. | the converter is graded against Bubble's own screenshots at 390 and 1440 px |
| STU-044 | **The importer's expressions graded against the dictionary.** Its compiler has 125 operators of its own, written without the community dictionary; by name only 37 of the dictionary's 94 match (an undercount: the dictionary uses Bubble's display names, ":count", "<", the importer the internal ones, `count`, `less_than`), weakest on Date 2/15, Date Range 0/11 and Integer range 3/11. Compile each phrasebook row's Bubble example through the importer and compare with the phrasebook's executed answer. | a gate prints covered / wrong / missing per data type, and every wrong one is fixed or filed |
| STU-053 | **The Bubble elements NodeGX has no node of its own for.** A floating group, a popup, a group focus, a repeating group's cell grid, a dropdown's dynamic choices, an input's formats: each converted to what Bubble draws, or said in the report. | each converts to what Bubble draws or has a line in the report, graded on a fixture and on the template |
| STU-043 | **Plugins, recreated (R9).** No shim and none of a plugin's own code in an imported app. The importer lists each plugin the app uses (its elements, actions and states, where each is used, the settings the app gives it) and writes a brief for it; from the brief, Claude Code (through Studio's "Connect Claude Code") recreates it in NodeGX in two separate sessions: one reads the plugin's code and writes down what it does, the other builds from that description alone. | one real plugin element in an imported app is replaced by a NodeGX component built by a session that never saw the plugin's code |

**Done (STU-040, 2026-10-20, s14).** The welcome screen's **Import an app…** (and File → Import an App…, which goes to
the welcome screen first) opens a guide before any dialog: **an export file**, or **your app's page files**, each with
its own button and its own dialog (the old one dialog for either is gone, so Windows and Linux ask the same way as
macOS). The guide says how to save each page's `dynamic.js` with the page's name in front (the bundler reads only
`*dynamic.js`, and Chrome saves every one as plain `dynamic.js`), how to add the editor's `c5r6j` for backend
workflows (*"consistently called c5r6j"* on Richard's apps; unmeasured on anyone else's), and that the files can hold
the app's API keys. Its words went through the content-authoring skill and its offline checks (written, closer,
contract, opener: clean after two fragments were rewritten). The import then opens the project with
**docs/IMPORT-REPORT.md beside the app**: a drawer under the header (`?report=import` on the page's URL), drawn by a
small Markdown reader (headings, tables, lists, code, quotes) built with elements, never as HTML, through a read-only
`/api/doc` that serves only a `.md` directly in `docs/`. An **Import report** button in the header brings it back
while the file is there. The header's pills now keep their words and the status line is what shortens.
`check:app` **45/45**: the guide opens with its two ways; the folder way ends in the editor with the report open, its
tables drawn as tables; Close and the header button; a project with no report shows neither. `check:editor` 170/170
(one run before that stopped at its 38th check on *Unexpected end of JSON input* and passed on a straight rerun;
not explained). Pictures: `docs/look/stu-003-import-guide.png`, `stu-003-import-report.png`.
- **Not in it:** the Data tab's exports (`data-to-nodegx.mjs` writes the backend's import files and a list of
  commands; nothing runs them from Studio yet); a link from a finding in the report to the element it names.

**STU-044, built (s5): `npm run check:dictionary` (`import/dictionary-check.mjs`, cases in `import/dictionary.mjs`).**
The dictionary names an operator as Bubble's editor shows it (":count"); an app stores the internal name (`count`). The
join is a table, one entry per phrasebook row: the internal name, and where that name comes from: **bubble_ex** (Rico
Trevisan's vocabulary and compiler at 5f1c480, written from real payloads, which also says whether an operand sits in
`args` or in `properties`) or nothing (the importer's own name, never seen in a payload). The gate builds a Bubble app
with one Group per case (its data source is the expression: a Group's data source becomes an Expression with nothing
around it), runs the real converter, evaluates each Expression and compares with the phrasebook's executed answer, or
Bubble's stated result, or a probe where the dictionary's example cannot tell right from wrong (the dates are local, so
it runs in Europe/Paris). It fails on a wrong row that is not filed.

| measured | covered | wrong | missing | no NodeGX answer |
|---|---|---|---|---|
| before (the importer as s4 left it) | 51 | 14 | 24 | 5 |
| after | 65 | 2 (filed) | 22 | 5 |

Fixed in the importer: **split by**, **find & replace**, **extract** and **rounded down** read their operands from
`properties` (`separator`; `find`, `replace`, `use_regex`; `component_to_extract`), where bubble_ex shows Bubble keeps
them; the importer read `args`, so split by split on `undefined`, find & replace returned the text unchanged, and
**rounded down** was not an operator at all: it compiled, silently, as a read of a field called `rounded_down`
(`stats.fieldReadsGuessed`, nothing in the report). Find & replace now replaces every match. **formatted as** (a date)
printed `Thu Jul 06 2023 14:22:00 GMT+0200 (…)`; it now writes Bubble's patterns (dateFormat's tokens:
`ddd dS mm-yy HH:MM` → `Thu 6th 07-23 14:22`; a named format is its own pattern). **JSON-safe** on a date gives the ISO
instant. **+(months) / +(years)** clamp (31 January + 1 month was 3 March, now 28 February). **equals rounded down to**
compared milliseconds whatever the unit. **A field read off a list** (`Search for people's location`, the dictionary's
":each item's") was `items?.location`, undefined; after a search, an option set's options or a list operator it is now
every item's field, and a list field read off a list reads flat (Teams' members). **:filtered** and **:sorted** were
handed to a person; they compile now (bubble_ex's constraint table; an empty constraint value matches nothing unless
"Ignore empty constraints" is set, as bubble_ex replayed; numbers sort as numbers).

- **Filed, STU-044-FORMATNUMBER (rows 122, 123):** ":formatted as" a number keeps its settings in `properties` under
  keys no payload here shows (bubble_ex keeps them verbatim and names none), so currency and decimal places print the
  number as it is. Wants one real payload of each.
- **Missing (22):** 21 rows whose internal name no payload or bubble_ex shows and the importer has no operator for
  (":truncated from end to", ":extract with Regex", ":floor", ":ceiling", "^", the range comparisons, ":start / :end /
  :center", "<-max-> / <-min->", "Date − Date :formatted as years"), and ":group by". Each wants its name from a real
  app before it can be written; Richard's real app export (not in this repo) is the place to look.
- **17 covered rows rest on the importer's own name** (":append", "<-range->", ":min / :max / :average", the importer's
  range operators, "change minutes to", ":random item", ":items from #", ":format as text" and others): they compute
  the right thing, and nothing says a real app reaches them under that name.
- Not measured: whether Bubble's ":plus item" leaves out an item the list already holds (the probe was dropped, not
  guessed), and Bubble's "+(days)" over a summer-time change (NodeGX's own Date Add counts a day as 24 hours).

**STU-053, built (s6).** What the importer did with each, read in `app-to-nodegx.mjs` and measured on the template (it has
one of them: the FloatingGroup "Floating Mobile Nav Menu", zindex 2, no `float_vertical`, hidden on load):

| element | before | now |
|---|---|---|
| FloatingGroup | a Group in the page's flow, no layer: shown, it pushed the page down | `position: fixed` on its `zindex`, at the top (Bubble's default), the bottom or both edges (`float_vertical`); another value is placed at the top and said |
| Popup | a Group in the flow, hidden on load | fixed in the middle of the window on layer 1000, no wider than its Bubble width, hidden on load; the report says the grey backdrop is not drawn |
| GroupFocus | a Group where it sits, hidden on load | the same, and the report says Bubble places it beside its reference element |
| RepeatingGroup, columns > 1 | one column of cells | the cells wrap in rows (`flexDirection: row`, `flexWrap: wrap`), each `100 / columns` % wide |
| Dropdown fed by a search or option set | the records as the Options node's items: it draws each item's `Label`, so every choice was empty | an Expression makes each one `{ Label: display / name / title / id, Value: id }`; the report says the dropdown's value is the id |
| Input formats | `content_format` → password, email, number, tel, url; MultiLineInput a text area | unchanged: no payload here shows another format |

`check:import` 73/73 (9 new: the five on a fixture page, run where it computes; the template's menu fixed on layer 2;
validate_project 0 errors on the fixture). Mutant (the floating group unfixed, the dropdown's records handed over as
they are): 69/73, the four that grade them.
- **STU-053-DROPDOWNVALUE, fixed (s7).** Bubble's "Dropdown's value" is the thing, and "Dropdown's value's name" reads
  its field; here the value is its id (a native select hands back text), so `el_Dropdown?.name` read nothing. Now a
  field read off a dropdown fed by a search or option set goes through one Expression per dropdown, "the chosen …":
  the dropdown's own choices, the item whose Value / id equals the value (none when nothing is chosen), and the field
  off that. "Dropdown's value" alone still wires the id straight through (what a Make changes or a search constraint
  wants). `check:import` 74/74 (1 new, run: value "b2" → Beta's name; "" and an unknown id → nothing); mutant (the
  look-up off): 73/74, the text read `el_Dropdown_pick?.name`.
- **Not read, for want of a payload:** a dropdown's own caption expression (its key is not in the bundle's table), the
  popup's backdrop and its "close when pressing Esc", a group focus's reference element and offsets. Richard's real app
  export is the place to look, with STU-044's missing names.

---

## M6 — Data: the backend, in Studio

Written 2026-10-22 (s15). Richard: *"I'm hoping we can work on the data tab, it's VERY basic at the moment."* Asked
three things, he ruled: **the backend map folds into Data**; **fields in NodeGX's words**, not Bubble's; **a development
and a live database, in the alpha**. *"Rock out."*

What Data was before this: types and fields written to `metadata.dbCollections` only (the running backend got them once,
when it was provisioned, and never a change after); the first 100 rows of a type as text cells; option sets. No privacy,
no files, no users. The backend underneath already has all of it over its admin API: `POST /admin/schema` (add, rename,
retype and drop a column, Choice as a declared check), `/admin/permissions` per collection, roles and users, export and
import of a collection as JSON or CSV, and `/admin/schema/diff` and `/apply` (BAK-007's development → production
promotion). The backend's own manager (phase 104) names a field's kind in `admin/app/fieldKinds.ts`: Text, Number,
Yes / No, Date & time, Choice, Link, Links, Picture or file, Location, List, Anything, the storage type as a small badge.
Those are the words (principle 5: Studio uses that module from vendor/, it does not copy it).

| id | task | done when |
|---|---|---|
| STU-060 | **The map in Data.** No fifth rail tab: Data's sub-tabs are Data types · Privacy · App data · Option sets · Map. A type has *Who can reach it* (the map's own answer, `/backend-map/api/check?table=`) and *Open on the map* (the map at `#t:<type>`). | the rail has four tabs; a type's panel says who can reach it in the map's words, and its link opens the map on that table |
| STU-061 | **Fields in NodeGX's words, on the running backend.** A field is made, renamed, retyped and deleted in the project's `dbCollections` and on the development backend in one act (`POST /admin/schema`); a Choice's values, a Link's target, Required, Unique, a default and a description as the backend's drawer has them. A change that loses values says how many before it runs. Where the project and the backend disagree, the type says so and offers both ways to agree. | a field added in Studio is a column on the running backend without a restart; a type the backend holds and the project does not, or the other way, is named with its two buttons; `check:editor` grades each |
| STU-062 | **A rename follows the app.** Renaming a field or a type rewrites what reads it: Record nodes' `collectionName` and `prop-*`, page data filters and sorts, composed expressions; *Used by* lists each reader. | renaming a field on the todo template leaves `validate_project` at 0 errors and the app still showing its rows |
| STU-063 | **App data you can work in.** Paging over every row with the count, search, sort by a column, a filter; a cell edited by its kind (a date picker, Yes / No, a Choice's values, a Link picked by its row's label); several rows selected and deleted together; a type's rows exported and imported as CSV or JSON through the backend's own import (a dry run first, its report shown); the importer's `data-to-nodegx.mjs` files loaded from here. | 250 rows page; a CSV round-trips; a dry run's rejects are shown before anything is written |
| STU-064 | **Privacy.** Each type's rule (who may find, read, create, change, delete) in sentences, written to `nodegx.security.json` and the running backend together, with the map's verdict for someone not signed in, a signed-in person and each role; roles and their members listed. | a type made private in Studio refuses an anonymous read on the backend, and the file says the same after a restart |
| STU-065 | **Development and live (in the alpha).** A second backend, the live one, recorded in the project as `metadata.cloudservicesLive` (the shape of `cloudservices`); App data switches between the two, as Bubble's *Switch to live database*; **Deploy to live** shows the backend's own promotion diff (what tables and fields change, and whether anything is lost) and applies it; Publish builds the site against live and deploys the functions there; rows copied development → live or live → development, one type or all, after a dry run. Development stays `cloudservices`, which the NodeGX editor and Claude Code use. | a field added in development reaches live only through Deploy to live; a published site reads live's rows, not development's |

Built in that order, except STU-065 before STU-062: it is in the alpha's line and the rename is not.

**Done (s15, 2026-10-22): STU-060, 061, 063, 064, 065.** `npm run check:data` (`editor/data-check.mjs`) **40/40**: a copy
of the todo template, its backend made by Studio's own *Start a backend* under a backends folder of the gate's own, the
editor driven in headless Chrome, every assertion read off the running backends' admin API, the project's files or the
page's table. `check:editor` 170/170, `check:app` 45/45, `check:publish` **31/31** (4 new), `check:timeline` 43/43,
`check:pagedata` 33/33, `check:reusable` 12/12, `check:rules` 20/20, `check:vendor` PASS (884 files). Pictures:
`docs/look/stu-060-map.png`, `stu-061-types.png`, `stu-063-appdata.png`, `stu-064-privacy.png`, `stu-065-live.png`.
- **The kit, not a copy.** The field kinds are the backend manager's own module, vendored as `vendor/fields.js`
  (`nodegx-backend/src/admin/app/fieldKinds.ts`, bundled at the same NodeGX commit as everything else in vendor/:
  rebuilt from a worktree of 6cba197ad, and every other vendored file came out byte for byte the same). Privacy reads
  its words from the map (`/backend-map/words.js`) and changes a rule through the map's own `/api/table-rule`, which
  writes the backend and `nodegx.security.json` together or neither. Who can reach a type is the map's `/api/check`.
  Deploy to live is the backend's `/admin/schema/diff` and `/apply` (BAK-007). Rows move by its `/admin/export` and
  `/admin/import`. `@nodegx/backend-map` 0.1.0 is on npm now and pinned in `dependencies`.
- **STU-060.** The rail has four tabs again; Data's sub-tabs are Data types · Privacy · App data · Option sets · Map.
  A type's panel says who can reach it and opens the map on its table (`#t:<type>`).
- **STU-061.** A field is made in a drawer of the eleven kinds; it goes to the development backend (`addColumn`, a
  Choice's `setChecks`, Unique's `setIndexes`) and only then into `dbCollections` (with `required`, `description`,
  `defaultValue`, and the type's `checks`, which the NodeGX editor ignores). A rename lifts the field's checks, renames,
  and puts them back under the new name (the backend refuses a rename under a built check, measured). A kind change
  says how many values convert. A type the project does not declare is never a warning (NodeGX's templates declare
  none); a declared one the backend disagrees with is a card per disagreement, each with both ways to agree.
- **STU-063.** 50 rows a page with the count, a search over the text fields (`$regex`, the words taken literally), sort
  by a column, a cell edited by its kind (a Choice's values, Yes / No, a date, a Link's rows by their label), rows
  ticked and deleted together, Export as CSV or JSON, Import… checked first. The importer's `backend/data/*.json`
  (`data-to-nodegx.mjs`) are offered as a card, checked, then loaded with their ids. A backend not on this computer
  shows its rows through the proxy, with the project's types standing in for its schema.
- **STU-064.** Each type's rule as two choices (looking at rows; adding, changing or deleting them) and *whoever made a
  row*, in the map's words; groups and their members; a project without `nodegx.security.json` is offered one written
  from the backend's rules first (the map refuses to change a rule it cannot keep).
- **STU-065.** *Make a live database* (Data's bar): NodeGX's provision under "<app> live backend", owned by the
  project, named in `metadata.cloudservicesLive`; `devOpen` off on live (its rules hold on this computer too); then
  development's schema deployed to it. *Development | Live* switches App data. *Deploy to live…* shows what is added
  and what is lost, and asks before losing anything; what the backend's apply leaves for a person (a dropped field, a
  changed type) and the rules, which it writes to live's file but not into the running backend, Studio does through
  the admin API after it (`lib/live.mjs`). *Copy rows…* either way, checked first. **Publish** goes against live when
  there is one: development's additive changes first, then the site from a copy of the project naming live, the
  functions to live; `check:publish` 7 has a todo added in the published app land on live and never on development.
- **Found on the way:** `button[hidden]` was drawn anyway (the buttons' own `display` beat it), so the header's Publish
  showed in the browser-only editor; it is hidden there now, as meant. A tick in App data redrew the table, so a second
  tick fell on a detached box: ticks change the Delete button only, and only the latest drawing draws.
- **Not in it yet:** ~~Required on an existing field; `_User` in App data~~ (both s17, below); the map's sample person
  is called "a signed-in learner" whatever the app (the training app's word, in `@nodegx/backend-map`).

**Done (s16, 2026-10-22): STU-062.** `editor/rename.mjs`, pure, graded by `check:data` (now **64/64**: 12 on the module,
7 on the todo app's `Task.closingNote`, 8 on renames reaching live). `check:editor` 170/170, `check:app` 45/45,
`check:publish` 31/31, `check:pagedata` 33/33, `check:reusable` 12/12, `check:timeline` 43/43, `check:rules` 20/20,
`check:vendor` PASS. Picture: `docs/look/stu-062-rename.png`.
- **What reads a field, in two kinds.** *Sure*: the field by name on something that names its type. A Record node on
  the type sets or reads `prop-<field>` (a setting, or a wire in or out); a query on it filters by the field (both saved
  shapes, `{combinator, rules: [{property}]}` and `{type, conditions: [{field}]}`, groups and all) or sorts by it; page
  data's first record (`Model2` bound to a query on the type) lists it in `properties` and sends `prop-<field>` on, to
  an element or a composed expression's chip. These follow a rename. *Maybe*: the name with nothing saying which type it
  belongs to: code (`expression`, `functionScript`, `code`, `mapScript`, `templateScript`) reading `.F`, `?.F` or
  `['F']` (never `Inputs.F`, `Outputs.F`, `this.F` or a global's), and an Object node not bound to page data. The field
  drawer's **Used by** lists both, the maybes by node with each line, and a maybe follows only when ticked.
- **Why the maybes matter, measured on the todo template:** it reads every field in JavaScript (`r.title`), so for
  `RoutineCheck.date` there are 2 sure readers and 206 maybes, most of them a money item's `date`. Only a person can say
  which `row.date` is this type's. For `Task.closingNote`: the three commands that set it (sure) and three pieces of
  code that read it (maybes); with those ticked, the app keeps working: `validate_project` 0 errors before and after,
  the list still shows, and a task added in the app after the rename is written with `closingWords` (the old column
  does not come back). Not measured: whether `validate_project` would flag a `prop-` port the type no longer has.
- **A type renamed** (Data types → Rename): the backend's `renameTable` (it refuses while checks or indexes are built
  under the old name, so they come off and go back on, as for a field); its rule moves on the backend and in
  `nodegx.security.json`; the project renames it and the Links that point at it; every node whose `collectionName` names
  it follows, and code that names it in quotes where ticked.
- **Renames reach live as renames.** The backend's diff knows no renames: it would drop the old field and add the new
  one, losing live's values. So a rename made while there is a live database is kept in
  `metadata.cloudservicesLive.renames`; Deploy to live (and Publish's schema step) shows it as "renamed, its values
  kept", renames on live first (its checks lifted for it), then compares under the new names; the page clears the list
  after a deploy. A rename live already has is skipped, so a stale entry does nothing. Graded: `Note.title` → `heading`
  then `Note` → `Memo` in development; Deploy to live names both and loses nothing; live has Memo, all 120 rows, their
  titles as headings, its Choice check back.
- **Also fixed on the way:** the app's types read their fields off wires too (`appFields`): the todo app sets every
  field by wire, so before this its types showed no fields until declared. Deleting a field names what in the app
  still sets or reads it.

**Done (s17, 2026-10-22): M6's two leftovers.** `check:data` **74/74** (10 new: 3 on Required in development, 4 on
App data's User, 3 on Required reaching live), `check:editor` 170/170, `check:app` 45/45, `check:publish` 31/31. Pictures: `docs/look/stu-061-required.png`, `stu-063-users.png`.
- **Required on a stored field.** The field drawer has the Required tick for a field that already holds values too
  (not a list of links: the backend never makes one required). Ticked on, it first counts the rows on the development
  database with nothing in the field (`{field: {$exists: false}}`, which is what the backend's `setRequired` counts:
  NULL, not an empty text), says how many, and Save waits; **Show them in App data** opens the type on those rows only
  ("1–2 of 2 with nothing in title", *Show every row* to leave). Saved, `setRequired` runs last, after a rename, a
  kind change and the rules, so a refusal leaves the rest done and the project's `required` as the backend has it.
  Measured: a row without one is then refused by the backend.
- **Required reaches live.** The backend's diff does not compare a field's Required, so `lib/live.mjs` does (field by
  field, under live's names), and Deploy to live (and Publish's schema step) makes it so on live with `setRequired`
  after the apply. When live has rows with nothing in the field, the drawer says so under **Not on live yet** ("Memo's
  state stays optional on live: 1 row there has nothing in it. Give it a value on live, then deploy again"), deploys the
  rest, and leaves the field optional there; once the row has one, the next deploy makes it required. A field made
  required before live existed arrives required, and stays so through a rename.
- **App data's User.** A **User** row heads App data's types, on development or live: the people with an account,
  through the backend's own Users API (`/admin/users`, the one its manager's Users page uses), so a password is hashed
  and the account's own fields are written the one way the backend allows. Paged 50 at a time with the count, searched
  by username or email (the backend's search), newest first; the account's fields (username, email, emailVerified,
  disabled), the fields the app added to `_User`, and each person's groups. A cell is edited by its kind; **New
  person** takes an email, a username (the email when left empty), a password and the app's own fields, and that
  person can sign in (graded with `POST /login`); ticked people are deleted (signed out everywhere). Not here: sorting
  by a column (the Users API sorts newest first only), Export and Import (whether the backend's export of `_User` leaves
  out password hashes was not checked, so neither is offered), changing groups, and `_User` in Data types (adding a
  field to users is still Claude Code's or the backend manager's).
- **Found on the way:** clicking a type in App data always shows every row now (the field drawer's filter stayed on
  after App data was left and opened again).

**s18 (2026-10-23): Required is drift.** `driftOf` compared types only; a field of one type that is required in the
project and not on the development database (or the other way) is now a drift card of its own, with both ways to agree:
*Make it required on the backend* first counts the rows with nothing in it and, when there are any, says how many and
offers *Show them in App data* instead of asking the backend; *Make the project's optional / required* takes the
backend's. `check:data` **78/78** (4 new: the pure `driftOf`, then on the running backend, title made optional from
outside: named, refused while one row is empty, made required once it is gone, and the project taking the backend's
Required either way).

- **Not in it:** the files manager (`/admin/files`), auth providers and email templates, backups and restore from
  Studio, backend workflows and triggers (they belong on the Workflow tab, drawn on the map; the kit has them all), and
  a live backend anywhere but this machine (R10).
- **For NodeGX:** `nodegx-deploy` takes the backend from the project file only, so Studio publishes against live from a
  copy of the project that names it (filed as P123-STU065-DEPLOYBACKEND: a `--backend` flag would remove the copy);
  the editor and the MCP server know one backend per project, so `cloudservicesLive` is Studio's word until NodeGX has
  one; `@nodegx/backend-map` is not on npm yet (its publish waits on Richard's OTP), so the map is still found in
  `node_modules` only on a machine that installed it by hand.

---

## Rulings open

| id | question | from |
|---|---|---|
| R4 | After a branch, can both sides rejoin into one next step? | phase 123 |
| R5 | Can a custom state live inside a reusable? | phase 123 |
| R6 | Where do option sets live — one component each, or one file? | phase 123 |
| R10 | Where can a published app go besides a folder (GitHub Pages, Netlify, the person's own server), and where does its backend live when it is not this machine? STU-008 publishes to a folder against the bound backend until this is ruled. **Leaning (Richard, 2026-10-20):** *"Dunno yet, something like a Linux VM with SSH would be an obvious start no?"* What NodeGX has for that, read the same day: the Docker Compose self-host (`packages/nodegx-backend/deploy/`, `docs/runtime/SELF-HOSTING.md`; run on the box itself, no SSH step; P112-OWN024-DEPLOYNOSHARP open on its image), the training template's SSH runbook (`templates/digital-bricks-training/hosting/`, live on nexus-1, hardcoded to that box), and the general SSH deploy specced as phase 89 *A box of your own* (BOX-002–006, from DEP-004–006), not started. A deployed site's backend address is built into it at export (SELF-HOSTING.md), so the site and its API on one origin is the usual shape. By principle 5 the SSH deploy is NodeGX's to build (phase 89), and Studio's Publish then offers it as a second target. | STU-008, 2026-10-20 |

**Taken.** R7 (Richard, 2026-10-19): page data is an ordinary Query Records node at the page root, named by
`metadata.pageData`. No new file, nothing new in the format: the NodeGX editor, the MCP server and the runtime read
it as the node it is. As built in STU-010–012.

**Taken.** R9 (Richard, 2026-10-20): **plugins are recreated, not run.** His words: *"if you have plugins, you need
to use an AI coder like Claude Code to read the plugin code and recreate it from scratch so we can avoid any licence
issues."* This replaces STU-043's shim, which would have run the plugin's own code inside the imported app. How it
is built (STU-043), so that "from scratch" holds:
- **Two sessions, not one.** One reads the plugin's code (the client half is in the run-mode bundle `static.js`) and writes
  a description of what it does: its fields, events, states and how it looks, never its code. A fresh session builds
  the NodeGX version from that description only. The session that writes the code never sees the plugin's code, which
  is the usual clean-room split; one session that reads and rewrites can carry the plugin's code over.
- **A plugin that wraps an open-source library** (a chart, a map, a date picker): the rebuild uses that library
  directly, under its own licence, which the brief names.
- **A plugin's server-side actions** run on Bubble's servers and are not in the export: their description comes from
  how the app uses them (what goes in, what comes back) and the plugin's public page.
- Not legal advice: a paid plugin's terms can still forbid reading its code, so each brief names the plugin's terms
  for the app's owner to check before the first session reads it.

**Taken.** R8 (Richard, 2026-10-19): **pages and reusables** have their own data; a repeating group's row and a popup
do not. His reason is the rule: *"you'll want to hide queries behind reusable elements so they don't all load at once
on page load. So if your repeater is hidden inside a reusable element, and you don't want to do unnecessary data calls,
put the query for the repeater's data inside the reusable element rather than the page, at least you have the
choice."* So a reusable's data loads when that reusable is shown, not when the page opens; each shown copy asks once.

## Writing about Bubble

Bubble's brand guidelines forbid the BUBBLE name (or anything confusingly like it) in a product, company, domain or
handle. So: the product is **NodeGX Studio**; Bubble is named only to describe what Studio works with — "imports apps
built on the Bubble™ platform" — never in the product's name, a logo or a menu title. **The importer is no
exception** (Richard, 2026-10-19): it is "the importer" / **File → Import an App…**, its scripts are
`import/app-to-nodegx.mjs`, `import/bundles-to-export.mjs` and `import/data-to-nodegx.mjs`, and what it writes into a
project is stamped `nodegx-studio` (`metadata.imported.by`; `from: "bubble"` is a plain fact about the source). Its
help text may say it imports apps built on the Bubble™ platform. The disclaimer in the README stays. Bubble's terms (§8(b)) let a person reuse their own app's design and workflows on another platform;
the importer reads only the person's own app.

Studio's panel follows how Bubble's is organised (a way of working, not something anyone owns), but **its words, icons
and pictures are Studio's own**: no Bubble UI wording copied in, no Bubble icons or colours, no screenshots of Bubble's
UI in the repo or anything published, and never "a Bubble clone" (Richard's look, 2026-10-19).
