import { damp, wrapAngle, shortestAngleDiff, TAU } from './mathHelpers';
import { createAngleTween, startAngleTween, updateAngleTween, easeOutSine, easeInOutCubic } from './easing';
import {
  advanceOscillatorRotation,
  advancePingPongRotation,
  getAngleForDivision,
  getBpmContinuousSpeed,
  getSecondsPerDivision,
  getSignedRotationDirection,
  type OscillatorState,
  type PingPongState,
} from './rotationSyncEngine';

export type RotationMode = 'free' | 'bpm' | 'quantized' | 'pingpong' | 'oscillator' | string;

export interface RotationAuthorityParams {
  rotation?: number;
  rotationSyncMode?: RotationMode;
  bpm?: number;
  bars?: number;
  rotationQuantize?: string;
}

const nearestVerticalRotation = (angle: number) => {
  const normalized = wrapAngle(angle);
  return Math.abs(shortestAngleDiff(normalized, 0)) <= Math.abs(shortestAngleDiff(normalized, Math.PI)) ? 0 : Math.PI;
};

const nearestUnwrappedEquivalent = (base: number, reference: number) =>
  base + Math.round((reference - base) / TAU) * TAU;

const clampSignedSpeed = (value?: number) => {
  const numeric = Number.isFinite(value) ? Number(value) : 0;
  return Math.abs(numeric) < 0.001 ? 1 : Math.max(-2, Math.min(2, numeric));
};

/**
 * Single cardinal-aware owner for all rotation modes.
 * Mode changes always home to the nearest North/South anchor first. Division and
 * slider changes preserve phase and never invoke the homing transition.
 */
export class RotationAuthority {
  angle = 0;
  targetAngle = 0;
  currentAngle = 0;
  velocity = 0;
  freeVelocity = 0;
  accumulator = 0;
  mode: RotationMode = 'free';
  cachedBpmSpeed = 0;

  private lastBpm = -1;
  private lastBars = -1;
  private lastDivision = '';
  private lastDirection: 1 | -1 = 1;
  private lastPingPongSign: 1 | -1 = 1;
  private homeTween = createAngleTween();
  private pendingMode: RotationMode | null = null;
  private modeAnchor = 0;
  private manualHomeOnly = false;
  private pingPong: PingPongState = { fromAngle: 0, direction: 1, elapsed: 0 };
  private oscillator: OscillatorState = { originAngle: 0, phase: 0 };
  private absolutePhase = 0;

  private quantizedFrom = 0;
  private quantizedTarget = 0;
  private quantizedElapsed = 0;
  private quantizedInterval = 1;

  private advanceDeterministic(speed: number, dt: number) {
    const safeDt = Math.min(Math.max(dt, 0), 1 / 30);
    const rawStep = speed * safeDt;
    const step = Math.max(-Math.PI / 12, Math.min(Math.PI / 12, rawStep));
    this.absolutePhase += step;
    return wrapAngle(this.absolutePhase);
  }

  reset(mode: RotationMode, currentGlobalAngle = this.angle) {
    const nextMode = mode || 'free';
    this.pendingMode = nextMode;
    this.manualHomeOnly = false;
    this.velocity = 0;
    this.freeVelocity = 0;
    this.accumulator = 0;

    const wrappedFrom = wrapAngle(currentGlobalAngle);
    const wrappedAnchor = nearestVerticalRotation(wrappedFrom);
    this.modeAnchor = nearestUnwrappedEquivalent(wrappedAnchor, this.currentAngle || currentGlobalAngle);
    this.currentAngle = currentGlobalAngle;
    this.targetAngle = this.modeAnchor;
    startAngleTween(this.homeTween, wrappedFrom, wrappedAnchor, 0.42, easeOutSine);
  }

  startHomeEase(fromAngle = this.angle, duration = 0.65) {
    const target = nearestVerticalRotation(fromAngle);
    this.pendingMode = null;
    this.manualHomeOnly = true;
    this.targetAngle = target;
    this.velocity = 0;
    this.freeVelocity = 0;
    startAngleTween(this.homeTween, wrapAngle(fromAngle), target, duration, easeOutSine);
  }

  private initializeMode(mode: RotationMode, anchor: number, params: RotationAuthorityParams): void {
    this.mode = mode || 'free';
    this.pendingMode = null;
    this.manualHomeOnly = false;
    this.modeAnchor = anchor;
    this.currentAngle = anchor;
    this.angle = wrapAngle(anchor);
    this.targetAngle = anchor;
    this.absolutePhase = anchor;
    this.accumulator = 0;
    this.velocity = 0;
    this.freeVelocity = 0;

    const division = params.rotationQuantize || '2/1';
    const bpm = params.bpm || 174;
    const direction = getSignedRotationDirection(params.rotation);
    this.lastDirection = direction;

    if (this.mode === 'quantized') {
      this.primeQuantized(anchor, bpm, division, direction);
    } else if (this.mode === 'pingpong') {
      this.pingPong = { fromAngle: wrapAngle(anchor), direction, elapsed: 0 };
      this.lastPingPongSign = direction;
    } else if (this.mode === 'oscillator') {
      this.oscillator = { originAngle: wrapAngle(anchor), phase: 0 };
    }
  }

  private primeQuantized(fromAngle: number, bpm: number, division: string, direction: 1 | -1): void {
    const step = getAngleForDivision(division);
    const relative = (fromAngle - this.modeAnchor) / step;
    const nextIndex = direction > 0
      ? Math.floor(relative + 1e-7) + 1
      : Math.ceil(relative - 1e-7) - 1;
    this.quantizedFrom = fromAngle;
    this.quantizedTarget = this.modeAnchor + nextIndex * step;
    this.quantizedElapsed = 0;
    this.quantizedInterval = Math.max(0.016, getSecondsPerDivision(bpm, division));
    this.accumulator = 0;
    this.currentAngle = fromAngle;
    this.targetAngle = this.quantizedTarget;
  }

