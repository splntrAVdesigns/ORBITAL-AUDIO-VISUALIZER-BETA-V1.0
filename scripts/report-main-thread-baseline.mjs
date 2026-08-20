import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const outputJson = path.resolve(root, args.get('out') ?? 'artifacts/main-thread-structural-baseline.json');
const outputMarkdown = outputJson.replace(/\.json$/i, '.md');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const lines = (relative) => read(relative).split(/\r?\n/).length;
const count = (text, pattern) => (text.match(pattern) ?? []).length;

const sessionPath = 'src/app/runtime/visualizer/createVisualizerRuntimeSession.ts';
const appPath = 'src/app/App.tsx';
const sessionCode = read(sessionPath);
const foundationCode = read('src/app/runtime/visualizer/VisualizerRuntimeFoundation.ts');
const productionFrameRuntimeCode = read('src/app/runtime/visualizer/frame/ProductionFrameRuntime.ts');
const mainThreadHostCode = read('src/app/runtime/visualizer/hosts/MainThreadRenderHost.ts');
const bridgeCode = read('src/app/runtime/mainThread/WindowBridgeManifest.ts');
const packageJson = JSON.parse(read('package.json'));
const distAssetsDir = path.join(root, 'dist/assets');
const jsBundle = fs.readdirSync(distAssetsDir).find((name) => name.endsWith('.js'));
const cssBundle = fs.readdirSync(distAssetsDir).find((name) => name.endsWith('.css'));
const jsBytes = fs.statSync(path.join(distAssetsDir, jsBundle)).size;
const cssBytes = fs.statSync(path.join(distAssetsDir, cssBundle)).size;
const jsGzipBytes = zlib.gzipSync(fs.readFileSync(path.join(distAssetsDir, jsBundle))).length;
const cssGzipBytes = zlib.gzipSync(fs.readFileSync(path.join(distAssetsDir, cssBundle))).length;

function collect(directory, predicate = (name) => /\.ts$/.test(name)) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(full, predicate));
    else if (predicate(entry.name)) files.push(full);
  }
  return files;
}

const workerTargetFiles = [
  ...collect(path.join(root, 'src/app/runtime/visualizer/renderers')),
  ...collect(path.join(root, 'src/app/runtime/visualizer/pipeline/passes')),
  ...collect(path.join(root, 'src/app/runtime/visualizer/pipeline/owners')),
  ...collect(path.join(root, 'src/app/runtime/visualizer/frame')),
].filter((file) => !file.endsWith(`${path.sep}index.ts`));

const activeBridgeKeys = new Set([
  ...sessionCode.matchAll(/(?:window|runtimeWindow)\.([A-Za-z_$][\w$]*)/g),
].map((match) => match[1]));
const manifestEntries = [...bridgeCode.matchAll(/bridge\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g)]
  .map((match) => ({ key: match[1], category: match[2], disposition: match[3] }));
const dispositionCounts = Object.fromEntries(
  ['replace-before-worker-cutover', 'keep-main-thread-only', 'debug-only'].map((disposition) => [
    disposition,
    manifestEntries.filter((entry) => entry.disposition === disposition).length,
  ]),
);

