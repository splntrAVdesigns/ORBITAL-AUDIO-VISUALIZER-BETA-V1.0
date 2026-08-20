import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

async function importBundled(relative) {
  const result = await build({
    entryPoints: [path.join(root, relative)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const parameters = await importBundled('src/app/runtime/parameters/RuntimeParameterTransactions.ts');
const resources = await importBundled('src/app/config/resourceLimits.ts');

const target = {};
const transaction = parameters.applyRuntimeParameterTransaction(target, {
  macro2: 160,
  fftSize: 11.6,
  shapeEdgeTrails: -0.25,
  darkStrobeDepth: 1.5,
  darkStrobeDisplacement: -0.4,
  beatPulseType: 'dark-strobe',
  centerImageMotionAmount: 1.4,
  centerImageMotionIntensity: Number.NaN,
  centerImageMotionType: 'teleport',
  coreParticlesShapeMode: 'invalid',
  unknownParameter: 1,
});
assert.equal(target.macro2, 100, 'macro values must be clamped');
assert.equal(target.fftSize, 12, 'FFT exponents must be clamped and integral');
assert.equal(target.shapeEdgeTrails, 0, 'Core Particle intensity must be clamped');
assert.equal(target.darkStrobeDepth, 1, 'Dark Strobe depth must be clamped');
assert.equal(target.darkStrobeDisplacement, 0, 'Dark Strobe displacement must be clamped');
assert.equal(target.beatPulseType, 'dark-strobe', 'Dark Strobe must be accepted by the typed enum authority');
assert.equal(target.centerImageMotionAmount, 1, 'Center Motion speed must be clamped');
assert.deepEqual(transaction.rejected.sort(), ['centerImageMotionIntensity', 'centerImageMotionType', 'coreParticlesShapeMode', 'unknownParameter']);
assert.deepEqual(transaction.clamped.sort(), ['centerImageMotionAmount', 'darkStrobeDepth', 'darkStrobeDisplacement', 'fftSize', 'macro2', 'shapeEdgeTrails']);

const storeSnapshot = {};
const store = { patch: patch => { Object.assign(storeSnapshot, patch); return Object.keys(patch); } };
const storeTransaction = parameters.applyRuntimeParameterStoreTransaction(store, {
  centerImageMotionIntensity: 0.75,
  shapeDensity: 2,
});
assert.equal(storeSnapshot.centerImageMotionIntensity, 0.75);
assert.equal(storeSnapshot.shapeDensity, 1);
assert.deepEqual(storeTransaction.clamped, ['shapeDensity']);

const validAudio = resources.validateAudioTrackResource(
  { name: 'track.wav', size: 20 * 1024 * 1024 },
  300,
  { trackCount: 0, totalBytes: 0 },
);
assert.equal(validAudio.valid, true);
assert.equal(resources.validateAudioTrackResource(
  { name: 'oversize.wav', size: resources.AUDIO_FILE_MAX_BYTES + 1 },
  300,
  { trackCount: 0, totalBytes: 0 },
).valid, false);
assert.equal(resources.validateCustomPresetResource(
  Array.from({ length: resources.SETTINGS_CUSTOM_PRESET_MAX_COUNT + 1 }, (_, index) => ({ name: `Preset ${index}` })),
).valid, false);
assert.equal(resources.validateBpmAnalysisResource(
  20 * 1024 * 1024,
  5 * 60,
  48_000,
  2,
).valid, true, 'normal tracks must remain eligible for automatic BPM analysis');
assert.equal(resources.validateBpmAnalysisResource(
  20 * 1024 * 1024,
  resources.BPM_ANALYSIS_MAX_DURATION_SECONDS + 1,
  48_000,
  2,
).valid, false, 'long compressed files must be rejected before full decode');
assert.equal(resources.validateDecodedBpmAudioResource(
  Math.ceil(resources.BPM_ANALYSIS_MAX_DECODED_BYTES / Float32Array.BYTES_PER_ELEMENT) + 1,
  1,
).valid, false, 'decoded PCM must obey its independent memory ceiling');
assert.equal(resources.validateCenterMediaAggregateResource(
  resources.CENTER_MEDIA_MAX_TOTAL_BYTES,
  1,
).valid, false, 'center-media slots must share one encoded-byte ceiling');
assert.equal(resources.validateCenterMediaAggregateResource(
  0,
  0,
  resources.CENTER_MEDIA_MAX_TOTAL_PIXELS,
  1,
).valid, false, 'center-media slots must share one decoded-pixel ceiling');

const sourceFiles = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .map(String)
  .filter((file) => /\.(?:ts|tsx)$/.test(file));
const legacyImpactReferences = sourceFiles.filter((file) => read(path.join('src', file)).includes('impactSparks'));
assert.deepEqual(legacyImpactReferences, [], 'legacy impactSparks wiring must be absent');

const index = read('index.html');
const gifExport = read('src/app/utils/gifExport.ts');
const audioSystem = read('src/app/engine/AudioSystemInit.ts');
const centerGraphicController = read('src/app/controllers/centerGraphicController.ts');
const mobileBlocker = read('src/app/components/MobileBlocker.tsx');
const vercel = read('vercel.json');
assert.match(index, /src=["']\/vendor\/gif\.js["']/);
assert.match(gifExport, /GIF_WORKER_SCRIPT\s*=\s*['"]\/vendor\/gif\.worker\.js['"]/);
assert.doesNotMatch(index + gifExport, /cdn\.jsdelivr\.net/);
assert.match(vercel, /Content-Security-Policy/);
assert.match(audioSystem, /validateBpmAnalysisResource\(file\.size, durationSeconds, AC\.sampleRate\)/);
assert.match(audioSystem, /validateDecodedBpmAudioResource\(audioBuffer\.length, audioBuffer\.numberOfChannels\)/);
assert.match(centerGraphicController, /validateCenterMediaAggregateResource/);
assert.match(mobileBlocker, /HTTP:\/\/SPLNTR-MICROTOOLS\.COM/);
assert.match(vercel, /https:\/\/api\.qrserver\.com/);
assert.ok(fs.existsSync(path.join(root, '.gitignore')));
assert.ok(fs.existsSync(path.join(root, '.nvmrc')));
assert.ok(fs.existsSync(path.join(root, 'public/vendor/gif.js')));
assert.ok(fs.existsSync(path.join(root, 'public/vendor/gif.worker.js')));

console.log('Beta safety contracts passed: typed parameters, decoded/aggregate resource budgets, release hygiene, local GIF, and CSP.');
