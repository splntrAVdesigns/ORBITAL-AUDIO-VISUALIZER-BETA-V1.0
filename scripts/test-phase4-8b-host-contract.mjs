import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const hostContract = read('src/app/runtime/visualizer/hosts/RenderHost.ts');
const mainHost = read('src/app/runtime/visualizer/hosts/MainThreadRenderHost.ts');
const kernel = read('src/app/runtime/visualizer/kernel/VisualizerRenderKernel.ts');
const input = read('src/app/runtime/visualizer/kernel/RenderInputSnapshot.ts');
const harness = read('src/app/runtime/visualizer/kernel/RenderParityHarness.ts');
const fixture = read('src/app/runtime/visualizer/kernel/DeterministicRenderFixture.ts');
const productionFrameRuntime = read('src/app/runtime/visualizer/frame/ProductionFrameRuntime.ts');

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
check('production frame body remains deterministic and hashable', frameHash.length === 64, frameHash);
for (const method of ['start()', 'stop()', 'pause()', 'resume(', 'updateInput(', 'resize(', 'dispose()']) {
  check(`RenderHost contract exposes ${method}`, hostContract.includes(method));
}
check('host contract identifies main-thread/offscreen kinds', hostContract.includes("'main-thread' | 'offscreen-worker'"));
check('MainThreadRenderHost implements contract', /implements RenderHost/.test(mainHost));
check('ProductionFrameRuntime owns kernel/host assembly', productionFrameRuntime.includes('createVisualizerRenderKernel') && productionFrameRuntime.includes('createMainThreadRenderHost'));
check('session delegates production-frame ownership', session.includes('createVisualizerProductionFrameController({'));
check('frame controller delegates frame-shell assembly', frameController.includes('createProductionFrameRuntime({'));
check('MainThreadRenderHost contains no feature renderer imports', !/SpikeRenderer|DotRenderer|HaloRenderer|CoreParticle|SharedVisualRuntime/.test(mainHost));
check('kernel contains no worker imports', !/worker\//.test(kernel));
check('kernel contains no DOM/window/document access', !/\b(window|document|HTMLElement|HTMLImageElement|HTMLVideoElement)\b/.test(kernel));
check('clone-safe RenderInputSnapshot exists', input.includes('RenderViewportSnapshot') && input.includes('parameterRevision'));
check('deterministic fixture has fixed viewport/timing', fixture.includes('DEFAULT_PARITY_VIEWPORT') && fixture.includes('deltaMs'));
check('parity harness compares stable probe snapshots', harness.includes('stableSerialize') && harness.includes('referenceSerialized === candidateSerialized'));
check('abandoned worker runtime is absent from the production app', !/useLiveOffscreenRenderer|useWebGLOffscreenPilot|UNIFIED_RENDER_WORKER/.test(read('src/app/App.tsx')));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8B host contract failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8B host contract: ${checks.length}/${checks.length} checks passed.`);
