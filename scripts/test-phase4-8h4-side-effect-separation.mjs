import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const ui = read('src/app/runtime/visualizer/ui/ProductionUISideEffectRuntime.ts');
const controls = read('src/app/runtime/visualizer/controls/ProductionControlBindingRuntime.ts');
const diagnostics = read('src/app/runtime/visualizer/diagnostics/ProductionRuntimeDiagnostics.ts');

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
const frameHash = crypto.createHash('sha256').update(extractFunction(frameController, 'executeVisualFramePipeline')).digest('hex');
const parityHash = 'fd109071da343499b79995fa8e3d26514fbbc9d2da522efe1a8dd1ea2834b839';

check('H4 accepts the current parity-reviewed production frame hash', frameHash === parityHash, frameHash);
check('session imports UI side-effect runtime', session.includes("from './ui/ProductionUISideEffectRuntime'"));
check('session imports control binding runtime', session.includes("from './controls/ProductionControlBindingRuntime'"));
check('frame controller imports diagnostics runtime', frameController.includes("from '../diagnostics/ProductionRuntimeDiagnostics'"));
check('loose pending UI queue removed from session', !/const pendingUIUpdates|let uiUpdatesPending|let pendingMacroUpdates|let macroUIUpdateQueued/.test(session));
check('UI side effects own macro coalescing', /scheduleMacro\(/.test(ui) && /pendingMacroUpdates/.test(ui));
check('UI side effects own bounded flush', /maxUpdatesPerFlush: 4/.test(ui) && /maxFlushMs: 1\.5/.test(ui));
check('control runtime owns binding controller lifecycle', /createDomBindingController/.test(controls) && /controller\.cleanup/.test(controls));
check('session no longer directly constructs DOM binding controller', !/const domBindingController = createDomBindingController/.test(session));
check('diagnostics runtime owns HUD publication', /publishPerformanceHUD/.test(diagnostics));
check('diagnostics runtime owns crash heartbeat', /__ORBITAL_CRASH_TELEMETRY__/.test(diagnostics));
check('diagnostics runtime owns audio soak publication', /__ORBITAL_AUDIO_SOAK__/.test(diagnostics));
check('frame controller diagnostics callback delegates', /runtimeDiagnostics\?\.publish\(pendingFramePublication, lastT\)/.test(frameController));
check('frame controller performance metrics delegate', /runtimeDiagnostics\?\.updatePerformanceMetrics\(now\)/.test(frameController));
check('new H4 runtimes contain no OffscreenCanvas/Worker architecture', !/OffscreenCanvas|new Worker\(|postMessage\(/.test(ui + controls + diagnostics));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8H.4 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8H.4 control/diagnostics/UI separation: ${checks.length}/${checks.length} checks passed.`);
