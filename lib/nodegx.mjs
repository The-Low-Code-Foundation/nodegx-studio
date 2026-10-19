/**
 * Where the NodeGX checkout is. NodeGX Studio is built from the NodeGX kit and, for now, uses its built pieces in
 * place: the deploy runtime, `@nodegx/preview`'s in-page bundle, the look and specs modules, the backend and the MCP
 * server. Set NODEGX_REPO to the checkout; by default it is a sibling folder called OpenNoodl.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const nodegxRepo = resolve(process.env.NODEGX_REPO || resolve(studioRoot, '..', 'OpenNoodl'));
