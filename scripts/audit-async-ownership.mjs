import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const root = process.cwd();
const sourceRoot = path.join(root, 'src/app');

/**
 * Exact inventory of application-owned scheduling primitives.
 * New or changed call sites must be classified deliberately here.
 */
const ASYNC_OWNERSHIP = {
  'src/app/components/ControlPanel.tsx': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'bounded upload metadata wait',
  },
  'src/app/components/LandingPage.tsx': {
    counts: { setTimeout: 2, setInterval: 0, requestAnimationFrame: 2 },
    classification: 'landing-only initialization and resize settlement',
  },
  'src/app/components/LoadingPage.tsx': {
    counts: { setTimeout: 3, setInterval: 2, requestAnimationFrame: 2 },
    classification: 'loading-screen-only progress and initialization',
  },
  'src/app/components/MidiConfigModal.tsx': {
    counts: { setTimeout: 0, setInterval: 1, requestAnimationFrame: 0 },
    classification: 'modal-open MIDI Learn countdown with effect cleanup',
  },
  'src/app/components/settings/ExportSection.tsx': {
    counts: { setTimeout: 0, setInterval: 1, requestAnimationFrame: 0 },
    classification: 'export-only countdown with effect cleanup',
  },
  'src/app/controllers/centerGraphicController.ts': {
    counts: { setTimeout: 0, setInterval: 1, requestAnimationFrame: 0 },
    classification: 'explicit center-media auto-cycle owner',
  },
  'src/app/controllers/exportController.ts': {
    counts: { setTimeout: 0, setInterval: 0, requestAnimationFrame: 2 },
    classification: 'export-only one-shot frame settlement',
  },
  'src/app/controllers/settingsTransferController.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'intentional settings-import reload delay',
  },
  'src/app/engine/AudioSystemInit.ts': {
    counts: { setTimeout: 2, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'bounded media recovery callbacks',
  },
  'src/app/engine/MidiController.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'owned MIDI Learn timeout',
  },
  'src/app/engine/RecordingEngine.ts': {
    counts: { setTimeout: 4, setInterval: 1, requestAnimationFrame: 0 },
    classification: 'recording/export-only owned callbacks',
  },
  'src/app/engine/WebGLAstralRenderer.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'bounded WebGL cleanup fallback',
  },
  'src/app/hooks/useOrbitalAppLifecycle.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'React app-ready timer with effect cleanup',
  },
  'src/app/hooks/usePresetKeyboardNavigation.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'owned latest-preset commit debounce with hook cleanup; toast timer removed',
  },
  'src/app/runtime/FrameScheduler.ts': {
    counts: { setTimeout: 0, setInterval: 0, requestAnimationFrame: 1 },
    classification: 'one-shot coalescing frame scheduler',
  },
  'src/app/runtime/audio/AudioObjectUrlRegistry.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'owned duration-probe timeout',
  },
  'src/app/runtime/mainThread/MainThreadAsyncDiagnostics.ts': {
    counts: { setTimeout: 1, setInterval: 1, requestAnimationFrame: 1 },
    classification: 'central tracked wrappers for non-session async work',
  },
  'src/app/runtime/renderFrameRuntime.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'bounded deferred UI flush; legacy split candidate',
  },
  'src/app/runtime/renderLoopHelpers.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'owned interaction-idle timeout',
  },
  'src/app/runtime/visualizer/RuntimeFrameScheduler.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 1 },
    classification: 'ONLY_CONTINUOUS_VISUAL_RAF plus bounded crash recovery',
  },
  'src/app/runtime/visualizer/createVisualizerRuntimeSession.ts': {
    counts: { setTimeout: 2, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'RuntimeAsyncRegistry-owned session setup timeouts outside extracted control/interaction setup',
  },
  'src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'relocated RuntimeAsyncRegistry-owned DOM cache initialization timeout; no independent scheduler',
  },
  'src/app/runtime/visualizer/controls/initializeVisualizerControlDefaults.ts': {
    counts: { setTimeout: 2, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'RuntimeAsyncRegistry-owned default and phase-control initialization',
  },
  'src/app/runtime/visualizer/setup/createSessionInteractionSetup.ts': {
    counts: { setTimeout: 1, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'RuntimeAsyncRegistry-owned snap-to-grid feedback timeout',
  },
  'src/app/runtime/visualizer/session/RuntimeAsyncRegistry.ts': {
    counts: { setTimeout: 2, setInterval: 0, requestAnimationFrame: 0 },
    classification: 'central session timeout/idle fallback registry',
  },
  'src/app/src/engines/CoreTexturesEngine.ts': {
    counts: { setTimeout: 0, setInterval: 1, requestAnimationFrame: 0 },
    classification: 'engine-owned cache cleanup interval with dispose',
  },
  'src/app/utils/gifExport.ts': {
    counts: { setTimeout: 3, setInterval: 1, requestAnimationFrame: 1 },
    classification: 'export-only capture/preflight/download cleanup',
  },
};

const schedulingNames = new Set(['setTimeout', 'setInterval', 'requestAnimationFrame']);
const discovered = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) continue;

    const code = fs.readFileSync(fullPath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    });
    const counts = { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 };
    traverse(ast, {
      CallExpression(callPath) {
        let callee = callPath.node.callee;
        while (callee.type === 'TSNonNullExpression' || callee.type === 'TSAsExpression' || callee.type === 'TSTypeAssertion') {
          callee = callee.expression;
        }
        let name = null;
        if (callee.type === 'Identifier') name = callee.name;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier'
        ) {
          name = callee.property.name;
        }
        if (name && schedulingNames.has(name)) counts[name] += 1;
      },
    });
    if (Object.values(counts).some(Boolean)) {
      discovered.set(path.relative(root, fullPath).split(path.sep).join('/'), counts);
    }
  }
}

