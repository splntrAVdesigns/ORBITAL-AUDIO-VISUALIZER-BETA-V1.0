import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const runtime = read('src/app/runtime/visualizer/frame/ProductionFrameRuntime.ts');

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
const approvedFrameHashes = new Set([
  '7455af51f242d72161b04a9938120f5bdd42ea11e676ee2c66e12393612ec9db', // H.1 shell extraction
  '051f9b33abd5d04596af5d3b2d37fa0f214c8449285b2a1de141140a3c003136', // H.2 explicit state owners
  'd19a834a5a233d1e68cff90f8a3df3c6e46dfe851cc9f2221979f0d1cba1544a', // H.3 feature runtime owners
  '27ec23bf034a5066a58b361b54b7a5fd03b60518632e2688edcb4da492e3b527', // H.3.1 center-media state hotfix / H.4 side-effect separation
  'a43e1c78504061cda0160f6337888ab79efb2b6d9fd6dfc2e94e20cbb9429792', // 4.8I cadence + Macro 2 authoritative commit action sprint
  'd126f94d7782a3e1405d6865da3dfe21bb96f695ff9554452163bf9a8805e5d0', // Phase 1 motion stability + typed control authority
  'fd109071da343499b79995fa8e3d26514fbbc9d2da522efe1a8dd1ea2834b839', // Phase 2 Liquid Shaper + Dark Strobe top pass
]);

check('authoritative production frame body hash is an approved parity-locked revision', approvedFrameHashes.has(frameHash), frameHash);
check('session imports production frame controller', session.includes("from './frame/createVisualizerProductionFrameController'"));
check('session delegates production frame ownership', session.includes('createVisualizerProductionFrameController({'));
check('frame controller delegates frame shell to ProductionFrameRuntime', frameController.includes('createProductionFrameRuntime({'));
check('frame controller preserves exact production frame callback invocation', frameController.includes('executeProductionFrame: executeVisualFramePipeline') || frameController.includes('executeVisualFramePipeline(now, timing);'));
check('recording publication remains after production frame execution', runtime.indexOf('options.executeProductionFrame(now, timing);') < runtime.indexOf('options.publishRecordingFrame(now);'));
check('shell delegates diagnostics to kernel', runtime.includes('publishDiagnostics: options.publishDiagnostics'));
check('shell delegates frame finalization to kernel', runtime.includes('finalizeFrame: options.finalizeFrame'));
check('shell preserves explicit resume callback', runtime.includes('onResume: options.onResume'));
check('shell creates existing VisualizerRenderKernel', runtime.includes('createVisualizerRenderKernel'));
check('shell creates existing MainThreadRenderHost', runtime.includes('createMainThreadRenderHost'));
check('shell contains no feature-specific renderer imports', !/SpikeRenderer|DotRenderer|HaloRenderer|CoreParticleRenderer|CoreTexturesEngine|astralShaper/.test(runtime));
check('shell contains no visual parameter/default names', !/gamma|iridize|spikeCount|dotDensity|haloRadius|shapeOscillate|motionBlur/i.test(runtime));
check('shell contains no offscreen/worker implementation', !/OffscreenCanvas|Worker\(|postMessage|SharedVisualRuntime/.test(runtime));
check('session/controller no longer assemble kernel directly', !(session + frameController).includes('createVisualizerRenderKernel({'));
check('session/controller no longer assemble main host directly', !(session + frameController).includes('createMainThreadRenderHost({'));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8H.1 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8H.1 production frame-shell extraction: ${checks.length}/${checks.length} checks passed.`);
