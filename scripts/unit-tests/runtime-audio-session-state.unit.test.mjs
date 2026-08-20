import assert from 'node:assert/strict';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

test('audio session state owns media bridges and deterministic media teardown', async context => {
  const previousWindow = globalThis.window;
  const runtimeWindow = {};
  globalThis.window = runtimeWindow;
  context.after(() => { globalThis.window = previousWindow; });

  const { RuntimeAudioSessionState } = await importBundledTypescript(
    'src/app/runtime/visualizer/audio/RuntimeAudioSessionState.ts',
    context,
  );
  const { createRuntimeResourceScope } = await importBundledTypescript(
    'src/app/runtime/visualizer/session/RuntimeResourceDiagnostics.ts',
    context,
  );

  const scope = createRuntimeResourceScope('audio-session-state-test');
  const state = new RuntimeAudioSessionState(scope, false);
  let attachedMedia = null;
  state.setStressDiagnosticsAttacher(media => { attachedMedia = media; });

  class FakeAudio extends EventTarget {
    paused = false;
    removedSource = false;
    loaded = false;
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.removedSource = true; }
    load() { this.loaded = true; }
  }

  const media = new FakeAudio();
  state.setMediaElement(media);
  assert.equal(state.mediaElement, media);
  assert.equal(runtimeWindow.mediaEl, media);
  assert.equal(attachedMedia, media);

  let metadataUpdates = 0;
  state.setMetadataUpdater(() => { metadataUpdates += 1; });
  state.notifyMetadataUpdated();
  assert.equal(metadataUpdates, 1);

  state.dispose();
  assert.equal(media.paused, true);
  assert.equal(media.removedSource, true);
  assert.equal(media.loaded, true);
  assert.equal(state.mediaElement, null);
  assert.equal(runtimeWindow.mediaEl, null);
  scope.close();
});
