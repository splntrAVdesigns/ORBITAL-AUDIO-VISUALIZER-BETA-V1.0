import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

test('session recovery supervisor journals classified state and never performs a browser reload', async context => {
  const previousStorage = globalThis.sessionStorage;
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  context.after(() => { globalThis.sessionStorage = previousStorage; });

  const { SessionRecoverySupervisor } = await importBundledTypescript(
    'src/app/runtime/session/SessionRecoverySupervisor.ts',
    context,
  );
  const supervisor = new SessionRecoverySupervisor();
  let notifications = 0;
  const unsubscribe = supervisor.subscribe(() => { notifications += 1; });
  let recoveryReason = '';
  const unregister = supervisor.registerGraphicsRecovery(reason => { recoveryReason = reason; });

  supervisor.requestSafeGraphicsRecovery('GPU render fault');
  assert.equal(recoveryReason, 'GPU render fault');
  assert.equal(supervisor.getSnapshot().state, 'recovering-renderer');
  assert.equal(supervisor.getSnapshot().recoveryCount, 1);

  supervisor.markDegraded('Canvas2D fallback active');
  assert.equal(supervisor.getSnapshot().state, 'degraded-rendering');
  supervisor.enterFatalMemoryProtection('bounded memory protection');
  assert.equal(supervisor.getSnapshot().state, 'fatal-memory-protection');
  supervisor.recordManualReload();
  assert.equal(supervisor.getSnapshot().state, 'manual-reload');
  assert.ok(notifications >= 4);
  assert.match(data.get('orbital.session.recovery.v1'), /manual-reload/);

  unregister();
  unsubscribe();
  const source = fs.readFileSync('src/app/runtime/session/SessionRecoverySupervisor.ts', 'utf8');
  assert.doesNotMatch(source, /location\.reload|window\.location|document\.location/);
});

test('renderer faults use graphics-only recovery while preserving audio and parameter ownership', () => {
  const session = (fs.readFileSync('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts', 'utf8') + '\n' + fs.readFileSync('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts', 'utf8'));
  const telemetry = fs.readFileSync('src/app/runtime/crashTelemetry.ts', 'utf8');
  const supervisor = fs.readFileSync('src/app/runtime/session/SessionRecoverySupervisor.ts', 'utf8');
  const environment = fs.readFileSync('src/app/config/runtimeEnvironment.ts', 'utf8');

  assert.match(session, /registerGraphicsRecovery/);
  assert.match(session, /disposeWebGLAstralRenderer\(\)/);
  assert.match(session, /disposeLiquidShaperCanvasCaches\(\)/);
  assert.match(session, /Canvas2D fallback is active; audio and controls were preserved/);
  assert.match(session, /requestSafeGraphicsRecovery\(`Renderer fault/);
  assert.match(supervisor, /orbital\.session\.recovery/);
  assert.match(telemetry, /window\.location\.origin/);
  assert.match(environment, /RUNTIME_TELEMETRY_ENABLED = true/);
});
