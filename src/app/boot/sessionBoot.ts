import { safeSessionStorage } from './safeSessionStorage';

/**
 * Sprint L2: distinguishes a fresh browser session from a same-tab reload.
 *
 * sessionStorage survives reloads within one tab and is cleared when the tab closes,
 * which is exactly the "new session" boundary. Landing is always shown (its Launch
 * button is the audio-unlock gesture); a returning tab only skips the brand hold on
 * the loader so boot lasts exactly as long as real initialization.
 */
const SESSION_BOOT_KEY = 'orbital.session.booted';

export function isReturningSession(): boolean {
  return safeSessionStorage.getItem(SESSION_BOOT_KEY) === '1';
}

export function markSessionBooted(): void {
  safeSessionStorage.setItem(SESSION_BOOT_KEY, '1');
}
