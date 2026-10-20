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

You need **Node 22** (`.nvmrc`) and, for the gates only, Google Chrome. Nothing else: the NodeGX kit pieces Studio is
built from come with it (see [The NodeGX kit](#the-nodegx-kit)).

```bash
npm install
npm start                       # the desktop app: recent projects, a template, or an import
npm start -- /path/to/project   # or opens one directly
npm run serve -- /path/to/project   # the same editor in your browser
```

With no folder named, Studio opens on its welcome screen: reopen the last project, pick a recent one, start from one of
NodeGX's templates (a copy in a new folder you name), or import an app. A project is any folder holding `nodegx.project.json` — a NodeGX template, a project made in the NodeGX editor, or
one the importer wrote.

## Import an app

The importer brings across an app built on the Bubble™ platform.

```bash
node import/app-to-nodegx.mjs /path/to/app.bubble.json /path/to/out   # a .bubble export, or…
node import/bundles-to-export.mjs …                                   # …your app's run-mode bundles (no paid plan)
npm start -- /path/to/out
```

Everything the importer cannot map is listed in `docs/IMPORT-REPORT.md` inside the new project and left in the graph
as a labelled placeholder, so every page still opens. [docs/IMPORT.md](docs/IMPORT.md) is the full dictionary and
how to get your app's files out of Bubble. Your Bubble terms let you reuse your own app's design and workflows on
another platform; this reads only your own app.

## The NodeGX kit

Studio is built from NodeGX's kit, at pinned versions:

- **npm**: `@nodegx/preview` (the deploy runtime, the in-page preview) and `@nodegx/mcp` (the MCP server Claude Code
  talks to, and the backend service), at the exact versions in `package.json`.
- **`vendor/`**: what NodeGX does not publish (its templates, the Bubble phrasebook, the canvas look and node specs,
  the backend's provisioning code and the NodeGX editor's writer of `.mcp.json`), built from one NodeGX commit.
  `vendor/NODEGX.json` names the commit and every file's hash; `npm run check:vendor` checks them.

To work on the kit and Studio together, point Studio at a NodeGX checkout instead — it then uses the checkout's
pieces as built there:

```bash
NODEGX_REPO=../NodeGX npm start          # or any gate
NODEGX_REPO=../NodeGX npm run vendor     # rebuild vendor/ from that checkout's HEAD (refuses uncommitted sources)
```

## Gates

```bash
npm run check:vendor   # vendor/ is what NODEGX.json names, and every kit piece is there
npm run check:editor   # 170 checks: drives the editor headless against a copy of NodeGX's todo template
npm run check:timeline # 43 checks: Record / Stop and the run timeline, on fixtures and on the todo template's opening
npm run check:pagedata # 33 checks: page data written, saved and read back from disk; NodeGX's validator on it
npm run check:reusable # 12 checks: a group made reusable, every node and wire accounted for; NodeGX's validator on it
npm run check:import   # the converter on the example editor requests, a page of repeated searches and a template bundle (79 checks with the bundle)
npm run check:app      # 39 checks: drives the desktop app — welcome screen, a template and its backend, reopen, Publish, an import, the recent list
npm run check:publish  # 27 checks: Publish — the todo app's site served statically, sign in and a todo on its backend; the folder rules; cloud functions deployed
npm run smoke -- /path/to/project   # the desktop app opens the project and the app draws (no path: the welcome screen)
```

## Layout

| folder | what |
|---|---|
| `app/` | the Electron shell: the welcome screen (`welcome.html`, `actions.mjs`), the editor server for a project folder in a window, the gate |
| `editor/` | `studio.html` (the whole editor, one file), `serve.mjs` (project files, save, the backend proxy), the gate |
| `import/` | the Bubble importer, its fixtures (example editor requests) and its gate |
| `lib/` | `nodegx.mjs`, where each NodeGX kit piece is; `backend.mjs`, the project's backend through NodeGX's own backend code; `agent.mjs`, Connect Claude Code |
| `vendor/` | the NodeGX kit pieces not on npm, at one commit (`scripts/vendor.mjs` builds it) |
| `docs/` | the scope, the importer's dictionary, screenshots, and `history/` (how this started) |

## Licence

GPL-3.0, like NodeGX. The importer's nonant order and 22 expression operators come from Rico Trevisan's
[bubble_ex](https://github.com/ricotrevisan/bubble_ex) (MIT), credited in the file.
