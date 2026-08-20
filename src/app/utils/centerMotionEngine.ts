/**
 * ORBITAL — Center Motion Engine
 * Phase 12D.8 — Motion Library Identity & Engine Polish.
 *
 * This pass moves the center layer away from small generic sine tweaks and toward
 * preset-owned animation behavior:
 * - Motion Speed and Motion Intensity are separated.
 * - Presets declare the transform channels they own.
 * - Transition/FX presets use timeline phases instead of generic continuous drift.
 * - Motion switching uses selective easing only where it improves the feel.
 * - Audio Motion was removed from the active pipeline; regular Center Reactive
 *   remains the intended audio-pulse path.
 */

import { easeInOutCubic, easeOutCubic, easeOutQuart, easeOutSine } from './easing';

export type CenterMotionType =
  | 'none'
  // Ambient
  | 'slowDrift'
  | 'staticDrift' // legacy alias
  | 'floating'
  | 'verticalFloat'
  | 'horizontalFloat'
  | 'slowFloat'
  | 'orbitDrift'
  | 'organicDrift'
  | 'hologramDrift'
  | 'pendulumSwing'
  // Cinematic
  | 'cinematicZoom'
  | 'cinematicPush'
  | 'breathingZoom'
  | 'logoRevealLoop'
  | 'kenBurnsDrift'
  | 'rockBack'
  | 'audioReactive' // legacy alias
  // Transition / Broadcast
  | 'downSlide'
  | 'fallTicker'
  | 'tickerScroll'
  | 'broadcastSweep'
  | 'sideSweep'
  | 'popIn'
  // FX / Reactive
  | 'glitchSnap'
  | 'microJitter'
  | 'beatPunch'
  | 'signalLock'
  | 'shakeBurst'
  | 'dataCorruption'
  | 'digitalSkip'
  | 'pulseBurst'
  // Legacy aliases kept so old saved presets do not break.
  | 'orbit'
  | 'float'
  | 'hover'
  | 'pendulum'
  | 'zoomPulse'
  | 'spiral'
  | 'inertia';

export type CenterMotionProfile =
  | 'static'
  | 'floating'
  | 'cinematic'
  | 'hologram'
  | 'organic'
  | 'broadcast'
  | 'audioReactive';

export type CenterMotionInput = {
  type?: CenterMotionType;
  profile?: CenterMotionProfile;
  /** Legacy-compatible: now represents Motion Speed. */
  amount?: number;
  speed?: number;
  /** Travel/strength. Only applies to the channels the active preset owns. */
  intensity?: number;
  /** Phase 12D.8: retained for saved preset compatibility, ignored by engine. */
  audioMotion?: boolean;
  t: number; // seconds
  /** Scheduler-owned delta; capped by the session runtime before integration. */
  dt?: number;
  /** Session-integrated motion time. Internal to CenterMotionRuntime. */
  phaseTime?: number;
  centerSize: number;
  bass?: number;
  mid?: number;
  high?: number;
};

export type CenterMotionDelta = {
  offsetX: number;
  offsetY: number;
  scaleAdd: number;
  rotationAddDeg: number;
  opacityMul: number;
};

type CanonicalMotionType = Exclude<
  CenterMotionType,
  'orbit' | 'float' | 'hover' | 'pendulum' | 'zoomPulse' | 'spiral' | 'inertia' | 'audioReactive' | 'staticDrift'
>;

type MotionFamily = 'ambient' | 'cinematic' | 'transition' | 'fx' | 'reactive' | 'none';
type TransformChannel = 'position' | 'scale' | 'rotation' | 'opacity';

