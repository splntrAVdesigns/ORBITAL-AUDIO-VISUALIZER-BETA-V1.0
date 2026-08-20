import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];
const favicon = path.join(dist, 'favicon.svg');
const index = path.join(dist, 'index.html');

if (!fs.existsSync(index)) errors.push('dist/index.html is missing');
if (!fs.existsSync(favicon)) errors.push('dist/favicon.svg is missing');
if (fs.existsSync(index) && !/href=["']\/favicon\.svg["']/.test(fs.readFileSync(index, 'utf8'))) {
  errors.push('dist/index.html is not wired to /favicon.svg');
}
if (fs.existsSync(favicon)) {
  const svg = fs.readFileSync(favicon, 'utf8');
  if (!/<svg\b/.test(svg)) errors.push('dist/favicon.svg is not valid SVG content');
}

const emittedFiles = fs.existsSync(dist)
  ? fs.readdirSync(dist, { recursive: true }).map(String)
  : [];
const emittedJavaScript = emittedFiles.filter((file) => file.endsWith('.js'));
if (emittedJavaScript.length === 0) errors.push('No production JavaScript bundle was emitted');
const productionJavaScript = emittedJavaScript
  .map(file => fs.readFileSync(path.join(dist, file), 'utf8'))
  .join('\n');
if (!/canvas2d-main-thread/.test(productionJavaScript) || !/main-thread/.test(productionJavaScript)) {
  errors.push('Certified main-thread render authority is missing from the production bundle');
}
if (/orbital-render-worker-shell|staging-probe|staging-verified-released/.test(productionJavaScript)) {
  errors.push('Abandoned worker staging protocol leaked back into the production bundle');
}

const distIndex = fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '';
if (!/src=["']\/vendor\/gif\.js["']/.test(distIndex)) errors.push('dist/index.html is not wired to the local GIF library');
if (/cdn\.jsdelivr\.net/.test(distIndex)) errors.push('dist/index.html contains a third-party runtime script');
for (const vendorFile of ['vendor/gif.js', 'vendor/gif.worker.js']) {
  if (!fs.existsSync(path.join(dist, vendorFile))) errors.push(`Local GIF asset is missing: ${vendorFile}`);
}

const eagerUiSources = [
  path.join(root, 'src/app/App.tsx'),
  path.join(root, 'src/app/components/SettingsPanel.tsx'),
];
for (const source of eagerUiSources) {
  if (!fs.existsSync(source)) continue;
  const contents = fs.readFileSync(source, 'utf8');
  if (/\blazy\s*\(|<Suspense\b/.test(contents)) {
    errors.push(`Figma-safe eager UI boundary regressed to lazy loading: ${path.relative(root, source)}`);
  }
}
const routeDependentBuiltInLogos = emittedFiles.filter((file) =>
  /(?:6a628cfc4040bec6f754d249d9bf9f3431785802|c07a706be6b5d99d8083377c61a56d294c064ec0|c80aa982ac9f9f0accc2e8fa020529c7250adeb5)\.png$/i.test(file),
);
if (routeDependentBuiltInLogos.length) {
  errors.push(`Built-in logos were emitted as route-dependent files: ${routeDependentBuiltInLogos.join(', ')}`);
}

if (errors.length) {
  console.error('\nDist verification failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('Dist verification passed: assets are stable, main-thread render authority is present, local GIF assets are emitted, and interaction-isolated UI boundaries are preserved.');
