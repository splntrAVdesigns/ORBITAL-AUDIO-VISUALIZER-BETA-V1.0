import assert from 'node:assert/strict';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

function frame(runtime, { t, speed, intensity, type = 'verticalFloat' }) {
  return runtime.compute({
    type,
    profile: 'static',
    amount: speed,
    speed,
    intensity,
    t,
    dt: 1 / 60,
    centerSize: 400,
    bass: 0,
    mid: 0,
    high: 0,
  });
}

test('Center Motion phase is session-owned and independent from absolute runtime', async context => {
  const { CenterMotionRuntime } = await importBundledTypescript(
    'src/app/utils/centerMotionEngine.ts',
    context,
  );
  const early = new CenterMotionRuntime();
  const late = new CenterMotionRuntime();
  const earlyFrame = frame(early, { t: 1, speed: 0.6, intensity: 0.6 });
  const lateFrame = frame(late, { t: 10_000, speed: 0.6, intensity: 0.6 });
  assert.deepEqual(lateFrame, earlyFrame);
  assert.equal(late.currentPhaseTime, early.currentPhaseTime);
});

test('Center Motion speed changes advance phase without rebasing it', async context => {
  const { CenterMotionRuntime } = await importBundledTypescript(
    'src/app/utils/centerMotionEngine.ts',
    context,
  );
  const runtime = new CenterMotionRuntime();
  let time = 1;
  let previous = frame(runtime, { t: time, speed: 0.35, intensity: 0.65 });
  for (let index = 0; index < 180; index += 1) {
    time += 1 / 60;
    previous = frame(runtime, { t: time, speed: 0.35, intensity: 0.65 });
  }

  const phaseBefore = runtime.currentPhaseTime;
  const displacementBefore = runtime.currentDisplacementPhase;
  time += 1 / 60;
  const next = frame(runtime, { t: time, speed: 0.95, intensity: 0.65 });
  assert.ok(runtime.currentPhaseTime > phaseBefore);
  assert.ok(runtime.currentPhaseTime - phaseBefore < 0.09, 'speed update must not jump phase');
  assert.ok(runtime.currentDisplacementPhase - displacementBefore < 0.04, 'displacement must not jump phase');
  assert.ok(Math.abs(next.offsetX - previous.offsetX) < 32, 'speed update must not teleport X');
  assert.ok(Math.abs(next.offsetY - previous.offsetY) < 32, 'speed update must not teleport Y');
});

test('Center Motion activation eases from neutral and explicit none remains off', async context => {
  const { CenterMotionRuntime } = await importBundledTypescript(
    'src/app/utils/centerMotionEngine.ts',
    context,
  );
  const runtime = new CenterMotionRuntime();
  const first = frame(runtime, { t: 50, speed: 0.8, intensity: 0.8 });
  assert.ok(Math.abs(first.offsetY) < 4, 'first enabled frame must stay near neutral');

  const off = frame(runtime, { t: 50 + 1 / 60, speed: 1, intensity: 1, type: 'none' });
  assert.equal(off.offsetX, 0);
  assert.equal(off.offsetY, 0);
  assert.equal(off.scaleAdd, 0);
  assert.equal(off.rotationAddDeg, 0);
  assert.equal(off.opacityMul, 1);
});
