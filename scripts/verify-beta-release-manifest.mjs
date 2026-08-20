import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { computeFallbackFreeze } from './fallback-freeze-hash.mjs';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BETA_RELEASE_VERIFICATION_MANIFEST.json'), 'utf8'));
const failures = [];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const canonicalText = value => `${value.toString('utf8').replace(/\r\n?/g, '\n').trimEnd()}\n`;
// Vendored third-party assets remain byte-exact; first-party text is hashed
// after newline normalization so Git checkout policy cannot invalidate it.
const byteExactVendorFiles = new Set([
  'public/vendor/gif.js',
  'public/vendor/gif.worker.js',
]);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!manifest.baselineArchive?.name || !/^[a-f0-9]{64}$/.test(manifest.baselineArchive?.sha256 ?? '')) {
  failures.push('baseline archive provenance is missing or malformed');
}
if (packageJson.engines?.node !== manifest.toolchain?.node) failures.push('Node engine differs from certified toolchain');
if (packageJson.engines?.npm !== manifest.toolchain?.npm) failures.push('npm engine differs from certified toolchain');
if (packageJson.packageManager !== manifest.toolchain?.packageManager) failures.push('package manager differs from certified toolchain');

for (const [relativePath, expected] of Object.entries(manifest.files)) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath} is missing`);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  const actual = sha256(byteExactVendorFiles.has(relativePath) ? bytes : canonicalText(bytes));
  if (actual !== expected) failures.push(`${relativePath}: expected ${expected}; found ${actual}`);
}

const session = fs.readFileSync(path.join(root, 'src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'), 'utf8');
const marker = 'function executeVisualFramePipeline(';
const start = session.indexOf(marker);
const brace = session.indexOf('{', start);
let depth = 0;
let end = -1;
let quote = null;
let escaped = false;
let lineComment = false;
let blockComment = false;
for (let index = brace; index >= 0 && index < session.length; index += 1) {
  const character = session[index];
  const next = session[index + 1] ?? '';
  if (lineComment) { if (character === '\n') lineComment = false; continue; }
  if (blockComment) { if (character === '*' && next === '/') { blockComment = false; index += 1; } continue; }
  if (quote) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === quote) quote = null;
    continue;
  }
  if (character === '/' && next === '/') { lineComment = true; index += 1; continue; }
  if (character === '/' && next === '*') { blockComment = true; index += 1; continue; }
  if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
  if (character === '{') depth += 1;
  else if (character === '}' && --depth === 0) { end = index + 1; break; }
}
if (start < 0 || brace < 0 || end < 0) failures.push('production frame body could not be extracted');
else {
  const frameBody = `${session.slice(start, end).replace(/\r\n/g, '\n').trimEnd()}\n`;
  const actual = sha256(frameBody);
  if (actual !== manifest.production.frameBodySha256) {
    failures.push(`production frame: expected ${manifest.production.frameBodySha256}; found ${actual}`);
  }
}

const fallbackManifest = JSON.parse(fs.readFileSync(path.join(root, 'SPRINT_22NC69_MAIN_THREAD_FALLBACK_FREEZE.json'), 'utf8'));
const fallback = computeFallbackFreeze({ root, includes: fallbackManifest.includes });
if (fallback.files.length !== manifest.production.mainThreadFallbackFileCount) failures.push('main-thread fallback file count differs');
if (fallback.digest !== manifest.production.mainThreadFallbackSha256) failures.push('main-thread fallback digest differs');

const coreManifest = JSON.parse(fs.readFileSync(path.join(root, 'PHASE_4_3_CORE_PARTICLES_CANVAS2D_FALLBACK_FREEZE.json'), 'utf8'));
const coreSource = fs.readFileSync(path.join(root, coreManifest.source), 'utf8').replace(/\r\n/g, '\n');
const coreBegin = coreSource.indexOf(coreManifest.beginMarker);
const coreEnd = coreSource.indexOf(coreManifest.endMarker, coreBegin);
const coreBlock = coreSource.slice(coreBegin, coreEnd).replace(/\n*$/, '\n');
if (sha256(coreBlock) !== manifest.production.coreParticleFallbackSha256) failures.push('Core Particle fallback digest differs');
if (coreBlock.split('\n').length !== manifest.production.coreParticleFallbackLineCount) failures.push('Core Particle fallback line count differs');

if (failures.length) {
  console.error(`Beta release manifest verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Beta release manifest verified: package lock, deployment surface, local GIF runtime, and production render hashes.');
