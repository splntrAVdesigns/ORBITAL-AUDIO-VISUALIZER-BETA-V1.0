/**
 * ORBITAL Math Helper Functions
 * Extracted from App.tsx for better code organization
 * 
 * Contains mathematical utilities for animation, angles, and dampening
 */

const TAU = Math.PI * 2;

/**
 * Exponential dampening/smoothing function
 * Used for smooth transitions and spring-like animations
 * @param current - Current value
 * @param target - Target value
 * @param response - Response rate (higher = faster)
 * @param dt - Delta time in seconds
 * @returns Smoothly interpolated value
 */
export function damp(current: number, target: number, response: number, dt: number): number {
  const blend = 1 - Math.exp(-response * dt);
  return current + (target - current) * blend;
}

/**
 * Wrap angle to 0-TAU range (0-2π)
 * Prevents angle accumulation and keeps values normalized
 * @param angle - Angle in radians
 * @returns Wrapped angle in [0, TAU) range
 */
export function wrapAngle(angle: number): number {
  angle = angle % TAU;
  if (angle < 0) angle += TAU;
  return angle;
}

/**
 * Calculate shortest angular difference between two angles
 * Handles wrapping and returns signed difference
 * @param from - Starting angle in radians
 * @param to - Target angle in radians
 * @returns Shortest angular difference in radians (-π to π)
 */
export function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return diff;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Map value from one range to another
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

/**
 * Smoothstep interpolation (smooth ease in/out)
 * @param t - Input value (0-1)
 * @returns Smoothly interpolated value (0-1)
 */
export function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/**
 * Smootherstep interpolation (smoother than smoothstep)
 * @param t - Input value (0-1)
 * @returns Smoothly interpolated value (0-1)
 */
export function smootherstep(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Calculate distance between two 2D points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two 2D points
 * @returns Angle in radians
 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Modulo operation that handles negative numbers correctly
 * (JavaScript's % operator doesn't handle negatives as expected)
 */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Check if value is within range (inclusive)
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Exponential moving average (EMA) for smooth time-series data
 * @param current - Current smoothed value
 * @param target - New target value
 * @param alpha - Smoothing factor (0-1, higher = more responsive)
 * @returns New smoothed value
 */
export function ema(current: number, target: number, alpha: number): number {
  return current + alpha * (target - current);
}

// Export TAU constant for use in other modules
export { TAU };
