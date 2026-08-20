import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACTIVE_KEYBOARD_SHORTCUT_PATH,
  FIGMA_RETAINED_INACTIVE_SOURCE,
  INACTIVE_KEYBOARD_SHORTCUT_PATH,
  REQUIRED_ACTIVE_SOURCE,
} from '../figma-retained-source-inventory.mjs';
import { buildSourceGraph, toProjectPath, walkTrackedSource } from '../source-graph.mjs';

test('source graph follows imports and leaves unimported modules unreachable', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-graph-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/main.ts'), "import { live } from './live';\nvoid live;\n");
  fs.writeFileSync(path.join(root, 'src/live.ts'), 'export const live = true;\n');
  fs.writeFileSync(path.join(root, 'src/dead.ts'), "import 'not-installed';\n");

  const graph = buildSourceGraph({ root, entrypoints: ['src/main.ts'] });
  const reachable = new Set([...graph.reachable].map(file => toProjectPath(root, file)));
  const all = walkTrackedSource(path.join(root, 'src')).map(file => toProjectPath(root, file));

  assert.deepEqual(graph.errors, []);
  assert.deepEqual([...reachable].sort(), ['src/live.ts', 'src/main.ts']);
  assert.deepEqual(all.filter(file => !reachable.has(file)), ['src/dead.ts']);
});

test('Figma retained inventory is exact and keeps the active shortcut path distinct', () => {
  const retained = new Set(FIGMA_RETAINED_INACTIVE_SOURCE);
  assert.equal(retained.size, FIGMA_RETAINED_INACTIVE_SOURCE.length);
  assert.equal(retained.has(INACTIVE_KEYBOARD_SHORTCUT_PATH), true);
  assert.equal(retained.has(ACTIVE_KEYBOARD_SHORTCUT_PATH), false);
  assert.equal(REQUIRED_ACTIVE_SOURCE.includes(ACTIVE_KEYBOARD_SHORTCUT_PATH), true);
  assert.equal(REQUIRED_ACTIVE_SOURCE.includes('src/app/components/ui/sheet.tsx'), true);
  assert.equal(REQUIRED_ACTIVE_SOURCE.includes('src/app/components/ui/utils.ts'), true);
});