const checks = {
  authoritativeSchedulerPresent: /new\s+RuntimeFrameScheduler\s*\(/.test(foundationCode),
  frameEnginePresent:
    /createMainThreadRenderHost\s*(?:<[^>]+>)?\s*\(/.test(productionFrameRuntimeCode) &&
    /new\s+RuntimeFrameEngine\s*\(/.test(mainThreadHostCode),
  legacyLoopGuardAbsent: !/\bloopRunning\b/.test(sessionCode),
  rootFaviconEmitted: fs.existsSync(path.join(root, 'dist/favicon.svg')),
  nestedPublicRemoved: !fs.existsSync(path.join(root, 'src/app/public')),
  orphanPresetManagementRemoved: !fs.existsSync(path.join(root, 'src/app/utils/presetManagement.ts')),
  windowBridgeAuditWired: packageJson.scripts?.verify?.includes('audit:window-bridges') ?? false,
  distVerificationWired: packageJson.scripts?.verify?.includes('verify:dist') ?? false,
};
const structuralGo = Object.values(checks).every(Boolean);

const report = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  kind: 'production-main-thread-structural-baseline',
  source: {
    appLines: lines(appPath),
    runtimeSessionLines: lines(sessionPath),
    runtimeSessionBytes: fs.statSync(path.join(root, sessionPath)).size,
    coordinatorDomReferences: count(sessionCode, /\bdocument\b|querySelector|getElementById/g),
    coordinatorWindowReferences: count(sessionCode, /\bwindow\b/g),
    workerTargetModules: workerTargetFiles.length,
    customWindowBridgeEntries: manifestEntries.length,
    activeSessionBridgeKeys: activeBridgeKeys.size,
    bridgeDispositionCounts: dispositionCounts,
  },
  productionBundle: {
    jsFile: jsBundle,
    jsBytes,
    jsGzipBytes,
    cssFile: cssBundle,
    cssBytes,
    cssGzipBytes,
  },
  ownershipChecks: checks,
  decision: structuralGo ? 'PRODUCTION_BASELINE_VALID' : 'NO_GO',
  decisionNotes: [
    structuralGo
      ? 'Scheduler, frame engine, asset output and production cleanup prerequisites passed the deterministic gate.'
      : 'One or more deterministic production-baseline prerequisites failed.',
    'This baseline deliberately does not claim audible playback, physical microphone or compositor timing results.',
    'Use npm run baseline:browser on a normal Chrome/Chromium installation to capture runtime frame and scrolling metrics.',
    'This report describes the restored production renderer after the Phase 4.8F architecture reset.',
  ],
};

const kb = (bytes) => (bytes / 1024).toFixed(2);
const markdown = `# ORBITAL — Production Main-Thread Structural Baseline\n\n` +
  `Captured: ${report.capturedAt}\n\n` +
  `## Decision\n\n**${report.decision}**\n\n` +
  report.decisionNotes.map((note) => `- ${note}`).join('\n') + '\n\n' +
  `## Source and ownership\n\n| Metric | Result |\n|---|---:|\n` +
  `| App.tsx lines | ${report.source.appLines} |\n` +
  `| Runtime session lines | ${report.source.runtimeSessionLines} |\n` +
  `| Runtime session size | ${kb(report.source.runtimeSessionBytes)} KiB |\n` +
  `| Main-thread coordinator DOM references | ${report.source.coordinatorDomReferences} |\n` +
  `| Main-thread coordinator window references | ${report.source.coordinatorWindowReferences} |\n` +
  `| Worker-targeted modules audited | ${report.source.workerTargetModules} |\n` +
  `| Classified custom Window bridges | ${report.source.customWindowBridgeEntries} |\n` +
  `| Replace before worker cutover | ${report.source.bridgeDispositionCounts['replace-before-worker-cutover']} |\n` +
  `| Keep main-thread-only | ${report.source.bridgeDispositionCounts['keep-main-thread-only']} |\n` +
  `| Debug-only | ${report.source.bridgeDispositionCounts['debug-only']} |\n\n` +
  `## Production output\n\n| Asset | Raw | Gzip |\n|---|---:|---:|\n` +
  `| JavaScript | ${kb(jsBytes)} KiB | ${kb(jsGzipBytes)} KiB |\n` +
  `| CSS | ${kb(cssBytes)} KiB | ${kb(cssGzipBytes)} KiB |\n\n` +
  `## Deterministic checks\n\n` +
  Object.entries(checks).map(([key, value]) => `- ${value ? 'PASS' : 'FAIL'} — ${key}`).join('\n') + '\n';

fs.mkdirSync(path.dirname(outputJson), { recursive: true });
fs.writeFileSync(outputJson, JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(outputMarkdown, markdown);
console.log(`Main-thread structural baseline written to ${path.relative(root, outputJson)}`);
console.log(`Decision: ${report.decision}`);
if (!structuralGo) process.exit(1);