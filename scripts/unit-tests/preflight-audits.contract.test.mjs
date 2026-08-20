import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runNode(relative, args = []) {
  return spawnSync(process.execPath, [path.join(root, relative), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('source and dependency audits pass with reviewed Figma inventory retained', () => {
  const source = runNode('scripts/audit-source-graph.mjs');
  assert.equal(source.status, 0, source.stderr || source.stdout);
  assert.match(source.stdout, /reviewed Figma-retained inactive files/);
  assert.match(source.stdout, /src\/app\/src\/app\/hooks\/useKeyboardShortcuts\.ts/);

  const dependencies = runNode('scripts/audit-dependencies.mjs');
  assert.equal(dependencies.status, 0, dependencies.stderr || dependencies.stdout);
  assert.match(dependencies.stdout, /reachable modules/);
});

test('root TypeScript scope includes active modules and excludes inactive generated inventory', () => {
  const result = runNode('node_modules/typescript/lib/tsc.js', ['-p', 'tsconfig.json', '--listFilesOnly']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const files = result.stdout.replaceAll('\\', '/').split(/\r?\n/).filter(Boolean);
  const includesProjectFile = relative => files.includes(path.join(root, relative).replaceAll('\\', '/'));
  assert.equal(includesProjectFile('src/app/src/app/hooks/useKeyboardShortcuts.ts'), true);
  assert.equal(includesProjectFile('src/app/components/ui/sheet.tsx'), true);
  assert.equal(includesProjectFile('src/app/components/ui/accordion.tsx'), false);
  assert.equal(includesProjectFile('src/app/hooks/useKeyboardShortcuts.ts'), false);
});