type PresetMeta = {
  family: MotionFamily;
  channels: TransformChannel[];
  transition: 'smooth' | 'quick' | 'hard';
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
const fract = (v: number) => ((v % 1) + 1) % 1;

function zero(): CenterMotionDelta {
  return { offsetX: 0, offsetY: 0, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 1 };
}

function mix(a: CenterMotionDelta, b: CenterMotionDelta, p: number): CenterMotionDelta {
  const k = clamp01(p);
  return {
    offsetX: a.offsetX + (b.offsetX - a.offsetX) * k,
    offsetY: a.offsetY + (b.offsetY - a.offsetY) * k,
    scaleAdd: a.scaleAdd + (b.scaleAdd - a.scaleAdd) * k,
    rotationAddDeg: a.rotationAddDeg + (b.rotationAddDeg - a.rotationAddDeg) * k,
    opacityMul: a.opacityMul + (b.opacityMul - a.opacityMul) * k,
  };
}

function normalizeMotionType(type?: CenterMotionType): CanonicalMotionType {
  switch (type) {
    case 'staticDrift': return 'slowDrift';
    case 'float': return 'floating';
    case 'hover': return 'verticalFloat';
    case 'orbit':
    case 'spiral': return 'orbitDrift';
    case 'pendulum': return 'pendulumSwing';
    case 'zoomPulse': return 'breathingZoom';
    case 'inertia': return 'cinematicPush';
    case 'audioReactive': return 'rockBack';
    case 'none':
    case 'slowDrift':
    case 'floating':
    case 'verticalFloat':
    case 'horizontalFloat':
    case 'slowFloat':
    case 'orbitDrift':
    case 'organicDrift':
    case 'hologramDrift':
    case 'pendulumSwing':
    case 'cinematicZoom':
    case 'cinematicPush':
    case 'breathingZoom':
    case 'logoRevealLoop':
    case 'kenBurnsDrift':
    case 'rockBack':
    case 'downSlide':
    case 'fallTicker':
    case 'tickerScroll':
    case 'broadcastSweep':
    case 'sideSweep':
    case 'popIn':
    case 'glitchSnap':
    case 'microJitter':
    case 'beatPunch':
    case 'signalLock':
    case 'shakeBurst':
    case 'dataCorruption':
    case 'digitalSkip':
    case 'pulseBurst':
      return type;
    default:
      return 'none';
  }
}

function fallbackTypeForProfile(profile?: CenterMotionProfile): CanonicalMotionType {
  switch (profile) {
    case 'floating': return 'verticalFloat';
    case 'cinematic': return 'cinematicZoom';
    case 'hologram': return 'hologramDrift';
    case 'organic': return 'organicDrift';
    case 'broadcast': return 'fallTicker';
    case 'audioReactive': return 'rockBack';
    case 'static': return 'slowDrift';
    default: return 'none';
  }
}

const PRESET_META: Record<CanonicalMotionType, PresetMeta> = {
  none: { family: 'none', channels: [], transition: 'smooth' },
  slowDrift: { family: 'ambient', channels: ['position'], transition: 'smooth' },
  floating: { family: 'ambient', channels: ['position', 'rotation'], transition: 'smooth' },
  verticalFloat: { family: 'ambient', channels: ['position'], transition: 'smooth' },
  horizontalFloat: { family: 'ambient', channels: ['position'], transition: 'smooth' },
  slowFloat: { family: 'ambient', channels: ['position'], transition: 'smooth' },
  orbitDrift: { family: 'ambient', channels: ['position', 'rotation'], transition: 'smooth' },
  organicDrift: { family: 'ambient', channels: ['position', 'rotation'], transition: 'smooth' },
  hologramDrift: { family: 'ambient', channels: ['position', 'rotation', 'opacity'], transition: 'quick' },
  pendulumSwing: { family: 'ambient', channels: ['position', 'rotation'], transition: 'smooth' },
  cinematicZoom: { family: 'cinematic', channels: ['scale', 'opacity'], transition: 'smooth' },
  cinematicPush: { family: 'cinematic', channels: ['position', 'scale', 'rotation'], transition: 'smooth' },
  breathingZoom: { family: 'cinematic', channels: ['scale'], transition: 'smooth' },
  logoRevealLoop: { family: 'cinematic', channels: ['position', 'scale', 'rotation', 'opacity'], transition: 'smooth' },
  kenBurnsDrift: { family: 'cinematic', channels: ['position', 'scale'], transition: 'smooth' },
  rockBack: { family: 'cinematic', channels: ['rotation', 'position'], transition: 'smooth' },
  downSlide: { family: 'transition', channels: ['position', 'opacity'], transition: 'hard' },
  fallTicker: { family: 'transition', channels: ['position', 'opacity'], transition: 'hard' },
  tickerScroll: { family: 'transition', channels: ['position'], transition: 'hard' },
  broadcastSweep: { family: 'transition', channels: ['position', 'opacity'], transition: 'hard' },
  sideSweep: { family: 'transition', channels: ['position', 'opacity'], transition: 'hard' },
  popIn: { family: 'transition', channels: ['scale', 'opacity'], transition: 'quick' },
  glitchSnap: { family: 'fx', channels: ['position', 'rotation', 'opacity'], transition: 'hard' },
  microJitter: { family: 'fx', channels: ['position', 'rotation'], transition: 'hard' },
  signalLock: { family: 'fx', channels: ['position', 'rotation', 'opacity'], transition: 'hard' },
  shakeBurst: { family: 'fx', channels: ['position', 'rotation'], transition: 'hard' },
  dataCorruption: { family: 'fx', channels: ['position', 'rotation', 'opacity'], transition: 'hard' },
  digitalSkip: { family: 'fx', channels: ['position', 'opacity'], transition: 'hard' },
  pulseBurst: { family: 'fx', channels: ['scale', 'opacity'], transition: 'quick' },
  beatPunch: { family: 'reactive', channels: ['position', 'scale', 'rotation'], transition: 'hard' },
};

function speedCurve(raw: number) {
  const s = clamp01(raw);
  if (s <= 0) return 0;
  // Preserve the approved ceiling while removing the old 0 -> 0.744 step.
  const lowMid = Math.pow(s, 0.54) * 3.04;
  const highAccel = Math.pow(Math.max(0, s - 0.68) / 0.32, 2.2) * 1.28;
  return (lowMid + highAccel) * 1.2;
}

function intensityCurve(raw: number) {
  const i = clamp01(raw);
  if (i <= 0) return 0;
  // Preserve the approved ceiling while remaining continuous from zero.
  return Math.pow(i, 0.68) * 1.78 * 1.25;
}

function motionSettings(input: CenterMotionInput) {
  const rawSpeed = clamp01(input.speed ?? input.amount ?? 0.52);
  const rawIntensity = clamp01(input.intensity ?? 0.56);
  const speed = speedCurve(rawSpeed);
  const intensity = intensityCurve(rawIntensity);
  const size = Math.max(1, input.centerSize);
  return {
    rawSpeed,
    rawIntensity,
    speed,
    intensity,
    size,
    // Wider center-area travel. Individual presets still multiply this.
    ampPx: size * 0.072 * intensity,
    fullX: size * 0.36 * Math.min(1.18, intensity),
    fullY: size * 0.34 * Math.min(1.18, intensity),
  };
}

function smoothStep(edge0: number, edge1: number, x: number) {
  const p = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return p * p * (3 - 2 * p);
}

function saw01(t: number, speed: number, phase = 0) {
  return fract(t * speed + phase);
}

function pingPongSigned(t: number, speed: number, phase = 0) {
  const p = saw01(t, speed, phase);
  return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
}

function steppedNoise(t: number, rate: number, phase = 0) {
  return Math.sin(Math.floor((t + phase) * rate) * 12.9898) * 43758.5453 % 1;
}

function lowMidPulse(input: CenterMotionInput) {
  const bass = clamp01(input.bass ?? 0);
  const mid = clamp01(input.mid ?? 0);
  const high = clamp01(input.high ?? 0);
  const punch = clamp01(bass * 0.72 + mid * 0.38 + Math.max(0, bass - mid * 0.3) * 0.5);
  const body = clamp01(bass * 0.35 + mid * 0.5 + high * 0.12);
  return { bass, mid, high, punch, body };
}

type CenterMotionEngineState = {
  activeType: CanonicalMotionType;
  previousDelta: CenterMotionDelta;
  transitionElapsed: number;
  lastT: number;
  dt: number;
  beatPrevEnergy: number;
  beatPos: number;
  beatVel: number;
};

function createEngineState(): CenterMotionEngineState {
  return {
  activeType: 'none' as CanonicalMotionType,
  previousDelta: zero(),
  transitionElapsed: 0,
  lastT: 0,
  dt: 1 / 60,
  beatPrevEnergy: 0,
  beatPos: 0,
  beatVel: 0,
  };
}

function updateEngineClock(state: CenterMotionEngineState, t: number, schedulerDt?: number): number {
  const measuredDt = state.lastT > 0 ? t - state.lastT : 1 / 60;
  const dtRaw = Number.isFinite(schedulerDt) ? schedulerDt! : measuredDt;
  state.dt = clamp(dtRaw, 1 / 240, 1 / 24);
  state.lastT = t;
  return state.dt;
}

function beatPunchSpring(
  state: CenterMotionEngineState,
  input: CenterMotionInput,
  ampPx: number,
  responseSpeed: number,
  intensity: number,
  motionTime: number,
): CenterMotionDelta {
  const { bass, mid } = lowMidPulse(input);
  const energy = clamp01(bass * 0.78 + mid * 0.34);
  const rise = Math.max(0, energy - state.beatPrevEnergy);
  state.beatPrevEnergy = state.beatPrevEnergy * 0.64 + energy * 0.36;

  if (rise > 0.028 && energy > 0.12) {
    state.beatVel += clamp(rise * 10.5 + Math.max(0, energy - 0.52) * 0.32, 0, 1.2);
  }

  const stiffness = 70 + responseSpeed * 18;
  const damping = 15.5 + responseSpeed * 2.5;
  const accel = -state.beatPos * stiffness - state.beatVel * damping;
  state.beatVel += accel * state.dt;
  state.beatPos += state.beatVel * state.dt;
  state.beatPos = clamp(state.beatPos, 0, 1);
  if (state.beatPos <= 0.0001 && state.beatVel < 0) state.beatVel = 0;

  const pulse = easeOutCubic(state.beatPos);
  return {
    offsetX: Math.sin(motionTime * 26.0) * pulse * ampPx * 0.08,
    offsetY: -pulse * ampPx * 0.46,
    scaleAdd: pulse * 0.052 * intensity,
    rotationAddDeg: Math.sin(motionTime * 22.0) * pulse * 0.72 * intensity,
    opacityMul: 1,
  };
}

function motion(state: CenterMotionEngineState, type: CanonicalMotionType, input: CenterMotionInput): CenterMotionDelta {
  const settings = motionSettings(input);
  const { intensity, size, ampPx, fullX, fullY } = settings;
  if (type === 'none' || settings.speed <= 0.001 || intensity <= 0.001) return zero();

  // When phaseTime is present it already contains the integral of mapped speed.
  // All existing motion formulas can therefore use a neutral temporal multiplier.
  const speed = input.phaseTime === undefined ? settings.speed : 1;
  const t = input.phaseTime ?? input.t;
  const { bass, mid, high, punch } = lowMidPulse(input);

  switch (type) {
    // AMBIENT — distinct, no scale/fade unless declared.
    case 'slowDrift': {
      // Full-area bounded ping-pong drift; cannot exceed the center area bounds.
      const x = pingPongSigned(t, 0.105 * speed, 0.12) * fullX;
      const y = pingPongSigned(t, 0.078 * speed, 0.62) * fullY;
      return { offsetX: x, offsetY: y, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 1 };
    }

    case 'floating':
    case 'verticalFloat':
    case 'slowFloat':
      return {
        offsetX: 0,
        offsetY: Math.sin(t * 0.9 * speed) * ampPx * 1.55,
        scaleAdd: 0,
        rotationAddDeg: 0,
        opacityMul: 1,
      };

    case 'horizontalFloat':
      return { offsetX: Math.sin(t * 0.86 * speed) * ampPx * 1.7, offsetY: 0, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 1 };

    case 'orbitDrift': {
      // Full-area ricochet/orbit hybrid: large bounded travel plus curved orbital wobble.
      const bx = pingPongSigned(t, 0.12 * speed, 0.18) * fullX;
      const by = pingPongSigned(t, 0.096 * speed, 0.71) * fullY;
      const a = t * 1.12 * speed;
      const wobbleX = Math.cos(a) * ampPx * 0.18;
      const wobbleY = Math.sin(a * 1.12) * ampPx * 0.16;
      return {
        offsetX: clamp(bx + wobbleX, -fullX, fullX),
        offsetY: clamp(by + wobbleY, -fullY, fullY),
        scaleAdd: 0,
        rotationAddDeg: Math.sin(a * 0.7) * 1.1 * intensity,
        opacityMul: 1,
      };
    }

    case 'organicDrift': {
      // Non-symmetric wandering: layered low-rate curves, distinct from ping-pong.
      const x = (Math.sin(t * 0.34 * speed + Math.sin(t * 0.13 * speed) * 1.2) + Math.sin(t * 0.83 * speed + 1.6) * 0.48) * ampPx * 0.88;
      const y = (Math.cos(t * 0.41 * speed + 0.2) + Math.sin(t * 0.69 * speed + Math.cos(t * 0.11 * speed)) * 0.56) * ampPx * 0.92;
      return { offsetX: x, offsetY: y, scaleAdd: 0, rotationAddDeg: Math.sin(t * 0.42 * speed) * 1.15 * intensity, opacityMul: 1 };
    }

    case 'hologramDrift': {
      // Projection shimmer: small travel, high-frequency shimmer, opacity gating.
      const shimmer = Math.sin(t * 22.0 * speed) * Math.sin(t * 8.8 * speed + 1.2);
      const snap = Math.sin(t * 31.0 * speed) > 0.94 ? 1 : 0;
      return {
        offsetX: Math.sin(t * 2.2 * speed) * ampPx * 0.16 + shimmer * ampPx * 0.13 + snap * ampPx * 0.18,
        offsetY: Math.cos(t * 2.9 * speed) * ampPx * 0.11 + Math.sin(t * 19.0 * speed) * ampPx * 0.06,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 3.6 * speed) * 0.52 * intensity + snap * 0.5,
        opacityMul: clamp(0.76 + Math.sin(t * 18.0 * speed) * 0.1 + high * 0.12 - snap * 0.28, 0.42, 1),
      };
    }

    case 'pendulumSwing':
      return {
        offsetX: Math.sin(t * 1.0 * speed) * ampPx * 0.82,
        offsetY: Math.cos(t * 0.5 * speed) * ampPx * 0.08,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 1.12 * speed) * 7.5 * intensity,
        opacityMul: 1,
      };

    // CINEMATIC — scale-owned presets only.
    case 'cinematicZoom': {
      const p = saw01(t, 0.072 * speed, 0.08);
      const fadeIn = smoothStep(0.05, 0.2, p);
      const fadeOut = 1 - smoothStep(0.72, 0.96, p);
      const visible = fadeIn * fadeOut;
      const zoomIn = easeOutQuart(smoothStep(0.08, 0.42, p));
      const zoomOut = easeInOutCubic(smoothStep(0.58, 0.98, p));
      return {
        offsetX: 0,
        offsetY: 0,
        scaleAdd: (-0.12 + zoomIn * 0.17 - zoomOut * 0.105) * intensity,
        rotationAddDeg: 0,
        opacityMul: 0.01 + visible * 0.99,
      };
    }

    case 'cinematicPush': {
      const p = (Math.sin(t * 0.9 * speed - Math.PI / 2) + 1) * 0.5;
      const push = easeInOutCubic(p);
      return {
        offsetX: Math.sin(t * 0.34 * speed) * ampPx * 0.22,
        offsetY: Math.sin(t * 1.05 * speed) * ampPx * 0.88 - push * ampPx * 0.28,
        scaleAdd: (-0.035 + push * 0.13) * intensity,
        rotationAddDeg: Math.sin(t * 0.42 * speed) * 0.8 * intensity,
        opacityMul: 1,
      };
    }

    case 'breathingZoom': {
      const breath = easeInOutCubic((Math.sin(t * 0.96 * speed - Math.PI / 2) + 1) * 0.5);
      return { offsetX: 0, offsetY: 0, scaleAdd: (-0.044 + breath * 0.088) * intensity, rotationAddDeg: 0, opacityMul: 1 };
    }

    case 'logoRevealLoop': {
      const p = saw01(t, 0.088 * speed, 0.18);
      const fadeIn = smoothStep(0.04, 0.2, p);
      const fadeOut = 1 - smoothStep(0.72, 0.96, p);
      const visible = fadeIn * fadeOut;
      const zoomIn = easeOutCubic(smoothStep(0.06, 0.36, p));
      const zoomOut = smoothStep(0.68, 0.98, p);
      return {
        offsetX: Math.sin(t * 0.7 * speed) * ampPx * 0.07 * visible,
        offsetY: Math.cos(t * 0.56 * speed) * ampPx * 0.055 * visible,
        scaleAdd: (-0.1 + zoomIn * 0.112 - zoomOut * 0.075) * intensity,
        rotationAddDeg: Math.sin(t * 0.7 * speed) * 0.72 * intensity * visible,
        opacityMul: 0.01 + visible * 0.99,
      };
    }


    case 'kenBurnsDrift': {
      // Converted from the old Ken Burns toggle into a proper Motion Type.
      // Slow cinematic pan + subtle push, scoped only to position/scale.
      const p = (Math.sin(t * 0.42 * speed - Math.PI / 2) + 1) * 0.5;
      const push = easeInOutCubic(p);
      return {
        offsetX: Math.sin(t * 0.23 * speed + 0.6) * ampPx * 1.05,
        offsetY: Math.cos(t * 0.19 * speed + 1.2) * ampPx * 0.82,
        scaleAdd: (-0.018 + push * 0.055) * intensity,
        rotationAddDeg: 0,
        opacityMul: 1,
      };
    }

    case 'rockBack':
      return {
        offsetX: Math.sin(t * 2.8 * speed) * ampPx * 0.1,
        offsetY: 0,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 2.7 * speed) * 5.8 * intensity,
        opacityMul: 1,
      };

    // TRANSITION / BROADCAST — timeline-owned.
    case 'downSlide': {
      const p = saw01(t, 0.09 * speed, 0.82);
      const travel = size * 2.45;
      const y = p < 0.32
        ? -travel * (1 - easeOutCubic(smoothStep(0.02, 0.32, p)))
        : p < 0.66
          ? 0
          : travel * easeInOutCubic(smoothStep(0.66, 0.96, p));
      const gate = smoothStep(0.02, 0.18, p) * (1 - smoothStep(0.78, 0.97, p));
      return { offsetX: 0, offsetY: y, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 0.04 + gate * 0.96 };
    }

    case 'fallTicker': {
      // Different from Down Slide: repeated center pause, then a falling drop.
      const p = saw01(t, 0.082 * speed, 0.12);
      const travel = size * 2.5;
      let y = 0;
      if (p < 0.48) y = 0;
      else if (p < 0.78) y = travel * easeInOutCubic(smoothStep(0.48, 0.78, p));
      else y = -travel * (1 - easeOutCubic(smoothStep(0.78, 1.0, p)));
      const gate = p < 0.82 ? 1 : smoothStep(0.82, 1.0, p);
      return { offsetX: 0, offsetY: y, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 0.08 + gate * 0.92 };
    }

    case 'tickerScroll': {
      const p = saw01(t, 0.072 * speed, 0.08);
      const travel = size * 2.9;
      return { offsetX: (p * 2 - 1) * travel, offsetY: 0, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 1 };
    }

    case 'broadcastSweep': {
      const p = saw01(t, 0.072 * speed, 0.72);
      const enter = smoothStep(0.06, 0.24, p);
      const exit = 1 - smoothStep(0.72, 0.94, p);
      const gate = enter * exit;
      const travel = size * 2.25;
      return { offsetX: (1 - p * 2) * travel, offsetY: size * 0.22 * (1 - gate), scaleAdd: 0, rotationAddDeg: 0, opacityMul: 0.05 + gate * 0.95 };
    }

    case 'sideSweep': {
      const p = saw01(t, 0.086 * speed, 0.25);
      const travel = size * 2.45;
      let x = 0;
      if (p < 0.28) x = -travel * (1 - easeOutCubic(smoothStep(0.02, 0.28, p)));
      else if (p < 0.62) x = 0;
      else x = travel * easeInOutCubic(smoothStep(0.62, 0.94, p));
      const gate = smoothStep(0.02, 0.16, p) * (1 - smoothStep(0.76, 0.96, p));
      return { offsetX: x, offsetY: 0, scaleAdd: 0, rotationAddDeg: 0, opacityMul: 0.04 + gate * 0.96 };
    }

    case 'popIn': {
      const p = saw01(t, 0.13 * speed, 0.1);
      const pop = p < 0.24 ? easeOutQuart(smoothStep(0.02, 0.24, p)) : p < 0.7 ? 1 : 1 - smoothStep(0.7, 0.94, p);
      return { offsetX: 0, offsetY: 0, scaleAdd: (-0.12 + pop * 0.12) * intensity, rotationAddDeg: 0, opacityMul: clamp01(pop) };
    }

    // FX / REACTIVE — intentionally fast, less easing.
    case 'glitchSnap': {
      const p = saw01(t, 1.55 * speed + 2.4, 0.31);
      const burst = p < 0.2 ? 1 - p / 0.2 : 0;
      const step = steppedNoise(t, 28 * speed, 0.2);
      const gate = Math.max(burst, punch > 0.7 ? 0.85 : 0);
      return {
        offsetX: (Math.sin(t * 92.0) + Math.sin(t * 161.0) * 0.55 + step * 0.9) * ampPx * 0.48 * gate,
        offsetY: (Math.cos(t * 83.0) + Math.cos(t * 151.0) * 0.46 - step * 0.6) * ampPx * 0.36 * gate,
        scaleAdd: 0,
        rotationAddDeg: (Math.sin(t * 96.0) + step * 2) * 4.2 * intensity * gate,
        opacityMul: clamp(1 - gate * 0.28 + Math.sin(t * 70) * gate * 0.08, 0.45, 1),
      };
    }

    case 'microJitter': {
      const jitterAmp = ampPx * 0.032;
      return {
        offsetX: (Math.sin(t * 76.0 * speed) + Math.sin(t * 121.0 * speed) * 0.42) * jitterAmp,
        offsetY: (Math.cos(t * 72.0 * speed) + Math.cos(t * 113.0 * speed) * 0.38) * jitterAmp,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 72.0 * speed) * 0.22 * intensity,
        opacityMul: 1,
      };
    }

    case 'beatPunch':
      return beatPunchSpring(state, input, ampPx, settings.speed, intensity, t);

    case 'signalLock': {
      const p = saw01(t, 0.18 * speed, 0.04);
      const out = 1 - smoothStep(0.02, 0.14, p);
      const lock = smoothStep(0.18, 0.28, p);
      const hold = 1 - smoothStep(0.66, 0.86, p);
      const visible = clamp01(Math.max(out * 0.05, lock * hold));
      const snap = p < 0.3 ? 1 - smoothStep(0.12, 0.3, p) : 0;
      const shake = snap + (visible > 0.1 ? 0.16 : 0);
      return {
        offsetX: Math.sin(t * 84.0 * speed) * ampPx * 0.17 * shake + Math.sin(t * 1.2 * speed) * ampPx * 0.025 * visible,
        offsetY: Math.cos(t * 76.0 * speed) * ampPx * 0.13 * shake,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 70.0 * speed) * snap * 1.35 * intensity,
        opacityMul: visible,
      };
    }

    case 'shakeBurst': {
      const p = saw01(t, 0.72 * speed, 0.04);
      const burst = p < 0.28 ? 1 - easeOutSine(p / 0.28) : 0;
      return {
        offsetX: Math.sin(t * 120.0) * ampPx * 0.56 * burst,
        offsetY: Math.cos(t * 104.0) * ampPx * 0.42 * burst,
        scaleAdd: 0,
        rotationAddDeg: Math.sin(t * 116.0) * 5.2 * intensity * burst,
        opacityMul: 1,
      };
    }

    case 'dataCorruption': {
      const p = saw01(t, 1.05 * speed, 0.44);
      const gate = p < 0.36 ? 1 - p / 0.36 : 0;
      const stepA = steppedNoise(t, 18 * speed, 0.7);
      const stepB = steppedNoise(t, 23 * speed, 1.3);
      return {
        offsetX: (stepA - 0.5) * ampPx * 1.05 * gate,
        offsetY: (stepB - 0.5) * ampPx * 0.64 * gate,
        scaleAdd: 0,
        rotationAddDeg: (stepA - stepB) * 7.0 * intensity * gate,
        opacityMul: clamp(1 - gate * (0.24 + stepB * 0.32), 0.35, 1),
      };
    }

    case 'digitalSkip': {
      const p = saw01(t, 0.98 * speed, 0.58);
      const step = Math.floor(p * 5) / 4;
      const gate = p < 0.78 ? 1 : 1 - smoothStep(0.78, 1.0, p);
      return {
        offsetX: (step - 0.5) * ampPx * 1.18 * gate,
        offsetY: (Math.floor(fract(p + 0.37) * 4) / 3 - 0.5) * ampPx * 0.68 * gate,
        scaleAdd: 0,
        rotationAddDeg: 0,
        opacityMul: clamp(0.58 + gate * 0.42, 0.35, 1),
      };
    }

    case 'pulseBurst': {
      const p = saw01(t, 0.54 * speed, 0.12);
      const burst = p < 0.22 ? easeOutQuart(1 - p / 0.22) : 0;
      return {
        offsetX: 0,
        offsetY: 0,
        scaleAdd: burst * 0.075 * intensity,
        rotationAddDeg: 0,
        opacityMul: clamp(1 - burst * 0.18 + bass * 0.05 + mid * 0.03, 0.72, 1),
      };
    }

    default:
      return zero();
  }
}

