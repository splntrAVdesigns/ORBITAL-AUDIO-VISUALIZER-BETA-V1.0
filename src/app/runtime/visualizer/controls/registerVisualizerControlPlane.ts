import type { VisualizerParams } from '../../../config/defaultParams';
import {
  normalizeSpikeFftExponent,
  spikeFftExponentToWindowSize,
} from '../../../config/parameterConversions';
import type { CenterColorSource } from '../../colorPipeline';
import { bpmClockRuntime } from '../../bpm/BpmClockRuntime';
import {
  cancelTrackedShortLivedRaf,
  requestTrackedShortLivedRaf,
} from '../../mainThread/MainThreadAsyncDiagnostics';
import type { CenterGraphicController } from '../../../controllers/centerGraphicController';
import type { AutoCycleSpeed, ShapeType, StrokeStyle } from '../../../utils/astralShaper';
import type { LiquidShaperFeatureRuntime } from '../features/LiquidShaperFeatureRuntime';
import type { SpikeFeatureRuntime } from '../features/SpikeFeatureRuntime';
import type { ProductionMotionStateRuntime } from '../motion/ProductionMotionStateRuntime';
import type { RuntimeAsyncRegistry } from '../session/RuntimeAsyncRegistry';
import type { RuntimeEventRegistry } from '../session/RuntimeEventRegistry';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';
import type { RuntimeParameterKey } from '../../parameters/RuntimeParameterTransactions';
import { initializeVisualizerControlDefaults } from './initializeVisualizerControlDefaults';

export type RuntimeControlElement = HTMLInputElement & HTMLSelectElement;
export type RuntimeControlBinder = (
  selector: string,
  handler: (element: RuntimeControlElement) => void,
) => void;

type WidenRuntimeValue<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T;

export type RuntimeVisualizerParams = {
  -readonly [K in keyof VisualizerParams]: WidenRuntimeValue<VisualizerParams[K]>;
} & Record<string, any>;

export interface MutableAudioControlBuffers {
  freqArr: Uint8Array<ArrayBufferLike>;
  timeArr: Uint8Array<ArrayBufferLike>;
  filteredFreqArr: Uint8Array<ArrayBufferLike>;
  beatDetectionFreqArr: Uint8Array<ArrayBufferLike>;
  rawSpikeFreqArr: Uint8Array<ArrayBufferLike>;
}

export interface VisualizerControlPlaneOptions {
  params: RuntimeVisualizerParams;
  analyser: AnalyserNode;
  audioBuffers: MutableAudioControlBuffers;
  spikeFeature: SpikeFeatureRuntime;
  liquidShaperFeature: LiquidShaperFeatureRuntime;
  motionState: ProductionMotionStateRuntime;
  audioState: { monitorEnabled: boolean; beatCounter: number };
  centerGraphicController: CenterGraphicController;
  centerImageRotationHomeTween: any;
  rotationHomeTween: { active: boolean };
  bind: RuntimeControlBinder;
  bindThrottled: RuntimeControlBinder;
  bindMotionControlsRouting: (
    params: RuntimeVisualizerParams,
    bind: RuntimeControlBinder,
    bindThrottled: RuntimeControlBinder,
  ) => void;
  commitRuntimeParameter: (key: RuntimeParameterKey, value: unknown) => void;
  scheduleMacroUpdate: (macroName: string, value: number) => void;
  updateMetadataDisplay: () => void;
  trackMetadata: { fft: string; [key: string]: unknown };
  getMotionBlurEngine: () => { clear(): void };
  clearTextureCache: () => void;
  astralStrokeStyleRaf: { current: number | null };
  startAngleTween: (...args: any[]) => void;
  easeOutSine: (...args: any[]) => any;
  startRotationHomeEase: (fromAngle: number, duration?: number) => void;
  resetRotationState: (newMode: string, currentGlobalAngle: number) => void;
  recalculateRotationSpeed: () => void;
  getAngle: () => number;
  query: (selector: string) => Element | null;
  asyncRegistry: RuntimeAsyncRegistry;
  eventRegistry: RuntimeEventRegistry;
  sessionDisposer: RuntimeSessionDisposer;
  debugGeneral: boolean;
}

/**
 * Owns visualizer control registration, draft-safe BPM fields, liquid-shaper
 * control publication, and initial DOM/default synchronization.
 *
 * This runs once per runtime session. Listener/timer cleanup remains delegated
 * to the session-owned registries supplied through the options boundary.
 */
