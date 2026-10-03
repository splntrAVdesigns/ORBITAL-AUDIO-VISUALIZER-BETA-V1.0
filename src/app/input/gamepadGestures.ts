import {
  GAMEPAD_FUNCTIONS,
  type GamepadConfig,
  type GamepadControl,
  type GamepadFunctionMeta,
} from './gamepadConfig';
import type { InputActionId, InputTarget } from './types';

/**
 * ORBITAL — gamepad gesture engine (Sprint O5). Pure: feed it snapshots, get intents.
 *
 * Sticks (knob functions)
 *   - Radial deadzone per stick; drift inside it does nothing.
 *   - Axis lock: when a stick leaves the deadzone, its dominant axis owns the gesture until
 *     the stick returns to centre — a slightly diagonal push never moves two knobs.
 *   - Flick (out and back within FLICK_MS, peak >= FLICK_MIN_PEAK) = exactly one step.
 *   - Hold (past FLICK_MS) = glide; speed ∝ deflection² (fine near centre), rising up to
 *     HOLD_ACCEL× after a second of holding. Release = stop (no extra step).
 *
 * Buttons
 *   - focused (A/B): press = one step immediately (no wait); held past HOLD_MS = glide.
 *     focusDown double-tap (2nd press within DOUBLE_TAP_MS) = reset to 0 — it simply
 *     overrides the first step, so single taps never wait to be classified.
 *   - modifier: fine = ¼ speed, fast = 3× while held (sticks and A/B).
 *   - action: fires once per press.  repeat: + auto-repeat while held (preset skim).
 *   - longPress: fires once after LONG_PRESS_MS (randomize: stick clicks happen by accident).
 *
 * Analog buttons (triggers) use hysteresis so a half-pressed trigger can't chatter.
 */

export interface GamepadSnapshot { buttons: readonly number[]; axes: readonly number[] }

export type GestureIntent =
  | { type: 'step'; target: InputTarget; delta: number }
  | { type: 'rate'; target: InputTarget; rate: number }
  | { type: 'reset'; target: InputTarget; value: number }
  | { type: 'action'; action: InputActionId };

export const GESTURE_TIMING = {
  FLICK_MS: 250,
  FLICK_MIN_PEAK: 0.5,
  HOLD_MS: 300,
  DOUBLE_TAP_MS: 300,
  LONG_PRESS_MS: 400,
  REPEAT_DELAY_MS: 450,
  REPEAT_INTERVAL_MS: 160,
  HOLD_ACCEL: 1.6,
  PRESS_ON: 0.5,
  PRESS_OFF: 0.35,
} as const;
const T = GESTURE_TIMING;

const FINE = 0.25;
const FAST = 3;

interface ButtonState {
  pressed: boolean;
  pressedAt: number;
  lastPressAt: number;
  ramping: boolean;
  /** Second tap of a double-tap: the reset already fired, don't ramp. */
  consumed: boolean;
  fired: boolean;
  nextRepeatAt: number;
  /** Ignore until released (e.g. the press that completed a Learn). */
  suppressed: boolean;
}

interface StickState {
  engagedAt: number;
  lockedAxis: number | null;
  peak: number;
  peakSign: number;
  ramping: boolean;
  lastRate: number;
  suppressed: boolean;
}

export class GamepadGestureEngine {
  private buttons = new Map<number, ButtonState>();
  private sticks = new Map<number, StickState>();
  /** button index -> function; axis index -> function */
  private buttonFns = new Map<number, GamepadFunctionMeta>();
  private axisFns = new Map<number, { meta: GamepadFunctionMeta; control: Extract<GamepadControl, { kind: 'axis' }> }>();

  constructor(private config: GamepadConfig) { this.reindex(); }

  setConfig(config: GamepadConfig): void { this.config = config; this.reindex(); }

  /** Stop every ramp (disconnect, disable, Learn start). */
  releaseAll(): GestureIntent[] {
    const out: GestureIntent[] = [];
    for (const [index, state] of this.buttons) {
      const meta = this.buttonFns.get(index);
      if (state.ramping && meta?.target) out.push({ type: 'rate', target: meta.target, rate: 0 });
    }
    for (const [stick, state] of this.sticks) {
      if (state.ramping && state.lockedAxis !== null) {
        const fn = this.axisFns.get(state.lockedAxis);
        if (fn?.meta.target) out.push({ type: 'rate', target: fn.meta.target, rate: 0 });
      }
      this.sticks.delete(stick);
    }
    this.buttons.clear();
    return out;
  }