function transitionDuration(type: CanonicalMotionType) {
  const mode = PRESET_META[type]?.transition ?? 'smooth';
  if (mode === 'hard') return 0;
  if (mode === 'quick') return 0.11;
  return 0.24;
}

function shouldEaseBetween(prev: CanonicalMotionType, next: CanonicalMotionType) {
  if (prev === next) return false;
  const a = PRESET_META[prev]?.transition ?? 'smooth';
  const b = PRESET_META[next]?.transition ?? 'smooth';
  if (a === 'hard' || b === 'hard') return false;
  const familyA = PRESET_META[prev]?.family;
  const familyB = PRESET_META[next]?.family;
  return familyA === familyB || (familyA === 'ambient' && familyB === 'ambient') || (familyA === 'cinematic' && familyB === 'cinematic');
}

/**
 * Session-owned Center Graphic motion state.
 * Speed changes alter angular velocity only; they never recompute an absolute-time phase.
 */
export class CenterMotionRuntime {
  private state = createEngineState();
  private phaseTime = 0;
  private displacementPhase = 0;
  private smoothedSpeed = 0;
  private smoothedIntensity = 0;
  private activation = 0;

  compute(input: CenterMotionInput): CenterMotionDelta {
    const state = this.state;
    const dt = updateEngineClock(state, input.t, input.dt);
    const targetSpeed = clamp01(input.speed ?? input.amount ?? 0);
    const targetIntensity = clamp01(input.intensity ?? 0);

    let type = normalizeMotionType(input.type);
    // Profiles remain an import bridge only. An explicit user-facing "none" stays off.
    if (input.type === undefined && type === 'none') type = fallbackTypeForProfile(input.profile);

    const previousType = state.activeType;
    if (type !== previousType) {
      state.transitionElapsed = 0;
      if (state.previousDelta.opacityMul === 0) state.previousDelta = zero();
      state.activeType = type;
      if (previousType === 'none' && type !== 'none') this.activation = 0;
    } else {
      state.transitionElapsed += dt;
    }

    const speedAlpha = 1 - Math.exp(-9.5 * dt);
    const intensityAlpha = 1 - Math.exp(-10.5 * dt);
    this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * speedAlpha;
    this.smoothedIntensity += (targetIntensity - this.smoothedIntensity) * intensityAlpha;

    const mappedSpeed = speedCurve(this.smoothedSpeed);
    if (type !== 'none' && mappedSpeed > 0) {
      this.phaseTime += mappedSpeed * dt;
      this.displacementPhase += (0.65 + this.smoothedSpeed * 1.65) * dt;
    }

    input.speed = this.smoothedSpeed;
    input.amount = this.smoothedSpeed;
    input.intensity = this.smoothedIntensity;
    input.dt = dt;
    input.phaseTime = this.phaseTime;

    const next = motion(state, type, input);
    const duration = transitionDuration(type);
    const blendable = duration > 0 && shouldEaseBetween(previousType, type);
    let output = next;
    if (blendable && state.transitionElapsed < duration) {
      output = mix(
        state.previousDelta,
        next,
        easeInOutCubic(clamp01(state.transitionElapsed / duration)),
      );
    }

    const controlsActive = targetSpeed > 0.0001 && targetIntensity > 0.0001;
    const activationTarget = type === 'none' || !controlsActive ? 0 : 1;
    const activationRate = activationTarget > this.activation ? 10.5 : 8.0;
    this.activation += (activationTarget - this.activation) * (1 - Math.exp(-activationRate * dt));
    if (this.activation < 0.999) {
      const envelope = easeInOutCubic(clamp01(this.activation));
      output.offsetX *= envelope;
      output.offsetY *= envelope;
      output.scaleAdd *= envelope;
      output.rotationAddDeg *= envelope;
      output.opacityMul = 1 + (output.opacityMul - 1) * envelope;
    }

    state.previousDelta = output;
    return output;
  }

  get currentSpeed(): number { return this.smoothedSpeed; }
  get currentIntensity(): number { return this.smoothedIntensity; }
  get currentPhaseTime(): number { return this.phaseTime; }
  get currentDisplacementPhase(): number { return this.displacementPhase; }

  reset(): void {
    this.state = createEngineState();
    this.phaseTime = 0;
    this.displacementPhase = 0;
    this.smoothedSpeed = 0;
    this.smoothedIntensity = 0;
    this.activation = 0;
  }
}
