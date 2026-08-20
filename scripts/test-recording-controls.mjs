import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-recording-controls-'));

function transpile(source, target) {
  const code = fs.readFileSync(source, 'utf8');
  const output = transformSync(code, {
    loader: source.endsWith('.tsx') ? 'tsx' : 'ts',
    format: 'esm',
    target: 'es2022',
    sourcefile: source,
  }).code;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}

try {
  transpile('src/app/engine/recording/installRecordingKeyboardShortcut.ts', path.join(tempRoot, 'installRecordingKeyboardShortcut.js'));
  transpile('src/app/src/app/hooks/useKeyboardShortcuts.ts', path.join(tempRoot, 'useKeyboardShortcuts.js'));

  const original = { Element: globalThis.Element, document: globalThis.document };
  class FakeElement {
    constructor(tagName = 'DIV', type = '') {
      this.tagName = tagName;
      this.type = type;
      this.isContentEditable = false;
    }
    closest() { return null; }
  }
  globalThis.Element = FakeElement;
  globalThis.document = { activeElement: null };

  try {
    const { createRecordingKeyboardShortcutHandlers } = await import(
      `${pathToFileURL(path.join(tempRoot, 'installRecordingKeyboardShortcut.js')).href}?v=${Date.now()}`
    );
    let toggles = 0;
    const controllerRef = {
      current: {
        start: () => 'started',
        stop: () => 'stopped',
        toggle: () => { toggles += 1; return toggles % 2 ? 'started' : 'stopped'; },
        deleteRecording: () => true,
        clearRecordings: () => 0,
        isRecording: () => false,
      },
    };
    const shortcut = createRecordingKeyboardShortcutHandlers(controllerRef);
    const numberInput = new FakeElement('INPUT', 'number');
    globalThis.document.activeElement = numberInput;

    const makeKeyEvent = (overrides = {}) => ({
      code: 'KeyR', key: 'r', repeat: false,
      ctrlKey: false, metaKey: false, altKey: false,
      target: numberInput,
      preventDefault() {}, stopPropagation() {},
      ...overrides,
    });

    const downEvent = makeKeyEvent();
    shortcut.keydown(downEvent);
    shortcut.keydown(downEvent);
    shortcut.keypress(makeKeyEvent());
    assert.equal(toggles, 1, 'one physical R press must toggle once');
    shortcut.keyup(makeKeyEvent());

    shortcut.keypress(makeKeyEvent({ code: '', key: 'R' }));
    assert.equal(toggles, 2, 'keypress fallback must work');
    shortcut.keyup(makeKeyEvent());

    shortcut.keyup(makeKeyEvent({ code: '', key: 'r' }));
    assert.equal(toggles, 3, 'keyup fallback must work');

    const textInput = new FakeElement('INPUT', 'text');
    shortcut.keydown(makeKeyEvent({ target: textInput }));
    assert.equal(toggles, 3, 'text inputs must retain R');
    shortcut.keydown(makeKeyEvent({ ctrlKey: true }));
    assert.equal(toggles, 3, 'browser modifier shortcuts must not be intercepted');

    const { createKeyboardShortcutHandler } = await import(
      `${pathToFileURL(path.join(tempRoot, 'useKeyboardShortcuts.js')).href}?v=${Date.now()}`
    );
    const genericHandler = createKeyboardShortcutHandler({
      isTypingTarget: () => false,
      toggleCollapse: () => {}, mediaEl: null, $: () => null,
      params: { vizMode: 0 }, palettes: [{ name: 'Default' }],
      getSelectedPaletteIndex: () => 0, setSelectedPaletteIndex: () => {},
      captureScreenshot: () => {}, toggleFullscreen: () => {},
      setShowKeyboardHelper: () => {}, debugUiEvents: false,
    });
    genericHandler(makeKeyEvent());
    assert.equal(toggles, 3, 'generic visualizer shortcut owner must not also toggle R');

    const appSource = fs.readFileSync('src/app/App.tsx', 'utf8');
    const runtimeSource = fs.readFileSync('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts', 'utf8');
    const engineSource = fs.readFileSync('src/app/engine/RecordingEngine.ts', 'utf8');
    assert.ok(appSource.includes('installRecordingKeyboardShortcut(recordingControllerRef)'));
    assert.ok(appSource.includes('recordingControllerRef.current?.start(options)'));
    assert.ok(!runtimeSource.includes('toggleRecording: () => recordingEngine.toggle()'));
    assert.ok(!engineSource.includes("querySelector('#recHUD')"), 'legacy REC HUD lookup must be removed');
    assert.ok(!engineSource.includes("$('#gifRec')"), 'legacy GIF recording button lookup must be removed');

    console.log('Recording shortcut ownership and obsolete DOM-path tests passed');
  } finally {
    globalThis.Element = original.Element;
    globalThis.document = original.document;
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
