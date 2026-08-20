import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default ?? traverseModule;

const root = process.cwd();
const appPath = path.join(root, 'src/app/App.tsx');
const hookPath = path.join(root, 'src/app/runtime/visualizer/useVisualizerRuntimeEffect.ts');
const bindingsPath = path.join(root, 'src/app/runtime/visualizer/VisualizerRuntimeBindings.ts');
const sessionPath = path.join(root, 'src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const sessionInfrastructurePath = path.join(root, 'src/app/runtime/visualizer/session/createRuntimeSessionInfrastructure.ts');
const rendererViewportSetupPath = path.join(root, 'src/app/runtime/visualizer/setup/createRendererViewportSetup.ts');
const audioRuntimeSetupPath = path.join(root, 'src/app/runtime/visualizer/audio/createAudioRuntimeSetup.ts');
const audioSessionStatePath = path.join(root, 'src/app/runtime/visualizer/audio/RuntimeAudioSessionState.ts');
const sessionInteractionSetupPath = path.join(root, 'src/app/runtime/visualizer/setup/createSessionInteractionSetup.ts');
const visualRuntimeResourcesPath = path.join(root, 'src/app/runtime/visualizer/setup/createVisualRuntimeResources.ts');
const featureSessionPath = path.join(root, 'src/app/runtime/visualizer/session/createVisualizerFeatureSession.ts');
const frameServicesPath = path.join(root, 'src/app/runtime/visualizer/setup/createVisualizerFrameServices.ts');
const productionFrameControllerPath = path.join(root, 'src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const packagePath = path.join(root, 'package.json');
const runtimeTsconfigPath = path.join(root, 'src/app/tsconfig.runtime.json');
const smokePath = path.join(root, 'scripts/smoke-app-mount.mjs');
const indexHtmlPath = path.join(root, 'index.html');
const viteConfigPath = path.join(root, 'vite.config.ts');
const publicFaviconPath = path.join(root, 'public/favicon.svg');
const localGifLibraryPath = path.join(root, 'public/vendor/gif.js');
const localGifWorkerPath = path.join(root, 'public/vendor/gif.worker.js');
const rootVercelConfigPath = path.join(root, 'vercel.json');
const nestedVercelConfigPath = path.join(root, 'src/app/vercel.json');
const fullscreenControllerPath = path.join(root, 'src/app/controllers/exportController.ts');
const keyboardShortcutPath = path.join(root, 'src/app/src/app/hooks/useKeyboardShortcuts.ts');
const globalStylesPath = path.join(root, 'src/styles/globals.css');
const uiEventHandlersPath = path.join(root, 'src/app/utils/uiEventHandlers.ts');
const bpmClockRuntimePath = path.join(root, 'src/app/runtime/bpm/BpmClockRuntime.ts');
const tapTempoControlPath = path.join(root, 'src/app/components/TapTempoControl.tsx');
const colorBpmSectionPath = path.join(root, 'src/app/components/ColorBPMSection.tsx');
const uiRefreshSchedulerPath = path.join(root, 'src/app/runtime/visualizer/pipeline/UIRefreshScheduler.ts');
const uiRefreshBusPath = path.join(root, 'src/app/runtime/visualizer/pipeline/MainThreadUIRefreshBus.ts');
const productionDiagnosticsPath = path.join(root, 'src/app/runtime/visualizer/diagnostics/ProductionRuntimeDiagnostics.ts');
const mainThreadRenderHostPath = path.join(root, 'src/app/runtime/visualizer/hosts/MainThreadRenderHost.ts');
const productionFrameRuntimePath = path.join(root, 'src/app/runtime/visualizer/frame/ProductionFrameRuntime.ts');

const performanceHudOverlayPath = path.join(root, 'src/app/components/PerformanceHUDOverlay.tsx');
const performanceHudSettingsPath = path.join(root, 'src/app/components/settings/PerformanceHUD.tsx');
const panelControllerPath = path.join(root, 'src/app/controllers/panelController.ts');
const viewportControllerPath = path.join(root, 'src/app/runtime/CanvasViewportController.ts');
const rotationAuthorityPath = path.join(root, 'src/app/utils/rotationAuthority.ts');
const rotationEnginePath = path.join(root, 'src/app/utils/rotationSyncEngine.ts');
const sparkCometPath = path.join(root, 'src/app/runtime/visualizer/renderers/SparkCometRuntime.ts');
const sparkSpriteAtlasPath = path.join(root, 'src/app/runtime/visualizer/renderers/SparkCometSpriteAtlas.ts');
const centerEmitterGeometryPath = path.join(root, 'src/app/runtime/visualizer/renderers/CenterEmitterGeometry.ts');
const canvasLayerRendererPath = path.join(root, 'src/app/renderers/canvasLayerRenderer.ts');
const crashTelemetryPath = path.join(root, 'src/app/runtime/crashTelemetry.ts');
const audioSoakPath = path.join(root, 'src/app/runtime/diagnostics/RuntimeAudioSoakMonitor.ts');
const mediaTelemetryPath = path.join(root, 'src/app/runtime/diagnostics/MediaTelemetryBridge.ts');

const assetRegistryPath = path.join(root, 'src/app/config/assets.ts');
const accidentalNestedAssetPath = path.join(root, 'src/app/src/app/config/assets.ts');
const builtInAssetFiles = [
  'assets/c80aa982ac9f9f0accc2e8fa020529c7250adeb5.png',
  'assets/6a628cfc4040bec6f754d249d9bf9f3431785802.png',
  'assets/c07a706be6b5d99d8083377c61a56d294c064ec0.png',
].map(name => path.join(root, name));


const frameDir = path.join(root, 'src/app/runtime/visualizer/frame');
const frameFiles = [
  'FrameEngineTypes.ts',
  'prepareFrame.ts',
  'updateFrame.ts',
  'executeRenderPipeline.ts',
  'publishFrameDiagnostics.ts',
  'finalizeFrame.ts',
  'RuntimeFrameEngine.ts',
].map(name => path.join(frameDir, name));

const read = p => fs.readFileSync(p, 'utf8');
const parseTs = (code, file) => parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], sourceFilename: file });
const errors = [];
const packageJson = JSON.parse(read(packagePath));
const requiredDevDependencies = ['@babel/parser', '@babel/traverse', 'typescript', 'happy-dom'];
for (const dependency of requiredDevDependencies) {
  if (!packageJson.devDependencies?.[dependency]) errors.push(`Missing explicit devDependency: ${dependency}`);
}
for (const script of ['validate:runtime', 'typecheck:runtime', 'test:beta-safety', 'test:phase4-8j', 'test:refactor-phase2', 'test:refactor-phase3', 'test:tap-tempo', 'test:runtime-soak', 'smoke:mount', 'verify']) {
  if (!packageJson.scripts?.[script]) errors.push(`Missing package script: ${script}`);
}
if (!fs.existsSync(runtimeTsconfigPath)) errors.push('Missing focused runtime tsconfig: tsconfig.runtime.json');
if (!fs.existsSync(smokePath)) errors.push('Missing application mount smoke test');
if (packageJson.scripts?.['test:tap-tempo'] !== 'node scripts/test-tap-tempo.mjs') errors.push('Tap Tempo deterministic test is not wired');
if (!packageJson.scripts?.verify?.includes('npm run test:tap-tempo')) errors.push('Full verify gate does not include Tap Tempo deterministic test');
if (packageJson.scripts?.['test:runtime-soak'] !== 'node scripts/test-runtime-soak.mjs') errors.push('Runtime soak certification test is not wired');
if (!packageJson.scripts?.verify?.includes('npm run test:runtime-soak')) errors.push('Full verify gate does not include the runtime soak certification');

