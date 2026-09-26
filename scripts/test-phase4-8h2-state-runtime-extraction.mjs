import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const featureSession = read('src/app/runtime/visualizer/session/createVisualizerFeatureSession.ts');
const audioRuntime = read('src/app/runtime/visualizer/frame/AudioFrameStateRuntime.ts');
const motionRuntime = read('src/app/runtime/visualizer/motion/ProductionMotionStateRuntime.ts');
const colorRuntime = read('src/app/runtime/visualizer/color/ProductionColorStateRuntime.ts');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = null, escape = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1] || '';
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === quote) quote = null; continue; }
    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return source.slice(start, i + 1).replace(/\r\n/g, '\n').trimEnd() + '\n'; }
  }
  throw new Error(`Unclosed ${name}`);
}

const checks = [];
const check = (name, ok, detail='') => checks.push({ name, ok: Boolean(ok), detail });
const frameBody = extractFunction(frameController, 'executeVisualFramePipeline');
const frameHash = crypto.createHash('sha256').update(frameBody).digest('hex');
const approvedStateOwnerHashes = new Set([
  '051f9b33abd5d04596af5d3b2d37fa0f214c8449285b2a1de141140a3c003136', // H.2
  'd19a834a5a233d1e68cff90f8a3df3c6e46dfe851cc9f2221979f0d1cba1544a', // H.3 feature runtime owners
  '27ec23bf034a5066a58b361b54b7a5fd03b60518632e2688edcb4da492e3b527', // H.3.1 hotfix / H.4 structural separation
  'a43e1c78504061cda0160f6337888ab79efb2b6d9fd6dfc2e94e20cbb9429792', // 4.8I cadence + interaction authority
  'd126f94d7782a3e1405d6865da3dfe21bb96f695ff9554452163bf9a8805e5d0', // Phase 1 motion stability + typed control authority
  'fd109071da343499b79995fa8e3d26514fbbc9d2da522efe1a8dd1ea2834b839', // Phase 2 Liquid Shaper + Dark Strobe top pass
  'e22efba8ebd98f4d8aa8bbd17e6ada36a4d030d49c2d2bc7cee066af981f5274', // Sprint F: Core Particles Spread max-reach trim
]);

check('H2/H3 approved production-frame state-owner hash matches', approvedStateOwnerHashes.has(frameHash), frameHash);
check('feature session imports AudioFrameStateRuntime factory', featureSession.includes("from '../frame/AudioFrameStateRuntime'"));
check('feature session imports ProductionMotionStateRuntime factory', featureSession.includes("from '../motion/ProductionMotionStateRuntime'"));
check('feature session imports ProductionColorStateRuntime factory', featureSession.includes("from '../color/ProductionColorStateRuntime'"));
check('audio engines are created through one state owner', featureSession.includes('const audioFrameStateRuntime = createAudioFrameStateRuntime({'));
check('motion engines are created through one state owner', featureSession.includes('const motionState = createProductionMotionStateRuntime({'));
check('color state is created through one state owner', featureSession.includes('const colorState = createProductionColorStateRuntime();'));
check('direct VisualAudioRuntime session construction removed', !/const visualAudioRuntime = new VisualAudioRuntime/.test(session));
check('direct RotationAuthority session construction removed', !/const rotationAuthority = new RotationAuthority/.test(session));
check('direct AutoZoomMotionRuntime session construction removed', !/const autoZoomMotionRuntime = new AutoZoomMotionRuntime/.test(session));
check('motion state owns chaos easing', motionRuntime.includes('chaosSegmentEase = 0'));
check('motion state owns zoom oscillator', motionRuntime.includes('zoomOscPhase = 0'));
check('motion state owns spike time accumulator', motionRuntime.includes('spikeTimeAcc = 0'));
check('color state owns beat/color state', colorRuntime.includes('beatColorShift = 0') && colorRuntime.includes('cornerFlashPulse = 0'));
check('color state owns energy gate state', colorRuntime.includes('energyGateSmoother = 1.0'));
check('color state owns color-wave cache state', colorRuntime.includes('cachedColorWaveHueRange = 0') && colorRuntime.includes('colorWaveLUTDirty = true'));
check('audio state owner resets all four audio runtimes', ['visualAudioRuntime.reset()', 'beatEffectRuntime.reset()', 'beatDetectionRuntime.reset()', 'coreParticleImpulseRuntime.reset()'].every(token => audioRuntime.includes(token)));
check('motion state owner resets motion runtimes', ['motionRotationRuntime.reset()', 'schedulerMotionPhaseRuntime.reset()', 'autoZoomMotionRuntime.reset()'].every(token => motionRuntime.includes(token)));
check('feature-session disposer resets state owners atomically', featureSession.includes('audioFrameStateRuntime.reset();') && featureSession.includes('motionState.reset();') && featureSession.includes('colorState.reset();'));
check('H2 introduces no worker/offscreen implementation', !/OffscreenCanvas|new Worker\(|postMessage\(/.test(audioRuntime + motionRuntime + colorRuntime));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8H.2 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8H.2 state-runtime extraction: ${checks.length}/${checks.length} checks passed.`);
