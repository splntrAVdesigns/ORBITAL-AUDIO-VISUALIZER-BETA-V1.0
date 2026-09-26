import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const controller = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = brace; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1] || '';
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return `${source.slice(start, index + 1).replace(/\r\n/g, '\n').trimEnd()}\n`;
    }
  }
  throw new Error(`Unclosed ${name}`);
}

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const frameBody = extractFunction(controller, 'executeVisualFramePipeline');
const frameHash = crypto.createHash('sha256').update(frameBody).digest('hex');
const sessionLines = session.split(/\r?\n/).length;

check('production frame body remains byte-identical', frameHash === 'fe90378e0b3f3d6bc3535c31652ca79b81ce3290c769923da13bee9e8a5d0d35', frameHash);
check('session entry point is reduced below the Phase 3 budget', sessionLines <= 800, `${sessionLines} lines`);
check('session composes exactly one production frame controller', (session.match(/createVisualizerProductionFrameController\(/g) || []).length === 1);
check('production frame implementation left the session entry point', !session.includes('function executeVisualFramePipeline('));
check('frame shell construction is controller-owned', controller.includes('createProductionFrameRuntime({') && !session.includes('createProductionFrameRuntime({'));
check('frame diagnostics and certification are controller-owned', controller.includes('createProductionRuntimeDiagnostics({') && controller.includes('createProductionPerformanceCertification({'));
check('viewport synchronization reuses one session-owned object', session.includes('const viewportState = {') && session.includes('getViewportMetrics: () => viewportState'));
check('mutable FFT buffers synchronize without per-frame copies', ['freqArr = audioBuffers.freqArr', 'timeArr = audioBuffers.timeArr', 'filteredFreqArr = audioBuffers.filteredFreqArr', 'rawSpikeFreqArr = audioBuffers.rawSpikeFreqArr'].every(token => controller.includes(token)));
check('angle, shape-select, and Dot owner bridges remain explicit', ['getProductionAngle = productionFrameController.getAngle', 'getProductionShapeSelect = productionFrameController.getCachedShapeSelect', 'resetProductionDotOwner = productionFrameController.resetDotOwner'].every(token => session.includes(token)));
check('controller adds no second RAF, worker, OffscreenCanvas, or canvas readback', !/requestAnimationFrame\s*\(|new\s+Worker\s*\(|OffscreenCanvas|getImageData\s*\(|readPixels\s*\(/.test(controller));
check('controller contains one production scheduler composition', (controller.match(/createProductionFrameRuntime\(/g) || []).length === 1);
check('dead radial-streak state was removed', !/\blastAmplitude\b/.test(session + controller));

const failed = checks.filter(result => !result.ok);
for (const result of checks) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
if (failed.length) {
  console.error(`Refactor Phase 3 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Refactor Phase 3 production-frame controller: ${checks.length}/${checks.length} checks passed.`);
