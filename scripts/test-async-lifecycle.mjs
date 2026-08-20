import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-async-lifecycle-'));

function transpile(source, target) {
  const code = fs.readFileSync(source, 'utf8');
  const output = transformSync(code, {
    loader: source.endsWith('.tsx') ? 'tsx' : 'ts',
    format: 'esm',
    target: 'es2022',
    sourcefile: source,
  }).code;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}

try {
  const resourceTarget = path.join(tempRoot, 'visualizer/session/RuntimeResourceDiagnostics.js');
  const asyncTarget = path.join(tempRoot, 'mainThread/MainThreadAsyncDiagnostics.js');
  transpile('src/app/runtime/visualizer/session/RuntimeResourceDiagnostics.ts', resourceTarget);
  transpile('src/app/runtime/mainThread/MainThreadAsyncDiagnostics.ts', asyncTarget);
  fs.writeFileSync(
    asyncTarget,
    fs.readFileSync(asyncTarget, 'utf8').replace(
      "../visualizer/session/RuntimeResourceDiagnostics",
      "../visualizer/session/RuntimeResourceDiagnostics.js",
    ),
  );

  const original = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let nextHandle = 1;
  const timeouts = new Map();
  const intervals = new Map();
  const rafs = new Map();
  globalThis.setTimeout = (callback) => {
    const handle = nextHandle++;
    timeouts.set(handle, callback);
    return handle;
  };
  globalThis.clearTimeout = (handle) => timeouts.delete(handle);
  globalThis.setInterval = (callback) => {
    const handle = nextHandle++;
    intervals.set(handle, callback);
    return handle;
  };
  globalThis.clearInterval = (handle) => intervals.delete(handle);
  globalThis.requestAnimationFrame = (callback) => {
    const handle = nextHandle++;
    rafs.set(handle, callback);
    return handle;
  };
  globalThis.cancelAnimationFrame = (handle) => rafs.delete(handle);
  delete globalThis.__ORBITAL_RUNTIME_RESOURCE_COUNTS__;
  delete globalThis.__ORBITAL_RUNTIME_RESOURCES__;

  try {
    const asyncModule = await import(`${pathToFileURL(asyncTarget).href}?v=${Date.now()}`);
    const resourceModule = await import(`${pathToFileURL(resourceTarget).href}?v=${Date.now()}`);

    let timeoutRan = false;
    const timeout = asyncModule.scheduleTrackedTimeout('test-timeout', () => { timeoutRan = true; }, 25);
    assert.equal(asyncModule.getMainThreadAsyncSnapshot().activeTimeouts, 1);
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeClassifiedTimeouts, 1);
    asyncModule.cancelTrackedTimeout(timeout);
    assert.equal(timeoutRan, false);
    assert.equal(timeouts.size, 0);
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeClassifiedTimeouts, 0);

    const completedTimeout = asyncModule.scheduleTrackedTimeout('test-complete', () => { timeoutRan = true; }, 25);
    const timeoutCallback = timeouts.get(completedTimeout);
    timeouts.delete(completedTimeout);
    timeoutCallback();
    assert.equal(timeoutRan, true);
    assert.equal(asyncModule.getMainThreadAsyncSnapshot().activeTimeouts, 0);

    const interval = asyncModule.scheduleTrackedInterval('test-interval', () => {}, 250);
    assert.equal(asyncModule.getMainThreadAsyncSnapshot().activeIntervals, 1);
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeClassifiedIntervals, 1);
    asyncModule.cancelTrackedInterval(interval);
    assert.equal(intervals.size, 0);
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeClassifiedIntervals, 0);

    let rafRan = false;
    const cancelledRaf = asyncModule.requestTrackedShortLivedRaf('test-raf-cancel', () => { rafRan = true; });
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeShortLivedRafs, 1);
    asyncModule.cancelTrackedShortLivedRaf(cancelledRaf);
    assert.equal(rafRan, false);
    assert.equal(rafs.size, 0);
    assert.equal(resourceModule.getGlobalRuntimeResourceSnapshot().activeShortLivedRafs, 0);

    const completedRaf = asyncModule.requestTrackedShortLivedRaf('test-raf-complete', () => { rafRan = true; });
    const rafCallback = rafs.get(completedRaf);
    rafs.delete(completedRaf);
    rafCallback(16.67);
    assert.equal(rafRan, true);
    assert.equal(asyncModule.getMainThreadAsyncSnapshot().activeShortLivedRafs, 0);
    assert.deepEqual(asyncModule.getMainThreadAsyncSnapshot().owners, {});
  } finally {
    Object.assign(globalThis, original);
  }

  const panel = fs.readFileSync('src/app/controllers/panelController.ts', 'utf8');
  assert.ok(panel.includes('panel-width-resize'), 'panel resize must be coalesced through one tracked RAF');
  assert.ok(panel.includes('cancelCollapseSettlement'), 'panel settlement RAFs must be cancellable');
  assert.ok(!/\bsetTimeout\s*\(|\brequestAnimationFrame\s*\(/.test(panel), 'panel controller must not own raw timers/RAFs');

  const viewport = fs.readFileSync('src/app/runtime/CanvasViewportController.ts', 'utf8');
  assert.ok(viewport.includes('SHORT_LIVED_LAYOUT_SETTLE_RAF'), 'approved viewport two-frame settlement must remain classified');
  assert.ok(viewport.includes("requestTrackedShortLivedRaf('viewport-settle-1'"));
  assert.ok(viewport.includes("requestTrackedShortLivedRaf('viewport-settle-2'"));

  const presets = fs.readFileSync('src/app/utils/presetActions.ts', 'utf8');
  assert.ok(presets.includes('macroDomSyncRafId'), 'macro DOM sync RAF handle must be retained');
  assert.ok(presets.includes('cancelTrackedShortLivedRaf(macroDomSyncRafId)'), 'macro DOM sync RAF must be cancelled on disposal');
  assert.ok(!/\brequestAnimationFrame\s*\(/.test(presets), 'preset actions must not own an untracked RAF');

  console.log('RAF/timer ownership and stale-callback lifecycle tests passed');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
