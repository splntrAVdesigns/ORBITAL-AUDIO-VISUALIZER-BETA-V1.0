import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Core Particle GPU seeds are deterministic, typed, and preserve the 850-particle capacity', async context => {
  const seeds = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticleSeedData.ts',
    context,
  );
  const first = seeds.createCoreParticleSeedData();
  const second = seeds.createCoreParticleSeedData();
  assert.equal(seeds.CORE_PARTICLE_CAPACITY, 850);
  assert.ok(first.seed0 instanceof Float32Array);
  assert.ok(first.seed1 instanceof Float32Array);
  assert.ok(first.initialState instanceof Float32Array);
  assert.deepEqual(first.seed0, second.seed0);
  assert.deepEqual(first.seed1, second.seed1);
  assert.equal(first.seed0.length, 850 * 4);
  assert.equal(first.seed1.length, 850 * 4);

  seeds.resetCoreParticleState(first.initialState, first.seed0, 120);
  assert.ok(first.initialState.some(value => value !== 0));
  assert.ok(first.initialState.every(Number.isFinite));
  const radii = [];
  for (let index = 0; index < first.seed0.length; index += 4) radii.push(first.seed0[index + 1]);
  radii.sort((a, b) => a - b);
  assert.ok(radii[Math.floor(radii.length / 2)] > 0.55, 'the median seed radius must not collapse into the center');
});

test('Core Particle control mapping gives Spread, Pulse, Burst and Density useful authority', async context => {
  const mapping = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticleControlMapping.ts',
    context,
  );
  const lowField = mapping.resolveCoreParticleFieldRadius(1000, 0);
  const defaultField = mapping.resolveCoreParticleFieldRadius(1000, 0.30);
  const highField = mapping.resolveCoreParticleFieldRadius(1000, 0.90);
  assert.equal(lowField, 115);
  assert.ok(defaultField > 185 && defaultField < 205);
  assert.ok(highField > 295 && highField < 310);
  assert.ok(highField / lowField > 2.5, 'Spread must create an obvious zoom/expansion range');
  assert.equal(mapping.resolveCoreParticlePulse(0.8, 0), 0);
  assert.ok(mapping.resolveCoreParticlePulse(0.8, 0.9) > 0.8);
  assert.equal(mapping.resolveCoreParticleImpulse(0.8, 0), 0);
  assert.ok(mapping.resolveCoreParticleImpulse(0.8, 0.9) > 0.6);
  assert.ok(mapping.resolveCoreParticleImpulse(0.8, 1) < 0.8, 'Burst must retain headroom at 100%');
  const zeroIntensity = mapping.resolveCoreParticleIntensity(0);
  const legacyQuarter = (1 - Math.exp(-2.35 * 0.25)) / (1 - Math.exp(-2.35));
  assert.ok(Math.abs(zeroIntensity - legacyQuarter) < 0.000001, 'new zero must match the former 25% appearance');
  assert.equal(mapping.resolveCoreParticleIntensity(1), 1);
  assert.equal(mapping.resolveCoreParticleVisualEnergy(0), 1);
  assert.equal(mapping.resolveCoreParticleVisualEnergy(1), 4);
  assert.equal(mapping.resolveCoreParticleDiameterGain(0), 1);
  assert.ok(mapping.resolveCoreParticleDiameterGain(1) >= 1.69);
  assert.equal(mapping.resolveCoreParticleDrawCount(0.25), 96);
  assert.equal(mapping.resolveCoreParticleDrawCount(1), 850);
});

