import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('src/app/App.tsx', 'utf8');
const presetActions = fs.readFileSync('src/app/utils/presetActions.ts', 'utf8');

test('Macro 2 keeps drag values out of committed runtime state until commit', () => {
  const changeStart = app.indexOf('const handleMacroChange');
  const commitStart = app.indexOf('const handleMacroCommit');
  const liveHandler = app.slice(changeStart, commitStart);
  const commitHandler = app.slice(commitStart, app.indexOf('const liveRenderMode', commitStart));

  assert.doesNotMatch(liveHandler, /applyMacro|applyRuntimeParameterTransaction|window\.params/);
  assert.match(liveHandler, /all visual macro gestures are draft-only until release/);
  assert.match(commitHandler, /applyRuntimeParameterTransaction\(params, \{ \[macroId\]: value \}\)/);
  assert.match(commitHandler, /applyMacro\?\.\(macroId, value, \{ immediateDom: true, interactionPhase: 'commit' \}\)/);
});

test('rotation reset has one Macro 2 home-ease owner', () => {
  const resetStart = presetActions.indexOf('function resetRotationSync()');
  const resetEnd = presetActions.indexOf('function resetOuterHaloCenterLayer()', resetStart);
  const resetRotationSync = presetActions.slice(resetStart, resetEnd);

  assert.match(resetRotationSync, /applyMacro\('macro2', 0, \{ syncDom: true, immediateDom: true \}\)/);
  assert.doesNotMatch(resetRotationSync, /ctx\.startRotationHomeEase\(/);
});
