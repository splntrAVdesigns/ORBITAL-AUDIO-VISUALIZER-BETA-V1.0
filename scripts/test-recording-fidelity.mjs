import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-recording-fidelity-'));
function transpile(source, target) {
  const output = transformSync(fs.readFileSync(source, 'utf8'), {
    loader: 'ts', format: 'esm', target: 'es2022', sourcefile: source,
  }).code;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}
function fixImports(file, replacements) {
  let code = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  fs.writeFileSync(file, code);
}

try {
  transpile('src/app/utils/gifExport.ts', path.join(tempRoot, 'utils/gifExport.js'));
  transpile('src/app/engine/recording/RecordingProfiles.ts', path.join(tempRoot, 'engine/recording/RecordingProfiles.js'));
  transpile('src/app/engine/recording/RecordingFramePublisher.ts', path.join(tempRoot, 'engine/recording/RecordingFramePublisher.js'));
  transpile('src/app/engine/RecordingEngine.ts', path.join(tempRoot, 'engine/RecordingEngine.js'));
  fixImports(path.join(tempRoot, 'engine/RecordingEngine.js'), [
    ['../utils/gifExport', '../utils/gifExport.js'],
    ['./recording/RecordingFramePublisher', './recording/RecordingFramePublisher.js'],
    ['./recording/RecordingProfiles', './recording/RecordingProfiles.js'],
  ]);

  const profiles = await import(`${pathToFileURL(path.join(tempRoot, 'engine/recording/RecordingProfiles.js')).href}?v=${Date.now()}`);
  assert.deepEqual(profiles.resolveRecordingDimensions('4k'), { resolution: '4k', width: 3840, height: 2160 });
  assert.equal(profiles.normalizeRecordingFps('1080p', 120), 60, '120 FPS must be capped');
  assert.equal(profiles.normalizeRecordingFps('4k', 60), 30, '4K must be capped at 30 FPS');
  const resolved = profiles.resolveRecordingOptions({ resolution: '1440p', fps: 60, duration: 30, codec: 'vp9', quality: 'ultra' });
  assert.equal(resolved.width, 2560);
  assert.equal(resolved.height, 1440);
  assert.equal(resolved.videoBitsPerSecond, 20_000_000);
  assert.equal(resolved.mimeCandidates[0], 'video/webm;codecs=vp9');
  const budgetItems = [100, 100, 100, 100].map((size) => ({ blob: { size: size * 1024 * 1024 } }));
  const evicted = profiles.trimRecordingLibraryToBudget(budgetItems, 8, 384 * 1024 * 1024);
  assert.equal(evicted.length, 1, 'byte budget must evict the oldest recording');
  assert.equal(budgetItems.length, 3);

  const original = {
    MediaRecorder: globalThis.MediaRecorder,
    document: globalThis.document,
    performance: globalThis.performance,
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };

  const createdCanvases = [];
  class FakeContext {
    drawCalls = [];
    imageSmoothingEnabled = false;
    imageSmoothingQuality = 'low';
    setTransform() {}
    fillRect() {}
    drawImage(...args) { this.drawCalls.push(args); }
    set globalAlpha(_) {}
    set globalCompositeOperation(_) {}
    set fillStyle(_) {}
  }
  let stoppedTracks = 0;
  let requestedFrames = 0;
  class FakeCanvas {
    width = 640;
    height = 360;
    context = new FakeContext();
    captureRequests = [];
    getContext() { return this.context; }
    captureStream(fps) {
      this.captureRequests.push(fps);
      const track = {
        stop() { stoppedTracks += 1; },
        requestFrame() { requestedFrames += 1; },
      };
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    }
  }
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        const canvas = new FakeCanvas();
        createdCanvases.push(canvas);
        return canvas;
      }
      return { style: {}, remove() {}, textContent: '', appendChild() {} };
    },
    body: { classList: { contains: () => false }, appendChild() {} },
    fullscreenElement: null,
    getElementById: () => null,
  };

  class FakeMediaRecorder {
    static instances = [];
    static isTypeSupported(type) { return type.includes('vp9') || type === 'video/webm'; }
    state = 'inactive';
    mimeType;
    ondataavailable = null;
    onstop = null;
    onerror = null;
    constructor(stream, options = {}) {
      this.stream = stream;
      this.options = options;
      this.mimeType = options.mimeType || 'video/webm';
      FakeMediaRecorder.instances.push(this);
    }
    start(timeslice) { this.timeslice = timeslice; this.state = 'recording'; }
    stop() {
      if (this.state !== 'recording') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['recording-data'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  globalThis.MediaRecorder = FakeMediaRecorder;
  const createdUrls = [];
  const revokedUrls = [];
  URL.createObjectURL = () => { const url = `blob:recording-${createdUrls.length + 1}`; createdUrls.push(url); return url; };
  URL.revokeObjectURL = (url) => revokedUrls.push(url);

  try {
    const { RecordingEngine, MAX_SINGLE_RECORDING_BYTES, MAX_MANUAL_RECORDING_SECONDS } = await import(`${pathToFileURL(path.join(tempRoot, 'engine/RecordingEngine.js')).href}?v=${Date.now()}`);
    const sourceCanvas = new FakeCanvas();
    const glCanvas = new FakeCanvas();
    const libraries = [];
    const qualityLocks = [];
    const metadata = { recTime: '—' };
    const engine = new RecordingEngine({
      canvas: sourceCanvas,
      glCanvas,
      params: { recordCountdown: false, recordFPS: 60 },
      getRecordingFPS: () => 60,
      getRecordingResolution: () => '1080p',
      getRecordingDuration: () => 0,
      getRecordingCodec: () => 'vp9',
      getRecordingQuality: () => 'high',
      setRecordingCaptureResolution: (value) => qualityLocks.push(value),
      setIsRecording: () => {}, setRecordingTimeLeft: () => {},
      setRecordingLibrary: (value) => libraries.push(value),
      getIsPlaying: () => true, setIsPlaying: () => {}, getIsMicActive: () => false,
      getMediaEl: () => null, getAC: () => null,
      getCurrentPlayPromise: () => null, setCurrentPlayPromise: () => {}, setAudioStartTime: () => {},
      trackMetadata: metadata, updateMetadataDisplay: () => {}, root: null,
    });

    assert.equal(MAX_MANUAL_RECORDING_SECONDS, 300);
    assert.ok(MAX_SINGLE_RECORDING_BYTES >= 128 * 1024 * 1024);
    assert.equal(engine.requestStart({ resolution: '720p', fps: 120, duration: 0, codec: 'vp9', quality: 'ultra' }), 'started');
    const recorder = FakeMediaRecorder.instances.at(-1);
    assert.equal(recorder.options.mimeType, 'video/webm;codecs=vp9');
    assert.equal(recorder.options.videoBitsPerSecond, 20_000_000);
    assert.equal(recorder.timeslice, 1000, 'periodic chunks must bound live recording memory');
    assert.deepEqual(qualityLocks[0], { width: 1280, height: 720 });

    const outputCanvas = createdCanvases[0];
    assert.equal(outputCanvas.width, 1280);
    assert.equal(outputCanvas.height, 720);
    assert.equal(outputCanvas.captureRequests[0], 0, 'requestFrame mode should be preferred');

    const base = performance.now();
    engine.publishFrame(base + 5);
    engine.publishFrame(base + 18);
    engine.publishFrame(base + 35);
    assert.ok(requestedFrames >= 2, 'authoritative cadence must request frames');
    assert.ok(outputCanvas.context.drawCalls.length >= 4, 'each published frame must composite Canvas2D and WebGL layers');

    assert.equal(engine.stop(), true);
    const item = libraries.at(-1)[0];
    assert.equal(item.width, 1280);
    assert.equal(item.height, 720);
    assert.equal(item.fps, 60);
    assert.equal(item.codec, 'vp9');
    assert.equal(item.quality, 'ultra');
    assert.equal(item.videoBitsPerSecond, 20_000_000);
    assert.equal(item.extension, 'webm');
    assert.equal(qualityLocks.at(-1), null, 'capture-quality lock must release after recording');
    assert.ok(stoppedTracks >= 1, 'capture stream must be stopped');

    engine.clearRecordings();
    assert.deepEqual(revokedUrls, createdUrls, 'saved recording URLs must be revoked');
    engine.dispose();

    const runtimeSource = fs.readFileSync('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts', 'utf8') +
      '\n' + fs.readFileSync('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts', 'utf8');
    const uiSource = fs.readFileSync('src/app/components/settings/RecordingSection.tsx', 'utf8');
    const centerSource = fs.readFileSync('src/app/renderers/centerGraphicRenderer.ts', 'utf8');
    assert.match(
      runtimeSource,
      /publishRecordingFrame:\s*\(now\)\s*=>\s*\{\s*recordingEngine\.publishFrame\(now\)/,
      'recording frames must publish from the authoritative ProductionFrameRuntime scheduler callback',
    );
    assert.ok(!uiSource.includes("value: 120"), 'unsupported 120 FPS option must be removed');
    assert.ok(!runtimeSource.includes('audioBridge.analyzeAsync'), 'unused audio-analysis worker traffic must remain removed');
    assert.ok(centerSource.includes('renderState.glitchSeed = glitchSeed'), 'kaleidoscope glitch seed must be owned by renderer state');

    console.log('Recording fidelity, codec, bitrate, cadence, composite-layer, and lifecycle tests passed');
  } finally {
    globalThis.MediaRecorder = original.MediaRecorder;
    globalThis.document = original.document;
    globalThis.performance = original.performance;
    URL.createObjectURL = original.createObjectURL;
    URL.revokeObjectURL = original.revokeObjectURL;
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
