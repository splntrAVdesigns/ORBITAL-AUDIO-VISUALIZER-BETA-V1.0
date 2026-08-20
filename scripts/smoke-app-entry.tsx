import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/app/App';
import { RuntimeFrameScheduler } from '../src/app/runtime/visualizer/RuntimeFrameScheduler';
import { RuntimeAsyncRegistry } from '../src/app/runtime/visualizer/session/RuntimeAsyncRegistry';
import { RuntimeEventRegistry } from '../src/app/runtime/visualizer/session/RuntimeEventRegistry';
import { createRuntimeResourceScope } from '../src/app/runtime/visualizer/session/RuntimeResourceDiagnostics';
import { RuntimeSessionDisposer } from '../src/app/runtime/visualizer/session/RuntimeSessionDisposer';
import {
  BUILT_IN_ASSETS,
  BUILT_IN_ASSET_TRANSPORT,
  assertBuiltInAssetRegistry,
  isInlineBuiltInAssetUrl,
} from '../src/app/config/assets';
import { dotDensityCountToSlider, dotDensitySliderToCount, normalizeDotDensityForSlider } from '../src/app/config/parameterConversions';
import { defaultParams } from '../src/app/config/defaultParams';
import { TapTempoControl } from '../src/app/components/TapTempoControl';
import { bpmClockRuntime } from '../src/app/runtime/bpm/BpmClockRuntime';
import { createFullscreenController } from '../src/app/controllers/exportController';
import { createKeyboardShortcutHandler } from '../src/app/src/app/hooks/useKeyboardShortcuts';

export function mountOrbitalForSmokeTest(element: HTMLElement): () => void {
  const root = createRoot(element);
  root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
  return () => root.unmount();
}

export function mountTapTempoForSmokeTest(element: HTMLElement): () => void {
  bpmClockRuntime.reset(performance.now(), 174);
  const root = createRoot(element);
  root.render(React.createElement(React.StrictMode, null, React.createElement(TapTempoControl)));
  return () => root.unmount();
}

/** Exercises setup → cleanup → setup with the same resource model used by StrictMode. */
export function runRuntimeLifecycleSmokeTest(): void {
  for (let cycle = 0; cycle < 20; cycle += 1) {
    const disposer = new RuntimeSessionDisposer();
    const resources = createRuntimeResourceScope(`strict-mode-smoke-${cycle}`);
    disposer.add(() => resources.close());
    const asyncRegistry = new RuntimeAsyncRegistry(resources);
    const eventRegistry = new RuntimeEventRegistry(resources);
    disposer.add(() => asyncRegistry.dispose());
    disposer.add(() => eventRegistry.dispose());
    eventRegistry.listen(document, 'click', () => {});
    asyncRegistry.setTimeout(() => {}, 1000);
    const scheduler = new RuntimeFrameScheduler({ onFrame: () => {}, resourceScope: resources });
    scheduler.start();
    disposer.add(() => scheduler.dispose());
    disposer.dispose();
  }

  const counts = (globalThis as any).__ORBITAL_RUNTIME_RESOURCES__;
  if (counts && Object.values(counts).some((value) => value !== 0)) {
    throw new Error(`Runtime lifecycle smoke test leaked resources: ${JSON.stringify(counts)}`);
  }
}


export function runBuiltInAssetSmokeTest(): void {
  assertBuiltInAssetRegistry();
  if (BUILT_IN_ASSET_TRANSPORT !== 'inline-data-url') {
    throw new Error(`Unexpected built-in asset transport: ${BUILT_IN_ASSET_TRANSPORT}`);
  }
  for (const [key, asset] of Object.entries(BUILT_IN_ASSETS)) {
    if (!asset.url || typeof asset.url !== 'string') {
      throw new Error(`Built-in asset ${key} has an empty URL`);
    }
    if (!isInlineBuiltInAssetUrl(asset.url)) {
      throw new Error(`Built-in asset ${key} is not an inline PNG data URL`);
    }
  }
}

export function runFunctionalDefaultsSmokeTest(): void {
  const densitySlider = normalizeDotDensityForSlider(defaultParams.dotsDensity);
  if (Math.abs(densitySlider - 0.25) > 0.015) {
    throw new Error(`Factory dot density is ${densitySlider}, expected approximately 0.25`);
  }
  if (defaultParams.gamma !== 0 || defaultParams.iridize !== 0) {
    throw new Error('Gamma and Iridize factory defaults must remain disabled');
  }
  for (const key of ['macro1', 'macro2', 'macro3', 'macro4'] as const) {
    if (defaultParams[key] !== 0) {
      throw new Error(`${key} factory default must remain zero`);
    }
  }
}

export function runParameterConversionSmokeTest(): void {
  const slider = dotDensityCountToSlider(32.8);
  if (Math.abs(slider - 0.25) > 0.015) {
    throw new Error(`Default dot density converted to ${slider}, expected approximately 0.25`);
  }
  const count = dotDensitySliderToCount(slider);
  if (Math.abs(count - 33) > 1) {
    throw new Error(`Dot density round-trip produced ${count}, expected approximately 33`);
  }
  if (Math.abs(normalizeDotDensityForSlider(0.42) - 0.42) > 0.0001) {
    throw new Error('Normalized preset density was altered unexpectedly');
  }
}


