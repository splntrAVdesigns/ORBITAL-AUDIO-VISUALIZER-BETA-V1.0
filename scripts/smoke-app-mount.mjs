import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Window } from 'happy-dom';
import { build } from 'vite';

const root = process.cwd();
const outDir = path.join(root, '.runtime-smoke');
await fs.rm(outDir, { recursive: true, force: true });

await build({
  configFile: path.join(root, 'vite.config.ts'),
  logLevel: 'error',
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: path.join(root, 'scripts/smoke-app-entry.tsx'),
      formats: ['es'],
      fileName: () => 'smoke-app.mjs',
    },
  },
});

const window = new Window({ url: 'http://localhost/' });
const globals = {
  window,
  document: window.document,
  navigator: window.navigator,
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  Element: window.Element,
  Node: window.Node,
  SVGElement: window.SVGElement,
  HTMLElement: window.HTMLElement,
  HTMLImageElement: window.HTMLImageElement,
  HTMLCanvasElement: window.HTMLCanvasElement,
  HTMLMediaElement: window.HTMLMediaElement,
  HTMLAudioElement: window.HTMLAudioElement,
  HTMLVideoElement: window.HTMLVideoElement,
  Image: window.Image,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MouseEvent: window.MouseEvent,
  PointerEvent: window.PointerEvent,
  KeyboardEvent: window.KeyboardEvent,
  FileReader: window.FileReader,
  MutationObserver: window.MutationObserver,
  Blob: window.Blob,
  URL: window.URL,
  getComputedStyle: window.getComputedStyle.bind(window),
};
for (const [key, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 16);
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
globalThis.requestIdleCallback = (callback) => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 10 }), 0);
globalThis.cancelIdleCallback = (handle) => clearTimeout(handle);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia = () => ({
  matches: false,
  media: '',
  onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent() { return false; },
});
window.matchMedia = globalThis.matchMedia;
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    canvas: this,
    save() {}, restore() {}, clearRect() {}, fillRect() {}, beginPath() {}, closePath() {},
    arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, translate() {}, rotate() {}, scale() {},
    setTransform() {}, resetTransform() {}, drawImage() {}, createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }, measureText() { return { width: 0 }; },
    getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
    putImageData() {}, fillText() {}, strokeText() {}, setLineDash() {},
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, shadowBlur: 0, shadowColor: 'transparent', filter: 'none',
  };
};

const rootElement = window.document.createElement('div');
rootElement.id = 'root';
window.document.body.appendChild(rootElement);

try {
  const smokeModule = await import(`${pathToFileURL(path.join(outDir, 'smoke-app.mjs')).href}?t=${Date.now()}`);
  smokeModule.runBuiltInAssetSmokeTest();
  smokeModule.runParameterConversionSmokeTest();
  smokeModule.runFunctionalDefaultsSmokeTest();
  smokeModule.runRuntimeLifecycleSmokeTest();
  await smokeModule.runFullscreenControllerSmokeTest();
  smokeModule.runFullscreenShortcutSmokeTest();

  const tapTempoHost = window.document.createElement('div');
  window.document.body.appendChild(tapTempoHost);
  const unmountTapTempo = smokeModule.mountTapTempoForSmokeTest(tapTempoHost);
  await new Promise((resolve) => setTimeout(resolve, 25));
  const tapButton = tapTempoHost.querySelector('#tapTempo');
  const modeButton = tapTempoHost.querySelector('#bpmMode');
  const beatIndicator = tapTempoHost.querySelector('[aria-label="Tap tempo and four-beat indicator"]');
  if (!tapButton || !modeButton || !beatIndicator) throw new Error('Tap Tempo UI did not mount completely');
  tapButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 15));
  if (modeButton.textContent?.trim() !== 'MAN') throw new Error('Tap Tempo did not enter manual mode after tapping');
  unmountTapTempo();
  tapTempoHost.remove();

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const unmount = smokeModule.mountOrbitalForSmokeTest(rootElement);
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (!rootElement.hasChildNodes()) throw new Error(`Application mount cycle ${cycle + 1} rendered no content`);
    const builtInImages = [...rootElement.querySelectorAll('img')].filter((image) => /orbital|loading|icon/i.test(image.alt));
    for (const image of builtInImages) {
      if (!image.src) throw new Error(`Mounted built-in image has an empty URL: ${image.alt}`);
    }
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  console.log('Application mount smoke test passed (assets + client bundle + StrictMode mount/unmount).');
} finally {
  window.close();
  await fs.rm(outDir, { recursive: true, force: true });
}
 