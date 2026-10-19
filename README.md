# NodeGX Studio

A visual app builder that runs on your own machine. Three tabs over one app — **Design**, **Workflow**, **Data** —
for people who think in pages, elements and workflows, built on [NodeGX](https://github.com/The-Low-Code-Foundation/NodeGX).

- **Your app is a folder of files.** No account, no cloud editor, no lock-in. Put it in git, open it in VS Code, hand
  it to Claude Code through the NodeGX MCP server, deploy it wherever you like.
- **The screen is the real app.** What you click on in Design is your running app, not a mock-up of it.
- **Bring your Bubble app.** The importer turns an app built on the Bubble™ platform into a NodeGX project: pages,
  elements, styles, workflows, option sets, data types, privacy rules and backend workflows.

NodeGX Studio is an independent open-source project of The Low Code Foundation. It is not affiliated with, endorsed
by or supported by Bubble Group, Inc. Bubble® is a trademark of Bubble Group, Inc.

> **Status: early (0.1).** The editor and the importer work and have gates; the desktop app opens a project. See
> [docs/SCOPE.md](docs/SCOPE.md) for what is being built next and why.

![Design tab](docs/look/s2-design-selected.png)

## Run it

You need **Node 22** (`.nvmrc`), Google Chrome (for the gates only) and a **NodeGX checkout** built once. Studio
uses the NodeGX kit's built pieces in place for now; by default it looks for a sibling folder called `OpenNoodl`, or
set `NODEGX_REPO`.

```bash
# in the NodeGX checkout, once
npm install
npm run build:editor:_viewer                          # the deploy runtime
npm --prefix packages/noodl-preview run build         # the in-page preview
bash dev-docs/tasks/phase-112-your-own-nodegx/prototype/real/build.sh   # look.js and specs.js

# here
npm install
npm start                       # the desktop app; asks for a project folder
npm start -- /path/to/project   # or opens one directly
npm run serve -- /path/to/project   # the same editor in your browser
```

A project is any folder holding `nodegx.project.json` — a NodeGX template, a project made in the NodeGX editor, or
one the importer wrote.

## Import a Bubble app

```bash
node import/bubble2nodegx.mjs /path/to/app.bubble.json /path/to/out   # a .bubble export, or…
node import/bubble-run-bundle-to-export.mjs …                          # …your app's run-mode bundles (no paid plan)
npm start -- /path/to/out
```

Everything the importer cannot map is listed in `docs/IMPORT-REPORT.md` inside the new project and left in the graph
as a labelled placeholder, so every page still opens. [docs/IMPORT.md](docs/IMPORT.md) is the full dictionary and
how to get your app's files out of Bubble. Your Bubble terms let you reuse your own app's design and workflows on
another platform; this reads only your own app.

## Gates

```bash
npm run check:editor   # 38 checks: drives the editor headless against a copy of NodeGX's todo template
npm run check:import   # the converter on the example editor requests (26 checks; 32 with a template bundle)
npm run smoke -- /path/to/project   # the desktop app opens the project and the app draws
```

## Layout

| folder | what |
|---|---|
| `app/` | the Electron shell: starts the editor server for a project folder and shows it in a window |
| `editor/` | `studio.html` (the whole editor, one file), `serve.mjs` (project files, save, the backend proxy), the gate |
| `import/` | the Bubble importer, its fixtures (example editor requests) and its gate |
| `lib/` | where the NodeGX checkout is |
| `docs/` | the scope, the importer's dictionary, screenshots, and `history/` (how this started) |

## Licence

GPL-3.0, like NodeGX. The importer's nonant order and 22 expression operators come from Rico Trevisan's
[bubble_ex](https://github.com/ricotrevisan/bubble_ex) (MIT), credited in the file.
