import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const CURATED_SEQUENCE = [
  'sg-vesica-chain',
  'sg-sri-yantra',
  'sg-merkaba',
  'sg-dodecahedron',
  'kx-polar-wedge',
  'kx-rosette',
  'sg-metatron-cube',
  'fx-guilloche-ribbon',
  'fx-lissajous',
  'gl-runic-ring',
  'gl-compass-rose',
  'vj-orbital-nodes',
  'kx-mirror-hex',
  'kx-mandala-rings',
  'kx-dihedral',
  'gl-circuit-glyph',
  'gl-lotus-mandala',
  'vj-hex-grid',
  'vj-concentric-squares',
  'vj-star-polygon',
];

test('Liquid Shaper exposes the requested 20-shape cycle without deleting compatibility shapes', async (context) => {
  const module = await importBundledTypescript('src/app/utils/astralShaper.ts', context);
  assert.deepEqual([...module.getActiveCycleShapes()], CURATED_SEQUENCE);
  assert.equal(module.getActiveCycleShapes().includes('fx-spirograph-hypo'), false);
  assert.equal(module.getAllShapes().includes('fx-spirograph-hypo'), true);
});

test('auto-cycle initialization preserves selected and legacy preset shapes', async (context) => {
  const { AstralMorphEngine } = await importBundledTypescript('src/app/engine/AstralMorphEngine.ts', context);
  const params = {
    astralShaper: true,
    astralAutoCycle: true,
    astralShape: 'sg-flower-of-life',
    astralCycleSpeed: 'slow',
    astralMorphAmount: 0,
    astralMorphDamping: 0.5,
  };
  const engine = new AstralMorphEngine();
  engine.update(params, 120, 1000);
  assert.equal(params.astralShape, 'sg-flower-of-life');
  assert.equal(engine.getNextShape(), CURATED_SEQUENCE[0]);

  params.astralShape = CURATED_SEQUENCE[4];
  engine.reset();
  engine.update(params, 120, 2000);
  assert.equal(params.astralShape, CURATED_SEQUENCE[4]);
  assert.equal(engine.getNextShape(), CURATED_SEQUENCE[5]);
});

test('Liquid Shaper shader has exact endpoints and derivative-based edge antialiasing', () => {
  const source = fs.readFileSync('src/app/engine/WebGLAstralRenderer.ts', 'utf8');
  assert.match(source, /biasA = 1\.0 - smoothstep\(0\.35, 1\.0, morph\)/);
  assert.match(source, /biasB = smoothstep\(0\.0, 0\.65, morph\)/);
  assert.match(source, /fwidth\(field\) \* 1\.35/);
  assert.match(source, /vec3 coreColor/);
  assert.match(source, /vec3 rimColor/);
});

test('Dark Strobe is one loop-free top pass included before recording capture', () => {
  const renderer = fs.readFileSync('src/app/runtime/visualizer/renderers/DarkStrobeRenderer.ts', 'utf8');
  const session = (fs.readFileSync('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts', 'utf8') + '\n' + fs.readFileSync('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts', 'utf8'));
  assert.doesNotMatch(renderer, /requestAnimationFrame|setInterval|setTimeout|readPixels|getImageData|createElement\(['"]canvas/);
  assert.match(renderer, /tearOffset/);
  assert.match(renderer, /uniform1f\(this\.depthLocation/);
  assert.match(renderer, /uniform1f\(this\.displacementLocation/);
  const renderIndex = session.indexOf('darkStrobeRenderer?.render(reusedDarkStrobeFrame)');
  const recordingIndex = session.indexOf('recordingEngine.publishFrame(now)');
  assert.ok(renderIndex >= 0 && recordingIndex > renderIndex, 'Dark Strobe must render before the recording frame is published');
});

test('Dark Strobe allocates once and releases its shared-context resources', async (context) => {
  let nextId = 1;
  const listeners = new Map();
  const uniforms = new Map();
  const counters = { draw: 0, deleteProgram: 0, deleteVao: 0, deleteShader: 0 };
  const resource = kind => ({ kind, id: nextId++ });
  const gl = {
    BLEND: 1, COLOR_BUFFER_BIT: 2, COMPILE_STATUS: 3, DEPTH_TEST: 4,
    FRAGMENT_SHADER: 5, FUNC_ADD: 6, LINK_STATUS: 7, ONE_MINUS_SRC_ALPHA: 8,
    SCISSOR_TEST: 9, SRC_ALPHA: 10, STENCIL_TEST: 11, TRIANGLES: 12, VERTEX_SHADER: 13,
    attachShader() {}, bindVertexArray() {}, blendEquation() {}, blendFunc() {},
    clear() {}, clearColor() {}, compileShader() {}, disable() {}, enable() {}, linkProgram() {},
    shaderSource() {}, useProgram() {}, viewport() {},
    createProgram: () => resource('program'),
    createShader: () => resource('shader'),
    createVertexArray: () => resource('vao'),
    deleteProgram: () => { counters.deleteProgram += 1; },
    deleteShader: () => { counters.deleteShader += 1; },
    deleteVertexArray: () => { counters.deleteVao += 1; },
    drawArrays: () => { counters.draw += 1; },
    getProgramInfoLog: () => '', getProgramParameter: () => true,
    getShaderInfoLog: () => '', getShaderParameter: () => true,
    getUniformLocation: (_program, name) => ({ name }),
    isContextLost: () => false,
    uniform1f: (location, value) => uniforms.set(location.name, value),
  };
  const canvas = {
    width: 1280,
    height: 720,
    style: {},
    getContext: () => gl,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  const { DarkStrobeRenderer } = await importBundledTypescript(
    'src/app/runtime/visualizer/renderers/DarkStrobeRenderer.ts',
    context,
  );
  const renderer = new DarkStrobeRenderer(canvas);
  assert.equal(renderer.render({ pulse: 1.5, depth: 2, displacement: -1, timeSeconds: 4, baseLayerActive: false }), true);
  assert.equal(counters.draw, 1);
  assert.equal(uniforms.get('u_pulse'), 1);
  assert.equal(uniforms.get('u_depth'), 1);
  assert.equal(uniforms.get('u_displacement'), 0);
  renderer.dispose();
  assert.equal(counters.deleteProgram, 1);
  assert.equal(counters.deleteVao, 1);
  assert.equal(counters.deleteShader, 2);
  assert.equal(listeners.size, 0);
  renderer.dispose();
  assert.equal(counters.deleteProgram, 1, 'dispose must be idempotent');
});
