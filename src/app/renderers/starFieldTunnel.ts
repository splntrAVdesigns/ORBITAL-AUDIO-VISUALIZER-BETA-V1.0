/**
 * Star Field Tunnel — full-canvas warp-tunnel background (Sprint H).
 *
 * Ported from a supplied Canvas2D "Star Field" sketch. The star physics
 * (perspective projection toward a focal depth, streak trails, glitter
 * flashes) is carried over closely. What changed for ORBITAL:
 *
 *  - Background pass, not an overlay: drawn right after the clear pass, so
 *    the spike ring, halo, dots and logo read as floating inside the tunnel.
 *  - Fixed-size offscreen buffer (long side capped at BUFFER_MAX_SIDE) that
 *    is upscaled with one drawImage. The trail erase (destination-out
 *    fillRect) is bandwidth-bound, so running it at buffer resolution instead
 *    of full display resolution keeps its cost flat on large/HiDPI screens.
 *  - Zero per-frame allocation: stars live in pre-allocated typed arrays and
 *    color strings are cached, rebuilt only when the palette hue moves.
 *  - Adaptive star budget: active star count scales with the frame pacing
 *    runtime's qualityScale, the same budget other heavy layers already use.
 *  - Palette-driven colors from the active hue instead of 3 fixed pickers.
 *  - Audio reactive: bass drives speed surges, mids flex turbulence, beats
 *    trigger glitter and brightness pulses (Beat Sync gates the beat parts).
 *  - Two-tier motion timing (normalizeMotionDelta), matching all other motion.
 */
import { normalizeMotionDelta } from '../utils/runtimeClock';

const BUFFER_MAX_SIDE = 960;
export const STAR_FIELD_MAX_STARS = 900;

export type StarFieldBlendMode = 'screen' | 'lighter' | 'source-over';

export interface StarFieldParams {
  starFieldCount: number;       // 150-900
  starFieldSpeed: number;       // 0.5-15
  starFieldSpread: number;      // 10-150
  starFieldSize: number;        // 0-20
  starFieldFocalDepth: number;  // 1-30 (%)
  starFieldTurbulence: number;  // 0-10
  starFieldGlitter: number;     // 0-10
  starFieldTrail: number;       // 0-100 (%)
  starFieldReverse: boolean;
  starFieldBlendMode: StarFieldBlendMode | string;
  starFieldBeatSync: boolean;
}

export interface StarFieldAudio {
  energy: number;       // 0-1
  bass: number;         // 0-1
  mid: number;          // 0-1
  beatPulse: number;    // 0-1
}

export interface StarFieldFrame {
  timeMs: number;
  cssWidth: number;
  cssHeight: number;
  hue: number;              // palette hue, degrees
  intensity: number;        // Effect Amount, 0-1 (brightness dial)
  qualityScale: number;     // 0.5-1 from frame pacing
  params: StarFieldParams;
  audio: StarFieldAudio;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class StarFieldTunnel {
  private buffer: HTMLCanvasElement | OffscreenCanvas | null = null;
  private bctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private bw = 0;
  private bh = 0;

  // Struct-of-arrays star storage: fixed capacity, never reallocated.
  private readonly x = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly y = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly z = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly px = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly py = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly seed = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly vmul = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly colorIdx = new Uint8Array(STAR_FIELD_MAX_STARS);
  private readonly flashUntil = new Float32Array(STAR_FIELD_MAX_STARS);
  private readonly nextFlash = new Float32Array(STAR_FIELD_MAX_STARS);
  private initialized = 0; // how many slots have been seeded at least once

  private elapsed = 0;
  private lastTimeMs = -1;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothBeat = 0;
  private prevBeat = 0;
  private smoothHue = -1;
  private cachedHueKey = -999;
  private readonly colorStrs: string[] = ['#fff', '#fff', '#fff'];
  private wasActive = false;

  private ensureBuffer(cssW: number, cssH: number): boolean {
    if (cssW <= 0 || cssH <= 0) return false;
    const scale = Math.min(1, BUFFER_MAX_SIDE / Math.max(cssW, cssH));
    const w = Math.max(64, Math.round(cssW * scale));
    const h = Math.max(64, Math.round(cssH * scale));
    if (this.buffer && this.bw === w && this.bh === h) return true;
    if (!this.buffer) {
      this.buffer = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      if (!this.buffer) return false;
    }
    this.buffer.width = w;
    this.buffer.height = h;
    this.bctx = this.buffer.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    this.bw = w;
    this.bh = h;
    // A resize clears the buffer; previous-position trails are no longer valid.
    this.px.fill(NaN);
    this.py.fill(NaN);
    return Boolean(this.bctx);
  }

  private resetStar(i: number, initial: boolean, p: StarFieldParams, focal: number, glitter: number): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = (0.2 + Math.random() * 0.8) * (p.starFieldSpread / 15);
    this.x[i] = Math.cos(angle) * radius;
    this.y[i] = Math.sin(angle) * radius;
    if (p.starFieldReverse) {
      this.z[i] = initial ? focal + Math.random() * (1 - focal) : focal;
    } else {
      this.z[i] = initial ? Math.random() : 1.0;
    }
    this.px[i] = NaN;
    this.py[i] = NaN;
    this.seed[i] = Math.random() * 1000;
    this.vmul[i] = 0.6 + Math.random() * 0.8;
    this.colorIdx[i] = Math.floor(Math.random() * 3);
    this.flashUntil[i] = 0;
    this.nextFlash[i] = this.elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
  }

