Continue NodeGX Studio (~/vscode_projects/nodegx-studio, public, GPL-3.0; plan of record: docs/SCOPE.md). Edit in
this repo, not OpenNoodl. Gates run on Node 22 (`~/.nvm/versions/node/v22.22.0/bin`). Read on 2026-10-23 (s21): on
adf9812 (STU-026) `check:editor` **193/193**, `check:data` 80/80, `check:timeline` 46/46; on the STU-009 tree
(single-instance included) `check:app` **54/54** and the smoke run; on 5acdd1d `check:import` **94/94**. `check:editor` 193/193 again on the final tree (after `attach` took `match`). `check:dictionary` 65 covered / 2 wrong (filed) / 22 missing (s20). Not
rerun since (nothing they test changed): `check:publish` 34/34, `check:pagedata` 33/33, `check:reusable` 12/12,
`check:rules` 20/20, `check:vendor` PASS (s18); `check:phrases` 85/85 (s13). 🔴 `check:app`, `check:editor`,
`check:data` and `check:timeline` load studio.html: run them after any studio.html change. One heavy gate at a time
(`nice -n 19`, ~/vscode_projects/OpenNoodl-worktrees/HEAVY.lock with mkdir, and **stop if the mkdir fails**; remove it
only if YOU made it). Wait for another session's jest/vitest first, matching node processes only:
`ps -axo comm=,args= | awk '$1 ~ /(^|\/)node$/ && /jest|vitest/'`. 🔴 npm eats a gate's own flags:
`npm run check:editor -- --shots` (and never put `check:editor -- --shots` in one shell variable: npm reads it as the
script's name, and s21 lost a run to that). `--shots` rewrites every picture that gate takes (`s2-*.png` for editor,
`stu-06x-*.png` for data): `git checkout --` the ones you did not mean to change. Three untracked
docs/look/s2-composer-slot.png, s2-composer-then-menu.png, s2-panel-group.png predate s10 and are not yours to commit.
Keep each gate's output in a file. 🔴 In `check:editor`, a write to the project from outside Studio before the "files
changed outside Studio (STU-002)" section fails its first check: drive Studio's own UI there.

🔴 **Another session works in this repo** (STU-070, *Studio inside a conversation*: editor/serve.mjs, editor/hosted/;
in s20–s21 it committed 698faff, fd4c49f, 2832647, deee252). Before each commit, `git diff` every file you add and commit only your
own hunks.

**s21, in order** (SCOPE, each marked s21):
- Item 1 still blocked: npm read 2026-10-23 has `@nodegx/preview` 0.2.4 and `@nodegx/mcp` 0.2.5, neither with
  BACKENDPUBLIC.
- *A Go to page with no page says so on its step* (R4 section of SCOPE): "No page picked: it goes nowhere, and nothing
  after it runs." with *Pick a page…* (opens its settings). Picking a page now redraws the card (`edits()` treats
  `target` like `collectionName`); before, the file changed and the card did not. Undo now toasts *Undone* (before, the
  undone gesture's own toast stayed up). `check:editor` 191/191 (4 new); 190/191 before the redraw was added. Pictures
  retaken: [look/s2-workflow-branch.png](look/s2-workflow-branch.png), [look/s2-workflow-rejoin.png](look/s2-workflow-rejoin.png).
- *R5's limits* (R5 section of SCOPE). **s20's handoff was wrong on the first:** a page setting a copy's state to the
  value its Variable already holds DID work: Set Variable writes with `forceChange`. Now gated in the running app; it
  passes on the s20 importer too. (A signal-based rewrite was built and then reverted as redundant.) **Toggle built**:
  `!shown` from the element's holder into the set, in a reusable (per copy) and on a page. `check:import` 94/94 (4
  new); mutant (s20 importer) fails the three Toggle checks.

Where the alpha stands (SCOPE "The alpha (0.2) — the line"): 1 Publish, 3 Import, 5 main pushed, 6 Data: done.
2 signed, packaged on all three in CI (s20 run); notarising waits on the five secrets. 4 waits on a NodeGX npm release
with BACKENDPUBLIC. **main pushed** to 93b7ef2 on 2026-10-23 (Richard: "yep commit and push please"), STU-026 and STU-009
with it, and the other session's 65b1623. Ask again before the next push.

**s21, later the same day.** Richard on the rejoin picture: *"Meh it's not clear that you're rejoining… I'd have liked
a bit more of a Noodl / NodeGX style connector system"*; on tabs: *"If we could do the whole multiple projects in
tabs concept… that would be a solution and also amazing."* Mock shown: *"It looks hot, I approve."* Both built:
- **STU-026 the flow, drawn** (adf9812): the card on a dark canvas in the backend map's palette, left to right, wires
  in an svg drawn from where the nodes land, fitted to the panel. Same DOM classes as before (two gate selectors moved
  from `.wf > .chain` to `.flow > .chain`).
