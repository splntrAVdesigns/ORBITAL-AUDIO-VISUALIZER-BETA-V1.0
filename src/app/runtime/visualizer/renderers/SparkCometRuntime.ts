import {
  SparkCometSpriteAtlas,
  type SparkCometSpriteTier,
} from './SparkCometSpriteAtlas';

export interface SparkCometFrame {
  dt: number;
  width: number;
  height: number;
  originRadius: number;
  emitterRadius?: number;
  emitterBand?: number;
  hue: number;
  impact: number;
  amps: number;
  trail: number;
  density: number;
  dispersion: number;
  bassEnergy?: number;
  highEnergy?: number;
  beatPulse?: number;
  frameTimeMs?: number;
}

interface SparkComet {
  active: boolean;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  drag: number;
  curve: number;
  age: number;
  lifetime: number;
  size: number;
  brightness: number;
  hero: boolean;
}

export type SparkCometQualityTier = 'full' | 'balanced' | 'critical';

export interface SparkCometDiagnostics {
  activeCount: number;
  maximumActive: number;
  emittedBursts: number;
  emittedParticles: number;
  droppedBursts: number;
  droppedParticles: number;
  deferredBursts: number;
  burstsPerSecond: number;
  particlesPerSecond: number;
  lastBurstStrength: number;
  armed: boolean;
  refractoryMs: number;
  qualityTier: SparkCometQualityTier;
  updateMs: number;
  renderMs: number;
  maximumUpdateMs: number;
  maximumRenderMs: number;
  spriteCacheEntries: number;
  centerBurstImpulse: number;
  emitterRadius: number;
  emitterBand: number;
  minimumBurstOriginRadius: number;
  maximumBurstOriginRadius: number;
  lastBurstAngularCoverage: number;
}

export interface SparkCometRenderTarget {
  save(): void;
  restore(): void;
  rotate(angle: number): void;
  translate(x: number, y: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  globalCompositeOperation: GlobalCompositeOperation;
  lineCap: CanvasLineCap;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
}

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const envelopeBlend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const QUALITY_LIMITS: Record<SparkCometQualityTier, {
  activeCap: number;
  burstCap: number;
  trailCap: number;
  allowHero: boolean;
}> = {
  full: { activeCap: 22, burstCap: 9, trailCap: 112, allowHero: true },
  balanced: { activeCap: 14, burstCap: 6, trailCap: 86, allowHero: true },
  critical: { activeCap: 8, burstCap: 3, trailCap: 62, allowHero: false },
};

/**
 * Worker-safe pooled micro-comet simulation and sprite renderer.
 * It owns no DOM, timer, listener or RAF. All particle state is bounded.
 */
export class SparkCometRuntime {
  private readonly pool: SparkComet[];
  private readonly spriteAtlas = new SparkCometSpriteAtlas();
  private readonly sectorOrder = new Uint8Array(16);
  private readonly burstAngles = new Float64Array(16);
  private seed = 0x6d2b79f5;
  private nextPoolIndex = 0;
  private activeCountValue = 0;
  private fastBass = 0;
  private slowBass = 0;
  private fastHigh = 0;
  private slowHigh = 0;
  private previousBeatPulse = 0;
  private armed = true;
  private refractorySeconds = 0;
  private burstTokens = 2;
  private queuedImpact = 0;
  private qualityTier: SparkCometQualityTier = 'full';
  private qualityPressure = 0;
  private qualityHoldSeconds = 0;
  private maximumActive = 0;
  private emittedBursts = 0;
  private emittedParticles = 0;
  private droppedBursts = 0;
  private droppedParticles = 0;
  private deferredBursts = 0;
  private lastBurstStrength = 0;
  private statsWindowSeconds = 0;
  private windowBursts = 0;
  private windowParticles = 0;
  private burstsPerSecond = 0;
  private particlesPerSecond = 0;
  private updateMs = 0;
  private renderMs = 0;
  private maximumUpdateMs = 0;
  private maximumRenderMs = 0;
  private centerBurstImpulseValue = 0;
  private emitterRadiusValue = 0;
  private emitterBandValue = 0;
  private minimumBurstOriginRadius = 0;
  private maximumBurstOriginRadius = 0;
  private lastBurstAngularCoverage = 0;

