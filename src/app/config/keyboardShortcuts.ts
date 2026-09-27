/**
 * Sprint L6: single source of truth for every keyboard shortcut shown to the user.
 *
 * Both ProTipsSection.tsx (Session Settings → PROTIPS) and KeyboardShortcutOverlay.tsx
 * (the "?" overlay) render from this list, instead of each hardcoding its own copy —
 * that duplication is exactly how arrow-key preset navigation went undocumented in one
 * place and got a stale "navigate center images" description in the README.
 *
 * The actual key handling lives in two places: useKeyboardShortcuts.ts for everything
 * except preset navigation, and usePresetKeyboardNavigation.ts for Up/Down. This file
 * only describes shortcuts for display; it does not bind any listeners.
 */
export interface KeyboardShortcutEntry {
  keys: string;
  description: string;
  /** Groups entries under a heading in the "?" overlay. ProTips renders a flat list. */
  section: 'Playback' | 'Visualization' | 'Capture' | 'Controls';
}

export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcutEntry[] = [
  { keys: 'SPACE', description: 'Play/Pause', section: 'Playback' },
  { keys: 'M', description: 'Mute/Unmute', section: 'Playback' },
  { keys: '1-4', description: 'Switch modes', section: 'Visualization' },
  { keys: 'C', description: 'Cycle colors', section: 'Visualization' },
  { keys: '↑ / ↓', description: 'Previous / next preset scene', section: 'Visualization' },
  { keys: 'F', description: 'Fullscreen (ESC to exit)', section: 'Visualization' },
  { keys: 'S', description: 'Screenshot', section: 'Capture' },
  { keys: 'R', description: 'Record video', section: 'Capture' },
  { keys: 'H', description: 'Hide/show panel', section: 'Controls' },
  { keys: '?', description: 'Toggle this help', section: 'Controls' },
];
