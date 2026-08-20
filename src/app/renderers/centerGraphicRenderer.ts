import { computeCenterGraphicMotion, advanceCenterGraphicTransition } from '../utils/centerGraphicEngine';
import { CenterMotionRuntime } from '../utils/centerMotionEngine';
import { getCenterGraphicFilter } from '../utils/centerFilterPipeline';
import { drawCenterGraphicWithColorStyle } from '../utils/centerColorStyleEngine';
import { updateAngleTween, easeOutCubic } from '../utils/easing';
import { clamp } from '../utils/audioVisualizationHelpers';

export interface CenterGraphicRenderState {
  offscreenRed: HTMLCanvasElement | null;
  ctxRed: CanvasRenderingContext2D | null;
  offscreenCyan: HTMLCanvasElement | null;
  ctxCyan: CanvasRenderingContext2D | null;
  lastOffscreenSize: number;
  kaleidoRGBTempCanvas: HTMLCanvasElement | null;
  kaleidoRGBTempCtx: CanvasRenderingContext2D | null;
  kaleidoRGBTempW: number;
  kaleidoRGBTempH: number;
  filterCache: Map<string, string>;
  MAX_FILTER_CACHE_SIZE: number;
  glitchSeed: number;
  motionRuntime: CenterMotionRuntime;
}

export interface CenterGraphicEnergyState {
  audioEverStarted: boolean;
  audioStartTime: number;
  lastEnergy: number;
}

export function createCenterGraphicRenderState(): CenterGraphicRenderState {
  return {
    offscreenRed: null,
    ctxRed: null,
    offscreenCyan: null,
    ctxCyan: null,
    lastOffscreenSize: 0,
    kaleidoRGBTempCanvas: null,
    kaleidoRGBTempCtx: null,
    kaleidoRGBTempW: 0,
    kaleidoRGBTempH: 0,
    filterCache: new Map<string, string>(),
    MAX_FILTER_CACHE_SIZE: 100,
    glitchSeed: 0,
    motionRuntime: new CenterMotionRuntime(),
  };
}

