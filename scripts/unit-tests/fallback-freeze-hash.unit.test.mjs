import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  computeFallbackFreeze,
  FALLBACK_SOURCE_NORMALIZATION,
  normalizeFrozenSource,
} from '../fallback-freeze-hash.mjs';

test('fallback source normalization canonicalizes line endings and final newline', () => {
  assert.equal(FALLBACK_SOURCE_NORMALIZATION, 'lf-with-single-final-newline-v1');
  assert.equal(normalizeFrozenSource('const value = 1;'), 'const value = 1;\n');
  assert.equal(normalizeFrozenSource('const value = 1;\n\n'), 'const value = 1;\n');
  assert.equal(normalizeFrozenSource('const value = 1;\r\n'), 'const value = 1;\n');
  assert.equal(normalizeFrozenSource('a\rb\r\n'), 'a\nb\n');
});

test('fallback digest is formatting-stable but detects source changes', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-freeze-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  const source = path.join(root, 'src/fallback.ts');

  fs.writeFileSync(source, 'export const value = 1;\n');
  const baseline = computeFallbackFreeze({ root, includes: ['src'] });

  fs.writeFileSync(source, 'export const value = 1;\r\n\r\n');
  const figmaNormalized = computeFallbackFreeze({ root, includes: ['src'] });
  assert.equal(figmaNormalized.digest, baseline.digest);
  assert.equal(figmaNormalized.files.length, 1);

  fs.writeFileSync(source, 'export const value = 2;\n');
  const changed = computeFallbackFreeze({ root, includes: ['src'] });
  assert.notEqual(changed.digest, baseline.digest);
});