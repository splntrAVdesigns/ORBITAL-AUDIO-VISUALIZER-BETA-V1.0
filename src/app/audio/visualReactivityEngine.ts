import { EnvelopeFollower } from './envelopeFollower';
import { type AudioBandSnapshot, readAudioBands } from './audioBands';

export type ReactivityMode = 'instant' | 'smooth' | 'hybrid' | 'manual';

export interface VisualReactivityParams {
  motionIntensity: number;
  motionSmoothing: number;
  bassBoost: number;
  frequencySmoothing: boolean;
  beatReactivityBoost: boolean;
  /**
   * Sprint 21B — user-facing routing.
   * instant: punch-first bus, smooth: cinematic bus, hybrid: curated per-layer defaults,
   * manual: user blends the non-protected layers.
   */
  reactivityMode?: ReactivityMode;
  /** Manual blend, 0 = instant / transient, 1 = smooth / cinematic. */
  reactivityBlend?: number;
}

export interface VisualReactivityUpdateInput {
  freq: Uint8Array;
  sampleRate: number;
  dt: number;
  params: VisualReactivityParams;
  beatPulse: number;
}

export interface VisualReactivityBus {
  bassSub: number;
  bassPunch: number;
  lowMid: number;
  midBody: number;
  presence: number;
  treble: number;
  full: number;
  spike: number;
  spikeEnvelope: number;
  dots: number;
  innerCore: number;
  halo: number;
  center: number;
  shockwave: number;
  coreParticles: number;
  onset: number;
  beat: number;
  lastBassPunchRaw: number;
  instantEnergy: number;
  smoothEnergy: number;
  macroModulatedEnergy: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const resolveLayerBlend = (mode: ReactivityMode, manualBlend: number, layerDefault: number) => {
  switch (mode) {
    case 'instant':
      return 0;
    case 'smooth':
      return 1;
    case 'manual':
      return clamp01(manualBlend);
    case 'hybrid':
    default:
      return clamp01(layerDefault);
  }
};


const getModeTuning = (mode: ReactivityMode) => {
  switch (mode) {
    case 'instant':
      return { attack: 0.72, release: 0.78, motion: 1.08, beat: 0.92, smoothBias: 0.82 };
    case 'smooth':
      return { attack: 1.18, release: 1.26, motion: 0.88, beat: 0.72, smoothBias: 1.18 };
    case 'manual':
      return { attack: 0.96, release: 1.04, motion: 1.0, beat: 0.86, smoothBias: 1.0 };
    case 'hybrid':
    default:
      return { attack: 0.9, release: 1.0, motion: 1.0, beat: 0.84, smoothBias: 1.0 };
  }
};

const blendBus = (instant: number, smooth: number, blend: number) => {
  const k = clamp01(blend);
  return clamp01(instant * (1 - k) + smooth * k);
};

const softRange = (value: number, drive: number) => {
  const safe = Math.max(0, Number.isFinite(value) ? value : 0);
  const shaped = safe * drive;
  // Soft saturation: stronger controls increase movement without pinning everything at 1.0.
  return clamp01(shaped / (1 + Math.max(0, shaped - 0.82) * 1.15));
};

export class VisualReactivityEngine {
  readonly bus: VisualReactivityBus = {
    bassSub: 0,
    bassPunch: 0,
    lowMid: 0,
    midBody: 0,
    presence: 0,
    treble: 0,
    full: 0,
    spike: 0,
    spikeEnvelope: 0,
    dots: 0,
    innerCore: 0,
    halo: 0,
    center: 0,
    shockwave: 0,
    coreParticles: 0,
    onset: 0,
    beat: 0,
    lastBassPunchRaw: 0,
    instantEnergy: 0,
    smoothEnergy: 0,
    macroModulatedEnergy: 0,
  };

  readonly bands = new Float32Array(8);
  private lastSnapshot: AudioBandSnapshot = {
    energy20_160: 0,
    energy20_600: 0,
    energy40_500: 0,
    energy60_150: 0,
    energy150_250: 0,
    energy500_2000: 0,
    energy600_1600: 0,
    energy1600_8000: 0,
    energy20_8000: 0,
  };

