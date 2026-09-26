import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDirectory = path.join(root, 'scripts/unit-tests');
const requiredTests = Object.freeze([
  'fallback-freeze-hash.unit.test.mjs',
  'preflight-audits.contract.test.mjs',
  'source-graph.unit.test.mjs',
  'webgl-astral-lifecycle.unit.test.mjs',
  'liquid-shaper-phase2.unit.test.mjs',
  'beta-visual-tuning.unit.test.mjs',
  'runtime-parameter-transactions.unit.test.mjs',
  'phase4-2-interaction-isolation.contract.test.mjs',
  'core-particles-gpu.unit.test.mjs',
  'phase4-5-frame-pacing.unit.test.mjs',
  'phase4-6-2-authority-and-pacing.unit.test.mjs',
  'core-textures-performance-isolation.contract.test.mjs',
  'cosmic-orb-core-texture.contract.test.mjs',
  'chromatic-waves-and-led-static.contract.test.mjs',
  'preset-parameter-ownership.unit.test.mjs',
]);

const missing = requiredTests.filter(file => !fs.existsSync(path.join(testDirectory, file)));
if (missing.length > 0) {
  console.error(`Required unit tests are missing:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

const testFiles = fs.readdirSync(testDirectory)
  .filter(file => file.endsWith('.test.mjs'))
  .sort()
  .map(file => path.join(testDirectory, file));

if (testFiles.length < requiredTests.length) {
  console.error(`Unit-test discovery failed: expected at least ${requiredTests.length}, found ${testFiles.length}.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);