  /** Ignore this control until it returns to rest (the press/move that completed a Learn). */
  suppressUntilReleased(control: GamepadControl): void {
    if (control.kind === 'button') {
      this.buttons.set(control.index, { ...this.blankButton(), pressed: true, suppressed: true });
    } else {
      this.sticks.set(stickOf(control.index), { ...this.blankStick(), engagedAt: 0, suppressed: true });
    }
  }

  update(now: number, snap: GamepadSnapshot): GestureIntent[] {
    const out: GestureIntent[] = [];
    const speedMul = this.modifierMultiplier(snap);
    this.updateButtons(now, snap, speedMul, out);
    this.updateSticks(now, snap, speedMul, out);
    return out;
  }

  /* ---- buttons ---- */

  private modifierMultiplier(snap: GamepadSnapshot): number {
    let mul = 1;
    for (const [index, meta] of this.buttonFns) {
      if (meta.kind !== 'modifier') continue;
      const held = this.isHeld(index, snap.buttons[index] ?? 0);
      if (held) mul *= meta.id === 'fine' ? FINE : FAST;
    }
    return mul;
  }

  private isHeld(index: number, value: number): boolean {
    const prev = this.buttons.get(index)?.pressed ?? false;
    return prev ? value > T.PRESS_OFF : value >= T.PRESS_ON;
  }

  private updateButtons(now: number, snap: GamepadSnapshot, speedMul: number, out: GestureIntent[]): void {
    for (const [index, meta] of this.buttonFns) {
      const value = snap.buttons[index] ?? 0;
      const state = this.buttons.get(index) ?? this.blankButton();
      const held = state.pressed ? value > T.PRESS_OFF : value >= T.PRESS_ON;

      if (held && !state.pressed) {
        // press edge
        const isDoubleTap = meta.id === 'focusDown' && now - state.lastPressAt <= T.DOUBLE_TAP_MS;
        state.pressed = true; state.pressedAt = now; state.ramping = false; state.consumed = false; state.fired = false;
        state.nextRepeatAt = now + T.REPEAT_DELAY_MS;
        state.lastPressAt = isDoubleTap ? 0 : now; // a triple tap starts a fresh pair
        if (!state.suppressed) this.onPress(meta, isDoubleTap, speedMul, state, out);
      } else if (held && state.pressed && !state.suppressed) {
        this.onHold(meta, now, speedMul, state, out);
      } else if (!held && state.pressed) {
        if (state.ramping && meta.target) out.push({ type: 'rate', target: meta.target, rate: 0 });
        state.pressed = false; state.ramping = false; state.suppressed = false;
      }
      this.buttons.set(index, state);
    }
  }

  private onPress(meta: GamepadFunctionMeta, isDoubleTap: boolean, speedMul: number, state: ButtonState, out: GestureIntent[]): void {
    switch (meta.kind) {
      case 'focused':
        if (isDoubleTap) { state.consumed = true; out.push({ type: 'reset', target: meta.target!, value: 0 }); }
        else out.push({ type: 'step', target: meta.target!, delta: (meta.direction ?? 1) * this.stepSize(speedMul) });
        break;
      case 'action':
      case 'repeat':
        out.push({ type: 'action', action: meta.action! });
        break;
      default:
        break; // modifier: level only; longPress: waits for the hold
    }
  }

  private onHold(meta: GamepadFunctionMeta, now: number, speedMul: number, state: ButtonState, out: GestureIntent[]): void {
    const heldFor = now - state.pressedAt;
    if (meta.kind === 'focused' && !state.consumed && heldFor >= T.HOLD_MS) {
      const rate = (meta.direction ?? 1) * this.config.speed * speedMul;
      if (!state.ramping) state.ramping = true;
      out.push({ type: 'rate', target: meta.target!, rate });
    } else if (meta.kind === 'repeat' && now >= state.nextRepeatAt) {
      state.nextRepeatAt = now + T.REPEAT_INTERVAL_MS;
      out.push({ type: 'action', action: meta.action! });
    } else if (meta.kind === 'longPress' && !state.fired && heldFor >= T.LONG_PRESS_MS) {
      state.fired = true;
      out.push({ type: 'action', action: meta.action! });
    }
  }

