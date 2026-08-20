import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'src/app');
const manifestPath = path.join(appRoot, 'runtime/mainThread/WindowBridgeManifest.ts');
const errors = [];

const read = (file) => fs.readFileSync(file, 'utf8');
function collect(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(full));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

if (!fs.existsSync(manifestPath)) {
  console.error('Window bridge audit failed: missing WindowBridgeManifest.ts');
  process.exit(1);
}

const manifestCode = read(manifestPath);
const manifestKeys = new Set(
  [...manifestCode.matchAll(/bridge\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
);
if (manifestKeys.size === 0) errors.push('Window bridge manifest contains no classified entries');

const standardWindowMembers = new Set([
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback',
  'innerWidth', 'innerHeight', 'devicePixelRatio',
  'location', 'localStorage', 'navigator', 'top', 'self',
  'matchMedia', 'AudioContext', 'webkitAudioContext',
]);

const patterns = [
  /\(window\s+as\s+any\)\.([A-Za-z_$][\w$]*)/g,
  /\(globalThis\s+as\s+any\)\.([A-Za-z_$][\w$]*)/g,
  /\bwindow\.([A-Za-z_$][\w$]*)/g,
  /\bruntimeWindow\.([A-Za-z_$][\w$]*)/g,
  /\bruntimeGlobal\.([A-Za-z_$][\w$]*)/g,
];

const discovered = new Map();
for (const file of collect(appRoot)) {
  if (file === manifestPath) continue;
  const code = read(file);
  for (const basePattern of patterns) {
    const pattern = new RegExp(basePattern.source, 'g');
    let match;
    while ((match = pattern.exec(code))) {
      const key = match[1];
      if (standardWindowMembers.has(key)) continue;
      if (!discovered.has(key)) discovered.set(key, new Set());
      discovered.get(key).add(path.relative(root, file));
    }
  }
}

for (const [key, files] of [...discovered.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (!manifestKeys.has(key)) {
    errors.push(`Unclassified custom global "${key}" in ${[...files].join(', ')}`);
  }
}

const duplicateKeys = [...manifestCode.matchAll(/bridge\(\s*['"]([^'"]+)['"]/g)]
  .map((match) => match[1])
  .filter((key, index, all) => all.indexOf(key) !== index);
if (duplicateKeys.length) errors.push(`Duplicate manifest keys: ${[...new Set(duplicateKeys)].join(', ')}`);

for (const token of [
  'replace-before-worker-cutover',
  'keep-main-thread-only',
  'debug-only',
  'AudioContext',
  'HTMLAudioElement',
  'RuntimeParameterStore',
]) {
  if (!manifestCode.includes(token)) errors.push(`Window bridge manifest missing required classification token: ${token}`);
}

if (errors.length) {
  console.error('\nWindow bridge audit failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

const classifiedInUse = [...discovered.keys()].filter((key) => manifestKeys.has(key)).length;
const replaceCount = (manifestCode.match(/'replace-before-worker-cutover'/g) ?? []).length - 1;
const mainOnlyCount = (manifestCode.match(/'keep-main-thread-only'/g) ?? []).length - 1;
const debugCount = (manifestCode.match(/'debug-only'/g) ?? []).length - 1;
console.log(`Window bridge audit passed: ${classifiedInUse} active custom globals classified.`);
console.log(`- replace before worker cutover: ${replaceCount}`);
console.log(`- keep main-thread-only: ${mainOnlyCount}`);
console.log(`- debug-only: ${debugCount}`);