- **STU-009 projects in tabs** (2391dc0 + the single-instance commit): `app/main.cjs` is a tab strip (`tabs.html`)
  over a `WebContentsView` per tab, each with its own `serve.mjs`. A second launch hands its project to the running
  Studio as a tab (which is what the other session's 65b1623 "Window ↗ opens the desktop app" now does through NodeGX:
  `open -n -a … --args <dir>`). 🔴 `--hidden` shows the window transparent: a view in a hidden window is a hidden page
  and takes no input (the header's Publish silently did nothing until this). Picture: [look/stu-009-tabs.png](look/stu-009-tabs.png),
  composed from the strip's and the tab's own CDP screenshots (no screen capture).

**s22 (2026-10-23, same day): STU-026's last run lit up, and a "+" on a wire** (SCOPE, STU-026 "Done (s22)").
*Show the last run* beside the zoom: the trace (armed at boot, no Record) read by the timeline's own `runsOf` (moved
out of `buildTimeline`) and `lastRunOf`; what ran wears *ran*, the wires it crossed glow and pulse, the rest fades,
"Last run at … · 3 steps · took Yes" under the flow. A "+" at the middle of each one-wire-in-the-graph wire puts a step
between (`addAction`'s `before`). Gates on the s22 tree: `check:editor` **197/197**, `check:timeline` **48/48**,
`check:app` 54/54, `check:data` 80/80. Committed, **not pushed** (ask first). Picture:
[look/s2-workflow-lastrun.png](look/s2-workflow-lastrun.png); the three s2-workflow-{branch,card,rejoin} pictures were
retaken (they show the "+").

**s23 (2026-10-23, same day)** (SCOPE, STU-026 "Done (s23)"): a timeline row opens its card with THAT run lit
(`lastRunOf(…, t)`, the recording keeps trace/cards/clock; "The recorded run at …", *Hide this run*), b7997bc. Then
item 2 below: step heads say the menu's words ("Go to page"), a record's type reads "Data type". Gates on the s23
tree: `check:editor` **198/198**, `check:timeline` **52/52**; `check:app` 54/54 and `check:data` 80/80 on b7997bc
(the last commit touched only words they do not read). Committed, **not pushed** (ask first; s22's ed40eb0 too).
**Found:** a side of a branch that fans one signal out to several steps draws only the first ("+ 3 more wired from
the same signal"), so the Todo page's *If Signed in* lights 2 of its 5 steps. Lanes exist only at the event.

**s24 (same day)** — Richard: *"Both of those next steps would be awesome."* Both built (SCOPE, STU-026 "Done (s24)"):
a fan-out along the way is lanes side by side (30278bb; the Todo page's *If Signed in* lights all 5 of its steps), and
a step can be dragged where the person wants it, saved as an offset on the node (`metadata.flowAt`), *Tidy up* puts
them back. Gates on the s24 tree: `check:editor` **200/200**, `check:timeline` **53/53**, `check:app` 54/54,
`check:data` 80/80. Committed; **pushed 2026-10-23** with CCN-002 (6a60d51).
Waiting on Richard: how the lanes and the drag feel on his app; no picture retaken (`--shots` rewrites every s2 one).

**From lane 3 (P125 CCN-002, OpenNoodl c5da19b12), same evening:** Studio names the agent. `serve.mjs` marks a file the
agent's when the watcher saw it change in the same batch as its `component.json` stamped `modifiedBy: 'noodl-mcp'`
(`agentChanged`, `byAgent`; Studio's own save clears it); a 409 clash on it is `by: 'agent'`, the dialog says *"The agent
changed …"*, and so does the "redrawn" toast. `check:editor` **203/203** (3 new), `check:data` 80/80, `check:timeline`
53/53, `check:app` 54/54 on that tree. Pushed with s22–s24 (Richard: "Push yes please").

Next buildable, in order:
0. STU-009 on Windows / Linux in the package workflow (only macOS was run). STU-026: nothing left that was asked.
1. When NodeGX publishes a release with BACKENDPUBLIC: bump the pins, `npm run vendor`, every gate. Check npm first
   (`npm view @nodegx/preview versions`).
2. (done s23: "Data type" in the In list; heads say the menu's words.)
3. R5's remaining limits: a state on an element inside a reusable read from the page, and a state in a reusable nested
   in one converted before it, are reported, not wired. A Toggle of an element in another component is "set to shown".
4. M6's small follow-ups, if wanted: `_User` in Data types; Export of people once the backend's `_User` export is read
   for password hashes.
The M4 timeline's remaining gap (overlapping runs) waits on NodeGX's trace `cause` (P123-STU030-SIGNALCAUSE).

Waiting on Richard (ask in plain words):
- What he made of docs/look/s2-workflow-rejoin.png (opened in Preview for him in s21) and the five from s20.
- The five notarisation secrets: "I'll get the secrets for you" (s21).
- His look at the drawn flow in the app (docs/look/s2-workflow-rejoin.png, s2-workflow-card.png), the lit last run
  (s2-workflow-lastrun.png) and at the tabs (docs/look/stu-009-tabs.png).
- **His idea (s21): "Window ↗" in the conversation opening the desktop app when it is installed, not the browser.**
  Not built; proposed: serve.mjs (local) launches the app with the project folder, a `nodegx-studio://` scheme for
  links from elsewhere, the hold passes to the desktop window. His answer to "what if the app already shows another
  project" was STU-009 (tabs): the project opens in a new tab. Who builds the bridge half (STU-070 is the other
  session's) is still his to say.
- Unchanged from s13: how the one-run Record feels on his app; his second sitting on data; his real app export
  (STU-044's 22 missing operators, STU-053's unread keys, STU-024's 16 split elements; also whether his reusables'
  states behave per copy). Filed and open in NodeGX's ledger: P123-STU032-TEXTFLASH, P123-STU031-COPYBOX,
  P123-STU008-BACKENDPUBLIC, P123-STU065-DEPLOYBACKEND, P123-STU030-SIGNALCAUSE.

Not to forget (from s13): a look's property list is long (73 on a Button); no "1 inherited from Style" count; a chip
from a record field has no type yet; a dropdown's value read through `chosen` is typed nothing;
STU-014-INSTANCELAYOUT (445 static settings on copies reach nothing); row searches still asked once per row; 17
covered dictionary rows rest on the importer's own operator names; the unknown no-argument operator still falls back
to a guessed field read. His worry from s7: people mixing composed phrases with typed JavaScript in one box.
