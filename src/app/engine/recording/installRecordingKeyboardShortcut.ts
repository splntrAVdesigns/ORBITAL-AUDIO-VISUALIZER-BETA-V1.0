import type { RecordingRuntimeController } from './RecordingRuntimeController';

interface RecordingControllerRefLike {
  current: RecordingRuntimeController | null;
}

export interface RecordingKeyboardShortcutHandlers {
  keydown: (event: KeyboardEvent) => void;
  keypress: (event: KeyboardEvent) => void;
  keyup: (event: KeyboardEvent) => void;
  blur: () => void;
}

function matchesRecordingKey(event: Pick<KeyboardEvent, 'code' | 'key'>): boolean {
  return event.code === 'KeyR' || event.key?.toLowerCase() === 'r';
}

function isProtectedTextEntry(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if ((element as HTMLElement).isContentEditable || element.closest('[contenteditable="true"]')) return true;
  if (element.tagName === 'TEXTAREA') return true;
  if (element.tagName !== 'INPUT') return false;

  const type = ((element as HTMLInputElement).type || 'text').toLowerCase();
  return ['text', 'search', 'email', 'url', 'tel', 'password'].includes(type);
}

function hasReservedModifier(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * Creates a resilient one-toggle-per-physical-press recording shortcut.
 *
 * `keydown` is authoritative. `keypress` and `keyup` are fallbacks for embedded
 * preview hosts that occasionally intercept one phase of a printable shortcut.
 */
export function createRecordingKeyboardShortcutHandlers(
  controllerRef: RecordingControllerRefLike,
): RecordingKeyboardShortcutHandlers {
  let pressActive = false;
  const observedEvents = new WeakSet<Event>();

  const consume = (event: KeyboardEvent): boolean => {
    if (observedEvents.has(event)) return false;
    observedEvents.add(event);
    return true;
  };

  const canHandle = (event: KeyboardEvent): boolean => {
    if (!matchesRecordingKey(event) || hasReservedModifier(event)) return false;
    const target = event.target ?? document.activeElement;
    return !isProtectedTextEntry(target);
  };

  const toggle = (event: KeyboardEvent): boolean => {
    const controller = controllerRef.current;
    if (!controller) return false;
    event.preventDefault();
    event.stopPropagation();
    controller.toggle();
    return true;
  };

  const keydown = (event: KeyboardEvent) => {
    if (!consume(event) || !canHandle(event) || event.repeat || pressActive) return;
    if (toggle(event)) pressActive = true;
  };

  const keypress = (event: KeyboardEvent) => {
    if (!consume(event) || !canHandle(event) || pressActive) return;
    if (toggle(event)) pressActive = true;
  };

  const keyup = (event: KeyboardEvent) => {
    if (!consume(event) || !matchesRecordingKey(event)) return;

    // Normal path: keydown/keypress already toggled; keyup only releases the latch.
    if (pressActive) {
      pressActive = false;
      return;
    }

    // Fallback path: an embedded host swallowed keydown/keypress but delivered keyup.
    if (canHandle(event)) toggle(event);
    pressActive = false;
  };

  return {
    keydown,
    keypress,
    keyup,
    blur: () => { pressActive = false; },
  };
}

export function installRecordingKeyboardShortcut(
  controllerRef: RecordingControllerRefLike,
): () => void {
  const handlers = createRecordingKeyboardShortcutHandlers(controllerRef);
  const capture = true;

  // Register on both window and document. The WeakSet in the handlers prevents
  // the same native event from toggling twice as it travels through capture.
  window.addEventListener('keydown', handlers.keydown, capture);
  document.addEventListener('keydown', handlers.keydown, capture);
  window.addEventListener('keypress', handlers.keypress, capture);
  document.addEventListener('keypress', handlers.keypress, capture);
  window.addEventListener('keyup', handlers.keyup, capture);
  document.addEventListener('keyup', handlers.keyup, capture);
  window.addEventListener('blur', handlers.blur);

  return () => {
    window.removeEventListener('keydown', handlers.keydown, capture);
    document.removeEventListener('keydown', handlers.keydown, capture);
    window.removeEventListener('keypress', handlers.keypress, capture);
    document.removeEventListener('keypress', handlers.keypress, capture);
    window.removeEventListener('keyup', handlers.keyup, capture);
    document.removeEventListener('keyup', handlers.keyup, capture);
    window.removeEventListener('blur', handlers.blur);
  };
}
