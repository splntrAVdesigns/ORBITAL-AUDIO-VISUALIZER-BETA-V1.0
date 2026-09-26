import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

// Sprint K1: preset determinism guard.
// Every parameter with a UI control (DOM id === parameter key) must be either
//   (a) restored by applyPreset AND stored by getCurrentSettings, or
//   (b) listed in NON_PRESET_PARAMETERS with a reason.
// Adding a new UI parameter without doing one of those fails this test.

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function componentSource() {
  const dir = path.join(root, 'src/app/components');
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx')) out.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return out.join('\n');
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `end marker not found after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('every UI parameter is preset-owned (loaded + saved) or explicitly non-preset', async (t) => {
  const { defaultParams } = await importBundledTypescript('src/app/config/defaultParams.ts', t);
  const ownership = await importBundledTypescript('src/app/config/presetParameterOwnership.ts', t);
  const { NON_PRESET_PARAMETERS, GENERIC_PRESET_PARAMETERS } = ownership;

  const components = componentSource();
  const uiParams = Object.keys(defaultParams).filter((key) => components.includes(`id="${key}"`));
  assert.ok(uiParams.length > 100, `expected >100 UI parameters, found ${uiParams.length}`);

  const actions = read('src/app/utils/presetActions.ts');
  const applyBody = sliceBetween(actions, 'function applyPreset(', 'function syncMacrosToPreset(');
  const saveBody = sliceBetween(actions, 'function getCurrentSettings(', 'return settings;');

  const generic = new Map(GENERIC_PRESET_PARAMETERS.map((e) => [e.key, e]));
  const loadedExplicitly = (key) => new RegExp(`["']#${escapeRe(key)}["']`).test(applyBody);
  const savedExplicitly = (key) => new RegExp(`\\b${escapeRe(key)}\\s*:`).test(saveBody);

  const problems = [];
  for (const key of uiParams) {
    if (Object.prototype.hasOwnProperty.call(NON_PRESET_PARAMETERS, key)) continue;
    const entry = generic.get(key);
    const loaded = loadedExplicitly(key) || Boolean(entry?.load);
    const saved = savedExplicitly(key) || Boolean(entry?.save);
    if (!loaded) problems.push(`${key}: not restored on preset load`);
    if (!saved) problems.push(`${key}: not stored in custom presets`);
  }
  assert.deepEqual(problems, [],
    'Classify these in src/app/config/presetParameterOwnership.ts (GENERIC_PRESET_PARAMETERS or NON_PRESET_PARAMETERS):\n' + problems.join('\n'));
});

test('ownership table is internally consistent', async (t) => {
  const { defaultParams } = await importBundledTypescript('src/app/config/defaultParams.ts', t);
  const { NON_PRESET_PARAMETERS, GENERIC_PRESET_PARAMETERS } =
    await importBundledTypescript('src/app/config/presetParameterOwnership.ts', t);
  const components = componentSource();
  const actions = read('src/app/utils/presetActions.ts');
  const applyBody = sliceBetween(actions, 'function applyPreset(', 'function syncMacrosToPreset(');
  const saveBody = sliceBetween(actions, 'function getCurrentSettings(', 'return settings;');

  const seen = new Set();
  for (const entry of GENERIC_PRESET_PARAMETERS) {
    assert.ok(!seen.has(entry.key), `${entry.key} listed twice`);
    seen.add(entry.key);
    assert.ok(entry.key in defaultParams, `${entry.key} is not a defaultParams key`);
    assert.ok(components.includes(`id="${entry.key}"`), `${entry.key} has no UI control with a matching id`);
    assert.ok(!(entry.key in NON_PRESET_PARAMETERS), `${entry.key} is both preset-owned and non-preset`);
    assert.ok(entry.load || entry.save, `${entry.key} syncs nothing`);
    // A side marked false must genuinely be handled explicitly, not silently dropped.
    if (!entry.load) assert.match(applyBody, new RegExp(`["']#${escapeRe(entry.key)}["']`), `${entry.key}: load=false but applyPreset does not set it`);
    if (!entry.save) assert.match(saveBody, new RegExp(`\\b${escapeRe(entry.key)}\\s*:`), `${entry.key}: save=false but getCurrentSettings does not store it`);
  }
  for (const [key, reason] of Object.entries(NON_PRESET_PARAMETERS)) {
    assert.ok(key in defaultParams, `${key} (non-preset) is not a defaultParams key`);
    assert.ok(typeof reason === 'string' && reason.length > 10, `${key} needs a reason`);
  }
});

test('generic control mapping round-trips every kind', async (t) => {
  const { writeOwnedControl, readOwnedControl } =
    await importBundledTypescript('src/app/config/presetParameterOwnership.ts', t);
  const fake = (type) => ({ type, value: '', checked: false });

  const range = fake('range');
  writeOwnedControl(range, 'value', 0.42);
  assert.equal(readOwnedControl(range, 'value', 0.1), 0.42);

  const select = fake('select-one');
  writeOwnedControl(select, 'value', 'bpm');
  assert.equal(readOwnedControl(select, 'value', 'free'), 'bpm');

  const box = fake('checkbox');
  writeOwnedControl(box, 'checked', true);
  assert.equal(readOwnedControl(box, 'checked', false), true);

  const hidden = fake('hidden');
  writeOwnedControl(hidden, 'checked', true);
  assert.equal(hidden.value, 'true');
  assert.equal(readOwnedControl(hidden, 'checked', false), true);

  const dir = fake('checkbox');
  writeOwnedControl(dir, 'direction-checked', -1);
  assert.equal(dir.checked, true);
  assert.equal(readOwnedControl(dir, 'direction-checked', 1), -1);
  writeOwnedControl(dir, 'direction-checked', 1);
  assert.equal(readOwnedControl(dir, 'direction-checked', 1), 1);

  const junk = fake('range');
  junk.value = 'not-a-number';
  assert.equal(readOwnedControl(junk, 'value', 0.35), 0.35, 'falls back to the default on bad input');
});
