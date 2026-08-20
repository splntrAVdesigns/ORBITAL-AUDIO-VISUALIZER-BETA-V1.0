import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const featureSession = read('src/app/runtime/visualizer/session/createVisualizerFeatureSession.ts');
const frameServices = read('src/app/runtime/visualizer/setup/createVisualizerFrameServices.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');

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
      if (escape) escape = false;
      else if (character === '\\') escape = true;
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
const count = (source, expression) => (source.match(expression) || []).length;
const frameBody = extractFunction(frameController, 'executeVisualFramePipeline');
const frameHash = crypto.createHash('sha256').update(frameBody).digest('hex');
const forbiddenAsyncOrReadback = /requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|new\s+Worker\s*\(|OffscreenCanvas|getImageData\s*\(|readPixels\s*\(/;

check('certified production frame body is unchanged', frameHash === 'fd109071da343499b79995fa8e3d26514fbbc9d2da522efe1a8dd1ea2834b839', frameHash);
check('session entry point remains within the Phase 2 size budget', session.split(/\r?\n/).length <= 3000, `${session.split(/\r?\n/).length} lines`);
check('session composes one persistent feature session', count(session, /createVisualizerFeatureSession\(/g) === 1);
check('session composes one frame-service owner', count(session, /createVisualizerFrameServices\(/g) === 1);
check('state-owner construction left the session entry point', !/createAudioFrameStateRuntime\(|createProductionMotionStateRuntime\(|createProductionColorStateRuntime\(/.test(session));
check('visual resource construction left the session entry point', !/createVisualEffectResources\(|createVisualFrameResources\(/.test(session));
check('feature session owns parameter authority', /attachRuntimeParameterAuthority\s*\(/.test(featureSession));
check('feature session owns audio, motion, and color state', /createAudioFrameStateRuntime\s*\(/.test(featureSession) && /createProductionMotionStateRuntime\s*\(/.test(featureSession) && /createProductionColorStateRuntime\s*\(/.test(featureSession));
check('frame services own reusable effect and frame resources', /createVisualEffectResources\s*\(/.test(frameServices) && /createVisualFrameResources\s*\(/.test(frameServices));
check('frame services own core-particle and center-media feature state', /createCoreParticleFeatureRuntime\s*\(/.test(frameServices) && /createCenterMediaFeatureRuntime\s*\(/.test(frameServices));
check('frame services own main-thread audio UI refresh', /new\s+MainThreadAudioUIRefreshRuntime\s*\(/.test(frameServices));
check('extracted feature session adds no scheduler, timer, worker, or readback', !forbiddenAsyncOrReadback.test(featureSession));
check('extracted frame services add no scheduler, timer, worker, or readback', !forbiddenAsyncOrReadback.test(frameServices));
check('removed dead runtime state is not reintroduced', !/\b(smoothedRotationMult|glitchSeed|colorCache)\b/.test(session));

const failed = checks.filter(checkResult => !checkResult.ok);
for (const result of checks) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
if (failed.length) {
  console.error(`Refactor Phase 2 failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Refactor Phase 2 session/service extraction: ${checks.length}/${checks.length} checks passed.`);