export function renderCenterGraphicLayer(args: any): CenterGraphicEnergyState {
  const {
    canvas,
    params,
    centerGraphicController,
    centerImageRotationHomeTween,
    cachedCycleSpeedEl,
    mediaEl,
    usingMic,
    DEBUG_FLAGS,
    cx,
    cy,
    W,
    H,
    r0,
    zoomCenter,
    t,
    dt,
    energy40_500,
    energy500_2000,
    energy1600_8000,
    energy600_1600,
    energy20_600,
    energy20_160,
    energy60_150,
    energy150_250,
    energy20_8000,
    hueFromPalette,
    renderState,
  } = args;

  let ctx = args.ctx as CanvasRenderingContext2D;
  let { audioEverStarted, audioStartTime, lastEnergy } = args.energyState as CenterGraphicEnergyState;
  let {
    offscreenRed,
    ctxRed,
    offscreenCyan,
    ctxCyan,
    lastOffscreenSize,
    kaleidoRGBTempCanvas,
    kaleidoRGBTempCtx,
    kaleidoRGBTempW,
    kaleidoRGBTempH,
    glitchSeed,
  } = renderState as CenterGraphicRenderState;
  const filterCache = (renderState as CenterGraphicRenderState).filterCache;
  const MAX_FILTER_CACHE_SIZE = (renderState as CenterGraphicRenderState).MAX_FILTER_CACHE_SIZE;

// Render center image FIRST (before rotation) to keep it level
// Disabled when Liquid Shaper OR Core Particles is enabled
const currentImage = centerGraphicController.activeImage;
const centerImageElement = currentImage?.element;
const centerImageLoaded = currentImage?.loaded || false;

if (centerImageElement && centerImageLoaded && !centerGraphicController.hidden && !params.astralShaper && !params.shapeOscillate) {
  ctx.save();
  ctx.translate(cx, cy); // Only translate, NO global rotation
  
  // PHASE 5: Eclipse Glow Effect (Realistic Solar Eclipse Backlit Glow)
  // Apply individual center image zoom for subtle variation
  const centerSize = (r0 * zoomCenter) * 0.85; // Circular frame size with independent zoom
  
  // SYNC WITH RINGS: Calculate shared color for both Eclipse and Gamma Blast
  // This ensures both effects use same color system (Auto Cycle, Color Mode, BPM, etc.)
  const rawEnergyEclipse = (energy40_500 * 0.9 + energy500_2000 + energy1600_8000 * 0.6) / 2.5;
  // 🔥 FIX: Iridize removed from hasActiveEffectsEclipse to prevent color breathing coupling
  const hasActiveEffectsEclipse = params.gamma > 0.01 || params.chaos > 0.01;
  const smoothstepEclipse = (x: number) => x * x * (3 - 2 * x);
  const hasAudioPlayingEclipse = (mediaEl && !mediaEl.paused) || usingMic;
  let energyEclipse: number;
  
  if (hasAudioPlayingEclipse) {
    const calculatedEnergy = hasActiveEffectsEclipse ? smoothstepEclipse(smoothstepEclipse(rawEnergyEclipse)) : rawEnergyEclipse * 0.5;
    const hasValidAudioData = rawEnergyEclipse > 0.01;
    
    if (!audioEverStarted && hasValidAudioData) {
      audioEverStarted = true;
      audioStartTime = t;
    }
    
    if (!audioEverStarted || !hasValidAudioData) {
      energyEclipse = 1.0;
    } else {
      const timeSinceStart = (t - audioStartTime) / 1000;
      // 🔧 FIX AUDIO DELAY 4: Transition 800ms → 100ms.
      //    The 0.8s energy fade-in meant the first beat was always visually muted.
      const transitionDuration = 0.1;
      
      if (timeSinceStart < transitionDuration) {
        const blend = timeSinceStart / transitionDuration;
        energyEclipse = 1.0 + (calculatedEnergy - 1.0) * blend;
      } else {
        energyEclipse = calculatedEnergy;
      }
    }
    
    lastEnergy = energyEclipse;
  } else if (audioEverStarted) {
    energyEclipse = lastEnergy;
  } else {
    energyEclipse = 1.0;
  }
  
  let hueBaseEclipse = hueFromPalette(energyEclipse);
  
  if (params.eclipseWeight > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    
    // Calculate audio energy for shimmer/pulse effect - FFT-INDEPENDENT
    const trebleEnergy = energy1600_8000;
    const midEnergy = energy600_1600;
    const bassEnergy = energy20_600;
    
    // Shimmer pulse - creates subtle breathing effect
    const shimmerPulse = 0.8 + Math.sin(t * 0.003) * 0.1 + trebleEnergy * 0.1;
    const eclipseIntensity = params.eclipseWeight * shimmerPulse;
    
    const sat = 100; // High saturation for vibrant color
    
    // REFINED: Tight edge glow - only radiates outward from circle edge
    // Create focused gradient that starts AT the edge and extends outward only
    const coronaGrad = ctx.createRadialGradient(
      0, 0, centerSize * 0.98, // Start just inside the circle edge
      0, 0, centerSize * 1.12   // Extend outward only slightly (tighter control)
    );
    
    // Colored glow with controlled luminosity (no white!)
    const lum = 55 + params.eclipseWeight * 8; // Lower base luminosity, stays colored
    coronaGrad.addColorStop(0, `hsla(${hueBaseEclipse},${sat}%,${lum + 10}%,0)`);
    coronaGrad.addColorStop(0.25, `hsla(${hueBaseEclipse},${sat}%,${lum + 8}%,${eclipseIntensity * 0.7})`);
    coronaGrad.addColorStop(0.5, `hsla(${hueBaseEclipse},${sat}%,${lum}%,${eclipseIntensity * 0.5})`);
    coronaGrad.addColorStop(0.75, `hsla(${(hueBaseEclipse + 15) % 360},${sat - 10}%,${lum - 8}%,${eclipseIntensity * 0.25})`);
    coronaGrad.addColorStop(1, `hsla(${hueBaseEclipse},${sat - 20}%,${lum - 15}%,0)`);
    
    ctx.fillStyle = coronaGrad;
    ctx.fillRect(-centerSize * 2, -centerSize * 2, centerSize * 4, centerSize * 4);
    
    ctx.restore();
  }
  
  // PHASE 5: Gamma Blast Effect - Sharp Colorizing Edge Ring (matches Automation Gamma style)
  if (params.gammaBlast > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    
    // CRITICAL: Create clipping mask that EXCLUDES the inner circle
    // This ensures gamma blast only appears OUTSIDE the center image area
    ctx.beginPath();
    ctx.rect(-W, -H, W * 2, H * 2); // Outer rectangle (entire canvas)
    ctx.arc(0, 0, centerSize, 0, Math.PI * 2, true); // Inner circle (reverse winding = hole)
    ctx.clip();
    
    // 🔥 USE ENERGY ANALYSER (FFT-independent!)
    const bassEnergy = energy20_600;
    const midEnergy = energy600_1600;
    const trebleEnergy = energy1600_8000;
    const totalEnergy = (bassEnergy * 0.4 + midEnergy * 0.4 + trebleEnergy * 0.2);
    
    // Apply GAMMA-STYLE luminosity pulsing (matches original gamma effect)
    const gammaBalanced = params.gammaBlast * params.gammaBlast; // Quadratic curve
    const gammaPulse = 1 + gammaBalanced * 0.25 * Math.sin(t * 0.0035 * 1000); // Synchronized pulse
    
    // TIGHT FOCUSED RING - much narrower spread around edge (like a sharp gamma rim)
    const tightEdgeStart = centerSize * 1.0; // Exact edge
    const tightEdgeEnd = centerSize * 1.06; // Only 6% outward (was 30%+)
    
    const gammaRing = ctx.createRadialGradient(
      0, 0, tightEdgeStart,
      0, 0, tightEdgeEnd
    );
    
    // SHARP COLORIZING: High saturation, strong luminosity manipulation (like original gamma)
    const sat = 100;
    const lumBase = 48; // Reduced from 62 for more saturated colors (less white-wash)
    const lum = Math.min(70, lumBase * gammaPulse); // Reduced from 88 - pulsing luminosity
    const blastAlpha = params.gammaBlast * (0.8 + totalEnergy * 0.2);
    
    // Sharp gradient with strong color definition (NOT a soft glow)
    gammaRing.addColorStop(0, `hsla(${hueBaseEclipse},${sat}%,${lum}%,${blastAlpha * 1.0})`); // Strong at edge
    gammaRing.addColorStop(0.4, `hsla(${hueBaseEclipse},${sat}%,${lum * 0.95}%,${blastAlpha * 0.85})`); // Hold strong
    gammaRing.addColorStop(0.75, `hsla(${(hueBaseEclipse + 20) % 360},${sat - 10}%,${lum * 0.85}%,${blastAlpha * 0.4})`); // Color shift
    gammaRing.addColorStop(1, `hsla(${hueBaseEclipse},${sat - 20}%,${lum * 0.7}%,0)`); // Sharp falloff
    
    ctx.fillStyle = gammaRing;
    ctx.fillRect(-centerSize * 2, -centerSize * 2, centerSize * 4, centerSize * 4);
    
    // Add secondary sharper ring for extra definition (double-ring gamma effect)
    const innerRingStart = centerSize * 1.0;
    const innerRingEnd = centerSize * 1.03;
    
    const innerGammaRing = ctx.createRadialGradient(
      0, 0, innerRingStart,
      0, 0, innerRingEnd
    );
    
    const innerLum = Math.min(75, (lumBase + 18) * gammaPulse); // Reduced from 92 - brighter inner ring
    innerGammaRing.addColorStop(0, `hsla(${hueBaseEclipse},${sat}%,${innerLum}%,${blastAlpha * 0.6})`);
    innerGammaRing.addColorStop(0.6, `hsla(${hueBaseEclipse},${sat}%,${innerLum * 0.9}%,${blastAlpha * 0.4})`);
    innerGammaRing.addColorStop(1, `hsla(${(hueBaseEclipse + 10) % 360},${sat - 5}%,${innerLum * 0.8}%,0)`);
    
    ctx.fillStyle = innerGammaRing;
    ctx.fillRect(-centerSize * 2, -centerSize * 2, centerSize * 4, centerSize * 4);
    
    ctx.restore();
  }
  
  // Create circular clipping mask
  ctx.beginPath();
  ctx.arc(0, 0, centerSize, 0, Math.PI * 2);
  ctx.clip();
  
  // Center Graphic motion/control math lives in utils/centerGraphicEngine.ts.
  // Keeps App.tsx focused on drawing and makes future FX tuning safer.
  const centerMotion = computeCenterGraphicMotion({
    params,
    motionRuntime: (renderState as CenterGraphicRenderState).motionRuntime,
    t,
    dt,
    centerSize,
    cycleSpeedMs: parseInt(cachedCycleSpeedEl?.value || '4000'),
    autoRotationAngle: centerGraphicController.autoRotationAngle,
    energy: {
      bassLow: energy20_160,
      midBass: energy60_150,
      midUpper: energy150_250,
    },
  });
  let centerRotationRad = (centerMotion.rotationDeg * Math.PI) / 180;
  if (!params.centerImageAutoRotate && centerImageRotationHomeTween.active) {
    centerGraphicController.autoRotationAngle = updateAngleTween(centerImageRotationHomeTween, dt);
    centerRotationRad = centerGraphicController.autoRotationAngle;
  } else {
    centerGraphicController.autoRotationAngle = centerMotion.autoRotationAngle;
  }
  let scale = centerMotion.scale;
  ctx.translate(centerMotion.offsetX, centerMotion.offsetY);
  ctx.translate(centerMotion.jitterX, centerMotion.jitterY);
  ctx.translate(centerMotion.displacementX, centerMotion.displacementY);
  ctx.rotate(centerRotationRad);
  
  // Get dimensions - videos use videoWidth/videoHeight, images use width/height
  const isVideo = centerImageElement instanceof HTMLVideoElement;
  const elementWidth = isVideo ? (centerImageElement as HTMLVideoElement).videoWidth : (centerImageElement as HTMLImageElement).width;
  const elementHeight = isVideo ? (centerImageElement as HTMLVideoElement).videoHeight : (centerImageElement as HTMLImageElement).height;
  
  // CRITICAL: Skip drawing if dimensions are invalid (video not ready or corrupt file)
  if (!elementWidth || !elementHeight || elementWidth <= 0 || elementHeight <= 0) {
    // 🚀 PERF (Beta cleanup): this runs in the per-frame draw path — while a video is
    // still loading (or a file is genuinely corrupt) this condition can hold for many
    // consecutive frames, so an ungated warn() here was capable of spamming the console
    // at 60fps. The skip-drawing behavior itself is unchanged either way.
    if (DEBUG_FLAGS.GENERAL) console.warn('⚠️ Skipping draw - invalid dimensions:', elementWidth, 'x', elementHeight);
    ctx.restore();
    return { audioEverStarted, audioStartTime, lastEnergy };
  }
  
  const imgAspect = elementWidth / elementHeight || 1;
  const containerAspect = 1; // Circular container
  let drawWidth, drawHeight;
  
  // Cover the circular area
  if (imgAspect > containerAspect) {
    drawHeight = centerSize * 2 * scale;
    drawWidth = drawHeight * imgAspect;
  } else {
    drawWidth = centerSize * 2 * scale;
    drawHeight = drawWidth / imgAspect;
  }
  
  // Enable high-quality image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Animate transition progress with easing for smoother fade/crossfade/zoom.
  let transitionEase = 1.0;
  if (centerGraphicController.transitionProgress < 1.0) {
    const transitionState = advanceCenterGraphicTransition(centerGraphicController.transitionProgress, dt, centerGraphicController.transitionType);
    centerGraphicController.transitionProgress = transitionState.raw;
    transitionEase = transitionState.eased;
  } else {
    transitionEase = 1.0;
    // Transition complete - clear previous image reference
    centerGraphicController.transitionFrom = -1;
  }
  
  // ========== CENTER IMAGE RENDERING WITH EFFECTS ==========
  
  // Decision: Render KALEIDOSCOPE or MAIN IMAGE (not both)
  const useKaleidoscope = params.centerImageKaleidoscope > 0.01;
  const useAberration = params.centerImageAberration > 0.01;
  
  ctx.globalCompositeOperation = "source-over";
  
  // Helper function to draw main image with current transition
  const drawMainImage = (opacity: number) => {
    // Add debug logging for GIFs and dimension validation
    const isVideo = centerImageElement instanceof HTMLVideoElement;
    const elemWidth = isVideo ? (centerImageElement as HTMLVideoElement).videoWidth : (centerImageElement as HTMLImageElement).width;
    const elemHeight = isVideo ? (centerImageElement as HTMLVideoElement).videoHeight : (centerImageElement as HTMLImageElement).height;
    
    // Validate dimensions before drawing
    if (!elemWidth || !elemHeight || elemWidth <= 0 || elemHeight <= 0) {
      // 🚀 PERF (Beta cleanup): same per-frame spam risk as the warning in the other
      // dimension check above — gated for the same reason, skip-behavior unchanged.
      if (DEBUG_FLAGS.GENERAL) console.warn('⚠️ Cannot draw image - invalid dimensions:', elemWidth, 'x', elemHeight, 'File:', currentImage?.filename);
      return;
    }
    
    // Apply user opacity control
    const finalOpacity = opacity * params.centerImageOpacity;
    
    // Center Graphic color/LUT pipeline lives outside App.tsx.
    // Kept CSS-filter based for live performance; heavy multi-pass FX are deferred.
    const colorFilter = getCenterGraphicFilter({
      grade: 'none',
      saturation: params.centerImageSaturation,
      hueShiftDeg: params.centerImageHueShift,
      hueShiftAuto: params.centerImageHueShiftAuto,
      t: t * 0.001,
    });
    
    const drawMediaElement = (element: HTMLImageElement | HTMLVideoElement, alpha: number, scaleMul = 1, xOff = 0, yOff = 0, filterOverride?: string) => {
      if (!element) return;
      const sourceIsVideo = element instanceof HTMLVideoElement;
      const sourceWidth = sourceIsVideo ? (element as HTMLVideoElement).videoWidth : (element as HTMLImageElement).width;
      const sourceHeight = sourceIsVideo ? (element as HTMLVideoElement).videoHeight : (element as HTMLImageElement).height;
      if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) return;
      const sourceAspect = sourceWidth / sourceHeight || 1;
      let w: number;
      let h: number;
      if (sourceAspect > containerAspect) {
        h = centerSize * 2 * scale * scaleMul;
        w = h * sourceAspect;
      } else {
        w = centerSize * 2 * scale * scaleMul;
        h = w / sourceAspect;
      }
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.filter = 'none';
      drawCenterGraphicWithColorStyle({
        ctx,
        element,
        x: -w / 2 + xOff,
        y: -h / 2 + yOff,
        width: w,
        height: h,
        styleId: params.centerImageColorGrade,
        extraFilter: filterOverride ?? colorFilter,
      });
    };

    const transitionTimeline = (() => {
      const raw = clamp(centerGraphicController.transitionProgress, 0, 1);
      const enter = transitionEase;
      const exit = 1 - transitionEase;
      const flash = centerGraphicController.transitionType === 'flashZoom' ? (Math.sin(raw * Math.PI * 7) > 0 ? (1 - raw) : 0) : 0;
      const scan = centerGraphicController.transitionType === 'signalScan' ? Math.sin(raw * Math.PI) : 0;
      const glitch = centerGraphicController.transitionType === 'glitchCut' ? Math.max(0, 1 - raw / 0.52) : 0;
      return { raw, enter, exit, flash, scan, glitch };
    })();

    const prevImage = centerGraphicController.transitionFrom >= 0 ? centerGraphicController.images[centerGraphicController.transitionFrom] : null;
    const hasPrev = !!prevImage && !!prevImage.loaded && centerGraphicController.transitionProgress < 1.0;

    if (centerGraphicController.transitionType === 'instant') {
      drawMediaElement(centerImageElement, finalOpacity, 1);
    } else if (centerGraphicController.transitionType === 'fade') {
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, 1);
    } else if (centerGraphicController.transitionType === 'crossfade') {
      if (hasPrev) drawMediaElement(prevImage!.element, transitionTimeline.exit * finalOpacity, 1);
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, 1);
    } else if (centerGraphicController.transitionType === 'zoom') {
      const zoomScale = 0.5 + transitionTimeline.enter * 0.5;
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, zoomScale);
    } else if (centerGraphicController.transitionType === 'flashZoom') {
      // Fast flash + zoom into user-set zoom level; no permanent scale snapping.
      const zoomScale = 0.62 + easeOutCubic(transitionTimeline.raw) * 0.38;
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, zoomScale);
      if (transitionTimeline.flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = transitionTimeline.flash * 0.38 * finalOpacity;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-centerSize * 1.35, -centerSize * 1.35, centerSize * 2.7, centerSize * 2.7);
        ctx.restore();
      }
    } else if (centerGraphicController.transitionType === 'pushFade') {
      // Exit current quickly, incoming pushes into the configured zoom level.
      if (hasPrev) {
        const outX = -centerSize * 0.16 * transitionTimeline.enter;
        drawMediaElement(prevImage!.element, transitionTimeline.exit * finalOpacity, 1, outX, 0);
      }
      const inX = centerSize * 0.24 * (1 - transitionTimeline.enter);
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, 1, inX, 0);
    } else if (centerGraphicController.transitionType === 'signalScan') {
      // Fast HUD scan reveal: a visible scan head travels from top to bottom during the whole
      // transition, then fully disappears once the transition settles.
      drawMediaElement(centerImageElement, transitionTimeline.enter * finalOpacity, 1);
      if (transitionTimeline.raw < 0.985 && transitionTimeline.scan > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const scanY = -centerSize * 1.05 + centerSize * 2.1 * transitionTimeline.raw;
        const lineAlpha = transitionTimeline.scan * 0.78 * finalOpacity;
        const beamHeight = Math.max(8, centerSize * 0.11);
        const grad = ctx.createLinearGradient(0, scanY - beamHeight, 0, scanY + beamHeight);
        grad.addColorStop(0, 'rgba(30,144,255,0)');
        grad.addColorStop(0.48, 'rgba(30,144,255,0.32)');
        grad.addColorStop(0.52, 'rgba(255,255,255,0.52)');
        grad.addColorStop(1, 'rgba(30,144,255,0)');
        ctx.globalAlpha = lineAlpha * 0.72;
        ctx.fillStyle = grad;
        ctx.fillRect(-centerSize * 1.16, scanY - beamHeight, centerSize * 2.32, beamHeight * 2);
        ctx.globalAlpha = lineAlpha;
        ctx.strokeStyle = 'rgba(140,220,255,0.98)';
        ctx.lineWidth = Math.max(1.5, centerSize * 0.014);
        ctx.beginPath();
        ctx.moveTo(-centerSize * 1.14, scanY);
        ctx.lineTo(centerSize * 1.14, scanY);
        ctx.stroke();
        ctx.restore();
      }
    } else if (centerGraphicController.transitionType === 'glitchCut') {
      // Ultra-fast digital cut with stronger twitch/shake and a brief sliced double-draw.
      const g = transitionTimeline.glitch;
      if (hasPrev && transitionTimeline.raw < 0.32) {
        const prevShake = (Math.sin(t * 0.31) + Math.sin(t * 0.83)) * centerSize * 0.09 * g;
        drawMediaElement(prevImage!.element, (1 - transitionTimeline.raw / 0.32) * finalOpacity, 1, prevShake, 0);
      }
      const twitch = transitionTimeline.raw < 0.56 ? g : 0;
      const jitterX = (Math.sin(t * 0.37) + Math.sin(t * 0.91) * 0.85 + Math.sin(t * 1.73) * 0.35) * centerSize * 0.105 * twitch;
      const jitterY = (Math.cos(t * 0.53) + Math.sin(t * 1.17) * 0.45) * centerSize * 0.065 * twitch;
      const alpha = Math.max(transitionTimeline.enter, 1 - g * 0.22) * finalOpacity;
      drawMediaElement(centerImageElement, alpha, 1, jitterX, jitterY);
      if (twitch > 0.08) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawMediaElement(
          centerImageElement,
          Math.min(0.22, twitch * 0.18) * finalOpacity,
          1,
          -jitterX * 0.55 + centerSize * 0.035 * twitch,
          jitterY * 0.25
        );
        ctx.restore();
      }
    } else {
      drawMediaElement(centerImageElement, finalOpacity, 1);
    }
  };
  
  // Helper function to draw kaleidoscope
  const drawKaleidoscope = () => {
    const totalEnergy = energy20_8000;
    const rotationSpeed = params.centerImageKaleidoscope * totalEnergy * 1.5;
    if (!glitchSeed) glitchSeed = 0;
    glitchSeed += rotationSpeed * 0.05;
    
    const segments = params.centerImageKaleidoscope < 0.4 ? 4 : 
                    params.centerImageKaleidoscope < 0.75 ? 6 : 8;
    const segmentAngle = (Math.PI * 2) / segments;
    
    for (let i = 0; i < segments; i++) {
      ctx.save();
      const angle = segmentAngle * i + glitchSeed;
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, centerSize * 1.5, -segmentAngle / 2, segmentAngle / 2);
      ctx.closePath();
      ctx.clip();
      if (i % 2 === 1) ctx.scale(-1, 1);
      const hueShift = (360 / segments) * i;
      const satBoost = 1.3 + totalEnergy * 0.5;
      
      // ⚡ PERFORMANCE: Use cached filter string
      const filterKey = `${Math.round(hueShift)}_${satBoost.toFixed(2)}`;
      let filterStr = filterCache.get(filterKey);
      if (!filterStr) {
        filterStr = `hue-rotate(${hueShift}deg) saturate(${satBoost}) brightness(1.15)`;
        filterCache.set(filterKey, filterStr);
        if (filterCache.size > MAX_FILTER_CACHE_SIZE) filterCache.clear();
      }
      ctx.filter = filterStr;
      ctx.drawImage(centerImageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    }
  };
  
  // Helper: Apply TRUE RGB CHROMATIC ABERRATION - draws ONLY image pixels!
  const applyAberration = (isKaleidoscope: boolean) => {
    const bassEnergy = energy20_600;
    const aberrationStrength = params.centerImageAberration * 45; // Increased from 18 to 45 for more intensity
    const aberrationOffset = aberrationStrength * (1 + bassEnergy * 0.7);
    
    // 🔧 MOTION FIX #3a: Use RAF timestamp `t` (sub-ms precision) instead of
    //    Date.now() (1ms integer resolution) to prevent chromatic aberration jitter.
    const timeMs = t;
    const rotationRed = Math.sin(timeMs * 0.0006) * 5.0;  // 2x speed, 2x wobble
    const rotationBlue = Math.cos(timeMs * 0.0008) * 5.0; // 2x speed, 2x wobble
    
    const offscreenSize = Math.ceil(centerSize * 3);
    
    // ⚡ PERFORMANCE FIX: Reuse pre-allocated canvases instead of creating new ones every frame
    // Only recreate if size changed (instead of 180 allocations/sec, we get ~0-1 allocations/sec!)
    if (!offscreenRed || !offscreenCyan || lastOffscreenSize !== offscreenSize) {
      // Create/resize Red channel canvas
      if (!offscreenRed) offscreenRed = document.createElement('canvas');
      offscreenRed.width = offscreenSize;
      offscreenRed.height = offscreenSize;
      ctxRed = offscreenRed.getContext('2d', { willReadFrequently: false })!;
      
      // Create/resize Cyan channel canvas
      if (!offscreenCyan) offscreenCyan = document.createElement('canvas');
      offscreenCyan.width = offscreenSize;
      offscreenCyan.height = offscreenSize;
      ctxCyan = offscreenCyan.getContext('2d', { willReadFrequently: false })!;
      
      lastOffscreenSize = offscreenSize;
    }
    
    // Helper to render content to any context
    const renderTo = (targetCtx: CanvasRenderingContext2D, opacity: number = 1.0) => {
      if (isKaleidoscope) {
        // Render kaleidoscope
        const totalEnergy = energy20_8000;
        const segments = params.centerImageKaleidoscope < 0.4 ? 4 : 
                        params.centerImageKaleidoscope < 0.75 ? 6 : 8;
        const segmentAngle = (Math.PI * 2) / segments;
        
        for (let i = 0; i < segments; i++) {
          targetCtx.save();
          const angle = segmentAngle * i + (glitchSeed || 0);
          targetCtx.rotate(angle);
          targetCtx.beginPath();
          targetCtx.moveTo(0, 0);
          targetCtx.arc(0, 0, centerSize * 1.5, -segmentAngle / 2, segmentAngle / 2);
          targetCtx.closePath();
          targetCtx.clip();
          if (i % 2 === 1) targetCtx.scale(-1, 1);
          const hueShift = (360 / segments) * i;
          const satBoost = 1.3 + totalEnergy * 0.5;
          
          // ⚡ PERFORMANCE: Use cached filter string instead of creating new one every frame
          const filterKey = `${Math.round(hueShift)}_${satBoost.toFixed(2)}`;
          let filterStr = filterCache.get(filterKey);
          if (!filterStr) {
            filterStr = `hue-rotate(${hueShift}deg) saturate(${satBoost}) brightness(1.15)`;
            filterCache.set(filterKey, filterStr);
            if (filterCache.size > MAX_FILTER_CACHE_SIZE) filterCache.clear(); // Prevent memory leak
          }
          targetCtx.filter = filterStr;
          targetCtx.globalAlpha = opacity;
          targetCtx.drawImage(centerImageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          targetCtx.restore();
        }
      } else {
        // Render main image
        targetCtx.globalAlpha = transitionEase * opacity;
        targetCtx.filter = "none";
        targetCtx.drawImage(centerImageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
    };
    
    // 1. RED CHANNEL - Shifted UP (vertical only)
    ctx.save();
    // FIXED: Vertical stacking - Red layer moves UP on Y-axis only
    ctx.translate(0, -aberrationOffset * 3.5); // Increased from 2.5 to 3.5 for more separation
    ctx.rotate(rotationRed * Math.PI / 180);
    
    // ⚡ PERFORMANCE: Use pre-allocated canvas (was creating new canvas every frame!)
    ctxRed!.save();
    ctxRed!.clearRect(0, 0, offscreenSize, offscreenSize); // Clear previous frame
    ctxRed!.translate(offscreenSize / 2, offscreenSize / 2);
    
    ctxRed!.filter = 'grayscale(1) contrast(3) brightness(1.6)';
    renderTo(ctxRed!, 1.0);
    
    ctxRed!.globalCompositeOperation = 'source-atop';
    ctxRed!.filter = 'none';
    ctxRed!.fillStyle = '#FF0055';
    ctxRed!.fillRect(-offscreenSize / 2, -offscreenSize / 2, offscreenSize, offscreenSize);
    ctxRed!.restore();
    
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.75 + Math.sin(timeMs * 0.001) * 0.15) * params.centerImageAberration; // Increased base from 0.65 to 0.75, removed 0.9 reduction
    ctx.filter = 'blur(0.5px)'; // Subtle blur for ethereal glow
    ctx.drawImage(offscreenRed!, -offscreenSize / 2, -offscreenSize / 2);
    ctx.restore();
    
    // 2. BLUE CHANNEL - Shifted DOWN (vertical only)
    ctx.save();
    // FIXED: Vertical stacking - Blue layer moves DOWN on Y-axis only
    ctx.translate(0, aberrationOffset * 3.5); // Increased from 2.5 to 3.5 for more separation
    ctx.rotate(rotationBlue * Math.PI / 180);
    
    // ⚡ PERFORMANCE: Use pre-allocated canvas (was creating new canvas every frame!)
    ctxCyan!.save();
    ctxCyan!.clearRect(0, 0, offscreenSize, offscreenSize); // Clear previous frame
    ctxCyan!.translate(offscreenSize / 2, offscreenSize / 2);
    
    ctxCyan!.filter = 'grayscale(1) contrast(3) brightness(1.6)';
    renderTo(ctxCyan!, 1.0);
    
    ctxCyan!.globalCompositeOperation = 'source-atop';
    ctxCyan!.filter = 'none';
    ctxCyan!.fillStyle = '#00CCFF';
    ctxCyan!.fillRect(-offscreenSize / 2, -offscreenSize / 2, offscreenSize, offscreenSize);
    ctxCyan!.restore();
    
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.80 + Math.cos(timeMs * 0.0013) * 0.15) * params.centerImageAberration; // Increased base from 0.70 to 0.80, removed 0.9 reduction
    ctx.filter = 'blur(0.5px)'; // Subtle blur for ethereal glow
    ctx.drawImage(offscreenCyan!, -offscreenSize / 2, -offscreenSize / 2);
    ctx.restore();
    
    // 3. MAIN IMAGE ON TOP (full color, always visible)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.filter = 'none';
    renderTo(ctx, 1.0);
  };
  
  // Helper: Apply RGB OFFSET Effect using CSS filters (ULTRA-FAST)
  // ⚡ PERFORMANCE: Uses CSS filters instead of getImageData - 100x faster!
  // ⚡ OPTIMIZED: No pixel manipulation, pure GPU-accelerated rendering
  const drawRGBOffset = (sourceElement?: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement) => {
    // 🔧 MOTION FIX #3b: Use RAF timestamp `t` instead of Date.now() — sub-ms
    //    precision eliminates stepping/jitter in RGB orbit breathing animation.
    const timeMs = t;
    const bassEnergy = energy20_600;
    
    // Breathing animation + Chromatic Intensity modulation
    const breathCycle = Math.sin(timeMs * 0.0012) * 0.15; // -0.15 to +0.15
    const chromaticMod = 1.0 + (params.centerImageAberration * 0.5); // Chromatic Intensity enhances offset
    const offsetStrength = params.centerImageRGBOffset * centerSize * 0.1 * (1.0 + breathCycle + bassEnergy * 0.3) * chromaticMod;
    
    // Auto-rotate: Each channel orbits at different speeds (floating motion, not spinning)
    let baseAngleRad = (params.centerImageRGBAngle * Math.PI) / 180;
    
    // Calculate separate angles for each RGB channel (creates orbital floating effect)
    let redAngle = baseAngleRad;
    let blueAngle = baseAngleRad;
    let greenAngle = baseAngleRad;
    
    if (params.centerImageRGBAutoRotate) {
      const autoRotateTime = timeMs * 0.0003; // Base rotation speed
      redAngle += autoRotateTime * 1.0;    // 100% speed - Red orbits at base speed
      blueAngle += autoRotateTime * 1.05;   // 105% speed - Blue orbits slightly faster
      greenAngle += autoRotateTime * 0.95;  // 95% speed - Green orbits slightly slower
    }
    
    // Use provided source or default to centerImageElement
    const source = sourceElement || centerImageElement;
    
    // Helper function to draw image with specific dimensions
    const drawSource = (targetCtx: CanvasRenderingContext2D) => {
      if (source instanceof HTMLCanvasElement) {
        targetCtx.drawImage(source, -source.width / 2, -source.height / 2);
      } else {
        targetCtx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
    };
    
    ctx.save();
    ctx.globalCompositeOperation = "screen"; // Screen blend mode - prevents excessive brightness
    
    // BLUE channel - orbits at 105% speed (opposite side, faster)
    // Background layer for depth
    ctx.save();
    const blueOffsetX = Math.cos(blueAngle + Math.PI) * offsetStrength;
    const blueOffsetY = Math.sin(blueAngle + Math.PI) * offsetStrength;
    ctx.translate(blueOffsetX, blueOffsetY);
    ctx.globalAlpha = 0.85; // Background layer
    ctx.filter = 'sepia(1) saturate(10) hue-rotate(180deg) brightness(0.6)'; // Pure blue channel
    drawSource(ctx);
    ctx.restore();
    
    // GREEN channel - centered with 95% speed orbital offset
    // Mid layer for depth
    ctx.save();
    const greenOffsetX = Math.cos(greenAngle + Math.PI * 0.66) * offsetStrength * 0.5;
    const greenOffsetY = Math.sin(greenAngle + Math.PI * 0.66) * offsetStrength * 0.5;
    ctx.translate(greenOffsetX, greenOffsetY);
    ctx.globalAlpha = 0.90; // Mid layer
    ctx.filter = 'sepia(1) saturate(10) hue-rotate(70deg) brightness(0.7)'; // Pure green channel
    drawSource(ctx);
    ctx.restore();
    
    // RED channel - orbits at 100% speed
    // ✅ TOP LAYER: Fully opaque (1.0) for maximum impact
    ctx.save();
    const redOffsetX = Math.cos(redAngle) * offsetStrength;
    const redOffsetY = Math.sin(redAngle) * offsetStrength;
    ctx.translate(redOffsetX, redOffsetY);
    ctx.globalAlpha = 1.0; // ✅ FULLY OPAQUE - No transparency on top layer
    ctx.filter = 'sepia(1) saturate(10) hue-rotate(330deg) brightness(0.8)'; // Pure red channel
    drawSource(ctx);
    ctx.restore();
    
    ctx.restore();
  };
  
  // RENDER LOGIC: Allow effect stacking (RGB + Kaleidoscope can work together)
  const useRGBOffset = params.centerImageRGBOffset > 0.01;
  const useChromaticIntensity = params.centerImageAberration > 0.01;
  
  // Base rendering decision
  if (useRGBOffset) {
    // RGB OFFSET EFFECT (pixel-perfect channel isolation)
    if (useKaleidoscope) {
      // STACK: Apply kaleidoscope first, then RGB split
      ctx.save();
      if (!kaleidoRGBTempCanvas || kaleidoRGBTempW !== canvas.width || kaleidoRGBTempH !== canvas.height) {
        if (!kaleidoRGBTempCanvas) kaleidoRGBTempCanvas = document.createElement('canvas');
        kaleidoRGBTempCanvas.width = canvas.width;
        kaleidoRGBTempCanvas.height = canvas.height;
        kaleidoRGBTempCtx = kaleidoRGBTempCanvas.getContext('2d')!;
        kaleidoRGBTempW = canvas.width;
        kaleidoRGBTempH = canvas.height;
      } else {
        // Reusing the pooled canvas — clear the previous frame's content and reset
        // the transform before redrawing (translate below would otherwise compound).
        kaleidoRGBTempCtx!.setTransform(1, 0, 0, 1, 0, 0);
        kaleidoRGBTempCtx!.clearRect(0, 0, kaleidoRGBTempCanvas.width, kaleidoRGBTempCanvas.height);
      }
      const tempCanvas = kaleidoRGBTempCanvas;
      const tempCtx = kaleidoRGBTempCtx!;
      tempCtx.translate(canvas.width / 2, canvas.height / 2);
      
      // Render kaleidoscope to temp canvas
      const originalCtx = ctx;
      ctx = tempCtx as any; // Temporarily swap context
      drawKaleidoscope();
      ctx = originalCtx; // Restore context
      
      // Now apply RGB offset to the kaleidoscope result
      drawRGBOffset(tempCanvas);
      
      ctx.restore();
    } else {
      // RGB offset on normal image
      drawRGBOffset();
    }
  } else if (useChromaticIntensity) {
    // Chromatic Intensity (Aberration) - vertical RGB split
    if (useKaleidoscope) {
      applyAberration(true);
    } else {
      applyAberration(false);
    }
  } else if (useKaleidoscope) {
    // KALEIDOSCOPE ONLY
    drawKaleidoscope();
  } else {
    // MAIN IMAGE ONLY (no effects)
    drawMainImage(centerMotion.opacityMul ?? 1.0);
  }
  
  ctx.globalAlpha = 1.0;
  ctx.filter = 'none';
  
  // ========== END CENTER IMAGE EFFECTS ==========
  
  ctx.restore(); // Restore before drawing border to avoid Ken Burns drift
  
  // Optional: Edge glow around circular frame (reacts to treble) - FFT-INDEPENDENT
  // ⚡ CRITICAL: Draw border AFTER restore to keep it static (not affected by Ken Burns)
  ctx.save();
  ctx.translate(cx, cy); // Fresh transform - only position, no Ken Burns
  const trebleEnergy = energy1600_8000;
  const edgeGlowAlpha = 0.3 + trebleEnergy * 0.5;
  const hueBase = hueFromPalette(1.0); // Get current hue
  const sat = 100;
  const lumBase = 62;
  const lum = Math.min(88, lumBase);
  ctx.strokeStyle = `hsla(${hueBase},${sat}%,${lum}%,${edgeGlowAlpha})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, centerSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

  renderState.offscreenRed = offscreenRed;
  renderState.ctxRed = ctxRed;
  renderState.offscreenCyan = offscreenCyan;
  renderState.ctxCyan = ctxCyan;
  renderState.lastOffscreenSize = lastOffscreenSize;
  renderState.kaleidoRGBTempCanvas = kaleidoRGBTempCanvas;
  renderState.kaleidoRGBTempCtx = kaleidoRGBTempCtx;
  renderState.kaleidoRGBTempW = kaleidoRGBTempW;
  renderState.kaleidoRGBTempH = kaleidoRGBTempH;
  renderState.glitchSeed = glitchSeed;

  return { audioEverStarted, audioStartTime, lastEnergy };
}