export function registerVisualizerControlPlane(options: VisualizerControlPlaneOptions): void {
  const {
    params,
    analyser,
    audioBuffers,
    spikeFeature,
    liquidShaperFeature,
    motionState,
    audioState,
    centerGraphicController,
    centerImageRotationHomeTween,
    rotationHomeTween,
    bind,
    bindThrottled,
    bindMotionControlsRouting,
    commitRuntimeParameter,
    scheduleMacroUpdate,
    updateMetadataDisplay,
    trackMetadata,
    getMotionBlurEngine,
    clearTextureCache,
    astralStrokeStyleRaf,
    startAngleTween,
    easeOutSine,
    startRotationHomeEase,
    resetRotationState,
    recalculateRotationSpeed,
    getAngle,
    query,
    asyncRegistry,
    eventRegistry,
    sessionDisposer,
    debugGeneral,
  } = options;

    // ⚡ PHASE 2 OPTIMIZATION: Throttle high-frequency sliders
    bindThrottled("#rot", el => {
      const nextRotation = parseFloat(el.value);
      const wasMoving = Math.abs(params.rotation || 0) > 0.001 || motionState.wasFreeRotating;
      params.rotation = nextRotation;
      if ((params.rotationSyncMode || 'free') === 'free') {
        if (Math.abs(nextRotation) <= 0.001 && wasMoving) {
          startRotationHomeEase(getAngle(), 1.65);
        } else if (Math.abs(nextRotation) > 0.001) {
          rotationHomeTween.active = false;
        }
      }
      motionState.wasFreeRotating = Math.abs(nextRotation) > 0.001;
    });
    bindThrottled("#mirror", el => params.mirror = parseFloat(el.value));
    // 🎯 NEW MOTION ARCHITECTURE - Auto-reactivity with visual controls
    bind("#motionIntensity", el => {
      const value = parseFloat(el.value);
      params.motionIntensity = value;

      // Toggle active state via class + data-active only — no inline style assignments.
      // CSS drives the appearance so React and DOM state cannot diverge.
      const allButtons = document.querySelectorAll('.motion-preset-btn') as NodeListOf<HTMLElement>;
      allButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('data-active');
      });

      let activeBtn: HTMLElement | null = null;
      if (value <= 0.35) {
        activeBtn = document.querySelector('[data-motion="0.20"]');
      } else if (value >= 0.67) {
        activeBtn = document.querySelector('[data-motion="0.85"]');
      } else {
        activeBtn = document.querySelector('[data-motion="0.50"]');
      }

      if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('data-active', 'true');
      }
    });
    // ⚡ PHASE 4A: Initialize button state on load
    (() => {
      const slider = document.getElementById('motionIntensity') as HTMLInputElement;
      if (slider) {
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })();
    bind("#motionSmoothing", el => {
      params.motionSmoothing = parseFloat(el.value);
    });
    bind("#bassBoost", el => {
      params.bassBoost = parseFloat(el.value);
    });
    // 🎛️ FREQUENCY SMOOTHING - Frequency-dependent attack/decay
    bind("#frequencySmoothing", el => {
      params.frequencySmoothing = el.checked;
    });
    // 🥁 BEAT REACTIVITY BOOST - Punch through on beats
    bind("#beatReactivityBoost", el => {
      params.beatReactivityBoost = el.checked;
    });

    bind("#fft", el => {
      const target = normalizeSpikeFftExponent(el.value);
      const newFFTSize = spikeFftExponentToWindowSize(target);
      el.value = String(target);
      params.fftSize = target;

      // 🔥 CRITICAL: FFT slider ONLY affects PRIMARY analyser (spikes/waveform)!
      // energyAnalyser stays LOCKED at 2048 FFT for consistent energy calculations.
      // This is the CORRECT ARCHITECTURE that fixes all the FFT slider issues!

      // CRITICAL FIX: Only resize if actually changed (prevent unnecessary resets)
      if (analyser.fftSize !== newFFTSize) {
        // Store old buffers to preserve waveform state during resize
        const oldAmpBuf = spikeFeature.ampBuf;
        const oldAmpEcho1 = spikeFeature.ampEcho1;
        const oldAmpEcho2 = spikeFeature.ampEcho2;

        analyser.fftSize = newFFTSize;

        // ⚡ CRITICAL FIX: DO NOT resample frequency data!
        // The AnalyserNode applies automatic normalization based on FFT size.
        // Resampling old data bypasses this normalization and causes scaling issues.
        // Instead, create EMPTY arrays and let the analyser fill them with fresh data on next frame.
        audioBuffers.freqArr = new Uint8Array(analyser.frequencyBinCount);
        audioBuffers.rawSpikeFreqArr = new Uint8Array(analyser.frequencyBinCount);
        audioBuffers.timeArr = new Uint8Array(analyser.fftSize);
        // ⚡ PHASE 1 OPTIMIZATION: Also resize audioBuffers.filteredFreqArr buffer
        audioBuffers.filteredFreqArr = new Uint8Array(analyser.frequencyBinCount);
        audioBuffers.beatDetectionFreqArr = new Uint8Array(analyser.frequencyBinCount); // 🔥 NEW: Resize beat detection array

        // CRITICAL FIX: Preserve existing amplitude data when resizing
        // This prevents visual collapse when FFT slider is dragged
        // Sprint B: this must match `N = filteredFreqArr.length` (frequencyBinCount)
        // in the frame loop's spike buffers, not the time-domain fftSize (2x too
        // large). Previously every FFT slider change ran a full linear-interp
        // resample here at the wrong size, then the frame controller's own
        // `ampBuf.length !== N` check fired on the very next frame and redid the
        // resize with a cruder nearest-neighbor copy, discarding this one entirely.
        const newLength = analyser.frequencyBinCount;
        spikeFeature.ampBuf = new Float32Array(newLength);
        spikeFeature.ampEcho1 = new Float32Array(newLength);
        spikeFeature.ampEcho2 = new Float32Array(newLength);
        // ⚡ PHASE 1 OPTIMIZATION: Also resize temp smoothing buffer
        spikeFeature.tempSmoothingBuf = new Float32Array(newLength);

        // Copy old data to new buffers (resample if needed)
        const oldLength = oldAmpBuf.length;        if (newLength >= oldLength) {
          // Upsampling: interpolate to fill new buffer
          for (let i = 0; i < newLength; i++) {
            const oldIdx = (i / newLength) * oldLength;
            const idx0 = Math.floor(oldIdx);
            const idx1 = Math.min(idx0 + 1, oldLength - 1);
            const frac = oldIdx - idx0;
            spikeFeature.ampBuf[i] = oldAmpBuf[idx0] * (1 - frac) + oldAmpBuf[idx1] * frac;
            spikeFeature.ampEcho1[i] = oldAmpEcho1[idx0] * (1 - frac) + oldAmpEcho1[idx1] * frac;
            spikeFeature.ampEcho2[i] = oldAmpEcho2[idx0] * (1 - frac) + oldAmpEcho2[idx1] * frac;
          }
        } else {
          // Downsampling: average adjacent samples
          for (let i = 0; i < newLength; i++) {
            const oldIdx = (i / newLength) * oldLength;
            const idx0 = Math.floor(oldIdx);
            const idx1 = Math.min(idx0 + 1, oldLength - 1);
            const frac = oldIdx - idx0;
            spikeFeature.ampBuf[i] = oldAmpBuf[idx0] * (1 - frac) + oldAmpBuf[idx1] * frac;
            spikeFeature.ampEcho1[i] = oldAmpEcho1[idx0] * (1 - frac) + oldAmpEcho1[idx1] * frac;
            spikeFeature.ampEcho2[i] = oldAmpEcho2[idx0] * (1 - frac) + oldAmpEcho2[idx1] * frac;
          }
        }

      }

      // The HUD and slider readout publish the same authoritative visible bin count.
      trackMetadata.fft = String(analyser.frequencyBinCount);
      window.dispatchEvent(new CustomEvent('orbital:spike-fft-change', {
        detail: {
          exponent: target,
          fftSize: analyser.fftSize,
          frequencyBinCount: analyser.frequencyBinCount,
        },
      }));
      updateMetadataDisplay();
    });
    bindThrottled("#halo", el => params.halo = parseFloat(el.value));
    bindThrottled("#bloom", el => params.bloom = parseFloat(el.value));
    bind("#dotsOn", el => params.dotsOn = el.checked);
    // ❌ REMOVED: trail slider (fade is now automatic from dotsPulse toggle)
    bindThrottled("#dotSize", el => params.dotSize = parseFloat(el.value));
    bindThrottled("#dotGlow", el => params.dotGlow = parseFloat(el.value));
    // ❌ REMOVED: dotReactivity slider (now using unified params.reactivity from ANIMATION section)
    bindThrottled("#hueSpeed", el => params.hueSpeed = parseFloat(el.value));
    bind("#density", el => {
      // Apply exponential curve for better distribution: more control at low end, extreme at high end
      const raw = parseFloat(el.value); // 0.0 to 1.0
      const curved = Math.pow(raw, 2.2); // Exponential curve (2.2 gives nice balance)
      params.dotsDensity = Math.round(22 + curved * 248); // Range: 22 to 270 (10% reduction for performance)
    });
    bind("#zoomToggle", el => params.allowZoom = el.checked);
    bind("#gamma", el => params.gamma = parseFloat(el.value));
    bind("#iridize", el => params.iridize = parseFloat(el.value));
    bind("#chaos", el => params.chaos = parseFloat(el.value));
    bindMotionControlsRouting(params, bind, bindThrottled);
    bind("#orbitalEnergy", el => params.orbitalEnergy = parseFloat(el.value));
    bind("#orbitalWidth", el => params.orbitalWidth = parseFloat(el.value));
    bind("#orbitalDirection", el => params.orbitalDirection = el.checked ? -1 : 1); // Toggle: checked=counter-clockwise, unchecked=clockwise
    bind("#haloCometEnabled", el => params.haloCometEnabled = el.checked);
    bind("#haloCometSpeed", el => params.haloCometSpeed = parseFloat(el.value));
    bind("#haloCometDirection", el => params.haloCometDirection = parseFloat(el.value) < 0 ? -1 : 1);
    bind("#haloCometThickness", el => params.haloCometThickness = parseFloat(el.value));
    bind("#haloCometTailLength", el => params.haloCometTailLength = parseFloat(el.value));
    // ⚡ PHASE 2 OPTIMIZATION: Throttle spike parameters to prevent update flooding
    bindThrottled("#spikeAttack", el => params.spikeAttack = parseFloat(el.value));
    bindThrottled("#spikeTightness", el => params.spikeTightness = parseFloat(el.value));
    bindThrottled("#spikeBloom", el => params.spikeBloom = parseFloat(el.value));
    bindThrottled("#transientBoost", el => params.transientBoost = parseFloat(el.value));
    bind("#bassReduce", el => params.bassReduce = parseFloat(el.value));
    bind("#frequencyMix", el => params.frequencyMix = parseFloat(el.value));
    bind("#spectrum", el => params.spectrum = el.checked);
    bind("#monitor", el => {
      audioState.monitorEnabled = el.checked;
      // No updateMonitor() - audio routes directly to destination
    });

    // Phase 1 bindings
    bind("#glowCenter", el => params.glowCenter = el.checked);
    bind("#glowStrength", el => params.glowStrength = parseFloat(el.value));
    bind("#autoZoom", el => {
      params.autoZoom = el.checked;
      // Auto Zoom now uses beat detection, no BPM sync needed
    });
    bind("#dotsPulse", el => {
      params.dotsPulse = el.checked;
      if (debugGeneral) console.log('🎨 DOT FADE TOGGLE:', el.checked ? 'ON ✅' : 'OFF ❌', '| params.dotsPulse =', params.dotsPulse);
    });

    // Phase 2 bindings
    bind("#shockwave", el => params.shockwave = el.checked);
    bind("#shockwaveThreshold", el => params.shockwaveThreshold = parseFloat(el.value));
    bind("#shockwaveSpeed", el => params.shockwaveSpeed = parseFloat(el.value));
    bind("#shockwaveDecay", el => params.shockwaveDecay = parseFloat(el.value));
    bind("#shockwaveRings", el => params.shockwaveRings = parseInt(el.value, 10));

    // 🔧 Impact Sparks bindings - checkbox removed, now controlled via beatPulseType
    bind("#sparkAmps", el => params.sparkAmps = parseFloat(el.value));
    bind("#sparkTrail", el => params.sparkTrail = parseFloat(el.value));
    bind("#sparkDispersion", el => params.sparkDispersion = parseFloat(el.value));
    bind("#sparkDensity", el => params.sparkDensity = parseFloat(el.value)); // 🚀 PHASE 5A: Density control

    // Shape Oscillate bindings
    bind("#shapeOscillate", el => params.shapeOscillate = el.checked);
    bind("#shapeEdgeTrails", el => commitRuntimeParameter('shapeEdgeTrails', parseFloat(el.value)));
    bind("#shapeDistortion", el => commitRuntimeParameter('shapeDistortion', parseFloat(el.value)));
    bind("#shapeTurbulence", el => commitRuntimeParameter('shapeTurbulence', parseFloat(el.value)));
    bind("#shapeDecay", el => commitRuntimeParameter('shapeDecay', parseFloat(el.value)));
    bind("#shapeOrbitDrift", el => commitRuntimeParameter('shapeOrbitDrift', parseFloat(el.value)));
    bind("#shapeDensity", el => commitRuntimeParameter('shapeDensity', parseFloat(el.value)));
    bind("#shapeBurstStrength", el => commitRuntimeParameter('shapeBurstStrength', parseFloat(el.value)));

    // Phase 3 bindings (Image Upload & Recording)
    bind("#centerImageScale", el => {
      params.centerImageScale = parseFloat(el.value) / 125; // Map 0-150 slider to 0-1.2 scale
      centerGraphicController.persistActiveZoom(params.centerImageScale);
    });
    bind("#centerImageOpacity", el => params.centerImageOpacity = parseFloat(el.value));
    bind("#centerImageXDrift", el => params.centerImageXDrift = el.checked);
    bind("#centerImageYDrift", el => params.centerImageYDrift = el.checked);
    bind("#centerImageReactive", el => params.centerImageReactive = el.checked);
    bind("#centerImageColorGrade", el => params.centerImageColorGrade = el.value as any);
    bind("#centerImageColorSource", el => params.centerImageColorSource = el.value as CenterColorSource);
    bind("#centerImageSaturation", el => params.centerImageSaturation = parseFloat(el.value));
    bind("#centerImageHueShift", el => params.centerImageHueShift = parseFloat(el.value));
    bind("#centerImageHueShiftAuto", el => params.centerImageHueShiftAuto = el.checked);
    bind("#centerImageDisplacement", el => commitRuntimeParameter('centerImageDisplacement', parseFloat(el.value)));
    bind("#centerImageKenBurns", el => params.centerImageKenBurns = el.checked);
    bind("#centerImageKenBurnsSpeed", el => params.centerImageKenBurnsSpeed = parseFloat(el.value));
    bind("#centerImageMotionProfile", el => params.centerImageMotionProfile = el.value as any);
    bind("#centerImageMotionType", el => commitRuntimeParameter('centerImageMotionType', el.value));
    bind("#centerImageMotionAmount", el => commitRuntimeParameter('centerImageMotionAmount', parseFloat(el.value)));
    bind("#centerImageMotionIntensity", el => commitRuntimeParameter('centerImageMotionIntensity', parseFloat(el.value)));
    bind("#centerImageMotionAudio", el => params.centerImageMotionAudio = false); // Phase 12D.8: Audio Motion toggle removed/ignored
    bind("#centerImageAberration", el => params.centerImageAberration = parseFloat(el.value));
    bind("#centerImageJitter", el => params.centerImageJitter = parseFloat(el.value));
    bind("#centerImageKaleidoscope", el => params.centerImageKaleidoscope = parseFloat(el.value));
    bind("#centerImageAutoRotate", el => {
      const wasRotating = params.centerImageAutoRotate;
      params.centerImageAutoRotate = el.checked;
      if (wasRotating && !el.checked) {
        startAngleTween(centerImageRotationHomeTween, centerGraphicController.autoRotationAngle, 0, 0.9, easeOutSine);
      } else if (el.checked) {
        centerImageRotationHomeTween.active = false;
      }
    });
    bind("#centerImageVisible", el => {
      params.centerImageVisible = el.checked;
      centerGraphicController.hidden = !el.checked; // Sync centerGraphicController.hidden with checkbox (inverted logic)
    });
    bind("#centerImageRotationSpeed", el => params.centerImageRotationSpeed = parseFloat(el.value));
    bind("#autoRotateSpeed", el => params.autoRotateSpeed = parseFloat(el.value));
    bind("#centerImageRGBOffset", el => params.centerImageRGBOffset = parseFloat(el.value));
    bind("#centerImageRGBAngle", el => params.centerImageRGBAngle = parseFloat(el.value));
    bind("#centerImageRGBAutoRotate", el => params.centerImageRGBAutoRotate = el.checked);
    bind("#recordFPS", el => params.recordFPS = parseInt(el.value, 10));
    bind("#recordCountdown", el => params.recordCountdown = el.checked);

    // Phase 4 bindings (Zoom Osc)
    bind("#zoomOsc", el => {
      params.zoomOsc = parseFloat(el.value);
    });
    bind("#zoomOscSpeed", el => {
      params.zoomOscSpeed = parseFloat(el.value);
    });
    bind("#zoomRings", el => {
      params.zoomRings = parseInt(el.value, 10);
    });

    // Phase 5 bindings (Eclipse Glow, Gamma Blast)
    bind("#eclipseWeight", el => params.eclipseWeight = parseFloat(el.value));
    bind("#gammaBlast", el => params.gammaBlast = parseFloat(el.value));

    // Phase 6 bindings (Macros, Frequency Bands, Beat Detection)
    bind("#macro1", el => {
      params.macro1 = parseFloat(el.value);
      scheduleMacroUpdate('macro1', params.macro1);
    });
    // Phase 4.8D.2D — Macro 2 is intentionally NOT bound to a live DOM input.
    // React's MacroKnob keeps its drag draft local and App.handleMacroCommit is
    // the single runtime publication point on release. This removes the legacy
    // second authority path that could otherwise fight rotation ownership.
    bind("#macro3", el => {
      params.macro3 = parseFloat(el.value);
      scheduleMacroUpdate('macro3', params.macro3);
    });
    bind("#macro4", el => {
      params.macro4 = parseFloat(el.value);
      scheduleMacroUpdate('macro4', params.macro4);
    });
    bind("#frequencyBand", el => {
      params.frequencyBand = el.value;
      updateMetadataDisplay();
    });
    bind("#beatDetect", el => {
      params.beatDetect = el.checked;
      updateMetadataDisplay();
    });
    bind("#beatSensitivity", el => commitRuntimeParameter('beatSensitivity', parseFloat(el.value)));
    bind("#effectAmount", el => commitRuntimeParameter('effectAmount', parseFloat(el.value)));
    bind("#darkStrobeDepth", el => commitRuntimeParameter('darkStrobeDepth', parseFloat(el.value)));
    bind("#darkStrobeDisplacement", el => commitRuntimeParameter('darkStrobeDisplacement', parseFloat(el.value)));
    bind("#beatPulseType", el => {
      commitRuntimeParameter('beatPulseType', el.value);

      // 🔧 Show/hide Spark Impact controls based on effect type
      const sparkAmpsControl = document.getElementById('sparkAmpsControl');
      const sparkTrailControl = document.getElementById('sparkTrailControl');
      const sparkDispersionControl = document.getElementById('sparkDispersionControl');
      const darkStrobeDepthControl = document.getElementById('darkStrobeDepthControl');
      const darkStrobeDisplacementControl = document.getElementById('darkStrobeDisplacementControl');
      const showSparkControls = el.value === 'spark' || el.value === 'all';
      const showDarkStrobeControls = el.value === 'dark-strobe' || el.value === 'all';

      if (sparkAmpsControl) {
        sparkAmpsControl.style.display = showSparkControls ? '' : 'none';
      }
      if (sparkTrailControl) {
        sparkTrailControl.style.display = showSparkControls ? '' : 'none';
      }
      if (sparkDispersionControl) {
        sparkDispersionControl.style.display = showSparkControls ? '' : 'none';
      }
      if (darkStrobeDepthControl) {
        darkStrobeDepthControl.style.display = showDarkStrobeControls ? '' : 'none';
      }
      if (darkStrobeDisplacementControl) {
        darkStrobeDisplacementControl.style.display = showDarkStrobeControls ? '' : 'none';
      }
    });
    // Motion Blur Trails bindings
    bind("#motionBlurEnabled", el => {
      params.motionBlurEnabled = el.checked;
      // Clear trail buffer when toggling off
      if (!el.checked) {
        getMotionBlurEngine().clear();
      }
    });
    bind("#motionBlurPersistence", el => params.motionBlurPersistence = parseFloat(el.value));
    bind("#motionBlurMode", el => params.motionBlurMode = el.value as 'multiply' | 'alpha');
    // TIER 1: New bindings
    bind("#beatAccent", el => params.beatAccent = parseFloat(el.value));
    bind("#energyGate", el => params.energyGate = el.checked);
    bind("#energyThreshold", el => params.energyThreshold = parseFloat(el.value));
    bind("#energyRelease", el => params.energyRelease = parseFloat(el.value));

    // LIQUID SHAPER - WebGL Sacred Geometry bindings
    // 🔥 PERFORMANCE: Beat-synced updates to prevent choking on heavy effects

    // Helper to schedule parameter change on next beat (like macros)
    // 🔧 FIX SLIDERS: Apply Liquid Shaper param changes IMMEDIATELY to window.params.
    //    Previously used setPendingLiquidChanges → React state → only flushed on beat.
    //    Result: every slider was completely dead unless audio was playing and a beat fired.
    //    Now: direct write to params, React state updated only for UI sync (no re-render cost).
    const scheduleLiquidUpdate = (paramName: string, value: any) => {
      // Immediate: write to the live params object so RAF loop sees it next frame
      const liveParams = (window as any).params;
      if (liveParams) liveParams[paramName] = value;
      // Also queue for React state sync (deferred, non-blocking)
      liquidShaperFeature.queueControlChange(paramName, value);
    };

    // Immediate updates (checkboxes, dropdowns - no performance impact)
    bind("#astralShaper", el => params.astralShaper = el.checked);
    bind("#astralShape", el => params.astralShape = el.value as ShapeType);
    bind("#astralAutoCycle", el => params.astralAutoCycle = el.checked);
    bind("#astralCycleSpeed", el => params.astralCycleSpeed = el.value as AutoCycleSpeed);
    bind("#astralBeatFlash", el => params.astralBeatFlash = el.checked);
    bind("#astralDepthEffect", el => params.astralDepthEffect = el.checked);
    bind("#astralKaleidoscope", el => params.astralKaleidoscope = el.checked);
    bind("#astralRainbowSpectrum", el => params.astralRainbowSpectrum = el.checked);
    bind("#astralUseGlobalColor", el => params.astralUseGlobalColor = el.checked);
    bind("#astralMorphMode", el => params.astralMorphMode = el.value);
    bind("#astralCustomColor", el => params.astralCustomColor = el.value);
    bind("#astralMorphOrigin", el => params.astralMorphOrigin = el.value as 'uniform' | 'center' | 'polarity');

    // Beat-synced updates (sliders - can cause performance issues)
    bind("#astralMorphAmount", el => scheduleLiquidUpdate('astralMorphAmount', parseFloat(el.value)));
    bind("#astralMorphDamping", el => scheduleLiquidUpdate('astralMorphDamping', parseFloat(el.value)));
    bind("#astralFieldModulation", el => scheduleLiquidUpdate('astralFieldModulation', parseFloat(el.value)));
    bind("#astralAudioInfluence", el => scheduleLiquidUpdate('astralAudioInfluence', parseFloat(el.value)));
    bind("#astralPulseDepth", el => scheduleLiquidUpdate('astralPulseDepth', parseFloat(el.value)));
    bind("#astralEnergyGlow", el => scheduleLiquidUpdate('astralEnergyGlow', parseFloat(el.value)));
    bind("#astralRotationMult", el => scheduleLiquidUpdate('astralRotationMult', parseFloat(el.value)));
    bind("#astralRotationJitter", el => scheduleLiquidUpdate('astralRotationJitter', parseFloat(el.value)));
    bind("#astralScale", el => scheduleLiquidUpdate('astralScale', parseFloat(el.value)));
    bind("#astralSymmetryFold", el => scheduleLiquidUpdate('astralSymmetryFold', parseFloat(el.value)));

    // Special cases: texture cache must clear immediately so new shape texture generates
    bind("#astralLineThickness", el => {
      scheduleLiquidUpdate('astralLineThickness', parseFloat(el.value));
      clearTextureCache(); // 🔧 FIX: immediate cache clear — was deferred to beat, so old texture persisted
    });
    bind("#astralStrokeStyle", el => {
      const newStyle = el.value as StrokeStyle;
      // Queue React state sync immediately
      liquidShaperFeature.queueControlChange('astralStrokeStyle', newStyle);
      // Defer param write + cache clear to next RAF start so both apply co-atomically,
      // preventing the 1-frame flash caused by mid-frame param/cache state mismatch.
      cancelTrackedShortLivedRaf(astralStrokeStyleRaf.current);
      astralStrokeStyleRaf.current = requestTrackedShortLivedRaf('astral-stroke-style-sync', () => {
        astralStrokeStyleRaf.current = null;
        const liveParams = (window as any).params;
        if (liveParams) liveParams.astralStrokeStyle = newStyle;
        clearTextureCache();
      });
    });
    bind("#astralRGBOffset", el => {
      params.astralRGBOffset = parseFloat(el.value);
      // Disable Energy Glow when RGB Offset is active (prevents visual conflict)
      const energyGlowToggle = document.querySelector<HTMLInputElement>("#astralEnergyGlow");
      if (energyGlowToggle) {
        if (params.astralRGBOffset > 0.01) {
          energyGlowToggle.disabled = true;
          // ENHANCED: Energy Glow is now a slider, set to 0
          (energyGlowToggle as HTMLInputElement).value = '0';
          params.astralEnergyGlow = 0;
          // Visual feedback for disabled state (slider, not switch)
          (energyGlowToggle as HTMLElement).style.opacity = '0.4';
          (energyGlowToggle as HTMLElement).style.pointerEvents = 'none';
        } else {
          energyGlowToggle.disabled = false;
          // Restore visual state
          (energyGlowToggle as HTMLElement).style.opacity = '1';
          (energyGlowToggle as HTMLElement).style.pointerEvents = 'auto';
        }
      }
    });
    bind("#astralRGBAngle", el => params.astralRGBAngle = parseFloat(el.value));
    bind("#astralRGBAutoRotate", el => params.astralRGBAutoRotate = el.checked);

    bind("#rotationSyncMode", el => {
      const oldMode = params.rotationSyncMode;
      const newMode = el.value;
      params.rotationSyncMode = newMode;

      // 🔥 PRIORITY 1 FIX: Reset rotation state when mode changes (prevents stuttering!)
      // Note: angle will be passed from render loop, so we use 0 as placeholder here
      // The actual reset happens in render loop when mode change is detected
      if (oldMode !== newMode) {
        if (debugGeneral) console.log(`🔄 Rotation mode changed: ${oldMode} → ${newMode}`);
        resetRotationState(newMode, getAngle());
      }

      // Preserve the user's selected division across rotation-mode changes.
      const rotationQuantizeDropdown = query("#rotationQuantize") as HTMLSelectElement;
      if (rotationQuantizeDropdown) {
        if (el.value === 'free') {
          rotationQuantizeDropdown.disabled = true;
          rotationQuantizeDropdown.style.opacity = '0.45';
          rotationQuantizeDropdown.style.cursor = 'not-allowed';
          rotationQuantizeDropdown.title = 'Quantize division is disabled in Free rotation mode.';
        } else {
          rotationQuantizeDropdown.disabled = false;
          rotationQuantizeDropdown.style.opacity = '1';
          rotationQuantizeDropdown.style.cursor = 'pointer';
          rotationQuantizeDropdown.title = 'Rotation sync division.';
        }
      }

      recalculateRotationSpeed(); // 🔥 Recalculate rotation speed
      // Gray out Free Rotation slider when not in free mode
      const rotSlider = query("#rot") as HTMLInputElement;
      if (rotSlider) {
        const speedEnabled = el.value === 'free' || el.value === 'quantized';
        rotSlider.disabled = !speedEnabled;
        rotSlider.style.opacity = speedEnabled ? '1' : '0.3';
        rotSlider.style.cursor = speedEnabled ? 'pointer' : 'not-allowed';
        rotSlider.title = speedEnabled
          ? 'Signed rotation speed: negative reverses, ±2.00 is double speed.'
          : (el.value === 'bpm' ? 'Rotation speed is BPM-owned in BPM Sync mode.' : 'Rotation speed is owned by the selected motion mode.');
      }
    });
    bind("#rotationQuantize", el => {
      // Division changes rephase inside RotationAuthority without a North/South home.
      params.rotationQuantize = el.value;
      recalculateRotationSpeed();
    });

    // BPM and cycle-beat fields use draft-safe commit semantics. Partial text is
    // never clamped or overwritten while focused; Enter/blur commits and Escape cancels.
    let syncingBpmClockControl = false;
    const bpmDraftInput = query("#bpm") as HTMLInputElement | null;
    const barsDraftInput = query("#bars") as HTMLInputElement | null;
    let lastCommittedBpm = Math.max(40, Math.min(220, Math.round(params.bpm || 174)));
    let lastCommittedBars = Math.max(1, Math.min(32, Math.round(params.bars || 8)));

    const commitBpmDraft = () => {
      if (!bpmDraftInput) return;
      const parsed = Number.parseFloat(bpmDraftInput.value);
      const next = Number.isFinite(parsed)
        ? Math.max(40, Math.min(220, Math.round(parsed)))
        : lastCommittedBpm;
      lastCommittedBpm = next;
      bpmDraftInput.value = String(next);
      params.bpm = next;
      if (!syncingBpmClockControl) bpmClockRuntime.setManualBpm(next, performance.now());
      recalculateRotationSpeed();
    };
    const commitBarsDraft = () => {
      if (!barsDraftInput) return;
      const parsed = Number.parseFloat(barsDraftInput.value);
      const next = Number.isFinite(parsed)
        ? Math.max(1, Math.min(32, Math.round(parsed)))
        : lastCommittedBars;
      lastCommittedBars = next;
      barsDraftInput.value = String(next);
      params.bars = next;
      recalculateRotationSpeed();
    };
    const attachDraftControl = (
      input: HTMLInputElement | null,
      commit: () => void,
      cancelValue: () => number,
    ) => {
      if (!input) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          input.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          input.value = String(cancelValue());
          input.blur();
        }
      };
      const onBlur = () => commit();
      eventRegistry.listen(input, 'keydown', onKeyDown);
      eventRegistry.listen(input, 'blur', onBlur);
    };
    attachDraftControl(bpmDraftInput, commitBpmDraft, () => lastCommittedBpm);
    attachDraftControl(barsDraftInput, commitBarsDraft, () => lastCommittedBars);

    // TIER 1: Initialize rotation sync mode AND quantize immediately from dropdowns
    const rotationSyncDropdown = query("#rotationSyncMode") as HTMLSelectElement;
    if (rotationSyncDropdown) {
      params.rotationSyncMode = rotationSyncDropdown.value || 'free';
      // Set initial state of Free Rotation slider
      const rotSlider = query("#rot") as HTMLInputElement;
      if (rotSlider) {
        const speedEnabled = ['free', 'quantized'].includes(rotationSyncDropdown.value);
        rotSlider.disabled = !speedEnabled;
        rotSlider.style.opacity = speedEnabled ? '1' : '0.3';
        rotSlider.style.cursor = speedEnabled ? 'pointer' : 'not-allowed';
      }
    }

    // Initialize quantize division
    const rotationQuantizeDropdown = query("#rotationQuantize") as HTMLSelectElement;
    if (rotationQuantizeDropdown) {
      params.rotationQuantize = rotationQuantizeDropdown.value || params.rotationQuantize || '2/1';
      const mode = ((params as any).rotationSyncMode || 'free') as string;
      rotationQuantizeDropdown.disabled = mode === 'free';
      rotationQuantizeDropdown.style.opacity = mode === 'free' ? '0.45' : '1';
      rotationQuantizeDropdown.style.cursor = mode === 'free' ? 'not-allowed' : 'pointer';
      rotationQuantizeDropdown.title = mode === 'free'
        ? 'Quantize division is disabled in Free rotation mode.'
        : 'Rotation sync division.';
    }

    // 🔥 PERFORMANCE FIX: Initialize BPM and bars from inputs on load
    const bpmInput = query("#bpm") as HTMLInputElement;
    const barsInput = query("#bars") as HTMLInputElement;
    if (barsInput) {
      params.bars = parseFloat(barsInput.value) || 8;
      lastCommittedBars = Math.max(1, Math.min(32, Math.round(params.bars)));
    }

    const syncBpmClockState = (state: ReturnType<typeof bpmClockRuntime.frame>) => {
      params.bpm = state.bpm;
      if (bpmInput && document.activeElement !== bpmInput && Number(bpmInput.value) !== state.bpm) {
        syncingBpmClockControl = true;
        try {
          lastCommittedBpm = state.bpm;
          bpmInput.value = String(state.bpm);
        } finally {
          syncingBpmClockControl = false;
        }
      }
      recalculateRotationSpeed();
      updateMetadataDisplay();
    };
    const unsubscribeBpmClock = bpmClockRuntime.subscribe(() => {
      syncBpmClockState(bpmClockRuntime.frame(performance.now()));
    });
    sessionDisposer.add(unsubscribeBpmClock);

    // 🔥 CRITICAL: Calculate initial rotation speed
    recalculateRotationSpeed();

    initializeVisualizerControlDefaults({
      params,
      query,
      asyncRegistry,
    });

}
