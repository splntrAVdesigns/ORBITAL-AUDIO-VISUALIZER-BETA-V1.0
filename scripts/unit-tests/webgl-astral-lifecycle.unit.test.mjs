import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

function createFakeWebGL() {
  let nextId = 1;
  const counters = {
    cancelIdleCallback: 0,
    clearTimeout: 0,
    deleteBuffer: 0,
    deleteProgram: 0,
    deleteShader: 0,
    deleteTexture: 0,
    loseContext: 0,
  };
  const object = kind => ({ kind, id: nextId++ });
  const gl = {
    ARRAY_BUFFER: 1, CLAMP_TO_EDGE: 2, COLOR_BUFFER_BIT: 3, COMPILE_STATUS: 4,
    FLOAT: 5, FRAGMENT_SHADER: 6, LINEAR: 7, LINK_STATUS: 8, RGBA: 9,
    STATIC_DRAW: 10, TEXTURE0: 11, TEXTURE1: 12, TEXTURE_2D: 13,
    TEXTURE_MAG_FILTER: 14, TEXTURE_MIN_FILTER: 15, TEXTURE_WRAP_S: 16,
    TEXTURE_WRAP_T: 17, TRIANGLE_STRIP: 18, UNSIGNED_BYTE: 19, VERTEX_SHADER: 20,
    activeTexture() {}, attachShader() {}, bindBuffer() {}, bindTexture() {}, bufferData() {},
    clear() {}, clearColor() {}, compileShader() {}, detachShader() {}, drawArrays() {},
    enableVertexAttribArray() {}, linkProgram() {}, shaderSource() {}, texImage2D() {},
    texParameteri() {}, uniform1f() {}, uniform1i() {}, uniform3f() {}, useProgram() {},
    vertexAttribPointer() {},
    createBuffer: () => object('buffer'),
    createProgram: () => object('program'),
    createShader: () => object('shader'),
    createTexture: () => object('texture'),
    deleteBuffer: () => { counters.deleteBuffer += 1; },
    deleteProgram: () => { counters.deleteProgram += 1; },
    deleteShader: () => { counters.deleteShader += 1; },
    deleteTexture: () => { counters.deleteTexture += 1; },
    getAttribLocation: () => 0,
    getExtension: name => name === 'WEBGL_lose_context'
      ? { loseContext: () => { counters.loseContext += 1; } }
      : null,
    getProgramInfoLog: () => '', getProgramParameter: () => true,
    getShaderInfoLog: () => '', getShaderParameter: () => true,
    getUniformLocation: (_program, name) => ({ name }),
  };
  return { counters, gl };
}

test('WebGLAstralRenderer disposal releases every resource and resets the singleton', async (context) => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const { counters, gl } = createFakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl };
  globalThis.document = { createElement: () => canvas };
  globalThis.window = {
    requestIdleCallback: () => 77,
    cancelIdleCallback: () => { counters.cancelIdleCallback += 1; },
    setTimeout: () => 88,
    clearTimeout: () => { counters.clearTimeout += 1; },
  };
  context.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });

  const module = await importBundledTypescript('src/app/engine/WebGLAstralRenderer.ts', context);
  const renderer = new module.WebGLAstralRenderer();
  renderer.cleanupIdleHandle = 77;
  renderer.cleanupTimeoutHandle = 88;
  renderer.dispose();

  assert.equal(renderer.isDisposed, true);
  assert.equal(counters.cancelIdleCallback, 1);
  assert.equal(counters.clearTimeout, 1);
  assert.equal(counters.deleteTexture, 2);
  assert.equal(counters.deleteBuffer, 1);
  assert.equal(counters.deleteShader, 2);
  assert.equal(counters.deleteProgram, 1);
  assert.equal(counters.loseContext, 1);
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.throws(() => renderer.render({}, {}, 0, 0, 1, 0, 0, 0, '#ffffff', 0), /disposed/);

  renderer.dispose();
  assert.equal(counters.deleteTexture, 2, 'dispose must be idempotent');
  assert.equal(counters.loseContext, 1, 'context must be released exactly once');

  const first = module.getWebGLAstralRenderer();
  assert.equal(module.getWebGLAstralRenderer(), first);
  module.disposeWebGLAstralRenderer();
  assert.equal(first.isDisposed, true);
  const second = module.getWebGLAstralRenderer();
  assert.notEqual(second, first);
  module.disposeWebGLAstralRenderer();
});
test('Liquid Shaper private WebGL context loss degrades without disposing the session and rebuilds after restoration', async (context) => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const { gl } = createFakeWebGL();
  const listeners = new Map();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  globalThis.document = { createElement: () => canvas };
  globalThis.window = {
    dispatchEvent() {},
    requestIdleCallback: () => 77,
    cancelIdleCallback() {},
    setTimeout: () => 88,
    clearTimeout() {},
  };
  context.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });

  const module = await importBundledTypescript('src/app/engine/WebGLAstralRenderer.ts', context);
  const renderer = new module.WebGLAstralRenderer();
  let prevented = false;
  listeners.get('webglcontextlost')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(renderer.getDiagnostics().status, 'context-lost');
  assert.equal(renderer.render({}, {}, 0, 0, 1, 0, 0, 0, '#ffffff', 0), null);
  assert.equal(renderer.isDisposed, false, 'context loss must not dispose the app renderer');

  listeners.get('webglcontextrestored')();
  const rebuilt = renderer.render({}, {}, 0, 0, 1, 0, 0, 0, '#ffffff', 0);
  assert.equal(rebuilt, canvas, 'first healthy render after restoration rebuilds resources');
  assert.equal(renderer.getDiagnostics().status, 'ready');
  assert.equal(renderer.getDiagnostics().contextLosses, 1);
  assert.equal(renderer.getDiagnostics().contextRestores, 1);
  renderer.dispose();
});

test('Liquid Shaper texture cache has an explicit byte-bounded eviction contract', () => {
  const source = fs.readFileSync('src/app/utils/astralShaper.ts', 'utf8');
  assert.match(source, /const LIQUID_TEXTURE_SIZE = 1024/);
  assert.match(source, /const MAX_LIQUID_TEXTURE_CACHE_ENTRIES = 12/);
  assert.match(source, /evictTextureCacheTo\(MAX_LIQUID_TEXTURE_CACHE_ENTRIES\)/);
  assert.match(source, /canvas\.width = 1;\s*canvas\.height = 1/);
  assert.match(source, /estimatedBytes: texCache\.size \* LIQUID_TEXTURE_SIZE \* LIQUID_TEXTURE_SIZE \* 4/);
});
