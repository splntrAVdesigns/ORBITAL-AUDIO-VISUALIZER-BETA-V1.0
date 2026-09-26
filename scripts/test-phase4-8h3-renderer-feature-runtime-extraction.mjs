import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const controls = read('src/app/runtime/visualizer/controls/registerVisualizerControlPlane.ts');
const frameServices = read('src/app/runtime/visualizer/setup/createVisualizerFrameServices.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const productionRuntime = `${session}\n${controls}\n${frameServices}\n${frameController}`;
const resources = read('src/app/runtime/visualizer/setup/createVisualRuntimeResources.ts');
const spike = read('src/app/runtime/visualizer/features/SpikeFeatureRuntime.ts');
const core = read('src/app/runtime/visualizer/features/CoreParticleFeatureRuntime.ts');
const liquid = read('src/app/runtime/visualizer/features/LiquidShaperFeatureRuntime.ts');
const center = read('src/app/runtime/visualizer/features/CenterMediaFeatureRuntime.ts');

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
const approvedH3Hashes = new Set([
  'd19a834a5a233d1e68cff90f8a3df3c6e46dfe851cc9f2221979f0d1cba1544a', // H.3
  '27ec23bf034a5066a58b361b54b7a5fd03b60518632e2688edcb4da492e3b527', // H.3.1 hotfix / H.4
  'a43e1c78504061cda0160f6337888ab79efb2b6d9fd6dfc2e94e20cbb9429792', // 4.8I cadence + interaction authority
  'd126f94d7782a3e1405d6865da3dfe21bb96f695ff9554452163bf9a8805e5d0', // Phase 1 motion stability + typed control authority
  'fd109071da343499b79995fa8e3d26514fbbc9d2da522efe1a8dd1ea2834b839', // Phase 2 Liquid Shaper + Dark Strobe top pass
  'e22efba8ebd98f4d8aa8bbd17e6ada36a4d030d49c2d2bc7cee066af981f5274', // Sprint F: Core Particles Spread max-reach trim
]);

check('H3 approved production-frame feature-owner hash matches', approvedH3Hashes.has(frameHash), frameHash);
check('session imports feature runtime barrel', session.includes("from './features'"));
check('Spike feature runtime is instantiated once', (session.match(/createSpikeFeatureRuntime\(/g) || []).length === 1);
check('Spike temporal buffers are owned by feature runtime', !/let ampBuf =|let ampEcho1 =|let spikeDisplayBuf =/.test(session));
check('Spike lookup lifecycle is owned by feature runtime', productionRuntime.includes('spikeFeature.ensureLookupTables(N)'));
check('Core Particle feature runtime is instantiated once', (productionRuntime.match(/createCoreParticleFeatureRuntime\(/g) || []).length === 1);
check('Core Particle loose mutable state removed', !/let particlePoolInitialized|let corePulseValue|let prevCoreParticleEnergy|let particleGlobalRadiusMultiplier/.test(session));
check('Core Particle stereo/diagnostic clocks are feature-owned', productionRuntime.includes('coreParticleFeature.nextStereoSampleAt') && productionRuntime.includes('coreParticleFeature.nextGpuDiagnosticAt'));
check('Liquid Shaper feature runtime owns pending control queue', productionRuntime.includes('liquidShaperFeature.queueControlChange') && productionRuntime.includes('liquidShaperFeature.resetPendingChanges'));
check('Liquid Shaper reusable frame options are feature-owned', productionRuntime.includes('liquidShaperFeature.prepareAudio') && productionRuntime.includes('liquidShaperFeature.prepareParams'));
check('Center Media feature runtime is instantiated once', (productionRuntime.match(/createCenterMediaFeatureRuntime\(/g) || []).length === 1);
check('Center Media frame options are feature-owned', productionRuntime.includes('centerMediaFeature.prepareCenter') && productionRuntime.includes('centerMediaFeature.prepareGlow'));
check('obsolete reusable center/liquid option bags removed from visual resources', !/reusedCenterGraphicOptions|reusedCenterGlowOptions|reusedLiquidAudioOptions|reusedLiquidParamsOptions/.test(resources));
check('Spike feature runtime contains no DOM/worker dependencies', !/window\.|document\.|OffscreenCanvas|postMessage|new Worker/.test(spike));
check('Core feature runtime contains no DOM/worker dependencies', !/window\.|document\.|OffscreenCanvas|postMessage|new Worker/.test(core));
check('Liquid feature runtime contains no renderer implementation', !/drawAstral|CanvasRenderingContext|WebGL/.test(liquid));
check('Center feature runtime contains no renderer implementation', !/drawImage|arc\(|CanvasRenderingContext|WebGL/.test(center));
check('H3 introduces no OffscreenCanvas worker architecture', !/OffscreenCanvas|new Worker\(|postMessage\(/.test(spike + core + liquid + center));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8H.3 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8H.3 renderer-feature runtime extraction: ${checks.length}/${checks.length} checks passed.`);