  constructor(maxParticles = 64) {
    this.pool = Array.from({ length: Math.max(8, maxParticles) }, () => ({
      active: false,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      drag: 0,
      curve: 0,
      age: 0,
      lifetime: 0.45,
      size: 1.5,
      brightness: 1,
      hero: false,
    }));
  }

  private random(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let value = this.seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  private updateQuality(frameTimeMs: number, dt: number): void {
    const observed = Number.isFinite(frameTimeMs) ? frameTimeMs : dt * 1000;
    if (observed >= 32) this.qualityPressure = Math.min(1, this.qualityPressure + dt * 3.8);
    else if (observed >= 23) this.qualityPressure = Math.min(1, this.qualityPressure + dt * 1.65);
    else this.qualityPressure = Math.max(0, this.qualityPressure - dt * 0.72);

    this.qualityHoldSeconds = Math.max(0, this.qualityHoldSeconds - dt);
    if (this.qualityHoldSeconds > 0) return;

    if (this.qualityTier === 'full' && this.qualityPressure >= 0.34) {
      this.qualityTier = 'balanced';
      this.qualityHoldSeconds = 0.55;
    } else if (this.qualityTier === 'balanced' && this.qualityPressure >= 0.72) {
      this.qualityTier = 'critical';
      this.qualityHoldSeconds = 0.70;
    } else if (this.qualityTier === 'critical' && this.qualityPressure <= 0.38) {
      this.qualityTier = 'balanced';
      this.qualityHoldSeconds = 1.0;
    } else if (this.qualityTier === 'balanced' && this.qualityPressure <= 0.10) {
      this.qualityTier = 'full';
      this.qualityHoldSeconds = 1.25;
    }
  }

  private updateRateWindow(dt: number): void {
    this.statsWindowSeconds += dt;
    if (this.statsWindowSeconds < 1) return;
    const scale = 1 / this.statsWindowSeconds;
    this.burstsPerSecond = this.windowBursts * scale;
    this.particlesPerSecond = this.windowParticles * scale;
    this.statsWindowSeconds = 0;
    this.windowBursts = 0;
    this.windowParticles = 0;
  }

  private deactivate(spark: SparkComet): void {
    if (!spark.active) return;
    spark.active = false;
    this.activeCountValue = Math.max(0, this.activeCountValue - 1);
  }

  private enforceActiveCap(): void {
    const cap = Math.min(QUALITY_LIMITS[this.qualityTier].activeCap, this.pool.length);
    while (this.activeCountValue > cap) {
      let candidate: SparkComet | null = null;
      let candidateScore = -Infinity;
      for (const spark of this.pool) {
        if (!spark.active) continue;
        const lifeProgress = spark.lifetime > 0 ? spark.age / spark.lifetime : 1;
        const score = lifeProgress + (spark.hero ? -0.35 : 0) + (1 - spark.brightness) * 0.2;
        if (score > candidateScore) {
          candidate = spark;
          candidateScore = score;
        }
      }
      if (!candidate) break;
      this.deactivate(candidate);
      this.droppedParticles += 1;
    }
  }

  private acquireSpark(): SparkComet | null {
    for (let offset = 0; offset < this.pool.length; offset += 1) {
      const index = (this.nextPoolIndex + offset) % this.pool.length;
      const candidate = this.pool[index];
      if (!candidate.active) {
        this.nextPoolIndex = (index + 1) % this.pool.length;
        return candidate;
      }
    }
    return null;
  }

  private secondsToViewportExit(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    width: number,
    height: number,
    margin: number,
  ): number {
    const left = -width * 0.5 - margin;
    const right = width * 0.5 + margin;
    const top = -height * 0.5 - margin;
    const bottom = height * 0.5 + margin;
    const candidates: number[] = [];
    if (velocityX > 0.001) candidates.push((right - x) / velocityX);
    else if (velocityX < -0.001) candidates.push((left - x) / velocityX);
    if (velocityY > 0.001) candidates.push((bottom - y) / velocityY);
    else if (velocityY < -0.001) candidates.push((top - y) / velocityY);
    const positive = candidates.filter((value) => value > 0 && Number.isFinite(value));
    return positive.length > 0 ? Math.min(...positive) : 0.5;
  }

  update(frame: SparkCometFrame): void {
    const startedAt = nowMs();
    const rawDt = Math.max(0, Math.min(frame.dt, 1 / 20));
    const simulationDt = Math.min(rawDt, 1 / 30);
    this.updateQuality(frame.frameTimeMs ?? rawDt * 1000, rawDt);
    this.enforceActiveCap();
    this.updateRateWindow(rawDt);

    const bass = clamp01(frame.bassEnergy ?? frame.impact);
    const high = clamp01(frame.highEnergy ?? frame.impact * 0.6);
    const beatPulse = clamp01(frame.beatPulse ?? 0);

    this.fastBass += (bass - this.fastBass) * envelopeBlend(34, rawDt);
    this.slowBass += (bass - this.slowBass) * envelopeBlend(4.2, rawDt);
    this.fastHigh += (high - this.fastHigh) * envelopeBlend(42, rawDt);
    this.slowHigh += (high - this.slowHigh) * envelopeBlend(5.5, rawDt);

    const bassOnset = Math.max(0, this.fastBass - this.slowBass) * 3.2;
    const highOnset = Math.max(0, this.fastHigh - this.slowHigh) * 2.7;
    const beatEdge = beatPulse >= 0.46 && this.previousBeatPulse < 0.46 ? beatPulse : 0;
    const hasBandInputs = frame.bassEnergy !== undefined || frame.highEnergy !== undefined;
    const fallbackImpact = hasBandInputs ? 0 : clamp01(frame.impact) * 0.72;
    const onset = clamp01(Math.max(bassOnset, highOnset, beatEdge, fallbackImpact));
    const attackThreshold = Math.max(0.14, 0.25 - clamp01(frame.amps) * 0.08);
    const releaseThreshold = attackThreshold * 0.34;

    this.burstTokens = Math.min(2, this.burstTokens + rawDt * 8);
    this.refractorySeconds = Math.max(0, this.refractorySeconds - rawDt);
    this.queuedImpact *= Math.exp(-4.5 * rawDt);
    this.centerBurstImpulseValue *= Math.exp(-18 * rawDt);

    const distinctBeatEdge = beatEdge >= 0.46;
    const triggerRequested = frame.amps > 0.001
      && ((this.armed && onset >= attackThreshold) || distinctBeatEdge);
    if (triggerRequested) {
      if (this.burstTokens >= 1 && this.refractorySeconds <= 0) {
        this.burstTokens -= 1;
        this.emit(onset, frame);
        this.refractorySeconds = 0.075;
      } else {
        this.queuedImpact = Math.max(this.queuedImpact, onset);
        this.deferredBursts += 1;
      }
      this.armed = false;
    } else if (!this.armed && onset <= releaseThreshold && beatPulse < 0.24) {
      this.armed = true;
    }

    if (this.queuedImpact >= attackThreshold && this.burstTokens >= 1 && this.refractorySeconds <= 0) {
      const queued = this.queuedImpact;
      this.queuedImpact = 0;
      this.burstTokens -= 1;
      this.emit(queued, frame);
      this.refractorySeconds = 0.075;
    }
    this.previousBeatPulse = beatPulse;

    const dispersion = clamp01(frame.dispersion);
    const margin = 24 + Math.max(frame.width, frame.height) * (0.018 + dispersion * 0.045);
    const left = -frame.width * 0.5 - margin;
    const right = frame.width * 0.5 + margin;
    const top = -frame.height * 0.5 - margin;
    const bottom = frame.height * 0.5 + margin;
    const steps = this.qualityTier !== 'critical' && simulationDt > 1 / 45 ? 2 : 1;
    const stepDt = steps > 0 ? simulationDt / steps : 0;

    for (const spark of this.pool) {
      if (!spark.active) continue;
      for (let step = 0; step < steps; step += 1) {
        spark.age += stepDt;
        const decay = Math.exp(-spark.drag * stepDt);
        spark.velocityX *= decay;
        spark.velocityY *= decay;
        const velocityX = spark.velocityX;
        spark.velocityX += -spark.velocityY * spark.curve * stepDt;
        spark.velocityY += velocityX * spark.curve * stepDt;
        spark.x += spark.velocityX * stepDt;
        spark.y += spark.velocityY * stepDt;
      }
      if (
        spark.age >= spark.lifetime
        || spark.x < left
        || spark.x > right
        || spark.y < top
        || spark.y > bottom
      ) {
        this.deactivate(spark);
      }
    }

    this.maximumActive = Math.max(this.maximumActive, this.activeCountValue);
    this.spriteAtlas.prepare(frame.hue);
    this.updateMs = Math.max(0, nowMs() - startedAt);
    this.maximumUpdateMs = Math.max(this.maximumUpdateMs, this.updateMs);
  }

  emit(impact: number, frame: SparkCometFrame): void {
    const limits = QUALITY_LIMITS[this.qualityTier];
    const available = Math.max(0, Math.min(limits.activeCap, this.pool.length) - this.activeCountValue);
    const dispersion = clamp01(frame.dispersion);
    const scaledDensity = clamp01(Number.isFinite(frame.density) ? frame.density : 0.5);
    const requested = Math.max(2, Math.round(1.5 + impact * 4.6 + scaledDensity * 2.2));
    const count = Math.min(requested, limits.burstCap, available);
    if (count <= 0) {
      this.droppedBursts += 1;
      this.droppedParticles += requested;
      return;
    }
    if (count < requested) this.droppedParticles += requested - count;

    const emitterRadius = Math.max(2, Number.isFinite(frame.emitterRadius)
      ? frame.emitterRadius as number
      : frame.originRadius * 0.28);
    const emitterBand = Math.max(1, Number.isFinite(frame.emitterBand)
      ? frame.emitterBand as number
      : emitterRadius * 0.16);
    const minimumOrigin = Math.max(2, emitterRadius - emitterBand * 0.5);
    const maximumOrigin = Math.max(minimumOrigin + 1, emitterRadius + emitterBand * 0.5);
    this.emitterRadiusValue = emitterRadius;
    this.emitterBandValue = emitterBand;
    this.minimumBurstOriginRadius = Number.POSITIVE_INFINITY;
    this.maximumBurstOriginRadius = 0;

    // Stratified random sectors provide broad 360-degree coverage without a
    // mirrored or machine-perfect sunburst. The burst-level offset ensures the
    // available sectors rotate between hits instead of repeating visibly.
    for (let index = 0; index < count; index += 1) this.sectorOrder[index] = index;
    for (let index = count - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      const temp = this.sectorOrder[index];
      this.sectorOrder[index] = this.sectorOrder[swapIndex];
      this.sectorOrder[swapIndex] = temp;
    }
    const burstOffset = this.random() * TAU;
    const viewportMargin = 20 + Math.max(frame.width, frame.height) * 0.035;
    let emittedThisBurst = 0;

    for (let index = 0; index < count; index += 1) {
      const spark = this.acquireSpark();
      if (!spark) break;
      const hero = limits.allowHero && impact > 0.72 && this.random() < 0.10 + impact * 0.08;
      const sector = this.sectorOrder[index];
      const sectorJitter = 0.22 + this.random() * 0.56;
      const originAngle = burstOffset + ((sector + sectorJitter) / count) * TAU;
      const originDistance = minimumOrigin + this.random() * (maximumOrigin - minimumOrigin);
      this.burstAngles[emittedThisBurst] = ((originAngle % TAU) + TAU) % TAU;
      this.minimumBurstOriginRadius = Math.min(this.minimumBurstOriginRadius, originDistance);
      this.maximumBurstOriginRadius = Math.max(this.maximumBurstOriginRadius, originDistance);
      const x = Math.cos(originAngle) * originDistance;
      const y = Math.sin(originAngle) * originDistance;
      const radialAngle = originAngle;
      const directionalJitter = (this.random() - 0.5) * (0.18 + dispersion * 0.72);
      const launchAngle = radialAngle + directionalJitter;
      const tangentSign = this.random() < 0.5 ? -1 : 1;
      const baseSpeed = 470 + frame.amps * 720 + impact * 580;
      const speed = baseSpeed
        * (0.82 + this.random() * 0.56)
        * (1 + dispersion * 0.76)
        * (hero ? 1.18 : 1);
      const tangential = speed * dispersion * (0.06 + this.random() * 0.31) * tangentSign;
      const radialX = Math.cos(launchAngle) * speed;
      const radialY = Math.sin(launchAngle) * speed;
      const velocityX = radialX - Math.sin(launchAngle) * tangential;
      const velocityY = radialY + Math.cos(launchAngle) * tangential;
      const naturalLifetime = 0.20 + dispersion * 0.38 + this.random() * (0.10 + dispersion * 0.12) + (hero ? 0.10 : 0);
      const exitSeconds = this.secondsToViewportExit(
        x,
        y,
        velocityX,
        velocityY,
        frame.width,
        frame.height,
        viewportMargin,
      );
      const offscreenLifetime = Math.min(0.92, Math.max(0.26, exitSeconds + 0.08));
      const lifetime = naturalLifetime + (offscreenLifetime - naturalLifetime) * Math.pow(dispersion, 1.45);

      spark.active = true;
      spark.x = x;
      spark.y = y;
      spark.velocityX = velocityX;
      spark.velocityY = velocityY;
      spark.drag = 1.26 - dispersion * 0.74 + this.random() * 0.26;
      spark.curve = (this.random() - 0.5) * (0.18 + dispersion * 0.62) * (hero ? 1.08 : 1);
      spark.age = 0;
      spark.lifetime = Math.max(0.20, lifetime);
      spark.size = (hero ? 1.72 : 0.90) + this.random() * (hero ? 1.08 : 0.72);
      spark.brightness = 0.78 + this.random() * 0.22;
      spark.hero = hero;
      this.activeCountValue += 1;
      emittedThisBurst += 1;
    }

    if (emittedThisBurst > 0) {
      if (emittedThisBurst > 1) {
        // In-place insertion sort on the reusable typed array keeps burst
        // diagnostics allocation-free.
        for (let index = 1; index < emittedThisBurst; index += 1) {
          const value = this.burstAngles[index];
          let cursor = index - 1;
          while (cursor >= 0 && this.burstAngles[cursor] > value) {
            this.burstAngles[cursor + 1] = this.burstAngles[cursor];
            cursor -= 1;
          }
          this.burstAngles[cursor + 1] = value;
        }
        let maximumGap = 0;
        for (let index = 0; index < emittedThisBurst; index += 1) {
          const current = this.burstAngles[index];
          const next = index === emittedThisBurst - 1 ? this.burstAngles[0] + TAU : this.burstAngles[index + 1];
          maximumGap = Math.max(maximumGap, next - current);
        }
        this.lastBurstAngularCoverage = TAU - maximumGap;
      } else {
        this.lastBurstAngularCoverage = 0;
      }
      this.centerBurstImpulseValue = Math.max(this.centerBurstImpulseValue, impact);
      this.emittedBursts += 1;
      this.emittedParticles += emittedThisBurst;
      this.windowBursts += 1;
      this.windowParticles += emittedThisBurst;
      this.lastBurstStrength = impact;
      this.maximumActive = Math.max(this.maximumActive, this.activeCountValue);
    } else {
      this.droppedBursts += 1;
    }
  }

  private renderFallbackComet(
    ctx: SparkCometRenderTarget,
    spark: SparkComet,
    alpha: number,
    trailLength: number,
    hue: number,
  ): void {
    const speed = Math.hypot(spark.velocityX, spark.velocityY);
    const directionX = speed > 0.001 ? spark.velocityX / speed : 1;
    const directionY = speed > 0.001 ? spark.velocityY / speed : 0;
    ctx.strokeStyle = `hsla(${hue},100%,78%,${Math.min(1, alpha * 0.78)})`;
    ctx.lineWidth = Math.max(0.8, spark.size * 0.82);
    ctx.beginPath();
    ctx.moveTo(spark.x - directionX * trailLength, spark.y - directionY * trailLength);
    ctx.lineTo(spark.x, spark.y);
    ctx.stroke();
    ctx.fillStyle = `hsla(${hue},100%,96%,${alpha})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, Math.max(1, spark.size * 0.86), 0, TAU);
    ctx.fill();
  }

  render(ctx: SparkCometRenderTarget, frame: SparkCometFrame, parentAngle = 0): void {
    const startedAt = nowMs();
    if (this.activeCountValue <= 0) {
      this.renderMs = 0;
      return;
    }

    const limits = QUALITY_LIMITS[this.qualityTier];
    const trailControl = clamp01(frame.trail);
    ctx.save();
    ctx.rotate(-parentAngle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const spark of this.pool) {
      if (!spark.active) continue;
      const life = clamp01(1 - spark.age / spark.lifetime);
      const easedLife = life * life * (3 - 2 * life);
      const alpha = easedLife * spark.brightness;
      const speed = Math.hypot(spark.velocityX, spark.velocityY);
      const trailLength = Math.min(
        limits.trailCap,
        (22 + trailControl * 58) * (0.76 + Math.min(0.52, speed / 2200)) * (spark.hero ? 1.16 : 1),
      );
      const spriteTier: SparkCometSpriteTier = this.qualityTier === 'critical'
        ? 'small'
        : spark.hero
          ? 'hero'
          : spark.size >= 1.35
            ? 'medium'
            : 'small';
      const sprite = this.spriteAtlas.get(frame.hue, spriteTier);

      if (sprite) {
        const angle = Math.atan2(spark.velocityY, spark.velocityX);
        const heightScale = this.qualityTier === 'critical' ? 0.72 : this.qualityTier === 'balanced' ? 0.86 : 1;
        const targetHeight = Math.max(7, sprite.height * (0.42 + spark.size * 0.20) * heightScale);
        const targetWidth = Math.max(24, trailLength + targetHeight * 0.42);
        ctx.save();
        ctx.translate(spark.x, spark.y);
        ctx.rotate(angle);
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          sprite.image,
          -targetWidth * sprite.headRatio,
          -targetHeight * 0.5,
          targetWidth,
          targetHeight,
        );
        ctx.restore();
      } else {
        this.renderFallbackComet(ctx, spark, alpha, trailLength, frame.hue);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
    this.renderMs = Math.max(0, nowMs() - startedAt);
    this.maximumRenderMs = Math.max(this.maximumRenderMs, this.renderMs);
  }

  reset(): void {
    for (const spark of this.pool) spark.active = false;
    this.activeCountValue = 0;
    this.fastBass = 0;
    this.slowBass = 0;
    this.fastHigh = 0;
    this.slowHigh = 0;
    this.previousBeatPulse = 0;
    this.armed = true;
    this.refractorySeconds = 0;
    this.queuedImpact = 0;
    this.burstTokens = 2;
    this.centerBurstImpulseValue = 0;
  }

  dispose(): void {
    this.reset();
    this.spriteAtlas.dispose();
    this.maximumActive = 0;
    this.emittedBursts = 0;
    this.emittedParticles = 0;
    this.droppedBursts = 0;
    this.droppedParticles = 0;
    this.deferredBursts = 0;
    this.lastBurstStrength = 0;
    this.burstsPerSecond = 0;
    this.particlesPerSecond = 0;
    this.updateMs = 0;
    this.renderMs = 0;
    this.maximumUpdateMs = 0;
    this.maximumRenderMs = 0;
    this.centerBurstImpulseValue = 0;
    this.emitterRadiusValue = 0;
    this.emitterBandValue = 0;
    this.minimumBurstOriginRadius = 0;
    this.maximumBurstOriginRadius = 0;
    this.lastBurstAngularCoverage = 0;
  }

  get centerBurstImpulse(): number {
    return this.centerBurstImpulseValue;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  get diagnostics(): SparkCometDiagnostics {
    return {
      activeCount: this.activeCountValue,
      maximumActive: this.maximumActive,
      emittedBursts: this.emittedBursts,
      emittedParticles: this.emittedParticles,
      droppedBursts: this.droppedBursts,
      droppedParticles: this.droppedParticles,
      deferredBursts: this.deferredBursts,
      burstsPerSecond: this.burstsPerSecond,
      particlesPerSecond: this.particlesPerSecond,
      lastBurstStrength: this.lastBurstStrength,
      armed: this.armed,
      refractoryMs: this.refractorySeconds * 1000,
      qualityTier: this.qualityTier,
      updateMs: this.updateMs,
      renderMs: this.renderMs,
      maximumUpdateMs: this.maximumUpdateMs,
      maximumRenderMs: this.maximumRenderMs,
      spriteCacheEntries: this.spriteAtlas.entries,
      centerBurstImpulse: this.centerBurstImpulseValue,
      emitterRadius: this.emitterRadiusValue,
      emitterBand: this.emitterBandValue,
      minimumBurstOriginRadius: Number.isFinite(this.minimumBurstOriginRadius) ? this.minimumBurstOriginRadius : 0,
      maximumBurstOriginRadius: this.maximumBurstOriginRadius,
      lastBurstAngularCoverage: this.lastBurstAngularCoverage,
    };
  }
}