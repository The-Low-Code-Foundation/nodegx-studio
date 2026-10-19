/**
 * Starts the desktop app. A terminal inside VS Code (or any Electron app) carries ELECTRON_RUN_AS_NODE=1, which turns
 * Electron into plain Node and the window never opens; this clears it and passes everything else through.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const electron = createRequire(import.meta.url)('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [join(dirname(fileURLToPath(import.meta.url)), '..'), ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
