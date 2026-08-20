import assert from 'node:assert/strict';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

test('every numeric and string runtime parameter has an explicit domain', async context => {
  const transactions = await importBundledTypescript(
    'src/app/runtime/parameters/RuntimeParameterTransactions.ts',
    context,
  );
  assert.deepEqual(transactions.getRuntimeParameterConstraintCoverage(), {
    numericWithoutConstraint: [],
    stringWithoutConstraint: [],
  });
});

test('numeric transactions clamp continuous and discrete controls', async context => {
  const { sanitizeRuntimeParameterPatch } = await importBundledTypescript(
    'src/app/runtime/parameters/RuntimeParameterTransactions.ts',
    context,
  );
  const result = sanitizeRuntimeParameterPatch({
    spikeTightness: 9,
    recordFPS: 120,
    reactivityHz: 45,
    astralSymmetryFold: 10,
    dotsDensity: 9999,
  });
  assert.deepEqual(result.patch, {
    spikeTightness: 1.5,
    recordFPS: 60,
    reactivityHz: 30,
    astralSymmetryFold: 8,
    dotsDensity: 270,
  });
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.clamped, [
    'spikeTightness',
    'recordFPS',
    'reactivityHz',
    'astralSymmetryFold',
    'dotsDensity',
  ]);
});

test('categorical transactions preserve compatibility values and reject unknown input', async context => {
  const { sanitizeRuntimeParameterPatch } = await importBundledTypescript(
    'src/app/runtime/parameters/RuntimeParameterTransactions.ts',
    context,
  );
  const accepted = sanitizeRuntimeParameterPatch({
    astralShape: 'flower-of-life',
    coreTexturesShaderId: 'chromatic-waves',
    centerImageColorGrade: 'cyberpunk',
    coreTexturesFrequencyRange: 'bass',
    astralCustomColor: '#04D9FF',
  });
  assert.deepEqual(accepted.rejected, []);
  assert.equal(accepted.patch.astralShape, 'flower-of-life');
  assert.equal(accepted.patch.coreTexturesShaderId, 'chromatic-waves');
  assert.equal(accepted.patch.centerImageColorGrade, 'coolCyberpunk');
  assert.equal(accepted.patch.coreTexturesFrequencyRange, 'low');
  assert.equal(accepted.patch.astralCustomColor, '#04D9FF');
  assert.deepEqual(accepted.clamped, ['centerImageColorGrade', 'coreTexturesFrequencyRange']);

  const rejected = sanitizeRuntimeParameterPatch({
    astralShape: 'not-a-real-shape',
    coreTexturesShaderId: 'remote-shader',
    centerImageColorGrade: 'unknown-grade',
    astralCustomColor: 'javascript:alert(1)',
  });
  assert.deepEqual(rejected.patch, {});
  assert.deepEqual(rejected.rejected, [
    'astralShape',
    'coreTexturesShaderId',
    'centerImageColorGrade',
    'astralCustomColor',
  ]);
});

test('every built-in preset is accepted by the transaction authority', async context => {
  const { sanitizeRuntimeParameterPatch } = await importBundledTypescript(
    'src/app/runtime/parameters/RuntimeParameterTransactions.ts',
    context,
  );
  const { presets } = await importBundledTypescript('src/app/data/presets.ts', context);
  const { defaultParams } = await importBundledTypescript('src/app/config/defaultParams.ts', context);
  for (const preset of presets) {
    const recognizedSettings = Object.fromEntries(
      Object.entries(preset.settings).filter(([key]) => Object.hasOwn(defaultParams, key)),
    );
    const result = sanitizeRuntimeParameterPatch(recognizedSettings);
    assert.deepEqual(result.rejected, [], `${preset.name} has unsupported parameter keys or values`);
  }
});