  private bassSub = new EnvelopeFollower({ attackMs: 18, releaseMs: 90 });
  private bassPunch = new EnvelopeFollower({ attackMs: 12, releaseMs: 70 });
  private lowMid = new EnvelopeFollower({ attackMs: 18, releaseMs: 90 });
  private midBody = new EnvelopeFollower({ attackMs: 22, releaseMs: 110 });
  private presence = new EnvelopeFollower({ attackMs: 16, releaseMs: 85 });
  private treble = new EnvelopeFollower({ attackMs: 26, releaseMs: 130 });
  private full = new EnvelopeFollower({ attackMs: 30, releaseMs: 150 });
  private onset = new EnvelopeFollower({ attackMs: 4, releaseMs: 48 });
  private spikeEnv = new EnvelopeFollower({ attackMs: 5, releaseMs: 54 });

  update(input: VisualReactivityUpdateInput) {
    const { freq, sampleRate, dt, params } = input;
    const snapshot = readAudioBands(freq, sampleRate);
    this.lastSnapshot = snapshot;

    const motion = clamp01(params.motionIntensity);
    const smoothing = clamp01(params.motionSmoothing);
    const bassBoost = clamp01(params.bassBoost);
    const beatPulse = clamp01(input.beatPulse);
    const reactivityMode: ReactivityMode = params.reactivityMode ?? 'hybrid';
    const reactivityBlend = clamp01(params.reactivityBlend ?? 0.45);

    // Control mapping: routing selects the response lane, Motion Smoothing shapes timing.
    // Instant mode stays snappy; Smooth mode intentionally adds longer release.
    const modeTuning = getModeTuning(reactivityMode);
    const attackScale = (params.frequencySmoothing ? 0.88 : 0.58) * modeTuning.attack;
    const releaseScale = (0.62 + smoothing * 1.45) * modeTuning.release;

    this.bassSub.setTiming(16 * attackScale, 70 * releaseScale);
    this.bassPunch.setTiming(9 * attackScale, 50 * releaseScale);
    this.lowMid.setTiming(14 * attackScale, 70 * releaseScale);
    this.midBody.setTiming(18 * attackScale, 95 * releaseScale);
    this.presence.setTiming(12 * attackScale, 72 * releaseScale);
    this.treble.setTiming(26 * attackScale, 125 * releaseScale);
    this.full.setTiming(28 * attackScale, 150 * releaseScale);
    this.onset.setTiming(3, 34 + smoothing * 60);
    this.spikeEnv.setTiming(4, 36 + smoothing * 72);

    const bassDrive = 1 + bassBoost * 1.35;
    const motionDrive = (0.9 + motion * 0.85) * modeTuning.motion;
    // Beat Boost is intentionally soft-limited in instant/hybrid modes so it does not
    // stack too aggressively with transient routing and cause jumpy motion.
    const beatDrive = params.beatReactivityBoost ? (1 + beatPulse * 0.34 * modeTuning.beat) : 1;

    const rawBassSub = softRange(snapshot.energy20_160, bassDrive * motionDrive);
    const rawBassPunch = softRange(snapshot.energy20_600, (1 + bassBoost * 1.2) * motionDrive);
    const rawLowMid = softRange(snapshot.energy150_250, (0.95 + motion * 0.75));
    const rawMidBody = softRange(snapshot.energy500_2000, (0.9 + motion * 0.62));
    const rawPresence = softRange(snapshot.energy600_1600, (0.95 + motion * 0.7));
    const rawTreble = softRange(snapshot.energy1600_8000, (0.82 + motion * 0.52));
    const rawFull = softRange(snapshot.energy20_8000, (0.88 + motion * 0.48));

    const rawOnset = clamp01(Math.max(0, rawBassPunch - this.bus.lastBassPunchRaw) * (5.2 + motion * 2.4 + bassBoost * 1.2));
    this.bus.lastBassPunchRaw = rawBassPunch;

    // Sprint 21: split the visual bus into instant/smooth lanes.
    // Spikes and beat flashes read instantEnergy/onset. Ambient layers read smoothEnergy.
    this.bus.instantEnergy = clamp01(rawBassPunch * 0.55 + rawLowMid * 0.20 + rawOnset * 0.70 + beatPulse * 0.22);
    this.bus.macroModulatedEnergy = clamp01(this.bus.instantEnergy * (0.92 + motion * 0.38));

    this.bus.bassSub = this.bassSub.update(rawBassSub, dt);
    this.bus.bassPunch = this.bassPunch.update(rawBassPunch, dt);
    this.bus.lowMid = this.lowMid.update(rawLowMid, dt);
    this.bus.midBody = this.midBody.update(rawMidBody, dt);
    this.bus.presence = this.presence.update(rawPresence, dt);
    this.bus.treble = this.treble.update(rawTreble, dt);
    this.bus.full = this.full.update(rawFull, dt);
    this.bus.onset = this.onset.update(rawOnset, dt);
    this.bus.smoothEnergy = clamp01((this.bus.full * 0.62 + this.bus.bassPunch * 0.24 + this.bus.presence * 0.14) * modeTuning.smoothBias);

    this.applyBeatPulse(beatPulse, beatDrive, reactivityMode, reactivityBlend);
    return { bus: this.bus, bands: this.bands, raw: this.lastSnapshot };
  }

