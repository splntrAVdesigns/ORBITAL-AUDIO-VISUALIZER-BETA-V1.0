export type SparkCometSpriteTier = 'small' | 'medium' | 'hero';

export interface SparkCometSprite {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly headRatio: number;
}

interface SparkCometSpriteSet {
  readonly small: SparkCometSprite;
  readonly medium: SparkCometSprite;
  readonly hero: SparkCometSprite;
}

const HUE_BUCKET_SIZE = 45;
const TAU = Math.PI * 2;

const normalizeHue = (hue: number): number => {
  const wrapped = Number.isFinite(hue) ? hue % 360 : 0;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

const getHueBucket = (hue: number): number => (
  Math.round(normalizeHue(hue) / HUE_BUCKET_SIZE) * HUE_BUCKET_SIZE
) % 360;

function createSprite(
  hue: number,
  width: number,
  height: number,
  headRadius: number,
): SparkCometSprite | null {
  if (typeof OffscreenCanvas === 'undefined') return null;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const centerY = height * 0.5;
  const headX = width - Math.max(5, headRadius * 2.4);
  const tailStartX = Math.max(2, height * 0.18);

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';

  // These gradients are created once per cached hue/tier, never per particle/frame.
  const glowGradient = ctx.createLinearGradient(tailStartX, 0, headX, 0);
  glowGradient.addColorStop(0, `hsla(${hue},100%,68%,0)`);
  glowGradient.addColorStop(0.30, `hsla(${hue},100%,68%,0.08)`);
  glowGradient.addColorStop(0.72, `hsla(${hue},100%,72%,0.42)`);
  glowGradient.addColorStop(1, `hsla(${hue},100%,82%,0.95)`);

  ctx.strokeStyle = glowGradient;
  ctx.lineWidth = Math.max(4, height * 0.42);
  ctx.shadowColor = `hsla(${hue},100%,72%,0.95)`;
  ctx.shadowBlur = Math.max(5, height * 0.30);
  ctx.beginPath();
  ctx.moveTo(tailStartX, centerY);
  ctx.lineTo(headX, centerY);
  ctx.stroke();

  const coreGradient = ctx.createLinearGradient(tailStartX, 0, headX, 0);
  coreGradient.addColorStop(0, 'rgba(255,255,255,0)');
  coreGradient.addColorStop(0.56, 'rgba(255,255,255,0.10)');
  coreGradient.addColorStop(0.88, 'rgba(255,255,255,0.70)');
  coreGradient.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.shadowBlur = Math.max(2, height * 0.12);
  ctx.strokeStyle = coreGradient;
  ctx.lineWidth = Math.max(1, height * 0.105);
  ctx.beginPath();
  ctx.moveTo(tailStartX + width * 0.18, centerY);
  ctx.lineTo(headX, centerY);
  ctx.stroke();

  const headGlow = ctx.createRadialGradient(headX, centerY, 0, headX, centerY, headRadius * 2.4);
  headGlow.addColorStop(0, 'rgba(255,255,255,1)');
  headGlow.addColorStop(0.28, `hsla(${hue},100%,88%,1)`);
  headGlow.addColorStop(0.62, `hsla(${hue},100%,68%,0.55)`);
  headGlow.addColorStop(1, `hsla(${hue},100%,62%,0)`);
  ctx.shadowBlur = 0;
  ctx.fillStyle = headGlow;
  ctx.beginPath();
  ctx.arc(headX, centerY, headRadius * 2.4, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.beginPath();
  ctx.arc(headX, centerY, Math.max(0.8, headRadius * 0.55), 0, TAU);
  ctx.fill();

  return {
    image: canvas,
    width,
    height,
    headRatio: headX / width,
  };
}

/**
 * Worker-safe, bounded sprite cache. Eight 45° hue buckets keep palette changes
 * smooth without regenerating sprites every frame during color cycling.
 */
export class SparkCometSpriteAtlas {
  private readonly cache = new Map<number, SparkCometSpriteSet>();
  private unavailable = false;

  prepare(hue: number): SparkCometSpriteSet | null {
    if (this.unavailable) return null;
    const bucket = getHueBucket(hue);
    const cached = this.cache.get(bucket);
    if (cached) return cached;

    const small = createSprite(bucket, 72, 18, 2.2);
    const medium = createSprite(bucket, 112, 28, 3.4);
    const hero = createSprite(bucket, 168, 42, 5.2);
    if (!small || !medium || !hero) {
      this.unavailable = true;
      return null;
    }

    const set = { small, medium, hero } as const;
    this.cache.set(bucket, set);
    return set;
  }

  get(hue: number, tier: SparkCometSpriteTier): SparkCometSprite | null {
    return this.prepare(hue)?.[tier] ?? null;
  }

  get entries(): number {
    return this.cache.size;
  }

  dispose(): void {
    for (const set of this.cache.values()) {
      for (const sprite of [set.small, set.medium, set.hero]) {
        if (typeof OffscreenCanvas !== 'undefined' && sprite.image instanceof OffscreenCanvas) {
          sprite.image.width = 1;
          sprite.image.height = 1;
        }
      }
    }
    this.cache.clear();
  }
}
