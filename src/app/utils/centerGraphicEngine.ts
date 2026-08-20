import { wrapAngle } from './mathHelpers';
import { CenterMotionRuntime, type CenterMotionProfile, type CenterMotionType } from './centerMotionEngine';

export type CenterGraphicParamsLike = {
  centerImageScale: number;
  centerImageReactive?: boolean;
  centerImageXDrift?: boolean;
  centerImageYDrift?: boolean;
  centerImageKenBurns?: boolean; // legacy only; Ken Burns Drift is now a Motion Type
  centerImageKenBurnsSpeed?: number;
  centerImageAutoRotate?: boolean;
  autoRotateSpeed?: number;
  centerImageJitter?: number;
  centerImageDisplacement?: number;
  centerImageMotionType?: CenterMotionType;
  centerImageMotionProfile?: CenterMotionProfile;
  centerImageMotionAmount?: number;
  centerImageMotionIntensity?: number;
  centerImageMotionAudio?: boolean;
};

export type CenterGraphicEnergy = {
  bassLow?: number;
  midBass?: number;
  midUpper?: number;
};

export type CenterGraphicMotionState = {
  scale: number;
  rotationDeg: number;
  autoRotationAngle: number;
  offsetX: number;
  offsetY: number;
  jitterX: number;
  jitterY: number;
  displacementX: number;
  displacementY: number;
  opacityMul: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOutCubic = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;


/**
 * Center graphic motion/control math extracted from App.tsx.
 * Keeps the main render loop lean and makes tuning easier without touching draw code.
 */
export function computeCenterGraphicMotion(args: {
  params: CenterGraphicParamsLike;
  motionRuntime: CenterMotionRuntime;
  t: number;
  dt: number;
  centerSize: number;
  cycleSpeedMs: number;
  autoRotationAngle: number;
  energy: CenterGraphicEnergy;
}): CenterGraphicMotionState {
  const { params, motionRuntime, t, dt, centerSize, cycleSpeedMs, energy } = args;
  const timeSec = t * 0.001;
  let scale = params.centerImageScale;
  let rotationDeg = 0;
  let autoRotationAngle = args.autoRotationAngle;

  let offsetX = 0;
  let offsetY = 0;

  // Phase 1: session-owned control smoothing and integrated phase prevent speed
  // changes from rebasing motion against the application's absolute runtime.
  const motionDelta = motionRuntime.compute({
    type: params.centerImageMotionType,
    profile: params.centerImageMotionProfile,
    amount: params.centerImageMotionAmount ?? 0,
    speed: params.centerImageMotionAmount ?? 0,
    intensity: params.centerImageMotionIntensity ?? 0,
    audioMotion: false, // Phase 12D.8: Audio Motion removed; centerImageReactive handles audio pulse
    t: timeSec,
    dt,
    centerSize,
    bass: energy.bassLow,
    mid: energy.midBass,
    high: energy.midUpper,
  });
  offsetX += motionDelta.offsetX;
  offsetY += motionDelta.offsetY;
  scale += motionDelta.scaleAdd;
  rotationDeg += motionDelta.rotationAddDeg;
  let opacityMul = motionDelta.opacityMul ?? 1;

  // Smoother, slightly more premium drift. Speed dropdown remains the source of truth.
  if (params.centerImageXDrift || params.centerImageYDrift) {
    const safeSpeedMs = Math.max(500, cycleSpeedMs || 4000);
    const driftSpeed = (1000 / safeSpeedMs) * Math.PI * 2;
    const bass = clamp01(energy.bassLow ?? 0);
    const reactiveLift = params.centerImageReactive ? (0.82 + bass * 0.58) : 1.0;
    const amplitude = centerSize * 0.13 * reactiveLift;

    if (params.centerImageXDrift) offsetX += Math.sin(timeSec * driftSpeed) * amplitude;
    if (params.centerImageYDrift) offsetY += Math.cos(timeSec * driftSpeed) * amplitude;
  }

  // Slower, smoother Ken Burns motion; less harsh when combined with X/Y drift.
  if (params.centerImageKenBurns && (!params.centerImageMotionType || params.centerImageMotionType === 'none')) {
    const speed = Math.max(0.1, params.centerImageKenBurnsSpeed ?? 0.5);
    const kbSpeed = speed * 0.038;
    offsetX += Math.sin(timeSec * kbSpeed * 0.26) * centerSize * 0.075;
    offsetY += Math.cos(timeSec * kbSpeed * 0.38) * centerSize * 0.075;
    scale *= 1.0 + Math.sin(timeSec * kbSpeed * 0.16) * 0.075;
  }

  // Faster default 1x auto-rotation, but still controlled and frame-rate independent.
  if (params.centerImageAutoRotate) {
    const speedMultiplier = Math.max(0.25, params.autoRotateSpeed || 1);
    autoRotationAngle = wrapAngle(autoRotationAngle + dt * 0.47 * speedMultiplier);
    rotationDeg += (autoRotationAngle * 180) / Math.PI;
  }

  // Stronger but clamped reactive zoom: punchier without bloating the image.
  if (params.centerImageReactive) {
    const midBass = clamp01(energy.midBass ?? 0);
    const midUpper = clamp01(energy.midUpper ?? 0);
    const reactiveEnergy = clamp01(midBass * 0.42 + midUpper * 0.58);
    scale += Math.min(0.085, easeOutCubic(reactiveEnergy) * 0.072);
  }

  let jitterX = 0;
  let jitterY = 0;
  const jitter = params.centerImageJitter ?? 0;
  if (jitter > 0.01) {
    const jitterStrength = jitter * 13;
    jitterX = Math.sin(timeSec * 1.7) * jitterStrength * 0.5;
    jitterY = Math.cos(timeSec * 1.3) * jitterStrength * 0.5;
  }

  let displacementX = 0;
  let displacementY = 0;
  const displacement = params.centerImageDisplacement ?? 0;
  if (displacement > 0) {
    const bass = clamp01(energy.bassLow ?? 0);
    const motionIntensity = Math.max(0.45, 0.75 + motionRuntime.currentIntensity * 0.7);
    const baseWarp = (displacement / 100) * centerSize * 0.16 * motionIntensity;
    const warpAmount = baseWarp * (1.0 + bass * 1.25);
    const displacementPhase = motionRuntime.currentDisplacementPhase;
    displacementX = Math.sin(displacementPhase * 1.75) * warpAmount;
    displacementY = Math.cos(displacementPhase * 1.25) * warpAmount;
  }

  return {
    scale,
    rotationDeg,
    autoRotationAngle,
    offsetX,
    offsetY,
    jitterX,
    jitterY,
    displacementX,
    displacementY,
    opacityMul,
  };
}

export function advanceCenterGraphicTransition(progress: number, dt: number, type = 'fade'): { raw: number; eased: number; complete: boolean } {
  // Phase 12D.10 — shared transition timeline. Fast specialty transitions use a
  // shorter timeline while classic fades stay smooth.
  const speedByType: Record<string, number> = {
    instant: 999,
    fade: 2.75,
    crossfade: 2.75,
    zoom: 2.9,
    flashZoom: 6.4,
    pushFade: 5.8,
    signalScan: 7.2,
    glitchCut: 10.0,
  };
  const speed = speedByType[type] ?? 3.0;
  const raw = Math.min(1, progress + dt * speed);
  return { raw, eased: easeInOutCubic(raw), complete: raw >= 1 };
}

export function shouldDrawCenterGraphic(args: { hasElement: boolean; hidden?: boolean; opacity?: number }): boolean {
  return !!args.hasElement && !args.hidden && (args.opacity ?? 1) > 0.001;
}

export type CenterGraphicMediaDimensions = {
  width: number;
  height: number;
};

export function getCenterGraphicMediaDimensions(element: HTMLImageElement | HTMLVideoElement | null | undefined): CenterGraphicMediaDimensions | null {
  if (!element) return null;
  const isVideo = element instanceof HTMLVideoElement;
  const width = isVideo ? element.videoWidth : element.width;
  const height = isVideo ? element.videoHeight : element.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Returns a media-aware scale that avoids tiny logos/icons inheriting a large-photo scale,
 * while keeping user zoom untouched unless the media size changes substantially.
 */
export function getSmartCenterGraphicScale(args: {
  incoming: CenterGraphicMediaDimensions | null;
  outgoing?: CenterGraphicMediaDimensions | null;
  currentScale: number;
  fallbackScale: number;
  savedScale?: number;
  force?: boolean;
}): number {
  const { incoming, outgoing, currentScale, fallbackScale, savedScale, force } = args;
  if (Number.isFinite(savedScale) && (savedScale as number) > 0) return Math.max(0.02, Math.min(1.2, savedScale as number));
  if (!incoming) return currentScale || fallbackScale;

  const longest = Math.max(incoming.width, incoming.height);
  const shortest = Math.min(incoming.width, incoming.height);
  const aspect = incoming.width / Math.max(1, incoming.height);
  const area = incoming.width * incoming.height;

  const isWideWordmark = aspect > 2.15;
  const isTallGraphic = aspect < 0.58;
  const isCompactLogo = longest <= 900 && shortest <= 640 && !isWideWordmark && !isTallGraphic;
  const isPhotoVideo = area >= 1280 * 720 || longest >= 1400;

  let suggested = fallbackScale;
  if (isWideWordmark) suggested = longest < 900 ? 0.145 : 0.118;
  else if (isTallGraphic) suggested = longest < 900 ? 0.155 : 0.125;
  else if (isCompactLogo) suggested = longest < 420 ? 0.225 : longest < 720 ? 0.195 : 0.168;
  else if (isPhotoVideo) suggested = 0.118;
  else suggested = 0.142;

  // Very tiny logos need a small lift; full-frame media needs restraint.
  if (longest < 260) suggested *= 1.16;
  if (area > 1920 * 1080) suggested *= 0.92;

  suggested = Math.max(0.075, Math.min(0.265, suggested));

  if (!force && outgoing) {
    const outArea = outgoing.width * outgoing.height;
    const inArea = incoming.width * incoming.height;
    const ratio = outArea > 0 ? inArea / outArea : 1;
    const aspectDelta = Math.abs((incoming.width / Math.max(1, incoming.height)) - (outgoing.width / Math.max(1, outgoing.height)));
    // Preserve manual/user scale when media is reasonably similar.
    if (ratio > 0.5 && ratio < 2.0 && aspectDelta < 0.65) return currentScale || suggested;
  }

  return suggested;
}
