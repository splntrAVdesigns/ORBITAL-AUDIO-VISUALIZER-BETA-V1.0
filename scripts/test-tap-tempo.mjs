import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const sourcePath = path.resolve('src/app/runtime/bpm/BpmClockRuntime.ts');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-tap-tempo-'));
const tscPath = path.resolve('node_modules/typescript/bin/tsc');

try {
  const compile = spawnSync(process.execPath, [
    tscPath,
    sourcePath,
    '--target', 'ES2022',
    '--module', 'ESNext',
    '--moduleResolution', 'Bundler',
    '--skipLibCheck',
    '--outDir', tempDir,
  ], { encoding: 'utf8' });

  if (compile.status !== 0) {
    throw new Error(`Tap Tempo test compile failed:\n${compile.stdout}\n${compile.stderr}`);
  }

  const findCompiledFile = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = findCompiledFile(full);
        if (nested) return nested;
      } else if (entry.name === 'BpmClockRuntime.js') {
        return full;
      }
    }
    return null;
  };

  const compiledPath = findCompiledFile(tempDir);
  if (!compiledPath) throw new Error('Tap Tempo compiled module was not produced');

  const { BpmClockRuntime } = await import(`${pathToFileURL(compiledPath).href}?v=${Date.now()}`);
  const clock = new BpmClockRuntime();

  clock.tap(0);
  clock.tap(500);
  clock.tap(1000);
  const result = clock.tap(1500);
  assert.equal(result.committed, true, 'four taps should commit a tempo');
  assert.equal(result.bpm, 120, '500 ms tap spacing should resolve to 120 BPM');
  assert.equal(clock.state.mode, 'manual', 'tap tempo should select manual BPM mode');

  const fourthBeat = clock.frame(1500);
  assert.equal(fourthBeat.beatIndex, 3, 'fourth tap should align to beat four');
  const nextDownbeat = clock.frame(2000);
  assert.equal(nextDownbeat.beatIndex, 0, 'next beat should wrap to the downbeat');
  assert.equal(nextDownbeat.downbeat, true, 'wrapped beat should be marked as the downbeat');

  clock.setAutoBpm(128, 2100);
  assert.equal(clock.state.bpm, 120, 'detected BPM must not override manual mode');
  clock.activateAuto(2200);
  assert.equal(clock.state.bpm, 128, 'AUTO mode should restore the latest detected BPM');

  clock.tap(3000);
  assert.equal(clock.frame(3100).tapCount, 1, 'tap sequence should report progress');
  assert.equal(clock.frame(5301).tapCount, 0, 'tap sequence should expire without a timer');

  console.log('Tap Tempo deterministic test passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