  applyBeatPulse(beatPulse: number, beatDrive = 1, reactivityMode: ReactivityMode = 'hybrid', reactivityBlend = 0.45) {
    const beat = clamp01(beatPulse);
    this.bus.beat = beat;

    const spikeRaw = softRange(
      this.bus.instantEnergy * 0.82 + this.bus.lowMid * 0.24 + this.bus.presence * 0.22,
      beatDrive
    );
    this.bus.spikeEnvelope = this.spikeEnv.update(spikeRaw, 1 / 60);
    this.bus.spike = this.bus.spikeEnvelope;

    // Sprint 21B — user-controlled routing with protected defaults.
    // Spike + shockwave remain instant/transient so they stay punchy even when the user
    // chooses Smooth mode. Center graphic remains smooth-safe to prevent Macro 2 / motion
    // controls from reintroducing erratic center-layer jumps.
    const instantLane = clamp01(this.bus.instantEnergy * 0.72 + this.bus.onset * 0.54 + beat * 0.16);
    const smoothLane = clamp01(this.bus.smoothEnergy * 0.82 + this.bus.full * 0.18 + beat * 0.04);
    const dotsBlend = resolveLayerBlend(reactivityMode, reactivityBlend, 0.35);
    const coreBlend = resolveLayerBlend(reactivityMode, reactivityBlend, 0.62);
    const haloBlend = resolveLayerBlend(reactivityMode, reactivityBlend, 0.82);
    const innerCoreBlend = resolveLayerBlend(reactivityMode, reactivityBlend, 0.55);

    this.bus.dots = blendBus(
      clamp01(this.bus.bassPunch * 0.58 + this.bus.onset * 0.44 + beat * 0.16),
      clamp01(this.bus.full * 0.42 + this.bus.presence * 0.28 + beat * 0.08),
      dotsBlend
    );
    this.bus.innerCore = blendBus(
      clamp01(this.bus.bassSub * 0.66 + this.bus.bassPunch * 0.25 + beat * 0.18),
      clamp01(this.bus.smoothEnergy * 0.74 + this.bus.bassSub * 0.18 + beat * 0.06),
      innerCoreBlend
    );
    this.bus.halo = blendBus(
      clamp01(instantLane * 0.38 + this.bus.treble * 0.24 + beat * 0.08),
      clamp01(this.bus.full * 0.72 + this.bus.treble * 0.18 + beat * 0.08),
      haloBlend
    );
    this.bus.center = clamp01(smoothLane * 0.74 + this.bus.bassSub * 0.10); // protected smooth-safe bus
    this.bus.shockwave = clamp01(this.bus.onset * 0.82 + beat * 0.46); // protected instant/transient bus
    this.bus.coreParticles = blendBus(
      clamp01(instantLane * 0.52 + this.bus.presence * 0.18 + beat * 0.10),
      clamp01(this.bus.full * 0.42 + this.bus.presence * 0.28 + this.bus.treble * 0.16 + beat * 0.16),
      coreBlend
    );

    this.bands[0] = this.bus.bassSub;
    this.bands[1] = this.bus.bassPunch;
    this.bands[2] = this.bus.lowMid;
    this.bands[3] = this.bus.midBody;
    this.bands[4] = this.bus.presence;
    this.bands[5] = this.bus.treble;
    this.bands[6] = this.bus.full;
    this.bands[7] = this.bus.onset;
  }

  get raw() {
    return this.lastSnapshot;
  }
}