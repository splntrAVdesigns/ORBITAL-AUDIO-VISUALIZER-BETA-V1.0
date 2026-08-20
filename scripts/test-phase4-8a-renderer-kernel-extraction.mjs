import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const sessionPath = path.join(root, 'src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const session = fs.readFileSync(sessionPath, 'utf8');
const frameController = fs.readFileSync(path.join(root, 'src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'), 'utf8');
const kernel = fs.readFileSync(path.join(root, 'src/app/runtime/visualizer/kernel/VisualizerRenderKernel.ts'), 'utf8');
const host = fs.readFileSync(path.join(root, 'src/app/runtime/visualizer/hosts/MainThreadRenderHost.ts'), 'utf8');
const productionFrameRuntime = fs.readFileSync(path.join(root, 'src/app/runtime/visualizer/frame/ProductionFrameRuntime.ts'), 'utf8');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1] || '';
    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === '*' && n === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1).replace(/\r\n/g, '\n').trimEnd() + '\n';
    }
  }
  throw new Error(`Unclosed ${name}`);
}

const checks = [];
const check = (name, ok, detail='') => checks.push({ name, ok: Boolean(ok), detail });

const frameBody = extractFunction(frameController, 'executeVisualFramePipeline');
const frameHash = crypto.createHash('sha256').update(frameBody).digest('hex');
check('production frame body is present and hashable', frameHash.length === 64, frameHash);
check('frame controller creates ProductionFrameRuntime shell', frameController.includes('createProductionFrameRuntime({'));
check('ProductionFrameRuntime creates VisualizerRenderKernel', productionFrameRuntime.includes('createVisualizerRenderKernel<TParameters>({'));
check('ProductionFrameRuntime creates MainThreadRenderHost', productionFrameRuntime.includes('createMainThreadRenderHost<TParameters>({'));
check('frame controller routes exact production frame callback into shell', frameController.includes('executeProductionFrame: (now, timing) => {') && frameController.includes('executeVisualFramePipeline(now, timing);'));
check('session does not import worker renderer into kernel path', !session.includes("from './shared/SharedVisualRuntime'"));
check('kernel contains no visual formulas/defaults', !/palette|spike|halo|dot|gamma|iridize|astral|coreTexture/i.test(kernel.replace(/comments?/gi,'')));
check('kernel contains no DOM/window/document access', !/\b(window|document|HTMLElement|HTMLImageElement|HTMLVideoElement)\b/.test(kernel));
check('main host owns RuntimeFrameEngine', host.includes('new RuntimeFrameEngine'));
check('main host gates render authority', host.includes('if (options.renderEnabled) options.kernel.render'));
check('main host contains no feature renderer imports', !/SpikeRenderer|DotRenderer|HaloRenderer|CoreParticle|SharedVisualRuntime/.test(host));
check('production app contains no abandoned offscreen activation path', !/OffscreenPilot|UNIFIED_RENDER_WORKER|CANVAS2D_OFFSCREEN_D2|orbitalWebglOffscreen/.test(fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8')));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8A failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8A renderer-kernel extraction: ${checks.length}/${checks.length} checks passed.`);
