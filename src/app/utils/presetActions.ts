// ORBITAL — Preset / Palette / Reset Actions
//
// Extracted from App.tsx (Beta cleanup, Phase 1 of the mega-effect decomposition).
// This is a verbatim relocation, not a redesign: every function below behaves exactly
// as it did inline in App.tsx. Cross-cutting state that the render loop reads directly
// every frame (palette, selectedPaletteIndex, and ~20 render-loop accumulator variables
// reset by resetToDefaults) was deliberately left declared in App.tsx and is reached
// through the getter/setter bridges in PresetActionsContext below, specifically so the
// render loop itself required zero changes for this extraction.
//
// Called once from inside the main effect in App.tsx via:
//   const presetActions = createPresetActions(ctx);
// with its returned functions destructured back into the same local names that were
// used inline before this extraction, so every existing call site keeps working unchanged.

import { palettes, type ColorPalette } from '../data/colorPalettes';
import { presets } from '../data/presets';
import { defaultParams } from '../config/defaultParams';
import { normalizeBeatPulseType, AVAILABLE_BEAT_PULSE_TYPES } from '../config/beatPulseTypes';
import { GENERIC_PRESET_PARAMETERS, readOwnedControl, writeOwnedControl } from '../config/presetParameterOwnership';
import {
  normalizeDotDensityForSlider,
  normalizeSpikeFftExponent,
} from '../config/parameterConversions';
import { macroMappings, type MacroMapping } from '../config/macroDefinitions';
import { createHueFromPaletteFunction, avg, clamp, lerp } from './audioVisualizationHelpers';
import { safeLocalStorage } from './browserCompat';
import { DEBUG_AUDIO, DEBUG_FLAGS, DEBUG_GENERAL, DEBUG_PERF, DEBUG_WEBGL } from '../src/app/config/debugFlags';
import {
  clearStaleCache,
  getActiveCycleShapes,
  syncLiquidShapeSelect,
  type ShapeType,
  type StrokeStyle,
  type AutoCycleSpeed,
} from './astralShaper';
import { bpmClockRuntime } from '../runtime/bpm/BpmClockRuntime';
import { setActivePresetName } from '../runtime/presetNameRuntimeStore';
import {
  cancelTrackedInterval,
  cancelTrackedShortLivedRaf,
  cancelTrackedTimeout,
  requestTrackedShortLivedRaf,
  scheduleTrackedInterval,
  scheduleTrackedTimeout,
} from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { createPaletteCycleController } from './presetActions/paletteCycleController';
import { createSectionResets } from './presetActions/sectionResets';
import {
  applyRuntimeParameterTransaction,
  dispatchRuntimeParameterTransaction,
} from '../runtime/parameters/RuntimeParameterTransactions';

type CenterTransitionType = 'fade' | 'crossfade' | 'zoom' | 'instant' | 'flashZoom' | 'pushFade' | 'signalScan' | 'glitchCut';

const $ = (sel: string) => document.querySelector(sel);

export interface PresetActionsContext {
  params: any;
  coreTexturesEngineRef: { current: any };
  eventHandlers: { documentClick?: () => void; [key: string]: any };
  centerImageRotationHomeTween: { active: boolean; [key: string]: any };
  rotationHomeTween: { active: boolean; [key: string]: any };
  setCenterImageAutoRotationAngle: (v: number) => void;
  setMacroValues: (updater: any) => void;
  applyPendingLiquidChanges: () => void;
  applyPendingMacroChanges: () => void;
  updateMetadataDisplay: () => void;
  getAstralMorphEngine: () => { reset: () => void };
  toggleAutoCycle: () => void;
  replayCenterTransitionPreview: (type: CenterTransitionType) => void;
  startRotationHomeEase: (fromAngle: number, duration?: number) => void;
  startMacro2RotationCommit: (targetRotation: number) => void;
  // Render-loop-critical palette state — declared in App.tsx, read by the render loop
  // every frame. Bridged rather than moved so the render loop needed zero changes here.
  getAngle: () => number;
  getPalette: () => ColorPalette;
  getSelectedPaletteIndex: () => number;
  setPaletteState: (idx: number) => void;
  getAutoCycleEnabled: () => boolean;
  getAutoCycleSpeed: () => number;
  setAutoCycleSpeed: (v: number) => void;
  setCenterImageHidden: (v: boolean) => void;
  // Bundles the ~20 write-only render-loop accumulator resets that resetToDefaults
  // previously inlined directly (centerImageAutoRotationAngle, beatPulse, cornerFlashPulse,
  // quadrantFlashIntensity, beatEnergyHistoryBuffer, organicFadeStrength, energyGateActive,
  // rotationSyncAccumulator, transitionProgress/transitionFrom, etc.) — see App.tsx for the
  // exact list. Kept as one bundled callback rather than ~20 individual getter/setters.
  resetRenderLoopMiscState: () => void;
  clearPendingControlTransactions: () => void;
}

interface PresetApplicationOptions {
  syncMacros?: boolean;
  deferDomSync?: boolean;
}