  private refreshColors(hue: number): void {
    // Rebuild the 3 color strings only when the smoothed hue moves >= 1 degree.
    const key = Math.round(hue);
    if (key === this.cachedHueKey) return;
    this.cachedHueKey = key;
    const h = ((key % 360) + 360) % 360;
    this.colorStrs[0] = `hsl(${h}, 95%, 70%)`;
    this.colorStrs[1] = `hsl(${(h + 40) % 360}, 90%, 62%)`;
    this.colorStrs[2] = `hsl(${h}, 30%, 96%)`; // near-white core stars
  }

  /** Clears state so re-enabling starts a fresh tunnel instead of a stale frame. */
  reset(): void {
    this.initialized = 0;
    this.elapsed = 0;
    this.lastTimeMs = -1;
    this.smoothBass = this.smoothMid = this.smoothBeat = this.prevBeat = 0;
    this.smoothHue = -1;
    if (this.bctx && this.bw > 0) this.bctx.clearRect(0, 0, this.bw, this.bh);
  }

  /** Releases the offscreen buffer (called on session dispose). */
  dispose(): void {
    if (this.buffer) {
      this.buffer.width = 1;
      this.buffer.height = 1;
    }
    this.buffer = null;
    this.bctx = null;
    this.bw = this.bh = 0;
    this.initialized = 0;
  }