  private updateQuantized(params: RotationAuthorityParams, dt: number, bpm: number, division: string): number {
    const safeDt = Math.min(Math.max(dt, 0), 1 / 30);
    const direction = getSignedRotationDirection(params.rotation);
    const nextInterval = Math.max(0.016, getSecondsPerDivision(bpm, division));
    const divisionChanged = division !== this.lastDivision;
    const directionChanged = direction !== this.lastDirection;

    if (divisionChanged || directionChanged) {
      this.primeQuantized(this.currentAngle, bpm, division, direction);
    } else if (Math.abs(nextInterval - this.quantizedInterval) > 1e-6) {
      const progress = this.quantizedInterval > 0 ? this.quantizedElapsed / this.quantizedInterval : 0;
      this.quantizedInterval = nextInterval;
      this.quantizedElapsed = Math.max(0, Math.min(this.quantizedInterval, progress * this.quantizedInterval));
    }

    this.lastDirection = direction;
    this.quantizedElapsed += safeDt;
    let guard = 0;
    while (this.quantizedElapsed >= this.quantizedInterval && guard++ < 8) {
      this.quantizedElapsed -= this.quantizedInterval;
      this.currentAngle = this.quantizedTarget;
      this.quantizedFrom = this.quantizedTarget;
      this.quantizedTarget += getAngleForDivision(division) * direction;
    }

    const progress = Math.max(0, Math.min(1, this.quantizedElapsed / this.quantizedInterval));
    const magnitude = Math.max(0.25, Math.min(2, Math.abs(clampSignedSpeed(params.rotation))));
    const base = easeInOutCubic(progress);
    // Magnitude changes the travel character, never the exact grid target.
    const shaped = 1 - Math.pow(1 - base, magnitude);
    this.currentAngle = this.quantizedFrom + (this.quantizedTarget - this.quantizedFrom) * shaped;
    this.targetAngle = this.quantizedTarget;
    this.accumulator = this.quantizedElapsed;
    this.absolutePhase = this.currentAngle;
    return wrapAngle(this.currentAngle);
  }

  update(params: RotationAuthorityParams, dt: number) {
    const requestedMode = params.rotationSyncMode || 'free';
    if (requestedMode !== this.mode && requestedMode !== this.pendingMode) this.reset(requestedMode, this.angle);

    const bpm = params.bpm || 174;
    const bars = params.bars || 8;
    const division = params.rotationQuantize || '2/1';
    if (bpm !== this.lastBpm || bars !== this.lastBars) {
      this.cachedBpmSpeed = getBpmContinuousSpeed(bpm, bars);
      this.lastBpm = bpm;
      this.lastBars = bars;
    }

    if (this.homeTween.active) {
      this.angle = updateAngleTween(this.homeTween, dt);
      this.currentAngle = this.angle;
      if (!this.homeTween.active) {
        const anchor = nearestUnwrappedEquivalent(nearestVerticalRotation(this.angle), this.modeAnchor || this.currentAngle);
        if (this.pendingMode) this.initializeMode(this.pendingMode, anchor, params);
        else if (this.manualHomeOnly) {
          this.currentAngle = anchor;
          this.absolutePhase = anchor;
          this.targetAngle = anchor;
          this.manualHomeOnly = false;
        }
      }
      this.lastDivision = division;
      return this.angle;
    }

    if (this.pendingMode) {
      this.initializeMode(this.pendingMode, this.modeAnchor, params);
    }

    const mode = this.mode;
    if (mode === 'bpm') {
      this.angle = this.advanceDeterministic(this.cachedBpmSpeed * clampSignedSpeed(params.rotation), dt);
      this.currentAngle = this.absolutePhase;
    } else if (mode === 'quantized') {
      this.angle = this.updateQuantized(params, dt, bpm, division);
    } else if (mode === 'pingpong') {
      const sign = getSignedRotationDirection(params.rotation);
      if (sign !== this.lastPingPongSign) {
        this.pingPong.direction = sign;
        this.lastPingPongSign = sign;
      }
      this.angle = advancePingPongRotation({ state: this.pingPong, dt: Math.min(Math.max(dt, 0), 1 / 30), bpm, division });
      this.currentAngle = this.angle;
      this.absolutePhase = this.angle;
    } else if (mode === 'oscillator') {
      this.angle = advanceOscillatorRotation({ state: this.oscillator, dt: Math.min(Math.max(dt, 0), 1 / 30), bpm, division });
      this.currentAngle = this.angle;
      this.absolutePhase = this.angle;
    } else {
      const targetVelocity = (params.rotation || 0) * 2.25;
      if (this.homeTween.active && Math.abs(targetVelocity) < 0.001) {
        this.angle = updateAngleTween(this.homeTween, dt);
        this.freeVelocity = 0;
      } else {
        if (Math.abs(targetVelocity) >= 0.001) this.homeTween.active = false;
        const cappedDt = Math.min(Math.max(dt, 0), 1 / 50);
        this.freeVelocity = damp(this.freeVelocity, targetVelocity, 8.5, cappedDt);
        this.absolutePhase += this.freeVelocity * cappedDt;
        this.angle = wrapAngle(this.absolutePhase);
      }
      this.currentAngle = this.absolutePhase;
    }

    this.lastDivision = division;
    return this.angle;
  }

  clear() {
    this.homeTween.active = false;
    this.pendingMode = null;
    this.manualHomeOnly = false;
    this.velocity = 0;
    this.freeVelocity = 0;
    this.accumulator = 0;
  }
}