export function createPresetActions(ctx: PresetActionsContext) {
  const { params } = ctx;
  const eventAbort = new AbortController();
  const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options: AddEventListenerOptions = {},
  ) => target.addEventListener(type, listener, { ...options, signal: eventAbort.signal });
  const scheduleTimeout = (callback: () => void, delay: number) => {
    const id = scheduleTrackedTimeout('preset-actions-timeout', () => {
      timeoutIds.delete(id);
      if (!eventAbort.signal.aborted) callback();
    }, delay);
    timeoutIds.add(id);
    return id;
  };
  let controlTransactionGeneration = 0;
  const scheduleLatestControlTransaction = (tasks: Array<() => void>): void => {
    const generation = ++controlTransactionGeneration;
    const startedAt = performance.now();
    let cursor = 0;
    window.dispatchEvent(new CustomEvent('orbital:control-transaction-start', {
      detail: { generation, taskCount: tasks.length },
    }));
    const flushChunk = () => {
      if (eventAbort.signal.aborted || generation !== controlTransactionGeneration) return;
      const chunkStart = performance.now();
      let processed = 0;
      while (cursor < tasks.length && processed < 8 && performance.now() - chunkStart < 2) {
        tasks[cursor++]();
        processed += 1;
      }
      if (cursor < tasks.length) {
        scheduleTimeout(flushChunk, 0);
        return;
      }
      const detail = { generation, taskCount: tasks.length, durationMs: performance.now() - startedAt };
      (window as any).__ORBITAL_LAST_CONTROL_TRANSACTION__ = detail;
      window.dispatchEvent(new CustomEvent('orbital:control-transaction-complete', { detail }));
    };
    scheduleTimeout(flushChunk, 0);
  };
    // Sprint C: palette menu, favorites and color auto-cycle live in
    // ./presetActions/paletteCycleController.ts (moved verbatim).
    const {
      paletteLabel,
      saveFavorites,
      renderPaletteMenu,
      setPaletteByName,
      nextPalette,
      startCycle,
      stopCycle,
    } = createPaletteCycleController({ ctx, listen, scheduleTimeout });

    // PHASE 3: Preset System (data imported from /data/presets.ts)
    
    const presetSelect = $("#presetSelect") as HTMLSelectElement;
    const randomizeBtn = $("#randomize");
    const resetMacrosBtn = $("#resetMacros");
    
    function applyPreset(preset: any, options: PresetApplicationOptions = {}) {
      // Sprint 21: give the visual canvas a brief transition window while bulk preset DOM events fire.
      document.documentElement.classList.add('orbital-preset-transitioning');
      scheduleTimeout(() => document.documentElement.classList.remove('orbital-preset-transitioning'), 260);
      // A random roll publishes its runtime values immediately, then synchronizes
      // control DOM/events in bounded latest-wins chunks. This avoids one 90-event
      // long task competing with audio and the visible renderer.
      const deferredControlEvents: Array<() => void> = [];
      if (options.deferDomSync) applyRuntimeParameterTransaction(params, preset);
      const dispatchControlEvent = (el: HTMLElement) => {
        const dispatch = () => el.dispatchEvent(new Event('input', { bubbles: true }));
        if (options.deferDomSync) deferredControlEvents.push(dispatch);
        else dispatch();
      };
      // Apply all slider and checkbox values
      const setSlider = (id: string, val: number) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          el.value = String(val);
          dispatchControlEvent(el);
        }
      };
      
      const setCheckbox = (id: string, val: boolean) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          el.checked = val;
          dispatchControlEvent(el);
        }
      };
      
      const setSelect = (id: string, val: string | number) => {
        const el = $(id) as HTMLSelectElement;
        if (el) {
          if (id === '#astralShape') syncLiquidShapeSelect(el, String(val) as ShapeType);
          else el.value = String(val);
          dispatchControlEvent(el);
        }
      };

      const setCoreParticleShapeMode = (value: unknown) => {
        const mode = value === 'tri' || value === 'dia' || value === 'all' ? value : 'dot';
        applyRuntimeParameterTransaction(params, { coreParticlesShapeMode: mode });
        const dispatch = () => dispatchRuntimeParameterTransaction({ coreParticlesShapeMode: mode }, 'preset');
        if (options.deferDomSync) deferredControlEvents.push(dispatch);
        else dispatch();
      };
      
      // Animation
      setSlider("#rot", preset.rotation);
      setSlider("#mirror", preset.mirror);
      setSlider("#gamma", preset.gamma);
      setSlider("#iridize", preset.iridize);
      setSlider("#chaos", preset.chaos);
      
      // Outer Halo + Center Layer
      setSlider("#halo", preset.halo);
      setSlider("#bloom", preset.bloom);
      setCheckbox("#glowCenter", preset.glowCenter);
      setSlider("#glowStrength", preset.glowStrength);
      setCheckbox("#haloCometEnabled", preset.haloCometEnabled ?? defaultParams.haloCometEnabled);
      setSlider("#haloCometSpeed", preset.haloCometSpeed ?? defaultParams.haloCometSpeed);
      setCheckbox("#haloStrobeEnabled", preset.haloStrobeEnabled ?? defaultParams.haloStrobeEnabled);
      setSlider("#haloStrobeDivision", preset.haloStrobeDivision ?? defaultParams.haloStrobeDivision);
      setSlider("#haloCometDirection", preset.haloCometDirection ?? defaultParams.haloCometDirection);
      setSlider("#haloCometThickness", preset.haloCometThickness ?? defaultParams.haloCometThickness);
      setSlider("#haloCometTailLength", preset.haloCometTailLength ?? defaultParams.haloCometTailLength);
      
      // Shockwave
      setCheckbox("#shockwave", preset.shockwave);
      setSlider("#shockwaveThreshold", preset.shockwaveThreshold !== undefined ? preset.shockwaveThreshold : 0.6);
      setSlider("#shockwaveRings", (preset as any).shockwaveRings !== undefined ? (preset as any).shockwaveRings : 3);
      
      // Impact Sparks
      setSlider("#sparkAmps", (preset as any).sparkAmps !== undefined ? (preset as any).sparkAmps : 0.3);
      setSlider("#sparkTrail", (preset as any).sparkTrail !== undefined ? (preset as any).sparkTrail : 0.3);
      setSlider("#sparkDispersion", (preset as any).sparkDispersion !== undefined ? (preset as any).sparkDispersion : 0.45);
      
      // Dots
      setCheckbox("#dotsOn", preset.dotsOn);
      setCheckbox("#dotsPulse", preset.dotsPulse);
      // ❌ REMOVED: trail slider (fade is automatic from toggle)
      setSlider("#density", normalizeDotDensityForSlider(preset.dotsDensity));
      setSlider("#dotSize", preset.dotSize !== undefined ? preset.dotSize : 2.0);
      setSlider("#dotGlow", preset.dotGlow !== undefined ? preset.dotGlow : 0.3);
      setSlider("#dotRipple", preset.dotRipple !== undefined ? preset.dotRipple : defaultParams.dotRipple);
      setSlider("#dotReactivity", preset.dotReactivity !== undefined ? preset.dotReactivity : 1.0);
      
      // 🔴 CRITICAL FIX: Motion FX - ALWAYS set values (use defaults if not in preset)
      setSlider("#hueSpeed", preset.hueSpeed !== undefined ? preset.hueSpeed : 1.0);
      setSlider("#zoomOsc", preset.zoomOsc !== undefined ? preset.zoomOsc : 0.0);
      
      // 🔴 CRITICAL FIX: Audio Engine Controls - ALWAYS set values
      setSlider("#fft", normalizeSpikeFftExponent(preset.fftSize));
      // 🎯 NEW REACTIVITY SYSTEM - Map old smoothing to new reactivity (inverted!)
      if (preset.reactivity !== undefined) {
        setSlider("#reactivity", preset.reactivity);
      } else if (preset.smoothing !== undefined) {
        // Legacy preset: convert old smoothing (0=reactive, 1=smooth) to new reactivity (0=smooth, 1=reactive)
        setSlider("#reactivity", 1.0 - preset.smoothing);
      } else {
        setSlider("#reactivity", 0.50); // Default: 50% (Balanced)
      }
      setCheckbox("#frequencySmoothing", preset.frequencySmoothing !== undefined ? preset.frequencySmoothing : true);
      setCheckbox("#beatReactivityBoost", preset.beatReactivityBoost !== undefined ? preset.beatReactivityBoost : false);
      
      // Spike Ring Enhancements - ALWAYS set values (use defaults if not in preset)
      setSlider("#spikeAttack", preset.spikeAttack !== undefined ? preset.spikeAttack : 0.20);
      setSlider("#spikeTightness", preset.spikeTightness !== undefined ? preset.spikeTightness : 2.0);
      setSlider("#spikeBloom", preset.spikeBloom !== undefined ? preset.spikeBloom : 0.5);
      setSlider("#spikeVariety", preset.spikeVariety !== undefined ? preset.spikeVariety : defaultParams.spikeVariety);
      setSlider("#transientBoost", preset.transientBoost !== undefined ? preset.transientBoost : 0.5);
      
      // Auto Zoom
      setCheckbox("#autoZoom", preset.autoZoom);
      
      // 🔴 CRITICAL FIX: Auto-Rotate Speed - ALWAYS set value
      setSelect("#autoRotateSpeed", preset.autoRotateSpeed !== undefined ? preset.autoRotateSpeed : 1);
      
      // Palette
      if (preset.palette !== undefined) {
        ctx.setPaletteState(preset.palette);
        if (paletteLabel) paletteLabel.textContent = palettes[preset.palette].name;
        renderPaletteMenu();
      }
      
      // Liquid Shaper
      setCheckbox("#astralShaper", (preset as any).astralShaper !== undefined ? (preset as any).astralShaper : false);
      setSelect("#astralShape", (preset as any).astralShape !== undefined ? (preset as any).astralShape : defaultParams.astralShape);
      setSlider("#astralMorphAmount", (preset as any).astralMorphAmount !== undefined ? (preset as any).astralMorphAmount : defaultParams.astralMorphAmount);
      setSlider("#astralMorphDamping", (preset as any).astralMorphDamping !== undefined ? (preset as any).astralMorphDamping : defaultParams.astralMorphDamping);
      setSelect("#astralMorphMode", (preset as any).astralMorphMode !== undefined ? (preset as any).astralMorphMode : 'path-interpolate');
      setSelect("#astralMorphOrigin", (preset as any).astralMorphOrigin !== undefined ? (preset as any).astralMorphOrigin : 'uniform');
      setSlider("#astralFieldModulation", (preset as any).astralFieldModulation !== undefined ? (preset as any).astralFieldModulation : 0);
      setCheckbox("#astralAutoCycle", (preset as any).astralAutoCycle !== undefined ? (preset as any).astralAutoCycle : true);
      setSelect("#astralCycleSpeed", (preset as any).astralCycleSpeed !== undefined ? (preset as any).astralCycleSpeed : 'slow');
      setSlider("#astralAudioInfluence", (preset as any).astralAudioInfluence !== undefined ? (preset as any).astralAudioInfluence : defaultParams.astralAudioInfluence);
      setSlider("#astralPulseDepth", (preset as any).astralPulseDepth !== undefined ? (preset as any).astralPulseDepth : defaultParams.astralPulseDepth);
      // ENHANCED: Energy Glow is now a slider (0-1)
      setSlider("#astralEnergyGlow", (preset as any).astralEnergyGlow !== undefined ? (preset as any).astralEnergyGlow : 0);
      setSlider("#astralRotationMult", (preset as any).astralRotationMult !== undefined ? (preset as any).astralRotationMult : defaultParams.astralRotationMult);
      setCheckbox("#astralRotationSpeedMod", (preset as any).astralRotationSpeedMod !== undefined ? (preset as any).astralRotationSpeedMod : defaultParams.astralRotationSpeedMod);
      setSlider("#astralRotationJitter", (preset as any).astralRotationJitter !== undefined ? (preset as any).astralRotationJitter : 0);
      setSlider("#astralComplexity", (preset as any).astralComplexity !== undefined ? (preset as any).astralComplexity : 5);
      setSlider("#astralLineThickness", (preset as any).astralLineThickness !== undefined ? (preset as any).astralLineThickness : 0.8);
      setSelect("#astralStrokeStyle", (preset as any).astralStrokeStyle !== undefined ? (preset as any).astralStrokeStyle : 'solid');
      setSlider("#astralScale", (preset as any).astralScale !== undefined ? (preset as any).astralScale : defaultParams.astralScale);
      setSelect("#astralSymmetryFold", (preset as any).astralSymmetryFold !== undefined ? (preset as any).astralSymmetryFold : 6);
      setCheckbox("#astralDepthEffect", (preset as any).astralDepthEffect !== undefined ? (preset as any).astralDepthEffect : true);
      setCheckbox("#astralKaleidoscope", (preset as any).astralKaleidoscope !== undefined ? (preset as any).astralKaleidoscope : false);
      setCheckbox("#astralRainbowSpectrum", (preset as any).astralRainbowSpectrum !== undefined ? (preset as any).astralRainbowSpectrum : false);
      setCheckbox("#astralUseGlobalColor", (preset as any).astralUseGlobalColor !== undefined ? (preset as any).astralUseGlobalColor : true);
      
      // Core Particles
      setCheckbox("#shapeOscillate", (preset as any).shapeOscillate !== undefined ? (preset as any).shapeOscillate : false);
      setSlider("#shapeEdgeTrails", (preset as any).shapeEdgeTrails !== undefined ? (preset as any).shapeEdgeTrails : 0.3);
      setSlider("#shapeDecay", (preset as any).shapeDecay !== undefined ? (preset as any).shapeDecay : defaultParams.shapeDecay);
      setSlider("#shapeDistortion", (preset as any).shapeDistortion !== undefined ? (preset as any).shapeDistortion : 0.30);
      setSlider("#shapeBurstStrength", (preset as any).shapeBurstStrength !== undefined ? (preset as any).shapeBurstStrength : 0.20);
      setSlider("#shapeTurbulence", (preset as any).shapeTurbulence !== undefined ? (preset as any).shapeTurbulence : 0.5);
      setSlider("#shapeOrbitDrift", (preset as any).shapeOrbitDrift !== undefined ? (preset as any).shapeOrbitDrift : 0.30);
      setSlider("#shapeDensity", (preset as any).shapeDensity !== undefined ? (preset as any).shapeDensity : defaultParams.shapeDensity);
      setCoreParticleShapeMode((preset as any).coreParticlesShapeMode ?? defaultParams.coreParticlesShapeMode);
      
      // Energy Gate - Set to defaults if not in preset
      setCheckbox("#energyGate", (preset as any).energyGate !== undefined ? (preset as any).energyGate : defaultParams.energyGate);
      setSlider("#energyThreshold", (preset as any).energyThreshold !== undefined ? (preset as any).energyThreshold : defaultParams.energyThreshold);
      setSlider("#energyRelease", (preset as any).energyRelease !== undefined ? (preset as any).energyRelease : defaultParams.energyRelease);
      
      // Beat Detection
      setCheckbox("#beatDetect", (preset as any).beatDetect !== undefined ? (preset as any).beatDetect : false);
      setSlider("#beatSensitivity", (preset as any).beatSensitivity !== undefined ? (preset as any).beatSensitivity : 0.65);
      setSlider("#effectAmount", (preset as any).effectAmount !== undefined ? (preset as any).effectAmount : 0.5);
      setSelect("#beatPulseType", normalizeBeatPulseType((preset as any).beatPulseType));
      setSlider("#darkStrobeDepth", (preset as any).darkStrobeDepth !== undefined ? (preset as any).darkStrobeDepth : defaultParams.darkStrobeDepth);
      setSlider("#starFieldCount", (preset as any).starFieldCount ?? defaultParams.starFieldCount);
      setSlider("#starFieldSpeed", (preset as any).starFieldSpeed ?? defaultParams.starFieldSpeed);
      setSlider("#starFieldSpread", (preset as any).starFieldSpread ?? defaultParams.starFieldSpread);
      setSlider("#starFieldSize", (preset as any).starFieldSize ?? defaultParams.starFieldSize);
      setSlider("#starFieldFocalDepth", (preset as any).starFieldFocalDepth ?? defaultParams.starFieldFocalDepth);
      setSlider("#starFieldTurbulence", (preset as any).starFieldTurbulence ?? defaultParams.starFieldTurbulence);
      setSlider("#starFieldGlitter", (preset as any).starFieldGlitter ?? defaultParams.starFieldGlitter);
      setSlider("#starFieldTrail", (preset as any).starFieldTrail ?? defaultParams.starFieldTrail);
      setSlider("#starFieldBlendMode", (preset as any).starFieldBlendMode ?? defaultParams.starFieldBlendMode);
      setCheckbox("#starFieldReverse", (preset as any).starFieldReverse ?? defaultParams.starFieldReverse);
      setCheckbox("#starFieldBeatSync", (preset as any).starFieldBeatSync ?? defaultParams.starFieldBeatSync);
      setSlider("#darkStrobeDisplacement", (preset as any).darkStrobeDisplacement !== undefined ? (preset as any).darkStrobeDisplacement : defaultParams.darkStrobeDisplacement);
      setSlider("#beatAccent", (preset as any).beatAccent !== undefined ? (preset as any).beatAccent : 1.0);
      setSelect("#frequencyBand", (preset as any).frequencyBand !== undefined ? (preset as any).frequencyBand : 'full');
      
      // Center Image Layer
      const centerVisible = (preset as any).centerImageVisible !== undefined ? (preset as any).centerImageVisible : true;
      setCheckbox("#centerImageVisible", centerVisible);
      // Sync centerImageHidden with checkbox value (inverted logic: visible=true means hidden=false)
      ctx.setCenterImageHidden(!centerVisible);
      setSlider("#centerImageScale", (preset as any).centerImageScale !== undefined ? Math.round((preset as any).centerImageScale * 125) : Math.round(defaultParams.centerImageScale * 125));
      setSlider("#centerImageOpacity", (preset as any).centerImageOpacity !== undefined ? (preset as any).centerImageOpacity : defaultParams.centerImageOpacity);
      setCheckbox("#centerImageAutoRotate", (preset as any).centerImageAutoRotate !== undefined ? (preset as any).centerImageAutoRotate : false);
      setSlider("#centerImageRotationSpeed", (preset as any).centerImageRotationSpeed !== undefined ? (preset as any).centerImageRotationSpeed : 1.0);
      setCheckbox("#centerImageReactive", (preset as any).centerImageReactive !== undefined ? (preset as any).centerImageReactive : defaultParams.centerImageReactive);
      setSelect("#centerImageColorGrade", (preset as any).centerImageColorGrade !== undefined ? (preset as any).centerImageColorGrade : defaultParams.centerImageColorGrade);
      setSelect("#centerImageColorSource", (preset as any).centerImageColorSource !== undefined ? (preset as any).centerImageColorSource : (defaultParams as any).centerImageColorSource || 'master');
      setSlider("#centerImageSaturation", (preset as any).centerImageSaturation !== undefined ? (preset as any).centerImageSaturation : defaultParams.centerImageSaturation);
      setSlider("#centerImageHueShift", (preset as any).centerImageHueShift !== undefined ? (preset as any).centerImageHueShift : defaultParams.centerImageHueShift);
      setCheckbox("#centerImageHueShiftAuto", (preset as any).centerImageHueShiftAuto !== undefined ? (preset as any).centerImageHueShiftAuto : defaultParams.centerImageHueShiftAuto);
      setSlider("#centerImageDisplacement", (preset as any).centerImageDisplacement !== undefined ? (preset as any).centerImageDisplacement : defaultParams.centerImageDisplacement);
      setSelect("#centerImageMotionType", (preset as any).centerImageMotionType !== undefined ? (preset as any).centerImageMotionType : defaultParams.centerImageMotionType);
      setSlider("#centerImageMotionAmount", (preset as any).centerImageMotionAmount !== undefined ? (preset as any).centerImageMotionAmount : defaultParams.centerImageMotionAmount);
      setSlider("#centerImageMotionIntensity", (preset as any).centerImageMotionIntensity !== undefined ? (preset as any).centerImageMotionIntensity : defaultParams.centerImageMotionIntensity);
      setCheckbox("#centerImageXDrift", (preset as any).centerImageXDrift !== undefined ? (preset as any).centerImageXDrift : defaultParams.centerImageXDrift);
      setCheckbox("#centerImageYDrift", (preset as any).centerImageYDrift !== undefined ? (preset as any).centerImageYDrift : defaultParams.centerImageYDrift);
      setSlider("#centerImageRGBOffset", (preset as any).centerImageRGBOffset !== undefined ? (preset as any).centerImageRGBOffset : defaultParams.centerImageRGBOffset);
      setSlider("#centerImageRGBAngle", (preset as any).centerImageRGBAngle !== undefined ? (preset as any).centerImageRGBAngle : defaultParams.centerImageRGBAngle);

      // Center transition presets — update direct state plus UI for immediate accuracy.
      if ((preset as any).centerImageTransitionType !== undefined) {
        const nextTransition = (preset as any).centerImageTransitionType as CenterTransitionType;
        setSelect("#transitionType", nextTransition);
        ctx.replayCenterTransitionPreview(nextTransition);
      }
      if ((preset as any).centerImageCycleSpeed !== undefined) {
        setSelect("#cycleSpeed", (preset as any).centerImageCycleSpeed);
        ctx.setAutoCycleSpeed(parseInt(String((preset as any).centerImageCycleSpeed), 10) || ctx.getAutoCycleSpeed());
      }
      if ((preset as any).centerImageAutoCycle !== undefined) {
        const shouldCycle = Boolean((preset as any).centerImageAutoCycle);
        const autoCycleEl = $("#autoCycle") as HTMLInputElement;
        if (autoCycleEl) autoCycleEl.checked = shouldCycle;
        if (ctx.getAutoCycleEnabled() !== shouldCycle) ctx.toggleAutoCycle();
      }

      // Sprint K1: preset-owned parameters synced generically (see
      // config/presetParameterOwnership.ts). A preset that omits one of these now
      // gets the default instead of inheriting the previous preset's value.
      for (const entry of GENERIC_PRESET_PARAMETERS) {
        if (!entry.load) continue;
        const el = document.getElementById(entry.key) as HTMLInputElement | HTMLSelectElement | null;
        if (!el) continue;
        writeOwnedControl(el, entry.kind, (preset as any)[entry.key] ?? (defaultParams as any)[entry.key]);
        dispatchControlEvent(el);
      }

      // Core Textures / shader layer presets. These controls are React-driven, so update
      // params + engine + shared UI globals directly instead of forcing App.tsx bloat.
      const corePresetEnabled = Boolean((preset as any).coreTexturesEnabled ?? false);
      (params as any).coreTexturesEnabled = corePresetEnabled;
      (params as any).coreTexturesShaderId = (preset as any).coreTexturesShaderId ?? 'digital-matrix';
      (params as any).coreTexturesOpacity = (preset as any).coreTexturesOpacity ?? 0.8;
      (params as any).coreTexturesAudioIntensity = (preset as any).coreTexturesAudioIntensity ?? 0.6;
      (params as any).coreTexturesFrequencyRange = (preset as any).coreTexturesFrequencyRange ?? 'full';
      (params as any).coreTexturesBeatSync = (preset as any).coreTexturesBeatSync ?? true;
      (params as any).coreTexturesBlendMode = (preset as any).coreTexturesBlendMode ?? 'screen';
      (params as any).coreTexturesScale = (preset as any).coreTexturesScale ?? 1.0;
      (params as any).coreTexturesSpeed = (preset as any).coreTexturesSpeed ?? 1.0;
      (params as any).coreTexturesDensity = (preset as any).coreTexturesDensity ?? 0.5;
      (params as any).coreTexturesGlowIntensity = (preset as any).coreTexturesGlowIntensity ?? 0.6;
      (window as any).__coreTexturesUIEnabled = corePresetEnabled;
      (window as any).__coreTexturesSelectedShader = (params as any).coreTexturesShaderId;
      const coreTextureToggle = $("#coreTexturesEnabled") as HTMLInputElement;
      if (coreTextureToggle) coreTextureToggle.checked = corePresetEnabled;
      ctx.coreTexturesEngineRef.current?.setEnabled?.(corePresetEnabled);
      if ((params as any).coreTexturesShaderId) ctx.coreTexturesEngineRef.current?.selectShader?.((params as any).coreTexturesShaderId);
      ctx.coreTexturesEngineRef.current?.updateParams?.({
        opacity: (params as any).coreTexturesOpacity,
        audioIntensity: (params as any).coreTexturesAudioIntensity,
        frequencyRange: (params as any).coreTexturesFrequencyRange,
        beatSync: (params as any).coreTexturesBeatSync,
        blendMode: (params as any).coreTexturesBlendMode,
        scale: (params as any).coreTexturesScale,
        speed: (params as any).coreTexturesSpeed,
        density: (params as any).coreTexturesDensity,
        glowIntensity: (params as any).coreTexturesGlowIntensity,
      });
      
      // Presets may reverse-map their parameters into macro positions. Factory reset
      // explicitly disables this so all eight macro values remain at zero.
      if (options.syncMacros !== false) syncMacrosToPreset();
      if (options.deferDomSync) scheduleLatestControlTransaction(deferredControlEvents);
    }
    
    // Reverse-calculate macro positions based on current parameter values
    function syncMacrosToPreset() {
      // For each macro, calculate what value (0-100) would produce the current params
      const calculateMacroValue = (macroName: string): number => {
        const mappings = macroMappings[macroName];
        if (!mappings) return 0;
        
        let totalPercentage = 0;
        let validMappings = 0;
        
        mappings.forEach(mapping => {
          const currentValue = (params as any)[mapping.param];
          if (currentValue !== undefined) {
            // Calculate percentage: (current - min) / (max - min)
            const range = mapping.max - mapping.min;
            if (range > 0) {
              const percentage = (currentValue - mapping.min) / range;
              // Clamp to 0-1 range
              const clamped = Math.max(0, Math.min(1, percentage));
              totalPercentage += clamped;
              validMappings++;
            }
          }
        });
        
        // Average the percentages and convert to 0-100
        if (validMappings > 0) {
          return (totalPercentage / validMappings) * 100;
        }
        return 0;
      };
      
      // Update each macro (all 8)
      ['macro1', 'macro2', 'macro3', 'macro4', 'macro5', 'macro6', 'macro7', 'macro8'].forEach(macroName => {
        const macroValue = calculateMacroValue(macroName);
        
        // Update params
        (params as any)[macroName] = macroValue;
        
        // Update UI slider
        const el = $(`#${macroName}`) as HTMLInputElement;
        if (el) {
          el.value = String(macroValue);
        }
        
        // Update visual feedback (knob rotation and value display)
        const fillEl = document.querySelector<SVGPathElement>(`#${macroName}-fill`);
        const valueEl = document.getElementById(`${macroName}-value`);
        if (fillEl) {
          const angle = (macroValue / 100) * 270; // 0-270 degrees (CSS conic-gradient expects this range)
          fillEl.style.strokeDashoffset = String(macroValue - 100);
          (fillEl as any).style.setProperty('--knob-angle', `${angle}deg`);
        }
        if (valueEl) {
          valueEl.textContent = Math.round(macroValue).toString();
        }
      });
    }
    
    // PHASE 3: Custom Preset Saving
    let customPresets: any[] = [];
    
    // Load custom presets from localStorage
    function loadCustomPresets() {
      try {
        const saved = safeLocalStorage.getItem('orbitalCustomPresets');
        if (saved) {
          customPresets = JSON.parse(saved);
        }
        // CRITICAL FIX: Always call updatePresetDropdown, even if no custom presets
        // This ensures built-in presets (including "Blang it Out") are always populated
        updatePresetDropdown();
      } catch (e) {
        console.error('Error loading custom presets:', e);
        // Still update dropdown even if loading fails
        updatePresetDropdown();
      }
    }
    
    // Save custom presets to localStorage
    function saveCustomPresetsToStorage() {
      try {
        safeLocalStorage.setItem('orbitalCustomPresets', JSON.stringify(customPresets));
      } catch (e) {
        console.error('Error saving custom presets:', e);
      }
    }
    
    // Update preset dropdown with custom presets
    function updatePresetDropdown() {
      if (!presetSelect) return;
      
      // Save current selection
      const currentValue = presetSelect.value;
      
      // Clear existing options
      presetSelect.innerHTML = '';
      
      // Add default option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '-1';
      defaultOpt.textContent = '— Choose Preset —';
      presetSelect.appendChild(defaultOpt);
      
      // Add built-in presets
      // 🗑️ REMOVED: Preset debug logging (production-ready)
      presets.forEach((preset, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = preset.name;
        presetSelect.appendChild(opt);
      });
      
      // Add custom presets section if there are any
      if (customPresets.length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─── CUSTOM PRESETS ───';
        presetSelect.appendChild(separator);
        
        customPresets.forEach((preset, idx) => {
          const opt = document.createElement('option');
          opt.value = `custom-${idx}`;
          opt.textContent = `★ ${preset.name}`;
          presetSelect.appendChild(opt);
        });
      }
      
      // Restore selection if possible
      presetSelect.value = currentValue;
    }
    
    // Capture current settings
    function getCurrentSettings() {
      const getSlider = (id: string) => {
        const el = $(id) as HTMLInputElement;
        return el ? parseFloat(el.value) : 0;
      };
      
      const getCheckbox = (id: string) => {
        const el = $(id) as HTMLInputElement;
        return el ? el.checked : false;
      };
      
      const getSelect = (id: string) => {
        const el = $(id) as HTMLSelectElement;
        return el ? el.value : '';
      };
      
      const settings: Record<string, unknown> = {
        rotation: getSlider("#rot"),
        mirror: getSlider("#mirror"),
        gamma: getSlider("#gamma"),
        iridize: getSlider("#iridize"),
        chaos: getSlider("#chaos"),
        halo: getSlider("#halo"),
        bloom: getSlider("#bloom"),
        glowCenter: getCheckbox("#glowCenter"),
        glowStrength: getSlider("#glowStrength"),
        shockwave: getCheckbox("#shockwave"),
        shockwaveThreshold: getSlider("#shockwaveThreshold"),
        shockwaveRings: parseInt((document.getElementById("shockwaveRings") as HTMLInputElement)?.value || "3", 10),
        sparkAmps: getSlider("#sparkAmps"),
        sparkTrail: getSlider("#sparkTrail"),
        sparkDispersion: getSlider("#sparkDispersion"),
        dotsOn: getCheckbox("#dotsOn"),
        dotsPulse: getCheckbox("#dotsPulse"),
        dotsDensity: getSlider("#density"),
        dotSize: getSlider("#dotSize"),
        dotGlow: getSlider("#dotGlow"),
        dotRipple: getSlider("#dotRipple"),
        dotReactivity: getSlider("#dotReactivity"),
        hueSpeed: getSlider("#hueSpeed"),
        fftSize: parseInt(getSlider("#fft").toString(), 10),
        // 🎯 NEW MOTION ARCHITECTURE
        motionIntensity: getSlider("#motionIntensity"),
        motionSmoothing: getSlider("#motionSmoothing"),
        bassBoost: getSlider("#bassBoost"),
        frequencySmoothing: getCheckbox("#frequencySmoothing"),
        beatReactivityBoost: getCheckbox("#beatReactivityBoost"),
        spikeAttack: getSlider("#spikeAttack"),
        spikeTightness: getSlider("#spikeTightness"),
        spikeBloom: getSlider("#spikeBloom"),
        spikeVariety: getSlider("#spikeVariety"),
        transientBoost: getSlider("#transientBoost"),
        autoZoom: getCheckbox("#autoZoom"),
        autoRotateSpeed: parseInt(getSelect("#autoRotateSpeed"), 10) || 1,
        palette: ctx.getSelectedPaletteIndex(),
        beatDetect: getCheckbox("#beatDetect"),
        beatSensitivity: getSlider("#beatSensitivity"),
        effectAmount: getSlider("#effectAmount"),
        beatPulseType: getSelect("#beatPulseType"),
        darkStrobeDepth: getSlider("#darkStrobeDepth"),
        starFieldCount: getSlider("#starFieldCount"),
        starFieldSpeed: getSlider("#starFieldSpeed"),
        starFieldSpread: getSlider("#starFieldSpread"),
        starFieldSize: getSlider("#starFieldSize"),
        starFieldFocalDepth: getSlider("#starFieldFocalDepth"),
        starFieldTurbulence: getSlider("#starFieldTurbulence"),
        starFieldGlitter: getSlider("#starFieldGlitter"),
        starFieldTrail: getSlider("#starFieldTrail"),
        starFieldBlendMode: getSelect("#starFieldBlendMode"),
        starFieldReverse: getCheckbox("#starFieldReverse"),
        starFieldBeatSync: getCheckbox("#starFieldBeatSync"),
        darkStrobeDisplacement: getSlider("#darkStrobeDisplacement"),
        beatAccent: getSlider("#beatAccent"),
        frequencyBand: getSelect("#frequencyBand"),
        // Liquid Shaper
        astralShaper: getCheckbox("#astralShaper"),
        astralShape: getSelect("#astralShape") as ShapeType,
        astralMorphAmount: getSlider("#astralMorphAmount"),
        astralMorphDamping: getSlider("#astralMorphDamping"),
        astralMorphMode: getSelect("#astralMorphMode") as 'crossfade' | 'path-interpolate',
        astralMorphOrigin: getSelect("#astralMorphOrigin") as 'uniform' | 'center' | 'polarity',
        astralFieldModulation: getSlider("#astralFieldModulation"),
        astralAutoCycle: getCheckbox("#astralAutoCycle"),
        astralCycleSpeed: getSelect("#astralCycleSpeed") as AutoCycleSpeed,
        astralAudioInfluence: getSlider("#astralAudioInfluence"),
        astralPulseDepth: getSlider("#astralPulseDepth"),
        // ENHANCED: Energy Glow is now a slider (0-1)
        astralEnergyGlow: getSlider("#astralEnergyGlow"),
        astralRotationMult: getSlider("#astralRotationMult"),
        astralRotationSpeedMod: getCheckbox("#astralRotationSpeedMod"),
        astralComplexity: defaultParams.astralComplexity,
        astralLineThickness: getSlider("#astralLineThickness"),
        astralStrokeStyle: getSelect("#astralStrokeStyle") as StrokeStyle,
        astralScale: getSlider("#astralScale"),
        astralSymmetryFold: parseInt(getSelect("#astralSymmetryFold"), 10),
        astralDepthEffect: getCheckbox("#astralDepthEffect"),
        astralKaleidoscope: getCheckbox("#astralKaleidoscope"),
        astralRainbowSpectrum: getCheckbox("#astralRainbowSpectrum"),
        astralUseGlobalColor: getCheckbox("#astralUseGlobalColor"),

        // Core Particles
        shapeOscillate: getCheckbox("#shapeOscillate"),
        shapeEdgeTrails: getSlider("#shapeEdgeTrails"),
        shapeDecay: getSlider("#shapeDecay"),
        shapeDistortion: getSlider("#shapeDistortion"),
        shapeBurstStrength: getSlider("#shapeBurstStrength"),
        shapeTurbulence: getSlider("#shapeTurbulence"),
        shapeOrbitDrift: getSlider("#shapeOrbitDrift"),
        shapeDensity: getSlider("#shapeDensity"),
        coreParticlesShapeMode: (params as any).coreParticlesShapeMode || 'dot',

        // Center Graphic Layer — include Phase 12D controls so custom presets
        // accurately recall center media treatment, transitions, and motion FX.
        centerImageVisible: getCheckbox("#centerImageVisible"),
        centerImageScale: getSlider("#centerImageScale") / 125,
        centerImageOpacity: getSlider("#centerImageOpacity"),
        centerImageAutoRotate: getCheckbox("#centerImageAutoRotate"),
        centerImageRotationSpeed: getSlider("#centerImageRotationSpeed"),
        centerImageReactive: getCheckbox("#centerImageReactive"),
        centerImageColorGrade: getSelect("#centerImageColorGrade"),
        centerImageColorSource: getSelect("#centerImageColorSource"),
        centerImageSaturation: getSlider("#centerImageSaturation"),
        centerImageHueShift: getSlider("#centerImageHueShift"),
        centerImageHueShiftAuto: getCheckbox("#centerImageHueShiftAuto"),
        centerImageDisplacement: getSlider("#centerImageDisplacement"),
        centerImageMotionType: getSelect("#centerImageMotionType"),
        centerImageMotionAmount: getSlider("#centerImageMotionAmount"),
        centerImageMotionIntensity: getSlider("#centerImageMotionIntensity"),
        centerImageXDrift: getCheckbox("#centerImageXDrift"),
        centerImageYDrift: getCheckbox("#centerImageYDrift"),
        centerImageRGBOffset: getSlider("#centerImageRGBOffset"),
        centerImageRGBAngle: getSlider("#centerImageRGBAngle"),
        centerImageTransitionType: getSelect("#transitionType"),
        centerImageCycleSpeed: getSelect("#cycleSpeed"),
        centerImageAutoCycle: getCheckbox("#autoCycle"),

        // Core Texture shader layer — read from live params because this section
        // is partially React-driven and not every field has a stable DOM slider id.
        coreTexturesEnabled: Boolean((params as any).coreTexturesEnabled),
        coreTexturesShaderId: (params as any).coreTexturesShaderId || 'digital-matrix',
        coreTexturesOpacity: Number((params as any).coreTexturesOpacity ?? 0.65),
        coreTexturesAudioIntensity: Number((params as any).coreTexturesAudioIntensity ?? 0.45),
        coreTexturesFrequencyRange: (params as any).coreTexturesFrequencyRange || 'full',
        coreTexturesBeatSync: Boolean((params as any).coreTexturesBeatSync ?? true),
        coreTexturesBlendMode: (params as any).coreTexturesBlendMode || 'screen',
        coreTexturesScale: Number((params as any).coreTexturesScale ?? 1),
        coreTexturesSpeed: Number((params as any).coreTexturesSpeed ?? 1),
        coreTexturesDensity: Number((params as any).coreTexturesDensity ?? 0.45),
        coreTexturesGlowIntensity: Number((params as any).coreTexturesGlowIntensity ?? 0.5)
      };

      // Sprint K1: preset-owned parameters synced generically (see
      // config/presetParameterOwnership.ts). Closes the save gaps, including
      // Halo Strobe / Halo Comet / Motion Blur, which were never saved.
      for (const entry of GENERIC_PRESET_PARAMETERS) {
        if (!entry.save) continue;
        const el = document.getElementById(entry.key) as HTMLInputElement | HTMLSelectElement | null;
        if (el) settings[entry.key] = readOwnedControl(el, entry.kind, (defaultParams as any)[entry.key]);
      }
      return settings;
    }
    
    // Save button handler
    const savePresetBtn = $("#savePreset");
    if (savePresetBtn) {
      listen(savePresetBtn, "click", () => {
        const presetName = prompt("Enter a name for this preset:");
        if (presetName && presetName.trim()) {
          const settings = getCurrentSettings();
          customPresets.push({
            name: presetName.trim(),
            settings: settings
          });
          saveCustomPresetsToStorage();
          updatePresetDropdown();
          
          // Select the newly created preset
          if (presetSelect) {
            presetSelect.value = `custom-${customPresets.length - 1}`;
          }
          
          // Update preset name in HUD
          setActivePresetName(presetName.trim());
        }
      });
    }
    
    if (presetSelect) {
      listen(presetSelect, "change", () => {
        const value = presetSelect.value;
        
        if (value.startsWith('custom-')) {
          const idx = parseInt(value.replace('custom-', ''), 10);
          if (idx >= 0 && idx < customPresets.length) {
            applyPreset(customPresets[idx].settings);
            // Update preset name in HUD
            const presetName = customPresets[idx].name || 'CUSTOM';
            setActivePresetName(presetName);
            // ✨ PHASE 1b: Clear stale cache after preset change for better memory management
            clearStaleCache();
          }
        } else {
          const idx = parseInt(value, 10);
          if (idx >= 0 && idx < presets.length) {
            applyPreset(presets[idx].settings);
            // Update preset name in HUD
            const presetName = presets[idx].name || 'DEFAULT';
            setActivePresetName(presetName);
            // ✨ PHASE 1b: Clear stale cache after preset change for better memory management
            clearStaleCache();
          } else if (value === '-1') {
            // No preset selected, show DEFAULT
            setActivePresetName('DEFAULT');
          }
        }
        ctx.updateMetadataDisplay();
      });
    }
    
    if (randomizeBtn) {
      listen(randomizeBtn, "click", () => {
        // Phase 13A.1: broad, performance-safe randomizer that touches the
        // expanded feature set without maxing expensive modes by default.
        const rand = (min: number, max: number) => min + Math.random() * (max - min);
        const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
        const chance = (p: number) => Math.random() < p;
        const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

        // Sprint D: glitch-style looks stay available but are rolled rarely, so the
        // dice favours clean, musical results instead of chaos on most rolls.
        const calmMotionTypes = [
          'none', 'slowDrift', 'verticalFloat', 'horizontalFloat', 'orbitDrift',
          'breathingZoom', 'kenBurnsDrift', 'tickerScroll', 'fallTicker', 'pulseBurst',
        ];
        const glitchMotionTypes = ['signalLock', 'glitchSnap', 'digitalSkip'];
        const calmTransitionTypes = ['fade', 'crossfade', 'zoom', 'flashZoom', 'pushFade', 'signalScan'];
        // Chaos: ~70% none, ~20% subtle, ~10% strong.
        const chaosRoll = Math.random();
        const rolledChaos = chaosRoll < 0.70 ? 0 : chaosRoll < 0.90 ? rand(0.06, 0.20) : rand(0.35, 0.65);
        const colorGrades = ['none', 'monoBlue', 'highContrastTech', 'cyberpunk', 'warmSunset', 'neonDreams'];
        const shaderIds = ['digital-matrix', 'liquid-gradient', 'geometric-pattern', 'particle-cube-field'];
        const useCoreTexture = chance(0.22);
        const useLiquidShaper = !useCoreTexture && chance(0.18);
        const useCoreParticles = !useCoreTexture && !useLiquidShaper && chance(0.12);

        applyPreset({
          rotation: rand(-0.28, 0.34),
          mirror: chance(0.18) ? rand(0.08, 0.35) : 0,
          gamma: rand(0, 0.65),
          iridize: rand(0, 0.75),
          chaos: rolledChaos,
          hueSpeed: rand(0.08, 1.15),
          halo: rand(0.25, 1.18),
          bloom: rand(0.10, 0.82),
          glowCenter: chance(0.45),
          glowStrength: rand(0.25, 0.9),
          shockwave: chance(0.18),
          shockwaveThreshold: rand(0.52, 0.82),
          shockwaveRings: randInt(2, 4),
          sparkAmps: rand(0.18, 0.55),
          sparkTrail: rand(0.16, 0.52),
          sparkDispersion: rand(0.2, 0.85),
          dotsOn: chance(0.88),
          dotsPulse: chance(0.42),
          dotsDensity: rand(0.08, 0.58),
          dotSize: rand(1.0, 2.45),
          dotGlow: rand(0.08, 0.88),
          dotRipple: rand(0.1, 0.75),
          dotReactivity: rand(0.45, 1.35),
          autoZoom: chance(0.18),
          reactivity: rand(0.28, 0.82),
          frequencySmoothing: chance(0.72),
          beatReactivityBoost: chance(0.22),
          // Keep Random inside the real-time performance envelope: 512 or 1024.
          fftSize: pick((navigator.hardwareConcurrency || 8) <= 4 ? [9] : [9, 10]),
          spikeAttack: rand(0.22, 0.68),
          spikeTightness: rand(0.34, 0.88),
          spikeBloom: rand(0, 0.75),
          spikeVariety: rand(0.1, 0.9),
          transientBoost: rand(0, 0.46),
          autoRotateSpeed: pick([1, 1, 1, 2]),
          palette: Math.floor(Math.random() * palettes.length),

          astralShaper: useLiquidShaper,
          astralShape: pick(getActiveCycleShapes()),
          astralScale: rand(0.46, 0.84),
          astralLineThickness: rand(0.75, 1.35),
          astralMorphAmount: rand(0.02, 0.22),
          astralMorphDamping: rand(0.30, 0.70),
          astralAutoCycle: useLiquidShaper && chance(0.35),
          astralCycleSpeed: pick(['slow', 'medium']),
          astralEnergyGlow: rand(0.05, 0.32),
          astralAudioInfluence: rand(0.08, 0.32),
          astralPulseDepth: rand(0.10, 0.36),
          astralRotationMult: rand(0.12, 0.42),

          shapeOscillate: useCoreParticles,
          shapeEdgeTrails: useCoreParticles ? rand(0.22, 0.68) : 0,
          shapeDecay: useCoreParticles ? rand(0.12, 0.48) : defaultParams.shapeDecay,
          shapeDistortion: useCoreParticles ? rand(0.18, 0.58) : 0,
          shapeBurstStrength: useCoreParticles ? rand(0.12, 0.52) : defaultParams.shapeBurstStrength,
          shapeTurbulence: useCoreParticles ? rand(0.04, 0.36) : 0,
          shapeOrbitDrift: useCoreParticles ? rand(0.16, 0.54) : 0,
          shapeDensity: useCoreParticles ? rand(0.36, 0.82) : 0,
          coreParticlesShapeMode: useCoreParticles ? pick(['dot', 'tri', 'dia', 'all']) : 'dot',

          beatDetect: chance(0.18),
          beatSensitivity: rand(0.55, 0.75),
          beatPulseType: chance(0.08) ? 'dark-strobe' : pick(['flash', 'color', 'rainbow', 'spark'].filter((t) => (AVAILABLE_BEAT_PULSE_TYPES as readonly string[]).includes(t))),
          beatAccent: rand(1.0, 1.35),
          effectAmount: rand(0.24, 0.58),
          darkStrobeDepth: rand(0.48, 0.84),
          darkStrobeDisplacement: rand(0.18, 0.72),
          frequencyBand: pick(['full', 'bass', 'mid', 'high']),

          centerImageVisible: chance(0.75),
          centerImageScale: rand(0.072, 0.22),
          centerImageOpacity: rand(0.68, 1.0),
          centerImageAutoRotate: chance(0.12),
          centerImageRotationSpeed: rand(0.25, 1.1),
          centerImageReactive: chance(0.55),
          centerImageColorGrade: pick(colorGrades),
          centerImageSaturation: rand(0.82, 1.24),
          centerImageHueShift: rand(0, 0.35),
          centerImageHueShiftAuto: chance(0.12),
          centerImageDisplacement: chance(0.10) ? rand(2, 10) : 0,
          centerImageMotionType: chance(0.12) ? pick(glitchMotionTypes) : pick(calmMotionTypes),
          centerImageMotionAmount: rand(0.24, 0.72),
          centerImageMotionIntensity: rand(0.18, 0.58),
          centerImageXDrift: false,
          centerImageYDrift: false,
          centerImageTransitionType: chance(0.08) ? 'glitchCut' : pick(calmTransitionTypes),
          centerImageAutoCycle: chance(0.18),
          centerImageCycleSpeed: pick(['4000', '6000', '8000']),

          coreTexturesEnabled: useCoreTexture,
          coreTexturesShaderId: pick(shaderIds),
          coreTexturesOpacity: rand(0.24, 0.55),
          coreTexturesAudioIntensity: rand(0.0, 0.45),
          coreTexturesFrequencyRange: pick(['full', 'bass', 'mid', 'high']),
          coreTexturesBeatSync: chance(0.35),
          coreTexturesBlendMode: 'screen',
          coreTexturesScale: rand(0.82, 1.18),
          coreTexturesSpeed: rand(0.35, 1.25),
          coreTexturesDensity: rand(0.22, 0.58),
          coreTexturesGlowIntensity: rand(0.16, 0.55)
        }, { deferDomSync: true });

        setActivePresetName('RANDOM');
        clearStaleCache();
      });
    }
    
    // Reset Macros button handler
    if (resetMacrosBtn) {
      listen(resetMacrosBtn, "click", () => {
        resetMacros();
      });
    }
    
    // Load custom presets on initialization
    loadCustomPresets();
    
    // PHASE 6: Macro Functions
    // Cache DOM elements for macro-controlled parameters
    const macroElementCache: { [key: string]: HTMLInputElement | null } = {};
    const macroOwnedToggles: { [key: string]: boolean } = {};
    let lastMacroFftSize = normalizeSpikeFftExponent((params as any).fftSize);

    // 🚀 (Beta cleanup, Sprint A): batches the DOM-touching part of applyMacro (slider display
    // sync, the FFT-size dispatch side-effect, and .closest('.control')/classList highlighting)
    // to at most once per animation frame per macro, instead of once per raw drag tick.
    // applyMacro's params writes happen synchronously and are unaffected — this only covers
    // the display/DOM-class work, which doesn't need to run more often than the screen repaints.
    const pendingMacroDomSyncQueue = new Set<string>();
    let macroDomSyncRafScheduled = false;
    let macroDomSyncRafId: number | null = null;

    function flushMacroDomSync() {
      macroDomSyncRafScheduled = false;
      macroDomSyncRafId = null;
      if (eventAbort.signal.aborted) {
        pendingMacroDomSyncQueue.clear();
        return;
      }
      pendingMacroDomSyncQueue.forEach(macroName => {
        const mappings = macroMappings[macroName];
        if (!mappings) return;
        const macroValue = Number((params as any)[macroName]) || 0;

        mappings.forEach(mapping => {
          // Params were already written synchronously in applyMacro — read the current value
          // rather than recomputing, so this never drifts from what the render loop is using.
          const paramValue = (params as any)[mapping.param];

          const htmlId =
            mapping.param === 'dotsDensity' ? 'density' :
            mapping.param === 'fftSize' ? 'fft' :
            mapping.param === 'coreTexturesOpacity' ? 'shaderOpacity' :
            mapping.param === 'coreTexturesAudioIntensity' ? 'shaderAudioIntensity' :
            mapping.param;
          const cacheKey = mapping.param;
          if (!(cacheKey in macroElementCache)) {
            macroElementCache[cacheKey] = $(`#${htmlId}`) as HTMLInputElement;
          }
          const el = macroElementCache[cacheKey];
          if (el) {
            // Special case: dotsDensity slider uses exponential curve (reverse it for display)
            if (mapping.param === 'dotsDensity') {
              const normalizedDensity = (paramValue - 22) / 248; // 0-1
              const sliderValue = Math.pow(Math.max(0, Math.min(1, normalizedDensity)), 1 / 2.2);
              el.value = String(Math.max(0, Math.min(1, sliderValue)));
              syncMacroSliderValueDisplay(el);
            } else if (mapping.param === 'fftSize') {
              const fftSize = normalizeSpikeFftExponent(paramValue);
              el.value = String(fftSize);
              syncMacroSliderValueDisplay(el);
              if (fftSize !== lastMacroFftSize) {
                lastMacroFftSize = fftSize;
                (params as any).fftSize = fftSize;
                // The FFT slider owns analyser/buffer resizing, so dispatch only when the rounded value changes.
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } else {
              el.value = String(paramValue);
              syncMacroSliderValueDisplay(el);
            }

            // PERSISTENT HIGHLIGHTING: Add/remove 'macro-active' class based on macro value (NO BLINKING)
            const controlRow = el.closest('.control');
            if (controlRow) {
              if (macroValue > 0) {
                controlRow.classList.add('macro-active');
              } else {
                controlRow.classList.remove('macro-active');
              }
            }
          }
        });

        // 🚀 (Sprint B): Core Textures engine sync for the Texture macro — both
        // engine.selectShader/setEnabled (previously in applyMacro's early macro7 block)
        // and engine.updateParams (previously in its late macro7 block) used to run on every
        // raw drag tick. Consolidated here into one call per flush, using the current
        // macroValue/params, which also removes a redundant double-call to selectShader.
        if (macroName === 'macro7') {
          const engine = (window as any).coreTexturesEngine;
          const enabled = macroValue > 0;
          if (enabled) engine?.selectShader?.('liquid-gradient');
          engine?.setEnabled?.(enabled);
          engine?.updateParams?.({
            shaderId: (params as any).coreTexturesShaderId || 'liquid-gradient',
            opacity: (params as any).coreTexturesOpacity,
            audioIntensity: (params as any).coreTexturesAudioIntensity,
            speed: (params as any).coreTexturesSpeed,
            density: (params as any).coreTexturesDensity,
            glowIntensity: (params as any).coreTexturesGlowIntensity,
          });
        }
      });
      pendingMacroDomSyncQueue.clear();
    }

    function scheduleMacroDomSync(macroName: string) {
      pendingMacroDomSyncQueue.add(macroName);
      if (macroDomSyncRafScheduled) return;
      macroDomSyncRafScheduled = true;
      // SHORT_LIVED_UI_RAF: one-frame DOM batching; retained and cancelled on disposal.
      macroDomSyncRafId = requestTrackedShortLivedRaf('preset-macro-dom-sync', flushMacroDomSync);
    }

    const setMacroCheckbox = (selector: string, checked: boolean, ownerKey: string) => {
      const el = $(selector) as HTMLInputElement;
      const wasChecked = !!el?.checked;
      if (checked) {
        if (!wasChecked) macroOwnedToggles[ownerKey] = true;
        if (el && !el.checked) {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (macroOwnedToggles[ownerKey]) {
        if (el && el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        macroOwnedToggles[ownerKey] = false;
      }
    };

    const syncMacroSliderValueDisplay = (el: HTMLInputElement) => {
      const valueDisplay = el.parentElement?.querySelector('.slider-value') as HTMLElement | null;
      if (!valueDisplay) return;

      const num = parseFloat(el.value);
      const min = parseFloat(el.min || '0');
      const max = parseFloat(el.max || '100');
      if (!Number.isFinite(num)) return;

      if (min === 0 && max === 1) {
        valueDisplay.textContent = `${Math.round(num * 100)}%`;
      } else if (max <= 10 && el.step === '0.01') {
        valueDisplay.textContent = num.toFixed(2);
      } else if (Number.isInteger(min) && Number.isInteger(max) && (!el.step || el.step === '1')) {
        valueDisplay.textContent = Math.round(num).toString();
      } else {
        valueDisplay.textContent = num.toFixed(2);
      }
    };

    const setMacroSlider = (selector: string, nextValue: number, dispatch = false) => {
      const el = $(selector) as HTMLInputElement;
      if (!el) return;
      el.value = String(nextValue);
      syncMacroSliderValueDisplay(el);
      if (dispatch) el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const macroEaseOutCubic = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
    const macroCenterMotionBases: Record<string, { amount: number; intensity: number } | undefined> = {};
    
    function applyMacro(
      macroName: string,
      value: number,
      options: { syncDom?: boolean; immediateDom?: boolean; interactionPhase?: 'live' | 'commit' } = {},
    ) {
      const mappings = macroMappings[macroName];
      if (!mappings) return;
      const syncDom = options.syncDom !== false;
      // Motion is an atomic commit macro. Any caller that explicitly identifies a
      // live interaction is prevented from touching rotation/motion authority.
      if (macroName === 'macro2' && options.interactionPhase === 'live') return;
      
      // value is 0-100, normalize to 0-1
      const normalized = value / 100;
      
      // Capture the current center-motion settings when Motion / Center FX macros become active.
      // This makes the macro additive instead of snapping the logo/video to a baked speed value while dragging.
      if (macroName === 'macro2' || macroName === 'macro8') {
        if (value > 0 && !macroCenterMotionBases[macroName]) {
          macroCenterMotionBases[macroName] = {
            amount: Number((params as any).centerImageMotionAmount ?? 0),
            intensity: Number((params as any).centerImageMotionIntensity ?? 0),
          };
        } else if (value <= 0) {
          delete macroCenterMotionBases[macroName];
        }
      }

      // Phase 13B: keep live macro movement lightweight.
      // Macros should mostly modulate numeric params; only guarded enabling remains for Texture.
      if (macroName === 'macro3') {
        // CHAOS is now focused instability. Avoid enabling motion blur automatically while dragging.
        if (value <= 0) {
          applyRuntimeParameterTransaction(params, {
            centerImageJitter: 0,
            centerImageRGBOffset: 0,
          });
        }
      }

      if (macroName === 'macro1') {
        // ENERGY: hue auto becomes part of the energy lift, but releases cleanly at zero.
        const enabled = value > 0;
        applyRuntimeParameterTransaction(params, { centerImageHueShiftAuto: enabled });
        if (syncDom) setMacroCheckbox('#centerImageHueShiftAuto', enabled, 'macro1HueAuto');
        if (!enabled) {
          applyRuntimeParameterTransaction(params, { centerImageHueShift: 0 });
          if (syncDom) setMacroSlider('#centerImageHueShift', 0);
        }
      }

      if (macroName === 'macro2') {
        // Phase 4.8I.1: Macro 2 is one commit transaction. Non-zero commits cancel any
        // old home transition; zero commits explicitly hand angle authority back to
        // RotationAuthority so North/South homing is restored.
        if (value > 0.001) ctx.rotationHomeTween.active = false;
      }

      if (macroName === 'macro4') {
        // ATMOSPHERE no longer hides/restores the center image. It owns glowCenter only if it enabled it.
        const enabled = value > 0;
        applyRuntimeParameterTransaction(params, {
          glowCenter: enabled || ((params as any).glowCenter && !macroOwnedToggles.macro4Glow),
        });
        if (syncDom) setMacroCheckbox('#glowCenter', enabled, 'macro4Glow');
      }

      if (macroName === 'macro6') {
        // DOTS: keep pulse responsive, but avoid live density changes that cause segmentation jumps.
        const enabled = value > 0;
        applyRuntimeParameterTransaction(params, { dotsPulse: enabled });
        if (syncDom) setMacroCheckbox('#dotsPulse', enabled, 'macro6DotsPulse');
      }

      if (macroName === 'macro7') {
        // TEXTURE: guarded auto-enable and force a valid/default shader to prevent render-skip spam.
        const enabled = value > 0;
        applyRuntimeParameterTransaction(params, { coreTexturesEnabled: enabled });
        (window as any).__coreTexturesUIEnabled = enabled;
        if (enabled) {
          applyRuntimeParameterTransaction(params, { coreTexturesShaderId: 'liquid-gradient' });
          (window as any).__coreTexturesSelectedShader = 'liquid-gradient';
        }
        if (syncDom) setMacroCheckbox('#coreTexturesEnabled', enabled, 'macro7Texture');
        // 🚀 (Sprint B): engine.selectShader/setEnabled calls moved into flushMacroDomSync
        // below — were firing on every raw drag tick; now batched once per animation frame
        // alongside the engine.updateParams call that already lived in the later macro7 block.
      }

      if (macroName === 'macro8') {
        // CENTER FX: chromatic + hue motion + center glow, all released cleanly at zero if macro-owned.
        const enabled = value > 0;
        applyRuntimeParameterTransaction(params, { centerImageHueShiftAuto: enabled });
        if (syncDom) setMacroCheckbox('#centerImageHueShiftAuto', enabled, 'macro8HueAuto');
        if (!enabled) {
          applyRuntimeParameterTransaction(params, { centerImageHueShift: 0 });
          if (syncDom) setMacroSlider('#centerImageHueShift', 0);
        }
        if (syncDom) setMacroCheckbox('#glowCenter', enabled, 'macro8Glow');
      }

      let macro2RotationTarget: number | null = null;
      mappings.forEach(mapping => {
        let paramValue = mapping.min + normalized * (mapping.max - mapping.min);

        // Motion / Center FX macros use additive smoothing against the user's current motion settings.
        // This prevents the center layer from twitching or yanking around during knob drag.
        if ((macroName === 'macro2' || macroName === 'macro8') &&
            (mapping.param === 'centerImageMotionAmount' || mapping.param === 'centerImageMotionIntensity')) {
          const base = macroCenterMotionBases[macroName];
          const baseValue = mapping.param === 'centerImageMotionAmount'
            ? (base?.amount ?? Number((params as any).centerImageMotionAmount ?? 0))
            : (base?.intensity ?? Number((params as any).centerImageMotionIntensity ?? 0));
          const additiveRange = Math.max(0, mapping.max);
          paramValue = Math.max(0, Math.min(1, baseValue + macroEaseOutCubic(normalized) * additiveRange));
        }

        if (macroName === 'macro2' && mapping.param === 'rotation') {
          // Phase 4.8I: Macro 2 commits a target, not a discontinuous rotation write.
          // The authoritative visual frame eases params.rotation toward this target.
          macro2RotationTarget = paramValue;
        } else {
          applyRuntimeParameterTransaction(params, { [mapping.param]: paramValue });
        }
        // 🚀 (Beta cleanup, Sprint A): DOM display sync (slider value, FFT-size dispatch,
        // .closest('.control')/classList highlighting) moved out of this per-mapping, per-call
        // loop into scheduleMacroDomSync below — batched to once per animation frame instead
        // of once per raw drag tick. The params write above stays synchronous; the render loop
        // and audio-reactive visuals need the current value immediately either way.
      });

      // Macro 2 publishes rotation only at commit. Live drag callers are rejected above.
      // The target is eased by the production motion runtime so release cannot create
      // the hard speed jump/catch-up artifact seen in the H.5 baseline.
      if (macroName === 'macro2') {
        if (macro2RotationTarget !== null) {
          if (Math.abs(macro2RotationTarget) <= 0.0001) {
            applyRuntimeParameterTransaction(params, { rotation: 0 });
            ctx.startRotationHomeEase(ctx.getAngle(), 0.65);
          } else {
            ctx.startMacro2RotationCommit(macro2RotationTarget);
          }
        }
        const rotEl = document.getElementById('rot') as HTMLInputElement | null;
        if (rotEl) {
          const formatted = (macro2RotationTarget ?? params.rotation).toFixed(2);
          rotEl.value = formatted;
          // setupSliderValueDisplays() inserts a <span class="slider-value"> as the
          // NEXT SIBLING of each range input. Setting .value programmatically does not
          // fire the input event listener that updates it, so update directly.
          const display = rotEl.nextElementSibling as HTMLElement | null;
          if (display?.classList.contains('slider-value')) display.textContent = formatted;
        }
      }

      if (syncDom) {
        pendingMacroDomSyncQueue.add(macroName);
        if (options.immediateDom) {
          if (macroDomSyncRafId !== null) cancelTrackedShortLivedRaf(macroDomSyncRafId);
          macroDomSyncRafScheduled = false;
          macroDomSyncRafId = null;
          flushMacroDomSync();
        } else {
          scheduleMacroDomSync(macroName);
        }
      } else if (macroName === 'macro7') {
        const engine = (window as any).coreTexturesEngine;
        const enabled = value > 0;
        engine?.setEnabled?.(enabled);
        engine?.updateParams?.({
          opacity: (params as any).coreTexturesOpacity,
          audioIntensity: (params as any).coreTexturesAudioIntensity,
          speed: (params as any).coreTexturesSpeed,
          density: (params as any).coreTexturesDensity,
          glowIntensity: (params as any).coreTexturesGlowIntensity,
        });
      }
    }
    
    // Expose applyMacro to window for access from React component handlers
    (window as any).applyMacro = applyMacro;
    
    // 🔥 FIX 5: Expose applyPendingMacroChanges for beat-quantized updates
    (window as any).applyPendingMacroChanges = ctx.applyPendingMacroChanges;
    
    // 🔥 PERFORMANCE: Expose applyPendingLiquidChanges for beat-quantized Liquid Shaper updates
    (window as any).applyPendingLiquidChanges = ctx.applyPendingLiquidChanges;
    
    function resetMacros() {
      // A macro reset must only release macro-owned effects. The former factory-reset
      // implementation assigned every default parameter and caused unrelated dots,
      // spikes, and panels to jump before rotation could ease home.
      ctx.clearPendingControlTransactions();

      const macroDefaults = {
        macro1: 0, macro2: 0, macro3: 0, macro4: 0,
        macro5: 0, macro6: 0, macro7: 0, macro8: 0,
      };

      // applyMacro owns Macro 2's single home-ease path. Do not pre-write rotation
      // or start another tween here; that was the source of the erratic stop.
      for (const macroName of Object.keys(macroDefaults)) {
        applyRuntimeParameterTransaction(params, { [macroName]: 0 });
        applyMacro(macroName, 0, { syncDom: true, immediateDom: true });

        const hiddenInput = $(`#${macroName}-hidden`) as HTMLInputElement;
        if (hiddenInput) hiddenInput.value = '0';
        const fillEl = document.querySelector<SVGPathElement>(`#${macroName}-fill`);
        const valueEl = document.getElementById(`${macroName}-value`);
        const circleEl = fillEl?.closest('.macro-knob-circle');
        if (fillEl) {
          fillEl.style.strokeDashoffset = '-100';
          fillEl.style.setProperty('--knob-angle', '0deg');
          fillEl.style.setProperty('--fill-percent', '0%');
          fillEl.style.opacity = '0';
        }
        if (valueEl) valueEl.textContent = '0';
        circleEl?.classList.remove('active');
      }

      ctx.setMacroValues(macroDefaults);
      ctx.updateMetadataDisplay();
    }
    
    // Reset functions for individual sections
    // Sprint C: per-section reset functions live in
    // ./presetActions/sectionResets.ts (moved verbatim).
    const {
      resetColorBPM,
      resetRotationSync,
      resetOuterHaloCenterLayer,
      resetDots,
      resetCenterGraphic,
      resetSpikeRing,
      resetLiquidMetalShaper,
    } = createSectionResets({ ctx, params, applyMacro, paletteLabel });
    
    // Expose reset functions to window
    (window as any).resetColorBPM = resetColorBPM;
    (window as any).resetRotationSync = resetRotationSync;
    (window as any).resetOuterHaloCenterLayer = resetOuterHaloCenterLayer;
    (window as any).resetDots = resetDots;
    (window as any).resetCenterGraphic = resetCenterGraphic;
    (window as any).resetSpikeRing = resetSpikeRing;
    (window as any).resetAstralShaper = resetLiquidMetalShaper;
    
    // Reset all parameters to default values
    function resetToDefaults() {
      if (!confirm('⚠️ Reset all sliders to default values?\n\nThis will reset all animation controls, effects, and settings to their original state.')) {
        return;
      }
      const rotationAngleBeforeReset = ctx.getAngle();
      
      // FIRST: Reset macros to 0 to prevent them from overriding individual parameter defaults
      params.macro1 = 0;
      params.macro2 = 0;
      params.macro3 = 0;
      params.macro4 = 0;
      params.macro5 = 0;
      params.macro6 = 0;
      params.macro7 = 0;
      params.macro8 = 0;
      
      // Update React state for SVG knobs
      ctx.setMacroValues({
        macro1: 0, macro2: 0, macro3: 0, macro4: 0,
        macro5: 0, macro6: 0, macro7: 0, macro8: 0,
      });
      
      // Reset macro UI elements without triggering applyMacro
      ['macro1', 'macro2', 'macro3', 'macro4', 'macro5', 'macro6', 'macro7', 'macro8'].forEach(macroName => {
        // Update hidden input for compatibility
        const hiddenInput = $(`#${macroName}-hidden`) as HTMLInputElement;
        if (hiddenInput) hiddenInput.value = '0';
        
        // Old DOM manipulation (kept for any legacy code)
        const fillEl = document.querySelector<SVGPathElement>(`#${macroName}-fill`);
        const valueEl = document.getElementById(`${macroName}-value`);
        if (fillEl) {
          fillEl.style.strokeDashoffset = '-100';
          fillEl.style.setProperty('--knob-angle', `0deg`);
          fillEl.style.setProperty('--fill-percent', '0%');
          fillEl.style.opacity = '0';
        }
        if (valueEl) valueEl.textContent = '0';
      });
      
      // SECOND: Reset all params to defaults
      Object.keys(defaultParams).forEach(key => {
        (params as any)[key] = (defaultParams as any)[key];
      });
      
      // Update all UI elements to reflect defaults (skip events for now to avoid macro interference)
      const updateSlider = (id: string, value: any) => {
        const el = $(id) as HTMLInputElement | HTMLSelectElement;
        if (el) {
          if (el.type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
          } else if (el.tagName === 'SELECT') {
            el.value = String(value);
          } else {
            el.value = String(value);
          }
          // We skip dispatchEvent to prevent macros from being re-triggered
        }
      };
      
      // Animation section
      updateSlider('#rot', defaultParams.rotation);
      // 🎯 NEW REACTIVITY SYSTEM
      updateSlider('#reactivity', defaultParams.reactivity); // Master reactivity control (50% default)
      updateSlider('#reactivityHz', defaultParams.reactivityHz); // Audio/reactivity cadence; visual RAF stays display-rate
      updateSlider('#frequencySmoothing', defaultParams.frequencySmoothing); // Frequency-dependent smoothing
      updateSlider('#beatReactivityBoost', defaultParams.beatReactivityBoost); // Beat boost
      updateSlider('#iridize', defaultParams.iridize);
      updateSlider('#gamma', defaultParams.gamma);
      updateSlider('#chaos', defaultParams.chaos);
      updateSlider('#orbitalEnergy', defaultParams.orbitalEnergy);
      updateSlider('#orbitalWidth', defaultParams.orbitalWidth);
      const orbitalDirCheckbox2 = $('#orbitalDirection') as HTMLInputElement;
      if (orbitalDirCheckbox2) orbitalDirCheckbox2.checked = (Number(defaultParams.orbitalDirection) === -1);
      updateSlider('#haloCometEnabled', defaultParams.haloCometEnabled);
      updateSlider('#haloCometSpeed', defaultParams.haloCometSpeed);
      updateSlider('#haloStrobeEnabled', defaultParams.haloStrobeEnabled);
      updateSlider('#haloStrobeDivision', defaultParams.haloStrobeDivision);
      updateSlider('#haloCometDirection', defaultParams.haloCometDirection);
      updateSlider('#haloCometThickness', defaultParams.haloCometThickness);
      updateSlider('#haloCometTailLength', defaultParams.haloCometTailLength);
      updateSlider('#hueSpeed', defaultParams.hueSpeed);
      updateSlider('#bpm', defaultParams.bpm);
      updateSlider('#bars', defaultParams.bars);
      updateSlider('#zoomToggle', defaultParams.allowZoom);
      updateSlider('#autoZoom', defaultParams.autoZoom);
      updateSlider('#zoomOsc', defaultParams.zoomOsc);
      updateSlider('#zoomOscSpeed', defaultParams.zoomOscSpeed);
      updateSlider('#zoomRings', defaultParams.zoomRings);
      
      // Spike Ring
      updateSlider('#fft', defaultParams.fftSize); // Default exponent 9 = 256 visible spikes
      updateSlider('#mirror', defaultParams.mirror);
      updateSlider('#spikeAttack', defaultParams.spikeAttack);
      updateSlider('#bassReduce', defaultParams.bassReduce);
      updateSlider('#frequencyMix', defaultParams.frequencyMix);
      
      // Outer Halo + Center Layer
      updateSlider('#halo', defaultParams.halo);
      updateSlider('#bloom', defaultParams.bloom);
      updateSlider('#glowCenter', defaultParams.glowCenter);
      updateSlider('#glowStrength', defaultParams.glowStrength);
      updateSlider('#shockwave', defaultParams.shockwave);
      updateSlider('#shockwaveThreshold', defaultParams.shockwaveThreshold);
      updateSlider('#shockwaveSpeed', defaultParams.shockwaveSpeed);
      updateSlider('#shockwaveDecay', defaultParams.shockwaveDecay);
      updateSlider('#shockwaveRings', defaultParams.shockwaveRings);
      updateSlider('#shapeOscillate', defaultParams.shapeOscillate || false);
      updateSlider('#shapeEdgeTrails', defaultParams.shapeEdgeTrails || 0.5)
      updateSlider('#shapeDistortion', defaultParams.shapeDistortion ?? 0.30);
      updateSlider('#shapeBurstStrength', defaultParams.shapeBurstStrength ?? 0.20);
      updateSlider('#shapeTurbulence', defaultParams.shapeTurbulence ?? 0.5);
      updateSlider('#shapeDecay', defaultParams.shapeDecay || 0.08); 
      updateSlider('#shapeOrbitDrift', defaultParams.shapeOrbitDrift || 0.30);
      updateSlider('#shapeDensity', defaultParams.shapeDensity || 0.65);
      applyRuntimeParameterTransaction(params, { coreParticlesShapeMode: defaultParams.coreParticlesShapeMode });
      dispatchRuntimeParameterTransaction({ coreParticlesShapeMode: defaultParams.coreParticlesShapeMode }, 'preset');
      
      // Dots
      updateSlider('#dotsOn', defaultParams.dotsOn);
      // ❌ REMOVED: trail slider
      updateSlider('#density', normalizeDotDensityForSlider(defaultParams.dotsDensity));
      // FIX 4: dotsPulse is a CHECKBOX, not a slider. updateSlider sets .value (no-op on checkboxes).
      // 🐛 BUG FIX (found during Phase 1 extraction, flagged separately to the team):
      // original code called setCheckbox() here, which was never defined anywhere in
      // resetToDefaults' scope — this threw "ReferenceError: setCheckbox is not defined"
      // at runtime, meaning every "Reset to Defaults" click silently aborted partway
      // through (everything from Dots onward — Motion FX, Spike Ring, Liquid Shaper, Core
      // Particles, Energy Gate, Beat Detection, Center Image, Core Textures — never reset).
      // This function's own updateSlider (above) already correctly branches on checkbox
      // type, so it's the exact right call — just using the tool that was already there.
      updateSlider('#dotsPulse', defaultParams.dotsPulse);
      updateSlider('#dotSize', defaultParams.dotSize);
      updateSlider('#dotGlow', defaultParams.dotGlow);
      updateSlider('#dotRipple', defaultParams.dotRipple);
      // ❌ REMOVED: dotReactivity slider (using unified params.reactivity)
      
      // Waveform
      updateSlider('#lineWidth', defaultParams.lineWidth);
      updateSlider('#innerRadius', defaultParams.innerRadius);
      updateSlider('#tail', defaultParams.tail);
      
      // Eclipse & Gamma
      updateSlider('#eclipseWeight', defaultParams.eclipseWeight);
      updateSlider('#gammaBlast', defaultParams.gammaBlast);
      
      // Center Image
      updateSlider('#centerImageScale', Math.round(defaultParams.centerImageScale * 125)); // Map 0-0.8 to 0-100
      updateSlider('#centerImageOpacity', defaultParams.centerImageOpacity);
      updateSlider('#centerImageXDrift', defaultParams.centerImageXDrift);
      updateSlider('#centerImageYDrift', defaultParams.centerImageYDrift);
      updateSlider('#centerImageReactive', defaultParams.centerImageReactive);
      updateSlider('#centerImageAberration', defaultParams.centerImageAberration);
      updateSlider('#centerImageKaleidoscope', defaultParams.centerImageKaleidoscope);
      updateSlider('#centerImageAutoRotate', defaultParams.centerImageAutoRotate);
      updateSlider('#autoRotateSpeed', defaultParams.autoRotateSpeed);
      updateSlider('#centerImageRGBOffset', defaultParams.centerImageRGBOffset);
      updateSlider('#centerImageRGBAngle', defaultParams.centerImageRGBAngle);
      updateSlider('#centerImageRGBAutoRotate', defaultParams.centerImageRGBAutoRotate);
      
      // New effects
      const colorGradeSelect = $('#centerImageColorGrade') as HTMLSelectElement;
      if (colorGradeSelect) colorGradeSelect.value = defaultParams.centerImageColorGrade || 'none';
      const colorSourceSelect = $('#centerImageColorSource') as HTMLSelectElement;
      if (colorSourceSelect) colorSourceSelect.value = (defaultParams as any).centerImageColorSource || 'master';
      updateSlider('#centerImageSaturation', defaultParams.centerImageSaturation ?? 1);
      updateSlider('#centerImageHueShift', defaultParams.centerImageHueShift ?? 0);
      updateSlider('#centerImageHueShiftAuto', defaultParams.centerImageHueShiftAuto ?? false);
      updateSlider('#centerImageDisplacement', defaultParams.centerImageDisplacement || 0);
      updateSlider('#centerImageKenBurns', defaultParams.centerImageKenBurns || false);
      updateSlider('#centerImageKenBurnsSpeed', defaultParams.centerImageKenBurnsSpeed || 0.5);
      updateSlider('#centerImageMotionProfile', defaultParams.centerImageMotionProfile || 'static');
      updateSlider('#centerImageMotionType', defaultParams.centerImageMotionType || 'none');
      updateSlider('#centerImageMotionAmount', defaultParams.centerImageMotionAmount ?? 0.52);
      updateSlider('#centerImageMotionIntensity', defaultParams.centerImageMotionIntensity ?? 0.56);
      updateSlider('#centerImageMotionAudio', defaultParams.centerImageMotionAudio ?? false);
      
      // Frequency Band & Beat Detection
      updateSlider('#frequencyBand', defaultParams.frequencyBand);
      updateSlider('#beatDetect', defaultParams.beatDetect);
      updateSlider('#beatSensitivity', defaultParams.beatSensitivity);
      updateSlider('#beatPulseType', defaultParams.beatPulseType);
      updateSlider('#effectAmount', defaultParams.effectAmount);
      updateSlider('#darkStrobeDepth', defaultParams.darkStrobeDepth);
      updateSlider('#starFieldCount', defaultParams.starFieldCount);
      updateSlider('#starFieldSpeed', defaultParams.starFieldSpeed);
      updateSlider('#starFieldSpread', defaultParams.starFieldSpread);
      updateSlider('#starFieldSize', defaultParams.starFieldSize);
      updateSlider('#starFieldFocalDepth', defaultParams.starFieldFocalDepth);
      updateSlider('#starFieldTurbulence', defaultParams.starFieldTurbulence);
      updateSlider('#starFieldGlitter', defaultParams.starFieldGlitter);
      updateSlider('#starFieldTrail', defaultParams.starFieldTrail);
      updateSlider('#starFieldBlendMode', defaultParams.starFieldBlendMode);
      updateSlider('#starFieldReverse', defaultParams.starFieldReverse);
      updateSlider('#starFieldBeatSync', defaultParams.starFieldBeatSync);
      updateSlider('#darkStrobeDisplacement', defaultParams.darkStrobeDisplacement);
      
      // TIER 1: Live Performance Features
      updateSlider('#beatAccent', defaultParams.beatAccent);
      updateSlider('#rotationSyncMode', defaultParams.rotationSyncMode);
      updateSlider('#rotationQuantize', defaultParams.rotationQuantize);
      updateSlider('#energyGate', defaultParams.energyGate);
      updateSlider('#energyThreshold', defaultParams.energyThreshold);
      updateSlider('#energyRelease', defaultParams.energyRelease);
      
      // Liquid Shaper
      updateSlider('#astralShaper', defaultParams.astralShaper);
      updateSlider('#astralShape', defaultParams.astralShape);
      updateSlider('#astralMorphAmount', defaultParams.astralMorphAmount);
      updateSlider('#astralMorphDamping', defaultParams.astralMorphDamping);
      updateSlider('#astralMorphMode', defaultParams.astralMorphMode);
      updateSlider('#astralMorphOrigin', defaultParams.astralMorphOrigin);
      updateSlider('#astralFieldModulation', defaultParams.astralFieldModulation);
      updateSlider('#astralAutoCycle', defaultParams.astralAutoCycle);
      updateSlider('#astralCycleSpeed', defaultParams.astralCycleSpeed);
      updateSlider('#astralAudioInfluence', defaultParams.astralAudioInfluence);
      updateSlider('#astralPulseDepth', defaultParams.astralPulseDepth);
      updateSlider('#astralBeatFlash', defaultParams.astralBeatFlash);
      updateSlider('#astralEnergyGlow', defaultParams.astralEnergyGlow);
      updateSlider('#astralRotationMult', defaultParams.astralRotationMult);
      updateSlider('#astralRotationJitter', defaultParams.astralRotationJitter);
      updateSlider('#astralRotationSpeedMod', defaultParams.astralRotationSpeedMod);
      updateSlider('#astralComplexity', defaultParams.astralComplexity);
      updateSlider('#astralLineThickness', defaultParams.astralLineThickness);
      updateSlider('#astralStrokeStyle', defaultParams.astralStrokeStyle);
      updateSlider('#astralScale', defaultParams.astralScale);
      updateSlider('#astralSymmetryFold', defaultParams.astralSymmetryFold);
      updateSlider('#astralDepthEffect', defaultParams.astralDepthEffect);
      updateSlider('#astralKaleidoscope', defaultParams.astralKaleidoscope);
      updateSlider('#astralRainbowSpectrum', defaultParams.astralRainbowSpectrum);
      updateSlider('#astralUseGlobalColor', defaultParams.astralUseGlobalColor);
      updateSlider('#astralRGBOffset', defaultParams.astralRGBOffset);
      updateSlider('#astralRGBAngle', defaultParams.astralRGBAngle);
      updateSlider('#astralRGBAutoRotate', defaultParams.astralRGBAutoRotate);
      
      // Reset all accumulated render-loop state variables (bundled in App.tsx since the
      // render loop reads/writes these directly every frame — see resetRenderLoopMiscState).
      ctx.resetRenderLoopMiscState();
      
      // Macros were already reset at the start of this function. Restore the
      // authoritative BPM clock to automatic mode and the factory tempo.
      bpmClockRuntime.reset(performance.now(), defaultParams.bpm);
      // resetToDefaults updates controls without dispatching their input events, so it
      // explicitly preserves the same smooth Cardinal home behavior as macro reset.
      ctx.startRotationHomeEase(rotationAngleBeforeReset, 1.65);
      const fftInput = $('#fft') as HTMLInputElement | null;
      fftInput?.dispatchEvent(new Event('input', { bubbles: true }));
      setActivePresetName('DEFAULT');
      ctx.updateMetadataDisplay();
    }

  return {
    // Palette controller
    saveFavorites, renderPaletteMenu, setPaletteByName, nextPalette, startCycle, stopCycle,
    // Presets
    applyPreset, syncMacrosToPreset, loadCustomPresets, saveCustomPresetsToStorage,
    updatePresetDropdown, getCurrentSettings, customPresets,
    // Macros
    setMacroCheckbox, syncMacroSliderValueDisplay, setMacroSlider, applyMacro,
    // Reset actions
    resetMacros, resetColorBPM, resetRotationSync,
    resetOuterHaloCenterLayer, resetDots, resetCenterGraphic, resetSpikeRing,
    resetLiquidMetalShaper, resetToDefaults,
    dispose: () => {
      stopCycle();
      for (const id of timeoutIds) cancelTrackedTimeout(id);
      timeoutIds.clear();
      cancelTrackedShortLivedRaf(macroDomSyncRafId);
      macroDomSyncRafId = null;
      macroDomSyncRafScheduled = false;
      pendingMacroDomSyncQueue.clear();
      eventAbort.abort();
      document.documentElement.classList.remove('orbital-preset-transitioning');
      ctx.eventHandlers.documentClick = undefined;
      const runtimeWindow = window as any;
      const ownedGlobals: Array<[string, unknown]> = [
        ['applyMacro', applyMacro],
        ['applyPendingMacroChanges', ctx.applyPendingMacroChanges],
        ['applyPendingLiquidChanges', ctx.applyPendingLiquidChanges],
        ['resetColorBPM', resetColorBPM],
        ['resetRotationSync', resetRotationSync],
        ['resetOuterHaloCenterLayer', resetOuterHaloCenterLayer],
        ['resetDots', resetDots],
        ['resetCenterGraphic', resetCenterGraphic],
        ['resetSpikeRing', resetSpikeRing],
        ['resetAstralShaper', resetLiquidMetalShaper],
      ];
      for (const [key, value] of ownedGlobals) {
        if (runtimeWindow[key] === value) delete runtimeWindow[key];
      }
      delete runtimeWindow.__coreTexturesUIEnabled;
      delete runtimeWindow.__coreTexturesSelectedShader;
    },
  };
}