  /** Steps scale with fine/fast too, but never below 1 unit. */
  private stepSize(speedMul: number): number {
    return Math.max(1, Math.round(this.config.step * speedMul));
  }

  /* ---- sticks ---- */

  private updateSticks(now: number, snap: GamepadSnapshot, speedMul: number, out: GestureIntent[]): void {
    const dz = this.config.deadzone;
    const sticks = new Set<number>();
    for (const axisIndex of this.axisFns.keys()) sticks.add(stickOf(axisIndex));
    for (const stick of sticks) {
      const ax = stick * 2;
      const vx = snap.axes[ax] ?? 0;
      const vy = snap.axes[ax + 1] ?? 0;
      const magnitude = Math.hypot(vx, vy);
      let state = this.sticks.get(stick);

      if (magnitude <= dz) {
        if (state && !state.suppressed && state.lockedAxis !== null) {
          const fn = this.axisFns.get(state.lockedAxis);
          if (fn?.meta.target) {
            if (state.ramping) out.push({ type: 'rate', target: fn.meta.target, rate: 0 });
            // Not ramping => every deflected poll fell inside FLICK_MS, i.e. it WAS a flick.
            // Deciding from the release poll's timestamp instead would drop flicks whenever
            // one slow frame (preset load, shader compile) delays that poll.
            else if (state.peak >= T.FLICK_MIN_PEAK) {
              out.push({ type: 'step', target: fn.meta.target, delta: state.peakSign * this.stepSize(speedMul) });
            }
          }
        }
        this.sticks.delete(stick);
        continue;
      }

      if (!state) {
        // Engage: lock the dominant axis (only axes that have a function can win).
        const candidates = [ax, ax + 1].filter((i) => this.axisFns.has(i));
        const locked = candidates.length === 2
          ? (Math.abs(vx) >= Math.abs(vy) ? ax : ax + 1)
          : candidates[0] ?? null;
        state = { ...this.blankStick(), engagedAt: now, lockedAxis: locked };
        this.sticks.set(stick, state);
      }
      if (state.suppressed || state.lockedAxis === null) continue;

      const fn = this.axisFns.get(state.lockedAxis)!;
      const raw = snap.axes[state.lockedAxis] ?? 0;
      const value = fn.control.invert ? -raw : raw;
      if (Math.abs(value) > state.peak) { state.peak = Math.abs(value); state.peakSign = Math.sign(value) || 1; }

      const heldFor = now - state.engagedAt;
      if (heldFor <= T.FLICK_MS) continue;

      const normalized = Math.max(0, Math.min(1, (Math.abs(value) - dz) / (1 - dz)));
      const accel = 1 + (T.HOLD_ACCEL - 1) * Math.max(0, Math.min(1, (heldFor - 1000) / 1000));
      const rate = Math.sign(value) * this.config.speed * normalized * normalized * accel * speedMul;
      if (!state.ramping || Math.abs(rate - state.lastRate) > 0.25) {
        state.ramping = true;
        state.lastRate = rate;
        out.push({ type: 'rate', target: fn.meta.target!, rate });
      }
    }
  }

  /* ---- internals ---- */

  private reindex(): void {
    this.buttonFns.clear();
    this.axisFns.clear();
    for (const meta of GAMEPAD_FUNCTIONS) {
      const control = this.config.bindings[meta.id];
      if (!control) continue;
      if (control.kind === 'button') this.buttonFns.set(control.index, meta);
      else this.axisFns.set(control.index, { meta, control });
    }
  }

  private blankButton(): ButtonState {
    return { pressed: false, pressedAt: 0, lastPressAt: -Infinity, ramping: false, consumed: false, fired: false, nextRepeatAt: 0, suppressed: false };
  }

  private blankStick(): StickState {
    return { engagedAt: 0, lockedAxis: null, peak: 0, peakSign: 1, ramping: false, lastRate: 0, suppressed: false };
  }
}

/** Axes 0/1 are one stick, 2/3 the next, and so on. */
export function stickOf(axisIndex: number): number {
  return Math.floor(axisIndex / 2);
}
