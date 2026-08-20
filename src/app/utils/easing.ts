/**
 * ORBITAL — Easing Utilities
 * Pure easing functions extracted from anime.js 4.4.1 (https://animejs.com).
 * No anime.js runtime dependency required — these are standalone math functions.
 *
 * Used for: rotation ease-home tween when slider returns to 0 or reset fires.
 *
 * All functions accept t ∈ [0, 1] and return a progress value ∈ [0, 1].
 */

/** Linear — no easing. */
export const easeLinear = (t: number): number => t;

/** Ease out cubic — decelerates smoothly. Good for settling motions. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Ease out quart — stronger deceleration. */
export const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** Ease in-out cubic — symmetric smooth ramp. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Ease out sine — gentle, organic deceleration. */
export const easeOutSine = (t: number): number => Math.sin((t * Math.PI) / 2);

/**
 * Ease out back — overshoots slightly, then settles.
 * Good for a "snap home" feel with a small spring overshoot.
 * @param overshoot Amount of overshoot. Default 1.7 (anime.js default).
 */
export const easeOutBack = (overshoot = 1.7) => (t: number): number => {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Lerp between two angles, taking the shortest arc.
 * @returns The interpolated angle in radians, wrapped to [0, 2π].
 */
export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  // Normalize diff to [-π, π]
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const result = from + diff * t;
  return ((result % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/**
 * Returns the nearest cardinal angle (N/E/S/W = 0, π/2, π, 3π/2)
 * in the direction that requires the smallest rotation from `angle`.
 */
export function nearestCardinal(angle: number): number {
  const TWO_PI = Math.PI * 2;
  const a = ((angle % TWO_PI) + TWO_PI) % TWO_PI; // normalise to [0, 2π)
  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, TWO_PI];
  let best = 0;
  let bestDist = Infinity;
  for (const c of cardinals) {
    const d = Math.abs(a - c);
    if (d < bestDist) { bestDist = d; best = c % TWO_PI; }
  }
  return best;
}

/**
 * Lightweight tween state — tracks a single in-progress angle tween.
 * Designed to be updated every RAF frame via `updateAngleTween`.
 */
export interface AngleTween {
  active:    boolean;
  fromAngle: number;
  toAngle:   number;
  duration:  number; // seconds
  elapsed:   number; // seconds
  easeFn:    (t: number) => number;
}

/** Create an inactive tween (initial state). */
export function createAngleTween(): AngleTween {
  return { active: false, fromAngle: 0, toAngle: 0, duration: 0.65, elapsed: 0, easeFn: easeOutCubic };
}

/**
 * Start a new angle tween from `from` → `to` over `duration` seconds.
 * The previous tween (if any) is discarded.
 */
export function startAngleTween(
  tween: AngleTween,
  from: number,
  to: number,
  duration = 0.65,
  easeFn: (t: number) => number = easeOutCubic
): void {
  tween.active    = true;
  tween.fromAngle = from;
  tween.toAngle   = to;
  tween.duration  = duration;
  tween.elapsed   = 0;
  tween.easeFn    = easeFn;
}

/**
 * Advance the tween by `dt` seconds and return the current interpolated angle.
 * When complete, `tween.active` is set to false and the final angle is returned.
 */
export function updateAngleTween(tween: AngleTween, dt: number): number {
  if (!tween.active) return tween.toAngle;
  tween.elapsed = Math.min(tween.elapsed + dt, tween.duration);
  const t = tween.elapsed / tween.duration;
  const eased = tween.easeFn(t);
  const result = lerpAngle(tween.fromAngle, tween.toAngle, eased);
  if (tween.elapsed >= tween.duration) {
    tween.active = false;
    return tween.toAngle;
  }
  return result;
}