  /**
   * Advance and draw the tunnel into its buffer, then blit to `ctx` as a
   * background. `ctx` is expected in CSS-pixel space (post clear pass).
   */
  render(ctx: CanvasRenderingContext2D, frame: StarFieldFrame): void {
    if (!this.wasActive) {
      this.reset();
      this.wasActive = true;
    }
    if (!this.ensureBuffer(frame.cssWidth, frame.cssHeight) || !this.bctx || !this.buffer) return;
    const b = this.bctx;
    const p = frame.params;

    // Timing
    const rawDt = this.lastTimeMs < 0 ? 1 / 60 : (frame.timeMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = frame.timeMs;
    const dtSec = normalizeMotionDelta(rawDt) || 1 / 60;
    const dt = dtSec * 60; // frame-normalized units, as in the original sketch
    this.elapsed += dtSec;

    // Audio smoothing (attack fast, release slower)
    const a = frame.audio;
    const bassT = clamp01(a.bass);
    const midT = clamp01(a.mid);
    this.smoothBass += (bassT - this.smoothBass) * Math.min(1, dtSec * (bassT > this.smoothBass ? 14 : 5));
    this.smoothMid += (midT - this.smoothMid) * Math.min(1, dtSec * 6);
    const beatTarget = p.starFieldBeatSync ? clamp01(a.beatPulse) : 0;
    this.smoothBeat += (beatTarget - this.smoothBeat) * Math.min(1, dtSec * (beatTarget > this.smoothBeat ? 22 : 7));
    const beatEdge = p.starFieldBeatSync && a.beatPulse > 0.55 && this.prevBeat <= 0.55;
    this.prevBeat = a.beatPulse;

    // Palette hue, smoothed so energy-driven hue jitter doesn't strobe stars.
    if (this.smoothHue < 0) this.smoothHue = frame.hue;
    else {
      let d = frame.hue - this.smoothHue;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      this.smoothHue = (this.smoothHue + d * Math.min(1, dtSec * 3) + 360) % 360;
    }
    this.refreshColors(this.smoothHue);

    // Effective config (audio layered on top of the manual base values)
    const focal = Math.max(0.01, p.starFieldFocalDepth / 100);
    const glitter = Math.max(0, p.starFieldGlitter) * 0.1;
    const speedMul = 1 + this.smoothBass * 1.4 + this.smoothBeat * 0.35;
    const stepZ = Math.max(0, p.starFieldSpeed) * 0.0008 * speedMul;
    const turbulence = (Math.max(0, p.starFieldTurbulence) + this.smoothMid * 3) * 0.2;
    const starScale = Math.max(0, p.starFieldSize) * 0.15 * (1 + this.smoothBeat * 0.25);
    const brightness = clamp01(frame.intensity) * (0.85 + this.smoothBeat * 0.3);
    const trail = clamp01(p.starFieldTrail / 100);
    const reverse = Boolean(p.starFieldReverse);

    // Adaptive star budget from frame pacing quality.
    const quality = Math.max(0.5, Math.min(1, frame.qualityScale || 1));
    const count = Math.max(50, Math.min(STAR_FIELD_MAX_STARS, Math.round(p.starFieldCount * quality)));
    while (this.initialized < count) {
      this.resetStar(this.initialized, true, p, focal, glitter);
      this.initialized++;
    }

    // Trail fade, at buffer resolution.
    const w = this.bw, h = this.bh;
    const keep = Math.pow(Math.min(0.98, trail), dt);
    const trailAlpha = Math.max(0.02, 1 - keep);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'destination-out';
    b.fillStyle = `rgba(0,0,0,${trailAlpha.toFixed(3)})`;
    b.fillRect(0, 0, w, h);

    const blend = (p.starFieldBlendMode === 'screen' || p.starFieldBlendMode === 'source-over')
      ? p.starFieldBlendMode
      : 'lighter';
    b.globalCompositeOperation = blend as GlobalCompositeOperation;

    const cx = w / 2, cy = h / 2;
    const projScale = Math.min(w, h) * 0.9;
    const maxR = 1 + starScale * 2.5;
    const flashBoost = 1 + 2.5 * glitter;

    for (let i = 0; i < count; i++) {
      const vz = stepZ * this.vmul[i] * dt;
      if (reverse) {
        this.z[i] += vz;
        if (this.z[i] >= 1.0) { this.resetStar(i, false, p, focal, glitter); continue; }
      } else {
        this.z[i] -= vz;
        if (this.z[i] <= focal) { this.resetStar(i, false, p, focal, glitter); continue; }
      }

      const zi = this.z[i];
      let tx = this.x[i], ty = this.y[i];
      if (turbulence > 0) {
        const t = this.elapsed * 1.2 + this.seed[i];
        const amp = turbulence * (1 - zi) * 0.25;
        tx += Math.sin(t + this.seed[i]) * amp;
        ty += Math.cos(t * 1.13 + this.seed[i] * 0.7) * amp;
      }

      const persp = focal / Math.max(zi, 0.0001);
      const sx = cx + tx * persp * projScale;
      const sy = cy + ty * persp * projScale;

      if (!reverse && (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20)) {
        this.resetStar(i, false, p, focal, glitter);
        continue;
      }

      // Glitter: beat-triggered when Beat Sync is on (a random ~18% of stars
      // flash on each detected beat), otherwise the original random timers.
      let flashMult = 1;
      if (glitter > 0) {
        if (p.starFieldBeatSync) {
          if (beatEdge && Math.random() < 0.18 * Math.min(1, glitter * 1.5)) {
            this.flashUntil[i] = this.elapsed + 0.05 + Math.random() * 0.07;
          }
        } else if (this.elapsed >= this.nextFlash[i] && this.flashUntil[i] < this.elapsed) {
          this.flashUntil[i] = this.elapsed + 0.04 + Math.random() * 0.07;
          this.nextFlash[i] = this.elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
        }
        if (this.elapsed <= this.flashUntil[i]) flashMult = flashBoost;
      }

      const sizePersp = Math.min(2.5, persp * 0.6);
      const baseR = Math.max(0.25, starScale * (0.4 + sizePersp));
      const r = Math.min(baseR * flashMult, maxR);

      const lifeT = reverse ? zi : 1 - zi;
      const fadeIn = reverse ? Math.min(1, (zi - focal) / (1 - focal) / 0.12) : 1;
      const alpha = Math.min(1, reverse ? 0.85 - lifeT * 0.6 : lifeT * 0.9 + 0.05)
        * fadeIn * brightness * (flashMult > 1 ? 1 : 0.85);
      if (alpha <= 0.004) { this.px[i] = sx; this.py[i] = sy; continue; }

      const col = this.colorStrs[this.colorIdx[i]];
      const ppx = this.px[i], ppy = this.py[i];
      if (ppx === ppx && ppy === ppy) { // not NaN
        b.globalAlpha = alpha * 0.5;
        b.strokeStyle = col;
        b.lineWidth = Math.max(0.4, r * 0.4);
        b.beginPath();
        b.moveTo(ppx, ppy);
        b.lineTo(sx, sy);
        b.stroke();
      }

      b.globalAlpha = alpha;
      b.fillStyle = col;
      b.fillRect(sx - r, sy - r, r * 2, r * 2);

      if (flashMult > 1) {
        const rf = Math.min(r * 1.4, maxR * 1.4);
        b.globalAlpha = alpha * 0.5;
        b.fillRect(sx - rf, sy - rf, rf * 2, rf * 2);
      }

      this.px[i] = sx;
      this.py[i] = sy;
    }

    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';

    // Blit the buffer as the background layer (canvas is black after clear).
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.buffer as CanvasImageSource, 0, 0, frame.cssWidth, frame.cssHeight);
    ctx.restore();
  }

  /** Call when the effect is not active this frame so the next enable starts fresh. */
  markInactive(): void {
    this.wasActive = false;
  }
}
