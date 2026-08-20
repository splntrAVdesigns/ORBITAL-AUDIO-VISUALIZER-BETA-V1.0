import { safeLocalStorage } from '../utils/browserCompat';
import {
  cancelTrackedShortLivedRaf,
  cancelTrackedTimeout,
  requestTrackedShortLivedRaf,
  scheduleTrackedTimeout,
} from '../runtime/mainThread/MainThreadAsyncDiagnostics';

export interface PanelController {
  setPanelW: (px: number) => void;
  toggleCollapse: () => void;
  dispose: () => void;
}

export function createPanelController(options: {
  root: HTMLElement | null;
  getElement: (selector: string) => any;
  resize: () => void;
  getFullscreenElement: () => Element | null;
}): PanelController {
  const { root, getElement, resize, getFullscreenElement } = options;
  const eventHandlers = {
    windowResize1: null as null | (() => void),
    windowResize2: null as null | (() => void),
    windowMousemove: null as null | ((e: MouseEvent) => void),
    windowMouseup: null as null | (() => void),
    handleMousedown: null as null | ((e: MouseEvent) => void),
  };

  let dragging = false;
  let startX = 0;
  let startW = 480;
  let mouseDownX = 0;
  let hasMoved = false;
  let isCollapsing = false;
  let disposed = false;
  let widthResizeRaf: number | null = null;
  let collapseRaf1: number | null = null;
  let collapseRaf2: number | null = null;
  let initialResizeTimer: ReturnType<typeof setTimeout> | null = null;
  const minW = 220;
  const maxW = 560;

  const safeResize = () => {
    if (disposed) return;
    try { resize(); } catch { /* ignore transient layout teardown errors */ }
  };

  const cancelWidthResize = () => {
    cancelTrackedShortLivedRaf(widthResizeRaf);
    widthResizeRaf = null;
  };

  const scheduleWidthResize = () => {
    if (disposed || isCollapsing || widthResizeRaf !== null) return;
    // SHORT_LIVED_UI_RAF: coalesces high-frequency panel drag events to one resize per frame.
    widthResizeRaf = requestTrackedShortLivedRaf('panel-width-resize', () => {
      widthResizeRaf = null;
      safeResize();
    });
  };

  const cancelCollapseSettlement = () => {
    cancelTrackedShortLivedRaf(collapseRaf1);
    cancelTrackedShortLivedRaf(collapseRaf2);
    collapseRaf1 = null;
    collapseRaf2 = null;
  };

  const setPanelW = (px: number) => {
    const clamped = Math.max(minW, Math.min(maxW, px));
    if (root) {
      root.style.setProperty('--panelW', clamped + 'px');
      safeLocalStorage.setItem('radial_panel_w', String(clamped));
      scheduleWidthResize();
    }
  };

  const toggleCollapse = () => {
    // Fullscreen is intentionally clean-canvas only. Preserve the captured
    // pre-fullscreen panel state until the authoritative controller restores it.
    if (getFullscreenElement() || disposed) return;

    cancelWidthResize();
    cancelCollapseSettlement();
    if (document.body) {
      isCollapsing = true;
      document.body.classList.toggle('collapsed');
    }

    // SHORT_LIVED_LAYOUT_SETTLE_RAF: retained until worker viewport messaging replaces it.
    collapseRaf1 = requestTrackedShortLivedRaf('panel-collapse-settle-1', () => {
      collapseRaf1 = null;
      safeResize();
      collapseRaf2 = requestTrackedShortLivedRaf('panel-collapse-settle-2', () => {
        collapseRaf2 = null;
        safeResize();
        isCollapsing = false;
      });
    });
  };

  initialResizeTimer = scheduleTrackedTimeout('panel-initial-resize', () => {
    initialResizeTimer = null;
    safeResize();
  }, 0);

  const savedW = parseInt(safeLocalStorage.getItem('radial_panel_w') || '0', 10);
  if (savedW > 0) setPanelW(savedW);

  const handle = getElement('#handle') as HTMLElement | null;
  if (handle) {
    eventHandlers.handleMousedown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      mouseDownX = e.clientX;
      hasMoved = false;
      const cs = getComputedStyle(root as HTMLElement).getPropertyValue('--panelW');
      startW = parseInt(cs || '480', 10);
      document.body.style.userSelect = 'none';
    };
    handle.addEventListener('mousedown', eventHandlers.handleMousedown);
  }

  eventHandlers.windowMousemove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = Math.abs(e.clientX - mouseDownX);
    if (dx > 5) hasMoved = true;
    if (hasMoved) {
      const delta = e.clientX - startX;
      setPanelW(startW + delta);
    }
  };
  window.addEventListener('mousemove', eventHandlers.windowMousemove);

  eventHandlers.windowMouseup = () => {
    if (dragging) {
      if (!hasMoved) toggleCollapse();
      else scheduleWidthResize();
      dragging = false;
      hasMoved = false;
      document.body.style.userSelect = '';
    }
  };
  window.addEventListener('mouseup', eventHandlers.windowMouseup);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelTrackedTimeout(initialResizeTimer);
    initialResizeTimer = null;
    cancelWidthResize();
    cancelCollapseSettlement();
    isCollapsing = false;
    dragging = false;
    document.body.style.userSelect = '';
    if (eventHandlers.windowMousemove) window.removeEventListener('mousemove', eventHandlers.windowMousemove);
    if (eventHandlers.windowMouseup) window.removeEventListener('mouseup', eventHandlers.windowMouseup);
    if (eventHandlers.handleMousedown && handle) handle.removeEventListener('mousedown', eventHandlers.handleMousedown);
  };

  return { setPanelW, toggleCollapse, dispose };
}