export async function runFullscreenControllerSmokeTest(): Promise<void> {
  let fullscreenElement: Element | null = null;
  let layoutSyncCount = 0;
  const originalRequestFullscreen = (document.documentElement as any).requestFullscreen;
  const originalExitFullscreen = (document as any).exitFullscreen;
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: async () => {
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  });

  const fullscreenState = { wasCollapsedBeforeFullscreen: false };
  const button = document.createElement('button');
  document.body.appendChild(button);
  const controller = createFullscreenController({
    button,
    getWasCollapsedBeforeFullscreen: () => fullscreenState.wasCollapsedBeforeFullscreen,
    setWasCollapsedBeforeFullscreen: (value) => { fullscreenState.wasCollapsedBeforeFullscreen = value; },
    onLayoutChange: () => { layoutSyncCount += 1; },
  });

  try {
    document.body.classList.remove('collapsed');
    await controller.enterFullscreen();
    if (!controller.isFullscreen()) throw new Error('Fullscreen controller did not enter fullscreen');
    if (!document.body.classList.contains('collapsed')) throw new Error('Fullscreen controller did not hide the panel');

    await controller.exitFullscreen();
    if (controller.isFullscreen()) throw new Error('Fullscreen controller did not exit fullscreen');
    if (document.body.classList.contains('collapsed')) throw new Error('Fullscreen controller did not restore an open panel');

    document.body.classList.add('collapsed');
    await controller.enterFullscreen();
    await controller.exitFullscreen();
    if (!document.body.classList.contains('collapsed')) throw new Error('Fullscreen controller did not preserve an initially collapsed panel');

    await controller.enterFullscreen();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    if (controller.isFullscreen()) throw new Error('Escape fallback did not exit fullscreen');
    if (!document.body.classList.contains('collapsed')) throw new Error('Escape exit did not restore the captured panel state');

    await new Promise((resolve) => setTimeout(resolve, 40));
    if (button.getAttribute('aria-pressed') !== 'false') throw new Error('Fullscreen button state did not synchronize after exit');
    if (layoutSyncCount < 1) throw new Error('Fullscreen layout synchronization did not run');

    // Figma/iframe-style permissions-policy rejection must fall back to embedded stage mode.
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: async () => { throw new TypeError('Disallowed by permissions policy'); },
    });
    document.body.classList.remove('collapsed');
    await controller.enterFullscreen();
    if (controller.getMode() !== 'embedded') throw new Error('Permissions-policy rejection did not enter embedded stage mode');
    if (!document.body.classList.contains('orbital-stage-fullscreen')) throw new Error('Embedded stage class was not applied');
    if (!document.body.classList.contains('collapsed')) throw new Error('Embedded stage mode did not hide the panel');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (controller.isFullscreen()) throw new Error('Escape did not exit embedded stage mode');
    if (document.body.classList.contains('orbital-stage-fullscreen')) throw new Error('Embedded stage class remained after exit');
    if (document.body.classList.contains('collapsed')) throw new Error('Embedded stage exit did not restore the open panel');
  } finally {
    controller.dispose();
    button.remove();
    document.body.classList.remove('collapsed');
    if (originalDescriptor) Object.defineProperty(document, 'fullscreenElement', originalDescriptor);
    else delete (document as any).fullscreenElement;
    if (originalRequestFullscreen) {
      Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: originalRequestFullscreen });
    } else {
      delete (document.documentElement as any).requestFullscreen;
    }
    if (originalExitFullscreen) {
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: originalExitFullscreen });
    } else {
      delete (document as any).exitFullscreen;
    }
  }
}


export function runFullscreenShortcutSmokeTest(): void {
  let toggleCount = 0;
  const handler = createKeyboardShortcutHandler({
    isTypingTarget: (element) => Boolean(element && ['INPUT', 'TEXTAREA'].includes(element.tagName)),
    toggleCollapse: () => {},
    mediaEl: null,
    $: () => null,
    params: { vizMode: 0 },
    palettes: [{ name: 'Electric Blue' }],
    getSelectedPaletteIndex: () => 0,
    setSelectedPaletteIndex: () => {},
    recorder: null,
    stopRecording: () => {},
    captureScreenshot: () => {},
    toggleFullscreen: () => { toggleCount += 1; },
    setShowKeyboardHelper: () => {},
    debugUiEvents: false,
  });

  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  document.body.appendChild(numberInput);
  numberInput.focus();
  numberInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true }));
  handler(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' }));
  if (toggleCount !== 1) throw new Error('F shortcut was blocked by number-input focus');

  const textInput = document.createElement('input');
  textInput.type = 'text';
  document.body.appendChild(textInput);
  textInput.focus();
  const textEvent = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' });
  Object.defineProperty(textEvent, 'target', { configurable: true, value: textInput });
  handler(textEvent);
  if (toggleCount !== 1) throw new Error('F shortcut intercepted a true text-entry field');

  const modifierEvent = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', metaKey: true });
  Object.defineProperty(modifierEvent, 'target', { configurable: true, value: numberInput });
  handler(modifierEvent);
  if (toggleCount !== 1) throw new Error('F shortcut intercepted a browser modifier shortcut');

  numberInput.remove();
  textInput.remove();
}
