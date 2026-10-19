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
| Data tab — types and fields, rows on the bound backend, option sets | works | `check:editor` |
| Live with outside edits — a file changed by Claude Code (MCP), VS Code or `git pull` is drawn without a reload; a clash with Studio's own edit asks | works (2026-10-19) | `check:editor` 46/46 |
| Styles — global styles as NodeGX variants | works | `check:editor` |
| Bubble importer — pages, elements, styles, workflows, expressions, option sets, reusables, custom states, data types, privacy rules → `nodegx.security.json`, backend workflows → cloud functions, Data-tab rows | spike, measured on a real 18-page app (0 validation errors) | `check:import` 26/26 |
| Desktop app — Electron window, a welcome screen (recent projects, NodeGX's templates, Import an app), File → Open Recent, a smoke mode | first cut (2026-10-19) | `check:app` 23/23, `smoke` |

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
| STU-004 | **The project's backend, from the app.** A project that names a local backend gets it started on open (`nodegx-backend serve` on the project's own data folder) and stopped on close; the status bar says where it is. | open the todo template copy, add a row in Data, quit, reopen: the row is there |
| STU-005 | **Work with Claude Code.** "Connect Claude Code" writes the project's `.mcp.json` entry for the NodeGX MCP server (the same writer the NodeGX editor uses, never a second one) and shows the one command to start a session in the folder. | from a fresh project, the button then `claude` in the folder lists the NodeGX tools |
| STU-006 | **Runs without a NodeGX checkout.** A build step copies the kit pieces Studio uses (deploy runtime, in-page preview, look and specs modules, backend, MCP server) into `vendor/` at pinned NodeGX versions; `lib/nodegx.mjs` prefers `vendor/`. | a fresh clone + `npm install` + `npm start` works on a machine with no OpenNoodl folder |
| STU-007 | **Packaged and signed.** electron-builder for macOS (signed, notarised), Windows and Linux, on NodeGX's release workflow. | a downloadable build opens a project on all three |

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

Order: STU-002 first (it is what makes "local" feel alive, and STU-005 depends on it), then STU-003–005, then
STU-006–007 when someone outside the team needs to run it.

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
| STU-014 | **Scopes beyond the page.** A reusable's own data; a repeating group's row (Bubble's "Current cell's thing" is already a row value, not a search); an item that depends on another. | ruling R8 taken; a reusable with its own item renders in two places, querying once per instance |

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
- A **step mode** for one card stays available ("pause before each step"), labelled for what it is: a teaching aid,
  not real timing.

**In NodeGX.** The NodeGX editor already has a trace channel (OBS-002, `TraceSession`): the runtime buffers trace
events while recording and the editor pulls them. In Studio the runtime runs in the same window, so the timeline
can read that buffer directly. To find out first: which events the buffer carries today (signals and values yes;
query start/end and element draws, to measure).

| id | task | done when |
|---|---|---|
| STU-030 | **Measure the trace buffer** in the in-page preview: which events, with what timing, at what cost. Write down what is missing for the three lanes. | a written inventory with a recording of the todo template's open |
| STU-031 | **Record / Stop and the timeline** with the three lanes, rows linked to their element / card / item. | recording the todo template's open shows its query's start and end and the list drawing after it |
| STU-032 | **Inputs and outputs** per step, and **screenshots** per point with a scrubber. | scrubbing to a step shows the screen as it was then |
| STU-033 | **Step mode** for one card, marked as not real timing. | stepping through a two-step card shows each step's values before it runs |

---

## M5 — The importer as a product

| id | task | done when |
|---|---|---|
| STU-040 | **File → Import an App…** with the guided path from [IMPORT.md](IMPORT.md) (run-mode bundles, the editor requests, the Data tab), the report shown in the app. | an import from the welcome screen ends with the project open and the report beside it |
| STU-041 | **One home for the converter.** It currently also lives in `digital-bricks/bubbleExporter` and in the NodeGX repo's phase 123 folder; this repo becomes the source and the other two point here. | both other copies carry a pointer, and nothing is edited there any more |
| STU-042 | **A fidelity gate** from Rico Trevisan's frozen cases (bubble_ex `test/support/fidelity`, fetched at a pinned commit, not vendored) — read his reply on ricotrevisan/bubble_ex#238 first. | the converter is graded against Bubble's own screenshots at 390 and 1440 px |
| STU-043 | **Plugins.** A shim for Bubble's client-side plugin API (`instance.publishState`, `triggerEvent`, `data`) so a plugin's own code can run; licence ruling first. | one real plugin element runs in an imported app |

---

## Rulings open

| id | question | from |
|---|---|---|
| R4 | After a branch, can both sides rejoin into one next step? | phase 123 |
| R5 | Can a custom state live inside a reusable? | phase 123 |
| R6 | Where do option sets live — one component each, or one file? | phase 123 |
| R7 | Page data's home in the format: page-root Query Records named by metadata (proposed), or a new file per page? | M2 |
| R8 | Which scopes get their own data: page, reusable, repeating group row, popup? | M2 |

## Writing about Bubble

Bubble's brand guidelines forbid the BUBBLE name (or anything confusingly like it) in a product, company, domain or
handle. So: the product is **NodeGX Studio**; Bubble is named only to describe what Studio works with — "imports apps
built on the Bubble™ platform" — never in the product's name, a logo or a menu title. **The importer is no
exception** (Richard, 2026-10-19): it is "the importer" / **File → Import an App…**, its scripts are
`import/app-to-nodegx.mjs`, `import/bundles-to-export.mjs` and `import/data-to-nodegx.mjs`, and what it writes into a
project is stamped `nodegx-studio` (`metadata.imported.by`; `from: "bubble"` is a plain fact about the source). Its
help text may say it imports apps built on the Bubble™ platform. The disclaimer in the README stays. Bubble's terms (§8(b)) let a person reuse their own app's design and workflows on another platform;
the importer reads only the person's own app.
