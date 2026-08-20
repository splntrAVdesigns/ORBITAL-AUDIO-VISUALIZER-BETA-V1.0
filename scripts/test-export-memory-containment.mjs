import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-export-memory-'));
const tscPath = path.resolve('node_modules/typescript/bin/tsc');

try {
  const compile = spawnSync(process.execPath, [
    tscPath,
    'src/app/utils/gifExport.ts',
    '--target', 'ES2022',
    '--module', 'ESNext',
    '--moduleResolution', 'Bundler',
    '--lib', 'ES2022,DOM,DOM.Iterable',
    '--skipLibCheck',
    '--strict',
    '--outDir', tempDir,
  ], { encoding: 'utf8' });
  if (compile.status !== 0) {
    throw new Error(`GIF export compile failed:\n${compile.stdout}\n${compile.stderr}`);
  }

  const modulePath = path.join(tempDir, 'gifExport.js');
  const gifExport = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);
  const budget = gifExport.DEFAULT_GIF_MEMORY_BUDGET_BYTES;

  const fiveSecondPlan = gifExport.createGIFExportPlan({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 5,
    fps: 30,
    width: 800,
    height: 800,
  });
  assert.ok(fiveSecondPlan.adjusted, 'unsafe 800×800 30 FPS capture must be adjusted');
  assert.ok(
    fiveSecondPlan.estimatedWorkingSetBytes <= budget,
    'five-second capture plan must remain within the hard working-set budget',
  );
  assert.ok(fiveSecondPlan.totalFrames <= 150);
  assert.ok(fiveSecondPlan.fps >= 8 && fiveSecondPlan.fps <= 30);
  assert.ok(fiveSecondPlan.width >= 160 && fiveSecondPlan.height >= 160);

  const tenSecondPlan = gifExport.createGIFExportPlan({
    sourceWidth: 3840,
    sourceHeight: 2160,
    duration: 10,
    fps: 30,
    width: 800,
    height: 800,
  });
  assert.ok(
    tenSecondPlan.estimatedWorkingSetBytes <= budget,
    'maximum-duration capture plan must remain within the hard working-set budget',
  );
  assert.ok(tenSecondPlan.totalFrames <= 300);

  const alreadySafePlan = gifExport.createGIFExportPlan({
    sourceWidth: 320,
    sourceHeight: 180,
    duration: 3,
    fps: 12,
    width: 320,
    height: 180,
  });
  assert.equal(alreadySafePlan.adjusted, false, 'safe capture settings must remain unchanged');

  const source = fs.readFileSync('src/app/utils/gifExport.ts', 'utf8');
  const recordingSource = fs.readFileSync('src/app/engine/RecordingEngine.ts', 'utf8');
  assert.ok(!source.includes('private frames:'), 'GIFExporter must not retain a parallel frame collection');
  assert.ok(!/private\s+\w+\s*:\s*ImageData\[\]/.test(source), 'GIFExporter must not accumulate full-session ImageData arrays');
  assert.ok(!source.includes('getImageData('), 'capture must not create a new ImageData object for each frame');
  assert.ok(source.includes('this.encoder.addFrame(this.captureContext'), 'frames must be handed to gif.js incrementally');
  assert.ok(source.includes('copy: true'), 'the reusable capture surface must be copied by the encoder');
  assert.ok(source.includes('memoryBudgetBytes'), 'capture must have an explicit memory budget');
  assert.ok(source.includes('captureTimerId') && source.includes('captureRafId'), 'capture scheduling handles must be owned');
  assert.ok(source.includes('encoder.abort()'), 'cancellation must abort active encoder workers');
  assert.ok(source.includes('releaseDownloadUrl()'), 'download object URLs must have deterministic cleanup');
  assert.ok(recordingSource.includes('this.gifExporter.dispose()'), 'recording-engine teardown must dispose GIF resources');
  assert.ok(recordingSource.includes('clearGIFModalCloseTimer'), 'progress-modal close work must be cancellable');
  assert.ok(recordingSource.includes('gifPreflightController'), 'GIF library preflight polling must be abortable');

  console.log('GIF export memory-containment and cancellation tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
