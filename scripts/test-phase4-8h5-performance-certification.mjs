import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const certification = read('src/app/runtime/visualizer/diagnostics/ProductionPerformanceCertification.ts');
const manifest = read('src/app/runtime/mainThread/WindowBridgeManifest.ts');

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
const frozenHash = 'e22efba8ebd98f4d8aa8bbd17e6ada36a4d030d49c2d2bc7cee066af981f5274';

check('H5 certification follows approved Phase 2 production frame revision', frameHash === frozenHash, frameHash);
check('frame controller imports performance certification runtime', frameController.includes("from '../diagnostics/ProductionPerformanceCertification'"));
check('certification runtime is instantiated once', (frameController.match(/createProductionPerformanceCertification\(/g) || []).length === 1);
check('session no longer owns performance certification', !session.includes('createProductionPerformanceCertification'));
check('certification wraps prepare boundary', frameController.includes('performanceCertification.beginPrepare(now, timing);') && frameController.includes('performanceCertification.endPrepare();'));
check('certification observes render boundary after production frame', frameController.indexOf('executeVisualFramePipeline(now, timing);') < frameController.indexOf('performanceCertification.endRender();'));
check('certification observes recording boundary', frameController.includes('performanceCertification.endRecording();'));
check('certification observes diagnostics boundary', frameController.includes('performanceCertification.endDiagnostics();'));
check('certification observes finalize boundary', frameController.includes('performanceCertification.endFinalize();'));
check('certification samples fixed-size bounded metrics', certification.includes('Float64Array') && certification.includes('capacity = 900'));
check('certification is dormant until explicit start', certification.includes('private active = false') && certification.includes('if (!this.active) return;'));
check('certification changes no renderer parameters', !/params\.|parameterStore|qualityScale\s*=|renderScale\s*=/.test(certification));
check('certification changes no scheduler cadence', !/requestAnimationFrame|setInterval|setTimeout|targetHz\s*=/.test(certification));
check('certification uses passive interaction listeners', certification.includes("addEventListener('wheel', this.onWheel, { passive: true, capture: true })"));
check('certification isolates Macro 2 by event detail', certification.includes("detail?.macroId === 'macro2'"));
check('certification samples Core Particles and Liquid Shaper independently', certification.includes('coreParticleCosts') && certification.includes('liquidShaperCosts'));
check('certification publishes explicit start/end/result commands', certification.includes('__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__') && certification.includes('__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__') && certification.includes('__ORBITAL_PHASE_4_8H_5_CERTIFICATION__'));
check('H5 globals are classified in bridge manifest', ['__ORBITAL_PHASE_4_8H_5_CERTIFICATION__','__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__','__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__','__ORBITAL_RESET_PHASE_4_8H_5_CERTIFICATION__'].every(key => manifest.includes(`bridge('${key}'`)));
check('certification contains no OffscreenCanvas/Worker architecture', !/OffscreenCanvas|new Worker\(|postMessage\(/.test(certification));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8H.5 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8H.5 parity freeze + performance certification: ${checks.length}/${checks.length} checks passed.`);