walk(sourceRoot);

const errors = [];
for (const [file, counts] of discovered) {
  const owned = ASYNC_OWNERSHIP[file];
  if (!owned) {
    errors.push(`Unclassified scheduler call site: ${file} ${JSON.stringify(counts)}`);
    continue;
  }
  for (const key of schedulingNames) {
    if (counts[key] !== owned.counts[key]) {
      errors.push(`${file} ${key} count changed: expected ${owned.counts[key]}, found ${counts[key]}`);
    }
  }
}
for (const [file, owned] of Object.entries(ASYNC_OWNERSHIP)) {
  const counts = discovered.get(file);
  if (!counts && Object.values(owned.counts).some(Boolean)) {
    errors.push(`Async ownership manifest is stale; no scheduler calls remain in ${file}`);
  }
}

const continuousOwners = Object.entries(ASYNC_OWNERSHIP)
  .filter(([, value]) => value.classification.includes('ONLY_CONTINUOUS_VISUAL_RAF'))
  .map(([file]) => file);
const expectedContinuousOwners = [
  'src/app/runtime/visualizer/RuntimeFrameScheduler.ts',
];
if (continuousOwners.length !== expectedContinuousOwners.length || expectedContinuousOwners.some(file => !continuousOwners.includes(file))) {
  errors.push(`Expected exactly one continuous visual RAF, found: ${continuousOwners.join(', ') || 'none'}`);
}

if (errors.length) {
  console.error('Async ownership audit failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

const totals = { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 };
for (const counts of discovered.values()) {
  for (const key of schedulingNames) totals[key] += counts[key];
}
console.log(
  `Async ownership audit passed: ${discovered.size} classified files, ` +
  `${totals.setTimeout} timeout calls, ${totals.setInterval} interval calls, ` +
  `${totals.requestAnimationFrame} RAF calls, exactly one continuous visual RAF plus one bounded staging-proof callback.`,
);
