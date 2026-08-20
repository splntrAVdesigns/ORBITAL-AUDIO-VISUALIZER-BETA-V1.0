import fs from 'node:fs';
import path from 'node:path';
import { buildSourceGraph, toProjectPath, walkTrackedSource } from './source-graph.mjs';
import {
  ACTIVE_KEYBOARD_SHORTCUT_PATH,
  FIGMA_RETAINED_INACTIVE_SOURCE,
  INACTIVE_KEYBOARD_SHORTCUT_PATH,
  REQUIRED_ACTIVE_SOURCE,
} from './figma-retained-source-inventory.mjs';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const graph = buildSourceGraph({ root });
const errors = [...graph.errors];
const retainedInactive = new Set(FIGMA_RETAINED_INACTIVE_SOURCE);

const unreachable = walkTrackedSource(sourceRoot)
  .filter(file => !file.endsWith('.d.ts'))
  .filter(file => !graph.reachable.has(file))
  .map(file => toProjectPath(root, file))
  .sort();

const unexpectedUnreachable = unreachable.filter(file => !retainedInactive.has(file));
if (unexpectedUnreachable.length > 0) {
  errors.push(`Unexpected unreachable source files (${unexpectedUnreachable.length}):\n${unexpectedUnreachable.map(file => `- ${file}`).join('\n')}`);
}

for (const file of REQUIRED_ACTIVE_SOURCE) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) errors.push(`Required active source is missing: ${file}`);
  else if (!graph.reachable.has(absolute)) errors.push(`Required active source is no longer reachable: ${file}`);
}

const activeKeyboardPath = path.join(root, ACTIVE_KEYBOARD_SHORTCUT_PATH);
const inactiveKeyboardPath = path.join(root, INACTIVE_KEYBOARD_SHORTCUT_PATH);
if (!graph.reachable.has(activeKeyboardPath)) {
  errors.push(`Active keyboard shortcut implementation is not reachable: ${ACTIVE_KEYBOARD_SHORTCUT_PATH}`);
}
if (graph.reachable.has(inactiveKeyboardPath)) {
  errors.push(`Inactive keyboard shortcut duplicate became reachable: ${INACTIVE_KEYBOARD_SHORTCUT_PATH}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `Source graph verified: ${graph.reachable.size} reachable modules, ` +
  `${unreachable.length} reviewed Figma-retained inactive files, and no unexpected dead source files.`,
);
console.log(`Active keyboard shortcuts: ${ACTIVE_KEYBOARD_SHORTCUT_PATH}`);