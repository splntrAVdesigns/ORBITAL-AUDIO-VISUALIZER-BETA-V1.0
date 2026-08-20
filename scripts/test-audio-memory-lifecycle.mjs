import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-audio-memory-'));
const tscPath = path.resolve('node_modules/typescript/bin/tsc');

try {
  const sources = [
    'src/app/runtime/audio/AudioObjectUrlRegistry.ts',
    'src/app/runtime/audio/SerializedBpmAnalysisQueue.ts',
  ];
  const compile = spawnSync(process.execPath, [
    tscPath,
    ...sources,
    '--target', 'ES2022',
    '--module', 'ESNext',
    '--moduleResolution', 'Bundler',
    '--skipLibCheck',
    '--outDir', tempDir,
  ], { encoding: 'utf8' });
  if (compile.status !== 0) throw new Error(`Audio lifecycle compile failed:\n${compile.stdout}\n${compile.stderr}`);

  const objectUrlModule = await import(`${pathToFileURL(path.join(tempDir, 'AudioObjectUrlRegistry.js')).href}?v=${Date.now()}`);
  const queueModule = await import(`${pathToFileURL(path.join(tempDir, 'SerializedBpmAnalysisQueue.js')).href}?v=${Date.now()}`);

  const revoked = [];
  let nextUrl = 0;
  const adapter = {
    createObjectURL() { return `blob:orbital-test-${++nextUrl}`; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const registry = new objectUrlModule.AudioObjectUrlRegistry(adapter);
  const probeUrl = registry.create(new Blob(['probe']), 'duration-probe', 'probe.wav');
  const playbackUrl = registry.create(new Blob(['playback']), 'playback', 'playback.wav');
  assert.equal(registry.snapshot().active, 2);
  assert.equal(registry.revoke(probeUrl), true);
  assert.equal(registry.revoke(probeUrl), false, 'an owned URL must only be revoked once');
  assert.equal(registry.revokeKind('playback'), 1);
  assert.deepEqual(revoked, [probeUrl, playbackUrl]);
  assert.deepEqual(registry.snapshot(), {
    active: 0,
    created: 2,
    revoked: 2,
    durationProbeActive: 0,
    playbackActive: 0,
  });

  class FakeAudio {
    preload = '';
    src = '';
    duration = 143.25;
    listeners = new Map();
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {
      if (this.src) queueMicrotask(() => this.listeners.get('loadedmetadata')?.({ type: 'loadedmetadata' }));
    }
  }

  const probeRegistry = new objectUrlModule.AudioObjectUrlRegistry(adapter);
  const duration = await objectUrlModule.probeAudioDuration(
    { name: 'metadata.wav' },
    {
      registry: probeRegistry,
      createAudio: () => new FakeAudio(),
      setTimer: () => 1,
      clearTimer: () => {},
    },
  );
  assert.equal(duration, 143.25);
  assert.equal(probeRegistry.snapshot().active, 0, 'duration probe URL must be revoked after metadata');
  assert.equal(probeRegistry.snapshot().created, probeRegistry.snapshot().revoked);

  let active = 0;
  let maximumActive = 0;
  const resolvers = new Map();
  const started = [];
  const queue = new queueModule.LatestOnlySerializedAnalysisQueue(async (input) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    started.push(input);
    try {
      return await new Promise((resolve) => resolvers.set(input, resolve));
    } finally {
      active -= 1;
    }
  });

  const first = queue.enqueue('track-a');
  await Promise.resolve();
  const second = queue.enqueue('track-b');
  const third = queue.enqueue('track-c');
  const secondOutcome = await second;
  assert.equal(secondOutcome.status, 'superseded', 'an unstarted intermediate analysis must be dropped');

  resolvers.get('track-a')({ bpm: 100 });
  const firstOutcome = await first;
  assert.equal(firstOutcome.status, 'superseded', 'an in-flight replaced analysis must not publish');
  await Promise.resolve();
  assert.deepEqual(started, ['track-a', 'track-c'], 'only the newest pending track should decode after the in-flight job');
  resolvers.get('track-c')({ bpm: 140 });
  const thirdOutcome = await third;
  assert.equal(thirdOutcome.status, 'completed');
  assert.deepEqual(thirdOutcome.value, { bpm: 140 });
  assert.equal(maximumActive, 1, 'decoded audio analysis must never overlap');
  assert.equal(queue.snapshot.maximumConcurrentJobs, 1);

  const controlPanelSource = fs.readFileSync('src/app/components/ControlPanel.tsx', 'utf8');
  const audioSystemSource = fs.readFileSync('src/app/engine/AudioSystemInit.ts', 'utf8');
  assert.ok(!controlPanelSource.includes('URL.createObjectURL'), 'ControlPanel duration probes must use the owned helper');
  assert.ok(!audioSystemSource.includes('URL.createObjectURL'), 'Audio playback URLs must use the owned registry');
  assert.ok(audioSystemSource.includes('detachMediaElement(prevEl)'), 'track replacement must detach and revoke the previous playback URL');
  assert.ok(audioSystemSource.includes('bpmAnalysisQueue.dispose()'), 'runtime disposal must invalidate queued BPM work');

  console.log('Audio object-URL ownership and serialized BPM analysis tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
