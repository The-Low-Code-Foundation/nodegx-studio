/**
 * A blank app: the smallest project that opens and renders, the one NodeGX's own `create_project` writes
 * (`packages/noodl-mcp/src/tools/createProject.ts` writeProjectSkeleton): an `/App` root whose one node is a Router, and
 * a `/Pages/Home` page it routes to, with one Text on it. Where a Bubble user starts: an empty page, not someone else's app.
 *
 * Plain Node, no kit: the files are the v2 format's own, and the component ids are the ones the kit's door would give
 * them (UUIDv5 layout over `<project id>:<legacy name>`, writeClock.ts stableComponentId), so a Home deleted and made
 * again in the NodeGX editor gets this one back.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SCHEMA = 'https://opennoodl.dev/schemas';
/** RUN_ON_VALUE_CHANGE_FORMAT_VERSION: authored under the run-on-value-change box, so nothing migrates on open. */
const FORMAT = '5';
/** A length is written as the format's unit object: a "48px" string is dropped silently by the runtime. */
const px = (value) => ({ value, unit: 'px' });

export function stableComponentId(namespace, legacyName) {
  const h = createHash('sha1').update(`${namespace}:${legacyName}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The files of a blank app called `name`, as `{ path: object }`. */
export function blankFiles(name) {
  const now = new Date().toISOString();
  const projectId = randomUUID(), routerId = randomUUID(), pageId = randomUUID(), textId = randomUUID(), boxId = randomUUID();
  const appId = stableComponentId(projectId, '/App'), homeId = stableComponentId(projectId, '/Pages/Home');
  const conns = (componentId) => ({ $schema: `${SCHEMA}/connections-v2.json`, componentId, version: 1, connections: [] });
  return {
    'nodegx.project.json': {
      $schema: `${SCHEMA}/project-v2.json`, name, id: projectId, version: FORMAT, nodegxVersion: '1.1.0', runtimeVersion: 'react19', created: now, modified: now,
      // bodyScroll: a new app scrolls (REL-002a); without it nothing below the fold can be reached
      settings: { htmlTitle: name, navigationPathType: 'path', bodyScroll: true },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: routerId
    },
    'components/App/component.json': { $schema: `${SCHEMA}/component-v2.json`, id: appId, name: 'App', path: '/App', type: 'root', modified: now },
    'components/App/nodes.json': { $schema: `${SCHEMA}/nodes-v2.json`, componentId: appId, version: 1, nodes: [{ id: routerId, type: 'Router', label: 'Main Router', parameters: { name: 'Main', pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } } }], visualRoots: [routerId] },
    'components/App/connections.json': conns(appId),
    'components/Pages/Home/component.json': { $schema: `${SCHEMA}/component-v2.json`, id: homeId, name: 'Home', path: '/Pages/Home', type: 'page', modified: now },
    'components/Pages/Home/nodes.json': {
      $schema: `${SCHEMA}/nodes-v2.json`, componentId: homeId, version: 1, visualRoots: [pageId],
      nodes: [
        { id: pageId, type: 'Page', label: 'Home', parameters: { title: 'Home', urlPath: 'home' }, children: [boxId] },
        { id: boxId, type: 'Group', label: 'Content', parent: pageId, parameters: { paddingTop: px(48), paddingBottom: px(48), paddingLeft: px(24), paddingRight: px(24), rowGap: px(16) }, children: [textId] },
        { id: textId, type: 'Text', label: 'Heading', parent: boxId, parameters: { text: name, fontSize: px(32), fontWeight: 600 } }
      ]
    },
    'components/Pages/Home/connections.json': conns(homeId),
    'components/_registry.json': {
      $schema: `${SCHEMA}/registry-v2.json`, version: 1, lastUpdated: now,
      components: {
        App: { path: 'App', type: 'root', nodeCount: 1, connectionCount: 0, created: now, modified: now },
        'Pages/Home': { path: 'Pages/Home', type: 'page', nodeCount: 3, connectionCount: 0, created: now, modified: now }
      },
      stats: { totalComponents: 2, totalNodes: 4, totalConnections: 0 }
    }
  };
}

/** Writes a blank app called `name` into `dir` (which the caller has checked is new or empty). */
export function writeBlank(dir, name) {
  for (const [rel, data] of Object.entries(blankFiles(name))) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(data, null, 2) + '\n');
  }
  return dir;
}
