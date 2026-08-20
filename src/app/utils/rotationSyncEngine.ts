import { easeInOutCubic } from './easing';
import { wrapAngle, TAU } from './mathHelpers';

export type RotationSyncMode = 'free' | 'bpm' | 'quantized' | 'pingpong' | 'oscillator';
export type RotationQuantizeDivision = '4/1' | '2/1' | '1/1' | '1/2' | '1/4' | '1/8' | string;

export interface PingPongState {
  fromAngle: number;
  direction: 1 | -1;
  elapsed: number;
}

export interface OscillatorState {
  originAngle: number;
  phase: number;
}

export function getBeatsForDivision(division: RotationQuantizeDivision): number {
  switch (division) {
    case '4/1': return 16;
    case '2/1': return 8;
    case '1/1': return 4;
    case '1/2': return 2;
    case '1/8': return 0.5;
    case '1/4':
    default: return 1;
  }
}

export function getAngleForDivision(division: RotationQuantizeDivision): number {
  switch (division) {
    case '4/1':
    case '2/1':
    case '1/1': return TAU;
    case '1/2': return Math.PI;
    case '1/8': return Math.PI / 4;
    case '1/4':
    default: return Math.PI / 2;
  }
}

export function getSecondsPerDivision(bpm: number, division: RotationQuantizeDivision): number {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 174;
  return (60 / safeBpm) * getBeatsForDivision(division);
}

export function getBpmContinuousSpeed(bpm: number, bars: number): number {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 174;
  const safeBars = Number.isFinite(bars) && bars > 0 ? bars : 8;
  const secondsPerBeat = 60 / safeBpm;
  const secondsPerBar = secondsPerBeat * 4;
  return TAU / (secondsPerBar * safeBars);
}

export function getSignedRotationDirection(speed?: number): 1 | -1 {
  return Number.isFinite(speed) && Number(speed) < 0 ? -1 : 1;
}

/**
 * Utility stepper used by tests and non-authority consumers. The rhythmic division
 * owns the exact angular grid. Signed speed controls direction only; fractional
 * slider values must never turn 90° into 72° or a full turn into a partial turn.
 */
export function advanceQuantizedRotation(opts: {
  accumulator: number;
  dt: number;
  bpm: number;
  division: RotationQuantizeDivision;
  targetAngle: number;
  speed?: number;
}): { accumulator: number; targetAngle: number; advanced: boolean; interval: number } {
  const interval = Math.max(0.016, getSecondsPerDivision(opts.bpm, opts.division));
  let accumulator = opts.accumulator + opts.dt;
  let targetAngle = opts.targetAngle;
  let advanced = false;
  const amount = getAngleForDivision(opts.division) * getSignedRotationDirection(opts.speed);

  let guard = 0;
  while (accumulator >= interval && guard++ < 8) {
    accumulator -= interval;
    targetAngle += amount;
    advanced = true;
  }

  return { accumulator, targetAngle, advanced, interval };
}

export function advancePingPongRotation(opts: {
  state: PingPongState;
  dt: number;
  bpm: number;
  division: RotationQuantizeDivision;
}): number {
  const interval = Math.max(0.08, getSecondsPerDivision(opts.bpm, opts.division));
  const halfTurn = Math.PI;
  const state = opts.state;
  state.elapsed += opts.dt;

  if (state.elapsed >= interval) {
    const completedTurns = Math.floor(state.elapsed / interval);
    state.elapsed %= interval;
    for (let i = 0; i < completedTurns; i++) {
      state.fromAngle = wrapAngle(state.fromAngle + state.direction * halfTurn);
      state.direction = state.direction === 1 ? -1 : 1;
    }
  }

  const p = Math.max(0, Math.min(1, state.elapsed / interval));
  return wrapAngle(state.fromAngle + state.direction * halfTurn * easeInOutCubic(p));
}

export function advanceOscillatorRotation(opts: {
  state: OscillatorState;
  dt: number;
  bpm: number;
  division: RotationQuantizeDivision;
}): number {
  const beats = getBeatsForDivision(opts.division);
  const safeBpm = Number.isFinite(opts.bpm) && opts.bpm > 0 ? opts.bpm : 174;
  const cycleSeconds = Math.max(0.25, (60 / safeBpm) * beats * 4);
  const amplitude = opts.division === '1/2' ? Math.PI : opts.division === '1/8' ? Math.PI / 4 : Math.PI / 2;
  opts.state.phase = (opts.state.phase + (opts.dt / cycleSeconds) * TAU) % TAU;
  return wrapAngle(opts.state.originAngle + Math.sin(opts.state.phase) * amplitude);
}