if (!fs.existsSync(assetRegistryPath)) errors.push('Missing portable built-in asset registry: src/app/config/assets.ts');
if (fs.existsSync(accidentalNestedAssetPath)) errors.push('Accidental duplicate asset registry path still exists: src/app/src/app/config/assets.ts');
for (const file of builtInAssetFiles) {
  if (!fs.existsSync(file)) errors.push(`Missing built-in asset file: ${path.relative(root, file)}`);
}
if (fs.existsSync(assetRegistryPath)) {
  const assetRegistryCode = read(assetRegistryPath);
  try { parseTs(assetRegistryCode, assetRegistryPath); } catch (e) { errors.push(`src/app/config/assets.ts parse failed: ${e.message}`); }
  if (/figma:asset/.test(assetRegistryCode)) errors.push('Portable asset registry still imports figma:asset');
  const inlineImports = assetRegistryCode.match(/from\s+['"][^'"]+\.png\?inline['"]/g) ?? [];
  if (inlineImports.length !== builtInAssetFiles.length) {
    errors.push(`Expected ${builtInAssetFiles.length} inline built-in PNG imports, found ${inlineImports.length}`);
  }
  if (/from\s+['"][^'"]+\.png['"]/.test(assetRegistryCode)) {
    errors.push('Built-in logo registry still contains a route-dependent PNG import');
  }
  for (const requiredExport of [
    'orbitalLogo',
    'iconLogo',
    'defaultCenterLogo',
    'BUILT_IN_ASSETS',
    'BUILT_IN_ASSET_TRANSPORT',
    'recoverBuiltInAssetImage',
    'assertBuiltInAssetRegistry',
    'isInlineBuiltInAssetUrl',
  ]) {
    if (!new RegExp(`\\b${requiredExport}\\b`).test(assetRegistryCode)) errors.push(`Asset registry missing ${requiredExport}`);
  }
}
if (!fs.existsSync(publicFaviconPath)) errors.push('Missing Vite public favicon: public/favicon.svg');
if (!fs.existsSync(indexHtmlPath) || !/href=["']\/favicon\.svg["']/.test(read(indexHtmlPath))) {
  errors.push('index.html is not wired to /favicon.svg');
}
if (!fs.existsSync(localGifLibraryPath) || !fs.existsSync(localGifWorkerPath)) {
  errors.push('Pinned local GIF library/worker files are missing');
}
if (!fs.existsSync(indexHtmlPath) || !/src=["']\/vendor\/gif\.js["']/.test(read(indexHtmlPath))) {
  errors.push('index.html is not wired to the local GIF library');
}
if (fs.existsSync(indexHtmlPath) && /cdn\.jsdelivr\.net/.test(read(indexHtmlPath))) {
  errors.push('index.html still depends on a runtime jsDelivr script');
}
if (!fs.existsSync(rootVercelConfigPath) || !/Content-Security-Policy/.test(read(rootVercelConfigPath))) {
  errors.push('Root deployment config is missing Content-Security-Policy');
}
if (fs.existsSync(nestedVercelConfigPath)) errors.push('Legacy nested src/app/vercel.json must be removed');
if (!fs.existsSync(rootVercelConfigPath)) errors.push('Missing root-level vercel.json');
else {
  try {
    const vercelConfig = JSON.parse(read(rootVercelConfigPath));
    if (vercelConfig.framework !== 'vite') errors.push('Root vercel.json framework must be vite');
    if (vercelConfig.outputDirectory !== 'dist') errors.push('Root vercel.json outputDirectory must be dist');
  } catch (e) {
    errors.push(`Root vercel.json parse failed: ${e.message}`);
  }
}
if (!fs.existsSync(viteConfigPath) || !/path\.resolve\(__dirname,\s*['"]assets['"],\s*filename\)/.test(read(viteConfigPath))) {
  errors.push('Figma asset resolver does not target the root-level assets folder');
}
const runtimeComponentRoots = [path.join(root, 'src/app/components'), path.join(root, 'src/app/controllers')];
for (const directory of runtimeComponentRoots) {
  if (!fs.existsSync(directory)) continue;
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && /figma:asset/.test(read(full))) {
        errors.push(`Runtime logo consumer still imports figma:asset: ${path.relative(root, full)}`);
      }
    }
  };
  scan(directory);
}

for (const p of [appPath, hookPath, bindingsPath, sessionPath, sessionInfrastructurePath, rendererViewportSetupPath, audioRuntimeSetupPath, audioSessionStatePath, sessionInteractionSetupPath, visualRuntimeResourcesPath, featureSessionPath, frameServicesPath, productionFrameControllerPath, ...frameFiles]) {
  try { parseTs(read(p), p); } catch (e) { errors.push(`${path.relative(root,p)} parse failed: ${e.message}`); }
}

const hookLines = read(hookPath).split(/\r?\n/).length;
if (hookLines > 80) errors.push(`useVisualizerRuntimeEffect.ts is ${hookLines} lines; expected <= 80`);
if (/\[key:\s*string\]\s*:\s*any/.test(read(bindingsPath))) errors.push('Untyped index-signature dependency bag still exists');
if (/useEffect\s*\(/.test(read(sessionPath))) errors.push('Non-React runtime session still owns a React effect');


const decompositionFiles = [
  'src/app/runtime/visualizer/setup/createLegacyWebGLSetup.ts',
  'src/app/runtime/visualizer/setup/createRendererViewportSetup.ts',
  'src/app/runtime/visualizer/setup/createRuntimePassOwners.ts',
  'src/app/runtime/visualizer/setup/createSessionInteractionSetup.ts',
  'src/app/runtime/visualizer/setup/createVisualRuntimeResources.ts',
  'src/app/runtime/visualizer/setup/createVisualizerFrameServices.ts',
  'src/app/runtime/visualizer/audio/createAudioRuntimeSetup.ts',
  'src/app/runtime/visualizer/audio/RuntimeAudioSessionState.ts',
  'src/app/runtime/visualizer/session/RuntimeSessionDisposer.ts',
  'src/app/runtime/visualizer/session/createRuntimeSessionInfrastructure.ts',
  'src/app/runtime/visualizer/session/createVisualizerFeatureSession.ts',
  'src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts',
  'src/app/runtime/visualizer/state/SpikeRuntimeState.ts',
  'src/app/runtime/visualizer/state/CoreParticleRuntimeState.ts',
].map(name => path.join(root, name));
for (const file of decompositionFiles) {
  if (!fs.existsSync(file)) errors.push(`Missing Stage 3 runtime module: ${path.relative(root, file)}`);
  else {
    try { parseTs(read(file), file); } catch (e) { errors.push(`${path.relative(root,file)} parse failed: ${e.message}`); }
  }
}
const sessionLines = read(sessionPath).split(/\r?\n/).length;
if (sessionLines > 1000) errors.push(`createVisualizerRuntimeSession.ts is ${sessionLines} lines; Refactor Phase 3 target is <= 1000`);
if (!/createRendererViewportSetup\s*\(/.test(read(sessionPath))) errors.push('Renderer/viewport setup is not composed by the session entry point');
if (!/createLegacyWebGLSetup\s*\(/.test(read(rendererViewportSetupPath))) errors.push('Legacy WebGL setup is not owned by the renderer/viewport factory');
if (!/createRuntimeSessionInfrastructure\s*\(/.test(read(sessionPath))) errors.push('Runtime session infrastructure is not composed by the session entry point');
if (!/createAudioRuntimeSetup\s*\(/.test(read(sessionPath))) errors.push('Audio runtime setup is not composed by the session entry point');
if (!/createSessionInteractionSetup\s*\(/.test(read(sessionPath))) errors.push('Session interaction setup is not composed by the session entry point');
if (!/installRecordingRuntimeController\s*\(/.test(read(sessionInteractionSetupPath))) errors.push('Recording runtime controller is not owned by the interaction setup factory');
if (!/initAudioSystem\s*\(/.test(read(audioRuntimeSetupPath))) errors.push('Audio system initialization is not owned by the audio runtime factory');
if (!/new\s+RuntimeAudioSessionState\s*\(/.test(read(audioRuntimeSetupPath))) errors.push('Mutable audio session state is not owned by the audio runtime factory');
if (!/new\s+RuntimeSessionDisposer\s*\(/.test(read(sessionInfrastructurePath))) errors.push('Runtime session disposer is not active');
if (!/createVisualizerFeatureSession\s*\(/.test(read(sessionPath))) errors.push('Persistent feature state is not composed by the session entry point');
if (!/createVisualizerFrameServices\s*\(/.test(read(sessionPath))) errors.push('Frame services are not composed by the session entry point');
if (!/createVisualizerProductionFrameController\s*\(/.test(read(sessionPath))) errors.push('Production frame controller is not composed by the session entry point');
if (!/createVisualEffectResources\s*\(/.test(read(frameServicesPath)) || !/createVisualFrameResources\s*\(/.test(read(frameServicesPath))) errors.push('Visual runtime resources are not owned by the frame-service factory');
if (!/createRuntimePassOwners\s*\(/.test(read(visualRuntimeResourcesPath))) errors.push('Pass owner setup is not owned by the visual resource factory');

const lifecycleFiles = [
  'src/app/runtime/visualizer/session/RuntimeAsyncRegistry.ts',
  'src/app/runtime/visualizer/session/createRuntimeSessionInfrastructure.ts',
  'src/app/runtime/visualizer/session/RuntimeEventRegistry.ts',
  'src/app/runtime/visualizer/session/RuntimeResourceDiagnostics.ts',
  'src/app/runtime/mainThread/MainThreadAsyncDiagnostics.ts',
  'src/app/runtime/visualizer/runtime-typecheck-entry.ts',
  'src/app/runtime/visualizer/frame/FrameEngineTypes.ts',
].map(name => path.join(root, name));
for (const file of lifecycleFiles) {
  if (!fs.existsSync(file)) errors.push(`Missing lifecycle/validation module: ${path.relative(root, file)}`);
  else {
    try { parseTs(read(file), file); } catch (e) { errors.push(`${path.relative(root,file)} parse failed: ${e.message}`); }
  }
}


// Sprint 22N.C.4F-G: the main screen must not introduce continuous secondary RAF loops.
const audioTrackProgressPath = path.join(root, 'src/app/components/AudioTrackProgress.tsx');
if (/requestAnimationFrame|cancelAnimationFrame/.test(read(audioTrackProgressPath))) {
  errors.push('AudioTrackProgress still owns a secondary RAF');
}
if (!/mainThreadUIRefreshBus\.subscribeAudioProgress/.test(read(audioTrackProgressPath))) {
  errors.push('AudioTrackProgress is not driven by the authoritative UI refresh bus');
}

for (const hudPath of [performanceHudOverlayPath, performanceHudSettingsPath]) {
  const hudCode = read(hudPath);
  if (/setInterval\s*\(/.test(hudCode)) errors.push(`${path.relative(root, hudPath)} still owns a Performance HUD interval`);
  if (!/subscribePerformanceHUD/.test(hudCode)) errors.push(`${path.relative(root, hudPath)} is not driven by MainThreadUIRefreshBus`);
}
if (!/publishPerformanceHUD/.test(read(productionDiagnosticsPath))) errors.push('Production diagnostics do not publish HUD snapshots from the authoritative scheduler');
if (!/SHORT_LIVED_LAYOUT_SETTLE_RAF/.test(read(panelControllerPath))) errors.push('Panel two-frame settle RAF is not classified as short-lived');
if (!/SHORT_LIVED_LAYOUT_SETTLE_RAF/.test(read(viewportControllerPath))) errors.push('Viewport two-frame settle RAF is not classified as short-lived');
const panelControllerCode = read(panelControllerPath);
const viewportControllerCode = read(viewportControllerPath);
if (/\bsetTimeout\s*\(|\brequestAnimationFrame\s*\(/.test(panelControllerCode)) {
  errors.push('Panel controller still owns raw timer/RAF scheduling instead of tracked coalesced work');
}
if (!/panel-width-resize/.test(panelControllerCode) || !/cancelCollapseSettlement/.test(panelControllerCode)) {
  errors.push('Panel resize coalescing or settlement cancellation is incomplete');
}
if (/\brequestAnimationFrame\s*\(/.test(viewportControllerCode)) {
  errors.push('Viewport controller bypasses tracked short-lived RAF ownership');
}
if (!/viewport-settle-1/.test(viewportControllerCode) || !/viewport-settle-2/.test(viewportControllerCode)) {
  errors.push('Viewport two-frame settlement sequence was removed or is not tracked');
}
for (const file of [rotationAuthorityPath, rotationEnginePath, sparkCometPath, sparkSpriteAtlasPath, centerEmitterGeometryPath, canvasLayerRendererPath, crashTelemetryPath, audioSoakPath, mediaTelemetryPath]) {
  if (!fs.existsSync(file)) errors.push(`Missing Sprint 22N.C.6.6 module: ${path.relative(root, file)}`);
  else {
    try { parseTs(read(file), file); } catch (e) { errors.push(`${path.relative(root,file)} parse failed: ${e.message}`); }
  }
}
const rotationAuthorityCode = read(rotationAuthorityPath);
if (!/pendingMode/.test(rotationAuthorityCode) || !/nearestVerticalRotation/.test(rotationAuthorityCode)) errors.push('Cardinal rotation mode-transition authority is incomplete');
if (/getAngleForDivision\(opts\.division\)\s*\*\s*signedScale/.test(read(rotationEnginePath))) errors.push('Quantized angle is still multiplied by fractional speed');
if (/rotationQuantizeDropdown\.value\s*=\s*['"]1\/1['"]/.test(read(sessionPath))) errors.push('Rotation mode changes still overwrite the selected division');
if (/bind\(["']#rotationQuantize["'][\s\S]{0,300}resetRotationState/.test(read(sessionPath))) errors.push('Division changes still invoke North/South homing');
const sparkCode = read(sparkCometPath);
const sparkSpriteCode = read(sparkSpriteAtlasPath);
if (/createLinearGradient/.test(sparkCode)) errors.push('Spark Comet frame render path still allocates CanvasGradient objects per particle');
if (/shadowBlur/.test(sparkCode)) errors.push('Spark Comet frame render path still mutates shadowBlur per particle');
if (!/SparkCometSpriteAtlas/.test(sparkCode) || !/drawImage/.test(sparkCode)) errors.push('Spark Comet runtime is not using the cached sprite renderer');
if (!/OffscreenCanvas/.test(sparkSpriteCode) || !/createLinearGradient/.test(sparkSpriteCode)) errors.push('Spark sprite atlas is not pre-rendering worker-safe cached comet sprites');
for (const diagnostic of ['maximumActive', 'emittedBursts', 'refractoryMs', 'renderMs', 'updateMs', 'qualityTier', 'droppedBursts', 'burstsPerSecond']) {
  if (!new RegExp(`\\b${diagnostic}\\b`).test(sparkCode)) errors.push(`Spark diagnostics missing ${diagnostic}`);
}
if (!/frameTimeMs:\s*framePacing\.avgFrameInterval/.test(read(productionFrameControllerPath))) errors.push('Spark adaptive quality is not receiving authoritative frame pacing');
if (!/__ORBITAL_AUDIO_SOAK__/.test(read(productionDiagnosticsPath))) errors.push('Audio soak before/after resource capture is not published');
if (!/__ORBITAL_SPARK_DIAGNOSTICS__/.test(read(productionDiagnosticsPath))) errors.push('Spark diagnostics are not published');
const centerEmitterCode = read(centerEmitterGeometryPath);
const canvasLayerCode = read(canvasLayerRendererPath);
const crashTelemetryCode = read(crashTelemetryPath);
if (!/minimumOriginRadius/.test(centerEmitterCode) || !/maximumOriginRadius/.test(centerEmitterCode)) errors.push('Center emitter geometry does not enforce a non-zero annular source shell');
if (!/emitterRadius:\s*centerEmitterGeometry\.emitterRadius/.test(read(productionFrameControllerPath)) || !/emitterBand:\s*centerEmitterGeometry\.emitterBand/.test(read(productionFrameControllerPath))) errors.push('Spark frame is not using the shared Center Glow emitter geometry');
if (!/geometry:\s*centerEmitterGeometry/.test(read(productionFrameControllerPath)) || !/burstImpulse:\s*sparkCometRuntime\.centerBurstImpulse/.test(read(productionFrameControllerPath))) errors.push('Center Glow is not sharing Spark emitter geometry/impulse');
if (!/sectorOrder/.test(sparkCode) || !/burstOffset/.test(sparkCode)) errors.push('Spark bursts are not using stratified 360-degree distribution');
if (/Math\.sqrt\(this\.random\(\)\)\s*\*\s*maxOriginRadius/.test(sparkCode)) errors.push('Legacy filled-disk Spark origin remains');
if (!/CenterEmitterGeometry/.test(canvasLayerCode)) errors.push('Center Glow renderer is not using shared emitter geometry');
for (const token of ['bootClassification', 'runtimeEvents', 'terminationEvidence', 'wasDiscarded', 'pagehidePersisted', 'pageshowPersisted', 'resumeWindow', 'vite:beforeFullReload', 'maximumLongFrameMs']) {
  if (!crashTelemetryCode.includes(token)) errors.push(`Crash telemetry attribution missing ${token}`);
}
if (!/framePacing:\s*publication\.framePacing/.test(read(productionDiagnosticsPath)) || !/activeEffects:/.test(read(productionDiagnosticsPath)) || !/audioState:\s*mediaState/.test(read(productionDiagnosticsPath))) {
  errors.push('Resume-window diagnostics are not receiving frame, effect, and audio snapshots');
}
const sessionLifecyclePaths = [sessionPath, sessionInfrastructurePath];
for (const lifecyclePath of sessionLifecyclePaths) {
  const lifecycleAst = parseTs(read(lifecyclePath), lifecyclePath);
  traverse(lifecycleAst, {
    CallExpression(p) {
      const callee = p.get('callee');
      if (callee.isIdentifier() && ['setTimeout', 'requestIdleCallback'].includes(callee.node.name)) {
        errors.push(`Untracked deferred callback in runtime session: ${callee.node.name}`);
      }
      if (callee.isMemberExpression() && callee.get('property').isIdentifier({ name: 'addEventListener' })) {
        errors.push('Direct addEventListener remains in runtime session; use RuntimeEventRegistry/controller ownership');
      }
    },
  });
}
const sessionLifecycleCode = sessionLifecyclePaths.map(read).join('\n');
if (!/new\s+RuntimeAsyncRegistry\s*\(/.test(sessionLifecycleCode)) errors.push('RuntimeAsyncRegistry is not active');
if (!/new\s+RuntimeEventRegistry\s*\(/.test(sessionLifecycleCode)) errors.push('RuntimeEventRegistry is not active');
if (!/createRuntimeResourceScope\s*\(/.test(sessionLifecycleCode)) errors.push('Runtime resource diagnostics scope is not active');
if (/window\.removeEventListener\(['"]wheel['"]/.test(sessionLifecycleCode)) errors.push('Canvas wheel cleanup still targets window');
if ((sessionLifecycleCode.match(/sessionDisposer\.dispose\s*\(/g) ?? []).length !== 2) {
  errors.push('Expected sessionDisposer.dispose only in initialization abort and final cleanup');
}

const appAst = parseTs(read(appPath), appPath);
let foundCall = false;
traverse(appAst, {
  CallExpression(p) {
    if (p.get('callee').isIdentifier({ name: 'useVisualizerRuntimeEffect' })) {
      foundCall = true;
      const arg = p.get('arguments.0');
      if (!arg?.isObjectExpression()) { errors.push('Runtime hook argument is not a grouped object'); return; }
      const expected = new Set(['enabled','activationKey','lifecycle','audio','controls','renderers','diagnostics','factories','utilities']);
      const actual = new Set();
      for (const prop of arg.get('properties')) {
        if (prop.isObjectProperty() && prop.get('key').isIdentifier()) actual.add(prop.node.key.name);
      }
      for (const k of expected) if (!actual.has(k)) errors.push(`Missing runtime binding group: ${k}`);
      for (const k of actual) if (!expected.has(k)) errors.push(`Unexpected runtime binding group: ${k}`);
      // Every shorthand binding must resolve in AppContent scope. This catches stale names like autoCycleTimer.
      for (const groupProp of arg.get('properties')) {
        if (!groupProp.isObjectProperty() || !groupProp.get('value').isObjectExpression()) continue;
        for (const prop of groupProp.get('value').get('properties')) {
          if (prop.isObjectProperty() && prop.node.shorthand && prop.get('value').isIdentifier()) {
            const name = prop.node.value.name;
            if (!p.scope.getBinding(name) && !new Set(['requestIdleCallback']).has(name)) errors.push(`Unresolved App runtime binding: ${name}`);
          }
        }
      }
    }
  }
});
if (!foundCall) errors.push('useVisualizerRuntimeEffect call not found');

for (const file of frameFiles) {
  if (!fs.existsSync(file)) errors.push(`Missing frame-engine module: ${path.relative(root, file)}`);
}
const sessionCode = read(sessionPath);
const productionFrameControllerCode = read(productionFrameControllerPath);
const mainThreadRenderHostCode = read(mainThreadRenderHostPath);
const productionFrameRuntimeCode = read(productionFrameRuntimePath);
if (!/new\s+RuntimeFrameEngine\s*\(/.test(mainThreadRenderHostCode)) errors.push('RuntimeFrameEngine is not instantiated by MainThreadRenderHost');
if (!/frameEngine\.run\s*\(/.test(mainThreadRenderHostCode)) errors.push('Authoritative scheduler is not delegating through RuntimeFrameEngine');
if (!/frameEngine\.dispose\s*\(/.test(mainThreadRenderHostCode)) errors.push('RuntimeFrameEngine disposal is missing');

if (/\bloopRunning\b/.test(sessionCode)) errors.push('Legacy loopRunning guard remains in the runtime session');
if (/WATCHDOG_TIMEOUT|lastFrameTime\s*=\s*performance\.now\(\)/.test(sessionCode)) {
  errors.push('Legacy RAF watchdog timing remains in the runtime session');
}
if (!/executeRenderPipeline:\s*frame\s*=>\s*\{[\s\S]*?options\.kernel\.render\(frame\.now,\s*frame\.timing\)/.test(mainThreadRenderHostCode) ||
    !/executeProductionFrame:\s*\(now,\s*timing\)\s*=>\s*\{[\s\S]*?executeVisualFramePipeline\(now,\s*timing\)/.test(productionFrameControllerCode)) {
  errors.push('RuntimeFrameEngine executeRenderPipeline phase is not the renderer authority');
}
if (!/publishDiagnostics:\s*options\.publishDiagnostics/.test(productionFrameRuntimeCode) || !/publishDiagnostics:\s*\(\)\s*=>\s*\{[\s\S]*?publishCurrentFrameDiagnostics\(\)/.test(productionFrameControllerCode)) {
  errors.push('Frame diagnostics are not isolated in the publish phase');
}
if (!/finalizeFrame:\s*options\.finalizeFrame/.test(productionFrameRuntimeCode) || !/finalizeFrame:\s*\(\)\s*=>\s*\{[\s\S]*?finalizeCurrentFrame\(\)/.test(productionFrameControllerCode)) {
  errors.push('Deferred UI finalization is not isolated in the finalize phase');
}

if (/LegacyLayerPassOwner/.test(sessionCode)) errors.push('LegacyLayerPassOwner still referenced by runtime session');
if (/\bspikePass\b/.test(sessionCode)) errors.push('Dead spikePass pipeline bridge still referenced by runtime session');
if (/\bparticlePass\b/.test(sessionCode)) errors.push('Dead particlePass pipeline bridge still referenced by runtime session');
const passOwnerSetupCode = read(path.join(root, 'src/app/runtime/visualizer/setup/createRuntimePassOwners.ts'));
if (/LegacyLayerPassOwner|spikes:\s*LegacyLayerPassOwner|particles:\s*LegacyLayerPassOwner/.test(passOwnerSetupCode)) {
  errors.push('Legacy spike/particle callback owners still exist in pass-owner setup');
}
const appCode = read(appPath);
if (/pipeline\/passes\/(spikePass|particlePass)/.test(appCode)) errors.push('App still imports dead spike/particle bridge passes');

// Sprint 22N.C.4E: renderer-system modules must remain React/DOM/global free.
const rendererSystemDir = path.join(root, 'src/app/runtime/visualizer/renderers');
const requiredRendererSystems = [
  'RendererSystem.ts',
  'SpikeRendererSystem.ts',
  'CoreParticleRendererSystem.ts',
  'DotRendererSystem.ts',
  'HaloRendererSystem.ts',
  'CenterMediaRendererSystem.ts',
  'PostEffectsRendererSystem.ts',
];
for (const name of requiredRendererSystems) {
  const file = path.join(rendererSystemDir, name);
  if (!fs.existsSync(file)) { errors.push(`Missing renderer-system module: ${name}`); continue; }
  const code = read(file);
  if (/from\s+['"]react['"]|require\(['"]react['"]\)/.test(code)) errors.push(`${name} imports React`);
  if (/\bdocument\b|querySelector|getElementById/.test(code)) errors.push(`${name} contains DOM access`);
  if (/\bwindow\b/.test(code)) errors.push(`${name} contains uncontrolled window access`);
  for (const method of ['update', 'render', 'reset', 'dispose']) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(code)) errors.push(`${name} missing ${method}()`);
  }
}


// Sprint 22N.C.5: validation wiring and reset-transaction invariants.
if (packageJson.scripts?.['typecheck:runtime'] !== 'tsc -p src/app/tsconfig.runtime.json') {
  errors.push('typecheck:runtime does not point to src/app/tsconfig.runtime.json');
}
if (packageJson.scripts?.['smoke:mount'] !== 'node scripts/smoke-app-mount.mjs') {
  errors.push('smoke:mount is not wired to the executable .mjs smoke test');
}
const parameterConversionsPath = path.join(root, 'src/app/config/parameterConversions.ts');
if (!fs.existsSync(parameterConversionsPath)) errors.push('Missing parameter conversion boundary');
else {
  try { parseTs(read(parameterConversionsPath), parameterConversionsPath); } catch (e) { errors.push(`parameterConversions.ts parse failed: ${e.message}`); }
}
const presetActionsPath = path.join(root, 'src/app/utils/presetActions.ts');
const presetActionsCode = read(presetActionsPath);
if (/\brequestAnimationFrame\s*\(/.test(presetActionsCode)) errors.push('Preset actions still own an uncancellable macro RAF');
if (!/macroDomSyncRafId/.test(presetActionsCode) || !/cancelTrackedShortLivedRaf\(macroDomSyncRafId\)/.test(presetActionsCode)) {
  errors.push('Preset macro DOM synchronization RAF is not retained/cancelled');
}
if (!/normalizeDotDensityForSlider\(preset\.dotsDensity\)/.test(presetActionsCode)) {
  errors.push('Preset dot density is not normalized at the UI boundary');
}
const resetMacroStart = presetActionsCode.indexOf('function resetMacros()');
const resetMacroEnd = presetActionsCode.indexOf('// Reset functions for individual sections', resetMacroStart);
const resetMacroBody = resetMacroStart >= 0 && resetMacroEnd > resetMacroStart
  ? presetActionsCode.slice(resetMacroStart, resetMacroEnd)
  : '';
const resetMacroMatch = resetMacroBody || null;
if (!resetMacroMatch) errors.push('resetMacros transaction was not found');
else {
  if (!/clearPendingControlTransactions\s*\(/.test(resetMacroMatch)) errors.push('resetMacros does not clear pending control transactions');
  if (!/const macroDefaults\s*=\s*\{/.test(resetMacroMatch)) errors.push('resetMacros does not define the canonical zeroed macro transaction');
  if (!/applyRuntimeParameterTransaction\(params,\s*\{\s*\[macroName\]:\s*0\s*\}\)/.test(resetMacroMatch)) errors.push('resetMacros bypasses the typed parameter transaction layer');
  if (/Object\.assign\(params,\s*defaultParams/.test(resetMacroMatch) || /applyPreset\(defaultParams/.test(resetMacroMatch)) {
    errors.push('resetMacros still performs an unrelated factory reset');
  }
}
if (!/clearPendingMacroTransactions/.test(appCode)) {
  errors.push('App does not expose deterministic pending-macro transaction cleanup');
}
if (!/clearPendingControlTransactions:\s*\(\)\s*=>\s*\{[\s\S]*?clearPendingMacroTransactions\(\)/.test(sessionCode)) {
  errors.push('Runtime reset transaction does not clear pending React macro commits');
}
const renderFrameRuntimePath = path.join(root, 'src/app/runtime/renderFrameRuntime.ts');
if (/createVisibilityRafController|requestAnimationFrame|cancelAnimationFrame/.test(read(renderFrameRuntimePath))) {
  errors.push('Legacy RAF ownership remains in renderFrameRuntime.ts');
}


// Sprint 22N.C.5.3: final cleanup, bridge classification and locked worker contract.
const proTipsPath = path.join(root, 'src/app/components/settings/ProTipsSection.tsx');
const proTipsCode = read(proTipsPath);
if (/gridTemplateRows|grid-template-rows/.test(proTipsCode)) {
  errors.push('Pro Tips still contains layout-driven grid-track animation');
}
if (!/aria-expanded=\{expanded\}/.test(proTipsCode)) {
  errors.push('Pro Tips disclosure is missing aria-expanded after animation cleanup');
}
const orphanedPresetManagementPath = path.join(root, 'src/app/utils/presetManagement.ts');
if (fs.existsSync(orphanedPresetManagementPath)) {
  errors.push('Orphaned presetManagement.ts still exists');
}
const architecturePath = path.join(root, 'src/app/ARCHITECTURE.md');
if (/presetManagement\.ts/.test(read(architecturePath))) {
  errors.push('ARCHITECTURE.md still documents removed presetManagement.ts');
}
const nestedPublicPath = path.join(root, 'src/app/public');
if (fs.existsSync(nestedPublicPath)) {
  errors.push('Legacy src/app/public directory still exists; Vite public assets must live in root public/');
}
const distVerifierPath = path.join(root, 'scripts/verify-dist-output.mjs');
if (!fs.existsSync(distVerifierPath)) errors.push('Missing production dist verification script');
if (packageJson.scripts?.['verify:dist'] !== 'node scripts/verify-dist-output.mjs') {
  errors.push('verify:dist is not wired to scripts/verify-dist-output.mjs');
}
if (packageJson.scripts?.['verify:worker-dist'] || packageJson.scripts?.['verify:worker-deployment']) {
  errors.push('Abandoned render-worker verification wiring is still present');
}
if (!packageJson.scripts?.verify?.endsWith('npm run build && npm run verify:dist')) {
  errors.push('Full verify gate does not finish with build and dist verification');
}

const windowBridgeManifestPath = path.join(root, 'src/app/runtime/mainThread/WindowBridgeManifest.ts');
const windowBridgeAuditPath = path.join(root, 'scripts/audit-window-bridges.mjs');
if (!fs.existsSync(windowBridgeManifestPath)) errors.push('Missing WindowBridgeManifest.ts');
else {
  const bridgeCode = read(windowBridgeManifestPath);
  for (const token of ['replace-before-worker-cutover', 'keep-main-thread-only', 'debug-only', 'WINDOW_BRIDGE_MANIFEST']) {
    if (!bridgeCode.includes(token)) errors.push(`Window bridge manifest missing ${token}`);
  }
}
if (!fs.existsSync(windowBridgeAuditPath)) errors.push('Missing custom Window bridge audit');
if (packageJson.scripts?.['audit:window-bridges'] !== 'node scripts/audit-window-bridges.mjs') {
  errors.push('audit:window-bridges package script is missing or incorrect');
}
if (!packageJson.scripts?.verify?.includes('npm run audit:window-bridges')) {
  errors.push('Full verify gate does not include the Window bridge audit');
}
if (packageJson.scripts?.['audit:async-ownership'] !== 'node scripts/audit-async-ownership.mjs') {
  errors.push('audit:async-ownership package script is missing or incorrect');
}
if (packageJson.scripts?.['test:async-lifecycle'] !== 'node scripts/test-async-lifecycle.mjs') {
  errors.push('test:async-lifecycle package script is missing or incorrect');
}
if (!packageJson.scripts?.verify?.includes('npm run audit:async-ownership') || !packageJson.scripts?.verify?.includes('npm run test:async-lifecycle')) {
  errors.push('Full verify gate does not include RAF/timer ownership certification');
}


// Sprint 22N.C.6 — Tap Tempo must remain driven by the primary scheduler.
for (const required of [bpmClockRuntimePath, tapTempoControlPath, colorBpmSectionPath, uiRefreshSchedulerPath, uiRefreshBusPath]) {
  if (!fs.existsSync(required)) errors.push(`Missing Tap Tempo module: ${path.relative(root, required)}`);
}
if (fs.existsSync(bpmClockRuntimePath)) {
  const code = read(bpmClockRuntimePath);
  try { parseTs(code, bpmClockRuntimePath); } catch (e) { errors.push(`BpmClockRuntime.ts parse failed: ${e.message}`); }
  for (const token of ['BpmClockRuntime', 'setAutoBpm', 'setManualBpm', 'activateAuto', 'tap(nowMs', 'beatIndex', 'barPhase']) {
    if (!code.includes(token)) errors.push(`BPM clock runtime missing ${token}`);
  }
  if (/requestAnimationFrame|setInterval|setTimeout|\bdocument\b|\bwindow\b/.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) {
    errors.push('BPM clock runtime owns a timer/RAF or DOM global');
  }
}
if (fs.existsSync(tapTempoControlPath)) {
  const code = read(tapTempoControlPath);
  try { parseTs(code, tapTempoControlPath); } catch (e) { errors.push(`TapTempoControl.tsx parse failed: ${e.message}`); }
  for (const token of ['tapTempo', 'bpmMode', 'subscribeBpmClock', 'Keyboard shortcut: T']) {
    if (!code.includes(token)) errors.push(`Tap Tempo control missing ${token}`);
  }
  if (/requestAnimationFrame|setInterval|setTimeout/.test(code)) errors.push('Tap Tempo control reintroduced a secondary scheduler');
}
if (fs.existsSync(colorBpmSectionPath) && !/TapTempoControl/.test(read(colorBpmSectionPath))) {
  errors.push('Color + BPM section does not mount TapTempoControl');
}

if (fs.existsSync(colorBpmSectionPath)) {
  const colorBpmCode = read(colorBpmSectionPath);
  for (const token of ['bpm-section-divider', 'bpm-control-row', 'bpm-value-group']) {
    if (!colorBpmCode.includes(token)) errors.push(`Compact BPM row missing ${token}`);
  }
}
if (fs.existsSync(tapTempoControlPath)) {
  const tapCode = read(tapTempoControlPath);
  const tapIndex = tapCode.indexOf('id="tapTempo"');
  const modeIndex = tapCode.indexOf('id="bpmMode"');
  const indicatorIndex = tapCode.indexOf('className="beat-indicator"');
  if (!(tapIndex >= 0 && modeIndex > tapIndex && indicatorIndex > modeIndex)) {
    errors.push('Tap Tempo layout order must be TAP, AUTO/MAN, then the far-right beat indicator');
  }
}
if (fs.existsSync(uiRefreshSchedulerPath) && !/beatClock:\s*1000\s*\/\s*30/.test(read(uiRefreshSchedulerPath))) {
  errors.push('Primary UI refresh scheduler is missing the 30 Hz beatClock channel');
}
if (fs.existsSync(uiRefreshBusPath) && !/publishBpmClock/.test(read(uiRefreshBusPath))) {
  errors.push('Main-thread UI refresh bus is missing BPM clock publication');
}
if (!/publishBpmClock\(bpmFrame\)/.test(read(productionFrameControllerPath))) {
  errors.push('Visualizer frame engine does not publish the BPM clock from the authoritative scheduler');
}

// Sprint 22N.C.6.1 — one fullscreen authority and borderless clean-canvas mode.
for (const required of [fullscreenControllerPath, keyboardShortcutPath, globalStylesPath]) {
  if (!fs.existsSync(required)) errors.push(`Missing fullscreen authority file: ${path.relative(root, required)}`);
}
if (fs.existsSync(fullscreenControllerPath)) {
  const fullscreenCode = read(fullscreenControllerPath);
  for (const token of ['toggleAppFullscreen', 'panelStateCaptured', 'handleFullscreenChange', 'handleEscape', 'onLayoutChange']) {
    if (!fullscreenCode.includes(token)) errors.push(`Fullscreen authority missing ${token}`);
  }
}
if (fs.existsSync(keyboardShortcutPath)) {
  const keyboardCode = read(keyboardShortcutPath);
  if (!/e\.code === 'KeyF'[\s\S]*?isProtectedTextEntry/.test(keyboardCode)) {
    errors.push('F shortcut is not guarded separately from generic input focus');
  }
  if (!/e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/.test(keyboardCode)) {
    errors.push('Fullscreen shortcut does not preserve browser modifier shortcuts');
  }
}
if (fs.existsSync(globalStylesPath)) {
  const styles = read(globalStylesPath);
  for (const token of ['body.collapsed #app-frame', 'html:fullscreen #app-frame', 'html:-webkit-full-screen #app-frame', '.bpm-control-row', '.beat-indicator']) {
    if (!styles.includes(token)) errors.push(`Global styles missing ${token}`);
  }
}
if (fs.existsSync(uiEventHandlersPath)) {
  errors.push('Orphaned legacy uiEventHandlers utility remains');
}
const fullscreenApiPattern = /\b(?:requestFullscreen|exitFullscreen)\s*\(/;
const scanFullscreenAuthority = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) scanFullscreenAuthority(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && full !== fullscreenControllerPath && fullscreenApiPattern.test(read(full))) {
      errors.push(`Direct Fullscreen API call bypasses authority: ${path.relative(root, full)}`);
    }
  }
};
scanFullscreenAuthority(path.join(root, 'src/app'));
if (!/onToggleFullscreen=\{toggleAppFullscreen\}/.test(read(appPath))) {
  errors.push('Settings Panel does not route through toggleAppFullscreen');
}

// Phase 4.8F.1: abandoned render-worker protocols/staging audits were removed atomically.
// The production renderer is the only active render authority in this baseline.
const baselineScriptPath = path.join(root, 'scripts/report-main-thread-baseline.mjs');
const browserBaselineScriptPath = path.join(root, 'scripts/capture-browser-baseline.mjs');
if (!fs.existsSync(baselineScriptPath)) errors.push('Missing deterministic main-thread baseline report script');
if (!fs.existsSync(browserBaselineScriptPath)) errors.push('Missing optional real-browser baseline capture script');
if (packageJson.scripts?.['baseline:main-thread'] !== 'node scripts/report-main-thread-baseline.mjs') {
  errors.push('baseline:main-thread package script is missing or incorrect');
}
if (packageJson.scripts?.['baseline:browser'] !== 'node scripts/capture-browser-baseline.mjs') {
  errors.push('baseline:browser package script is missing or incorrect');
}

// Ensure local relative imports resolve to files or index files.
const runtimeImportFiles = [];
const collectRuntimeFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collectRuntimeFiles(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) runtimeImportFiles.push(full);
  }
};
collectRuntimeFiles(path.join(root, 'src/app/runtime/visualizer'));
for (const file of [appPath, hookPath, bindingsPath, ...runtimeImportFiles]) {
  const ast = parseTs(read(file), file);
  traverse(ast, { ImportDeclaration(p) {
    const spec = p.node.source.value;
    if (!spec.startsWith('.')) return;
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base,'index.ts'), path.join(base,'index.tsx')];
    if (!candidates.some(fs.existsSync)) errors.push(`Missing import target in ${path.relative(root,file)}: ${spec}`);
  }});
}

if (errors.length) {
  console.error('\nRuntime boundary validation failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Runtime boundary validation passed. Thin hook: ${hookLines} lines.`);
