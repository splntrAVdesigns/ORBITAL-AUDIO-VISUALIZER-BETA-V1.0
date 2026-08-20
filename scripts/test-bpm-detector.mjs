import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const sourcePath = path.resolve('src/app/runtime/bpm/BpmDetector.ts');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-bpm-detector-'));
const tscPath = path.resolve('node_modules/typescript/bin/tsc');

function makeClickTrack(bpm, sampleRate = 8000, seconds = 24) {
  const data = new Float32Array(sampleRate * seconds);
  const beatSamples = Math.round(sampleRate * 60 / bpm);
  for (let start = 0; start < data.length; start += beatSamples) {
    for (let i = 0; i < Math.min(120, data.length - start); i += 1) {
      data[start + i] += Math.exp(-i / 22) * (i % 2 === 0 ? 1 : -1);
    }
  }
  return data;
}

try {
  const compile = spawnSync(process.execPath, [
    tscPath, sourcePath,
    '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler',
    '--skipLibCheck', '--outDir', tempDir,
  ], { encoding: 'utf8' });
  if (compile.status !== 0) throw new Error(`BPM detector compile failed:\n${compile.stdout}\n${compile.stderr}`);
  const compiledPath = path.join(tempDir, 'BpmDetector.js');
  const { analyzeTempoFromChannels } = await import(`${pathToFileURL(compiledPath).href}?v=${Date.now()}`);

  for (const expected of [70, 100, 120, 128, 140, 174, 180]) {
    const result = analyzeTempoFromChannels([makeClickTrack(expected)], 8000);
    assert.ok(result, `expected a result for ${expected} BPM`);
    assert.ok(Math.abs(result.bpm - expected) <= 2, `${expected} BPM resolved as ${result.bpm}`);
    assert.ok(result.confidence > 0.08, `${expected} BPM confidence should be usable`);
  }
  console.log('BPM detector deterministic fixtures passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
