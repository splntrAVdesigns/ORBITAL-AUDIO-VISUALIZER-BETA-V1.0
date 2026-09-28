/**
 * ORBITAL — non-blocking notifications (Sprint M3).
 *
 * Replaces the browser alert() dialog, which freezes the main thread, which stops the
 * render loop and (on some browsers) starves audio callbacks mid-performance.
 * This module is framework-free on purpose: most callers are DOM controllers
 * and engines that run outside React.
 *
 * Contract:
 * - Never blocks. Never throws. Safe to call before React mounts.
 * - One container, created lazily, reused for the session.
 * - Max 4 visible toasts; oldest is evicted first.
 * - Errors stay 9s, warnings 7s, everything else 4.5s. Click to dismiss.
 */

export type NotifyTone = 'error' | 'warning' | 'success' | 'info';

export interface NotifyOptions {
  tone?: NotifyTone;
  /** Override auto-dismiss (ms). 0 keeps the toast until clicked. */
  durationMs?: number;
}

const MAX_VISIBLE = 4;
const CONTAINER_ID = 'orbital-toast-root';

const TONE_COLORS: Record<NotifyTone, string> = {
  error: '#ff4d6d',
  warning: '#ffb347',
  success: '#39e6a0',
  info: 'var(--neonBlue, #1e90ff)',
};

const DEFAULT_DURATION: Record<NotifyTone, number> = {
  error: 9000,
  warning: 7000,
  success: 4500,
  info: 4500,
};

/** Infer tone from the legacy emoji prefixes used across the codebase. */
function inferTone(message: string): NotifyTone {
  const head = message.trimStart().slice(0, 3);
  if (head.startsWith('❌')) return 'error';
  if (head.startsWith('⚠')) return 'warning';
  if (head.startsWith('✅')) return 'success';
  return 'info';
}

function getContainer(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let container = document.getElementById(CONTAINER_ID);
  if (container) return container;
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Notifications');
  container.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
    'z-index:2147483000',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'max-width:min(380px, calc(100vw - 32px))',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);
  return container;
}

export function notify(message: unknown, options: NotifyOptions = {}): void {
  try {
    const text = message instanceof Error ? message.message : String(message ?? '');
    const tone = options.tone ?? inferTone(text);
    const container = getContainer();
    if (!container) {
      console.warn('[notify]', text);
      return;
    }

    while (container.childElementCount >= MAX_VISIBLE) {
      container.firstElementChild?.remove();
    }

    const toast = document.createElement('div');
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    toast.style.cssText = [
      'pointer-events:auto',
      'cursor:pointer',
      'white-space:pre-line',
      'font:12px/1.45 system-ui, -apple-system, sans-serif',
      'color:#dce8f5',
      'background:rgba(10,14,23,0.94)',
      `border:1px solid ${TONE_COLORS[tone]}`,
      `border-left:3px solid ${TONE_COLORS[tone]}`,
      'border-radius:6px',
      'padding:10px 12px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.45)',
      'opacity:0',
      'transform:translateY(6px)',
      'transition:opacity 160ms ease, transform 160ms ease',
    ].join(';');
    // textContent only — messages can contain user file names.
    toast.textContent = text;

    let removed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const remove = () => {
      if (removed) return;
      removed = true;
      if (timer !== null) clearTimeout(timer);
      toast.remove();
    };
    toast.addEventListener('click', remove, { once: true });
    container.appendChild(toast);

    // Next frame: fade in (no layout thrash, no rAF ownership needed).
    toast.getBoundingClientRect();
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    const duration = options.durationMs ?? DEFAULT_DURATION[tone];
    if (duration > 0) timer = setTimeout(remove, duration);
  } catch (error) {
    console.warn('[notify] failed to render toast', error, message);
  }
}
