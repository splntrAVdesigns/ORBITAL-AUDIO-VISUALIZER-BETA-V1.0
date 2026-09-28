import { useEffect, useRef } from 'react';
import { requestTrackedShortLivedRaf } from '../runtime/mainThread/MainThreadAsyncDiagnostics';

/**
 * ORBITAL — Control-panel accordion (Sprint O2).
 *
 * Seven sections below Presets share a single "open section": opening one collapses
 * the others. Audio, Macros, Presets and Center Graphic stay manual.
 *
 *  - Collapse uses the existing `.collapsible-wrapper.collapsed` (display:none), so no
 *    section unmounts and no control loses state or its #id binding.
 *  - Alt/Option-click a header to open it without closing the others.
 *  - The opened section scrolls to the top of the parameter scroll region.
 *
 * Members mark their island with data-accordion-section="<id>" (ControlPanel does this).
 */
export type AccordionSectionId = 'color' | 'motion' | 'spike' | 'halo' | 'particles' | 'liquid' | 'textures';

export const PANEL_ACCORDION_OPEN_EVENT = 'orbital:panel-accordion-open';

interface OpenDetail { id: AccordionSectionId }

let lastActivationAlt = false;
let lastActivationAt = 0;
let modifierListenerInstalled = false;

/** Headers are plain onClick handlers; remember whether Alt was held for this activation. */
function ensureModifierListener(): void {
  if (modifierListenerInstalled || typeof document === 'undefined') return;
  modifierListenerInstalled = true;
  const record = (event: MouseEvent | KeyboardEvent) => {
    lastActivationAlt = event.altKey;
    lastActivationAt = performance.now();
  };
  document.addEventListener('click', record as EventListener, true);
  document.addEventListener('keydown', record as EventListener, true);
}

function altHeldForCurrentActivation(): boolean {
  return lastActivationAlt && performance.now() - lastActivationAt < 100;
}

function islandFor(id: AccordionSectionId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-accordion-section="${id}"]`);
}

function scrollSectionIntoView(id: AccordionSectionId): void {
  // Wait one frame so React has committed the collapse of the other sections.
  requestTrackedShortLivedRaf('panel-accordion-scroll', () => {
    const island = islandFor(id);
    if (!island) return;
    const region = island.closest<HTMLElement>('.parameter-scroll-region');
    if (!region) return;
    const offset = island.getBoundingClientRect().top - region.getBoundingClientRect().top;
    if (Math.abs(offset) > 2) region.scrollTop += offset;
  });
}

/** Call when a member section has just been opened by the user. */
export function announceSectionOpened(id: AccordionSectionId): void {
  ensureModifierListener();
  if (!altHeldForCurrentActivation()) {
    window.dispatchEvent(new CustomEvent<OpenDetail>(PANEL_ACCORDION_OPEN_EVENT, { detail: { id } }));
  }
  scrollSectionIntoView(id);
}

/** Subscribe to "another section opened". Returns a disposer. */
export function onOtherSectionOpened(id: AccordionSectionId, collapse: () => void): () => void {
  ensureModifierListener();
  const handler = (event: Event) => {
    const opened = (event as CustomEvent<OpenDetail>).detail?.id;
    if (opened && opened !== id) collapse();
  };
  window.addEventListener(PANEL_ACCORDION_OPEN_EVENT, handler);
  return () => window.removeEventListener(PANEL_ACCORDION_OPEN_EVENT, handler);
}

/** React members: collapse() is only called while the section is open. */
export function useAccordionMember(id: AccordionSectionId, isOpen: boolean, collapse: () => void): void {
  const state = useRef({ isOpen, collapse });
  state.current = { isOpen, collapse };
  useEffect(() => onOtherSectionOpened(id, () => {
    if (state.current.isOpen) state.current.collapse();
  }), [id]);
}

/* ---- DOM-toggled members (Liquid Shaper, Core Textures) ---- */

function ownHeader(id: AccordionSectionId): HTMLElement | null {
  return islandFor(id)?.querySelector<HTMLElement>(':scope > .section > .collapsible-header') ?? null;
}

export function isDomSectionOpen(header: Element | null): boolean {
  const wrapper = header?.nextElementSibling;
  return Boolean(wrapper && wrapper.classList.contains('collapsible-wrapper') && !wrapper.classList.contains('collapsed'));
}

function collapseDomSection(id: AccordionSectionId): void {
  const header = ownHeader(id);
  if (!header || !isDomSectionOpen(header)) return;
  header.nextElementSibling?.classList.add('collapsed');
  header.querySelector('.collapsible-chevron')?.classList.add('collapsed');
}

/** For components whose header toggles classes directly instead of React state. */
export function useDomAccordionMember(id: AccordionSectionId): void {
  useEffect(() => onOtherSectionOpened(id, () => collapseDomSection(id)), [id]);
}

/** Header click helper for DOM members: announce after the class toggle if now open. */
export function afterDomSectionToggle(id: AccordionSectionId, header: Element): void {
  if (isDomSectionOpen(header)) announceSectionOpened(id);
}
