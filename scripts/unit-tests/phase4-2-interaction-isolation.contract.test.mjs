import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('macro drag stays local/mutable and React commits only at interaction completion', () => {
  const app = read('src/app/App.tsx');
  const knob = read('src/app/components/MacroKnob.tsx');
  const macros = read('src/app/components/MacrosSection.tsx');
  assert.match(app, /const handleMacroChange = useCallback/);
  const changeStart = app.indexOf('const handleMacroChange');
  const commitStart = app.indexOf('const handleMacroCommit');
  assert.doesNotMatch(app.slice(changeStart, commitStart), /applyMacro|applyRuntimeParameterTransaction/);
  assert.match(app, /applyMacro\?\.\(macroId, value, \{ immediateDom: true, interactionPhase: 'commit' \}\)/);
  assert.match(app, /const handleMacroCommit = useCallback/);
  assert.match(knob, /const committed = latestValueRef\.current;[\s\S]{0,220}onCommit\(committed\)/);
  assert.match(macros, /onMacroCommit/);
  assert.doesNotMatch(app, /scheduleMacroValuesFlush|pendingMacroValuesRef|macroValuesSchedulerRef/);
});

test('metadata and audio tabs are isolated from top-level App React state', () => {
  const app = read('src/app/App.tsx');
  const panel = read('src/app/components/ControlPanel.tsx');
  const store = read('src/app/runtime/controlPanelRuntimeStore.ts');
  assert.doesNotMatch(app, /const \[metadata, setMetadata\]/);
  assert.doesNotMatch(app, /audioTab=\{audioTab\}|metadata=\{metadata\}/);
  assert.match(app, /setMetadata: publishAudioMetadata/);
  assert.match(panel, /useControlPanelAudioTab/);
  assert.match(panel, /AudioMetadataStrip/);
  assert.match(store, /useSyncExternalStore/);
  assert.match(panel, /hidden=\{audioTab !== 'controls'\}/);
  assert.match(panel, /hidden=\{audioTab !== 'playlist'\}/);
});

test('panel paint and randomizer work are bounded for real-time rendering', () => {
  const css = read('src/styles/globals.css');
  const preset = read('src/app/utils/presetActions.ts');
  const uiSideEffects = read('src/app/runtime/visualizer/ui/ProductionUISideEffectRuntime.ts');
  assert.match(css, /\.panel-render-island[\s\S]*content-visibility:\s*auto/);
  assert.match(css, /#panel\{[\s\S]*contain:\s*layout paint style/);
  assert.match(preset, /scheduleLatestControlTransaction/);
  assert.match(preset, /processed < 8/);
  assert.match(preset, /fftSize:\s*pick\([^\n]*\[9, 10\]/);
  assert.match(preset, /deferDomSync:\s*true/);
  assert.match(uiSideEffects, /maxUpdatesPerFlush:\s*4/);
  assert.match(uiSideEffects, /maxFlushMs:\s*1\.5/);
});

test('interaction diagnostics compare worker state, frame gaps, panel renders, and audio stalls', () => {
  const diagnostics = read('src/app/runtime/uiInteractionRuntime.ts');
  for (const marker of [
    'maxMacroFrameGap', 'maxTabSwitchFrameGap', 'panelRenders', 'audioUnderruns',
    'workerStage', 'workerActive', 'maxControlTransactionMs',
  ]) assert.match(diagnostics, new RegExp(marker));
  assert.doesNotMatch(diagnostics, /requestAnimationFrame\s*\(/);
});

test('panel scrolling cannot gate the live frame engine', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const scheduler = read('src/app/runtime/visualizer/RuntimeFrameScheduler.ts');
  const host = read('src/app/runtime/visualizer/hosts/MainThreadRenderHost.ts');

  // The visualizer session must not subscribe to panel scroll or introduce a
  // debounce/paused flag. Native passive panel scrolling is isolated in CSS/UI.
  assert.doesNotMatch(session, /_scrollPaused|_scrollResumeTimer|_onPanelScroll/);
  assert.doesNotMatch(session, /querySelector\(['"]\.panel-scrollable['"]\)/);
  assert.doesNotMatch(session, /addEventListener\(['"]scroll['"]/);

  // Every scheduler tick reaches the frame engine directly, so frame index,
  // audio reactivity, and motion clocks continue while the panel scrolls.
  assert.match(
    host,
    /onFrame:\s*\(timing:\s*RuntimeFrameTiming\)\s*=>\s*this\.frameEngine\.run\(\{ now: timing\.now, timing \}\)/,
  );
  assert.match(scheduler, /this\.frameIndex \+= 1;/);
  assert.match(scheduler, /this\.rafId = null;[\s\S]{0,180}this\.schedule\(\);/);
  assert.match(scheduler, /this\.options\.onFrame\(timing\);/);
});
