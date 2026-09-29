/**
 * ORBITAL — single painter for macro knob visuals (Sprint O3.2).
 *
 * Five code paths used to write knob visuals directly (preset sync, macro resets, the
 * UI side-effect runtime, MIDI preview, pointer drag) and each set a different subset of
 * fields. Preset sync never set `opacity`, so after a reset had set inline opacity 0 the
 * arc stayed invisible while the number showed its value.
 *
 * Every writer now calls paintMacroKnob(), which always sets ALL visual fields together:
 * arc offset, arc opacity, --knob-angle (observed by AnimationSettings), --fill-percent,
 * value label, and the circle's `active` glow. Invariant: value > 0 => arc visible.
 */
export function paintMacroKnob(macroId: string, rawValue: number, options: { opacity?: number; glow?: boolean } = {}): void {
  if (typeof document === 'undefined') return;
  const numeric = Number(rawValue);
  const value = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
  const visible = value > 0;
  const fill = document.getElementById(`${macroId}-fill`) as SVGPathElement | null;
  if (fill) {
    fill.style.strokeDashoffset = String(value - 100);
    fill.style.opacity = visible ? String(options.opacity ?? 1) : '0';
    fill.style.setProperty('--knob-angle', `${(value / 100) * 270}deg`);
    fill.style.setProperty('--fill-percent', `${value}%`);
    // Pointer-drag previews skip the glow class (Phase 4.8J: no class churn mid-gesture);
    // it is applied on release when the committed value repaints.
    if (options.glow !== false) fill.closest('.macro-knob-circle')?.classList.toggle('active', visible);
  }
  const label = document.getElementById(`${macroId}-value`);
  if (label) label.textContent = String(Math.round(value));
}