test('GPU renderer uses transform feedback and one SDF point-sprite draw with no private scheduler', () => {
  const renderer = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  const shaders = read('src/app/src/render/coreParticles/CoreParticleShaders.ts');
  const facade = read('src/app/src/engines/webgl/WebGLEngine.ts');
  const combinedRuntime = `${renderer}\n${facade}`;

  assert.match(renderer, /transformFeedbackVaryings/);
  assert.match(renderer, /beginTransformFeedback\(gl\.POINTS\)/);
  assert.match(renderer, /gl\.drawArrays\(gl\.POINTS, 0, CORE_PARTICLE_CAPACITY\)/);
  assert.match(renderer, /gl\.drawArrays\(gl\.POINTS, 0, this\.drawCount\)/);
  assert.equal((renderer.match(/gl\.drawArrays\(/g) ?? []).length, 2);
  assert.doesNotMatch(combinedRuntime, /requestAnimationFrame|setInterval|setTimeout/);
  assert.doesNotMatch(combinedRuntime, /beginPath|drawImage|createRadialGradient|hsla\(/i);
  assert.match(shaders, /circleSdf/);
  assert.match(shaders, /triangleSdf/);
  assert.match(shaders, /diamondSdf/);
  assert.match(shaders, /fwidth\(distanceToBody\)/);
  assert.match(shaders, /shapeGlow = exp/);
  assert.match(shaders, /uniform float u_fieldRadius/);
  assert.match(shaders, /uniform float u_visualEnergy/);
  assert.match(shaders, /uniform float u_diameterGain/);
  assert.match(shaders, /presenceGate = mix\(0\.42, 1\.0, reactiveGate\)/);
  assert.doesNotMatch(shaders, /mix\(0\.045, 0\.15/);
});

test('Core Particle authority is lazy, exclusive, recoverable, and Canvas2D fallback remains present', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const rendererViewportSetup = read('src/app/runtime/visualizer/setup/createRendererViewportSetup.ts');
  const renderer = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  const app = read('src/app/App.tsx');

  assert.match(session, /ensureCoreParticlesGpuRenderer/);
  assert.match(session, /if \(useEngineOwnedGL\) \{[\s\S]*ensureCoreParticlesGpuRenderer\(\)/);
  assert.match(rendererViewportSetup, /const ensureCoreParticlesGpuRenderer/);
  assert.match(rendererViewportSetup, /new WebGLEngine\(/);
  assert.doesNotMatch(session, /new WebGLEngine\(/);
  assert.match(session, /if \(params\.shapeOscillate && !params\.astralShaper && !useEngineOwnedGL\)/);
  assert.match(session, /if \(!gpuFrameRendered\) useEngineOwnedGL = false/);
  assert.match(session, /webglEngineRef\.current\?\.suspend\(\)/);
  assert.match(session, /legacyWebGLSpikeAllowed && webglSpikeRenderer/);
  assert.match(session, /params\.spikeBloom > 0\.01 && glCanvas/);
  assert.match(renderer, /webglcontextlost/);
  assert.match(renderer, /webglcontextrestored/);
  assert.match(renderer, /Context recovery failed; Canvas2D fallback remains active/);
  assert.match(renderer, /WEBGL_lose_context/);
  assert.match(app, /const useWebGLCoreParticlesRef = useRef\(true\)/);
});

test('context loss switches a live GPU frame to fallback and restoration rebuilds resources', async context => {
  const { CoreParticlesGpuRenderer, normalizeCoreParticleShapeMode } = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts',
    context,
  );
  let drawCalls = 0;
  let loseCalls = 0;
  const uniformValues = new Map();
  const object = () => ({});
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    INTERLEAVED_ATTRIBS: 5, ARRAY_BUFFER: 6, STATIC_DRAW: 7, DYNAMIC_COPY: 8,
    FLOAT: 9, TRANSFORM_FEEDBACK_BUFFER: 10, TRANSFORM_FEEDBACK: 11,
    POINTS: 12, RASTERIZER_DISCARD: 13, DEPTH_TEST: 14, CULL_FACE: 15,
    SCISSOR_TEST: 16, COLOR_BUFFER_BIT: 17, BLEND: 18, FUNC_ADD: 19,
    SRC_ALPHA: 20, ONE_MINUS_SRC_ALPHA: 21,
    createShader: object, shaderSource() {}, compileShader() {},
    getShaderParameter: () => true, getShaderInfoLog: () => '', deleteShader() {},
    createProgram: object, attachShader() {}, transformFeedbackVaryings() {}, linkProgram() {},
    getProgramParameter: () => true, getProgramInfoLog: () => '', deleteProgram() {},
    getUniformLocation: (_program, name) => ({ name }),
    createBuffer: object, bindBuffer() {}, bufferData() {}, bufferSubData() {}, deleteBuffer() {},
    createVertexArray: object, bindVertexArray() {}, enableVertexAttribArray() {}, vertexAttribPointer() {}, deleteVertexArray() {},
    createTransformFeedback: object, bindTransformFeedback() {}, bindBufferBase() {},
    beginTransformFeedback() {}, endTransformFeedback() {}, deleteTransformFeedback() {},
    useProgram() {}, uniform1f(location, value) { uniformValues.set(location.name, value); }, uniform2f() {}, viewport() {}, disable() {}, enable() {},
    clearColor() {}, clear() {}, blendEquation() {}, blendFunc() {},
    drawArrays() { drawCalls += 1; },
    getExtension(name) { return name === 'WEBGL_lose_context' ? { loseContext: () => { loseCalls += 1; } } : null; },
  };
  class FakeCanvas extends EventTarget {
    width = 1;
    height = 1;
    style = { width: '', height: '', visibility: '' };
    getContext(name) { return name === 'webgl2' ? gl : null; }
  }
  const canvas = new FakeCanvas();
  gl.canvas = canvas;
  const renderer = new CoreParticlesGpuRenderer(canvas);
  renderer.resize(800, 600, 1);
  const frame = {
    timeSec: 1,
    dtSec: 1 / 60,
    resolution: { w: 800, h: 600, dpr: 1 },
    params: { coreParticlesEnabled: true, coreParticlesShapeMode: 'all' },
    beatPulse: 0.4,
    audioEnergy: 0.6,
  };
  assert.equal(renderer.render(frame), true);
  assert.equal(drawCalls, 2, 'one simulation and one render draw are submitted');
  assert.equal(renderer.getDiagnostics().state, 'ready');
  assert.equal(uniformValues.get('u_shapeMode'), 3, 'ALL reaches the shader as the mixed-shape mode');
  assert.ok(uniformValues.get('u_fieldRadius') > 110, 'default Spread fills a useful share of the 600px core');
  assert.equal(normalizeCoreParticleShapeMode('triangle'), 'tri');
  assert.equal(normalizeCoreParticleShapeMode('diamond'), 'dia');
  frame.params.coreParticlesShapeMode = 'tri';
  assert.equal(renderer.render(frame), true);
  assert.equal(uniformValues.get('u_shapeMode'), 1);
  frame.params.coreParticlesShapeMode = 'dia';
  assert.equal(renderer.render(frame), true);
  assert.equal(uniformValues.get('u_shapeMode'), 2);

  const lost = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true);
  assert.equal(renderer.render(frame), false);
  assert.equal(renderer.getDiagnostics().state, 'context-lost');
  assert.equal(renderer.getDiagnostics().fallbackFrames, 1);

  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(renderer.render(frame), true);
  assert.equal(renderer.getDiagnostics().contextRecoveries, 1);
  renderer.suspend();
  assert.equal(renderer.getDiagnostics().state, 'suspended');
  renderer.dispose();
  assert.equal(renderer.getDiagnostics().state, 'disposed');
  assert.equal(loseCalls, 1);
});

test('all legacy Core Particle controls and shape modes route into the GPU frame', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const types = read('src/app/src/render/coreParticles/CoreParticleTypes.ts');
  const renderer = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  const controls = read('src/app/components/CoreParticlesSettings.tsx');

  for (const key of [
    'coreParticlesIntensity', 'coreParticlesSpread', 'coreParticlesChaos',
    'coreParticlesPulse', 'coreParticlesEdgeFallback', 'coreParticlesShapeMode',
    'coreParticlesDensity', 'coreParticleImpulse', 'coreParticleBass',
    'coreParticleMid', 'coreParticleHigh', 'motionSmoothing',
  ]) {
    assert.match(session, new RegExp(`gpuParams\\.${key}\\s*=`), `${key} must be forwarded by the authoritative RAF`);
    assert.match(types, new RegExp(`${key}\\?`), `${key} must be typed at the GPU boundary`);
  }
  assert.match(renderer, /mode === 'tri'/);
  assert.match(renderer, /mode === 'dia'/);
  assert.match(renderer, /mode === 'all'/);
  assert.match(renderer, /mode === 'triangle'/);
  assert.match(renderer, /mode === 'diamond'/);
  assert.match(controls, /\['dot', 'tri', 'dia', 'all'\]/);
  assert.match(controls, /dispatchRuntimeParameterTransaction\(\{ coreParticlesShapeMode: mode \}, 'control'\)/);
  assert.match(controls, /RUNTIME_PARAMETER_TRANSACTION_EVENT/);
  assert.match(controls, /aria-pressed=/);
  assert.match(renderer, /resolveCoreParticleImpulse/);
  assert.match(session, /visualAudioFrame\.transient \* 0\.54/);
  assert.match(session, /coreParticleFeature\.nextGpuDiagnosticAt = t \+ 500/);
});
