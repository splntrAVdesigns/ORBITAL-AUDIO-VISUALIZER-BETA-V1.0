// ORBITAL — Per-section reset actions (Color/BPM, Rotation, Outer Halo,
// Dots, Center Graphic, Spike Ring, Liquid Shaper).
//
// Sprint C: extracted from utils/presetActions.ts. The reset functions are
// moved verbatim into a factory; the closure values they used are now passed
// in explicitly.

import { palettes } from '../../data/colorPalettes';
import { defaultParams } from '../../config/defaultParams';
import { normalizeDotDensityForSlider } from '../../config/parameterConversions';
import { DEBUG_FLAGS } from '../../src/app/config/debugFlags';
import { bpmClockRuntime } from '../../runtime/bpm/BpmClockRuntime';
import type { PresetActionsContext } from '../presetActions';

const $ = (sel: string) => document.querySelector(sel);

export interface SectionResetDeps {
  ctx: PresetActionsContext;
  params: PresetActionsContext['params'];
  applyMacro: (...args: any[]) => unknown;
  paletteLabel: HTMLSpanElement;
}

export function createSectionResets({ ctx, params, applyMacro, paletteLabel }: SectionResetDeps) {
    // Reset functions for individual sections
    function resetColorBPM() {
      const updateSlider = (id: string, value: number | boolean | string) => {
        const el = $(id) as HTMLInputElement | HTMLSelectElement;
        if (el) {
          if (el.type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else if (el.tagName === 'SELECT') {
            el.value = String(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      // Color palette - set to default (palette 0)
      params.palette = 0;
      const paletteLabel = document.getElementById('paletteLabel');
      if (paletteLabel) paletteLabel.textContent = palettes[0].name;
      
      // BPM
      updateSlider('#bpm', defaultParams.bpm);
      updateSlider('#bpmAdapt', false);
      bpmClockRuntime.reset(performance.now(), defaultParams.bpm);
      
      // Energy Gate - Reset to defaults
      updateSlider('#energyGate', defaultParams.energyGate);
      updateSlider('#energyThreshold', defaultParams.energyThreshold);
      updateSlider('#energyRelease', defaultParams.energyRelease);
      
      // Beat Detection - Reset to defaults
      updateSlider('#beatDetect', defaultParams.beatDetect);
      updateSlider('#beatSensitivity', defaultParams.beatSensitivity);
      updateSlider('#effectAmount', defaultParams.effectAmount);
      updateSlider('#beatPulseType', defaultParams.beatPulseType);
      updateSlider('#darkStrobeDepth', defaultParams.darkStrobeDepth);
      updateSlider('#darkStrobeDisplacement', defaultParams.darkStrobeDisplacement);
      updateSlider('#starFieldCount', defaultParams.starFieldCount);
      updateSlider('#starFieldSpeed', defaultParams.starFieldSpeed);
      updateSlider('#starFieldSpread', defaultParams.starFieldSpread);
      updateSlider('#starFieldSize', defaultParams.starFieldSize);
      updateSlider('#starFieldFocalDepth', defaultParams.starFieldFocalDepth);
      updateSlider('#starFieldTurbulence', defaultParams.starFieldTurbulence);
      updateSlider('#starFieldGlitter', defaultParams.starFieldGlitter);
      updateSlider('#starFieldTrail', defaultParams.starFieldTrail);
      updateSlider('#starFieldReverse', defaultParams.starFieldReverse);
      updateSlider('#starFieldBeatSync', defaultParams.starFieldBeatSync);
      updateSlider('#starFieldBlendMode', defaultParams.starFieldBlendMode);
    }
    
    function resetRotationSync() {
      const updateControl = (id: string, value: string | number | boolean) => {
        const el = $(id) as HTMLInputElement | HTMLSelectElement;
        if (el) {
          if (el.tagName === 'SELECT') {
            (el as HTMLSelectElement).value = String(value);
            el.dispatchEvent(new Event('change'));
          } else if ((el as HTMLInputElement).type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            (el as HTMLInputElement).value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      updateControl('#rotationSyncMode', defaultParams.rotationSyncMode);
      updateControl('#rotationQuantize', defaultParams.rotationQuantize);
      updateControl('#rot', defaultParams.rotation);
      params.rotation = defaultParams.rotation;
      updateControl('#bpm', defaultParams.bpm);
      updateControl('#bars', defaultParams.bars);
      bpmClockRuntime.reset(performance.now(), defaultParams.bpm);

      // Reset Macro 2 (MOTION): applyMacro owns the single cleanup/home-ease path.
      // Starting a second tween here used a later angle and caused the visible stop/jump.
      // applyMacro runs the cleanup path (params.rotation=0,
      // home ease, center-motion bases cleared). setMacroValues uses a functional update
      // so only macro2 changes — passing a plain object would replace the entire state
      // and set all other macros to undefined (NaN in display).
      applyMacro('macro2', 0, { syncDom: true, immediateDom: true });
      ctx.setMacroValues((prev: any) => ({ ...prev, macro2: 0 }));
      const macro2Hidden = document.getElementById('macro2-hidden') as HTMLInputElement | null;
      if (macro2Hidden) macro2Hidden.value = '0';
      const macro2Fill = document.querySelector<SVGPathElement>('#macro2-fill');
      if (macro2Fill) {
        macro2Fill.style.opacity = '0';
        macro2Fill.style.strokeDashoffset = '-100';
        macro2Fill.style.setProperty('--knob-angle', '0deg');
        macro2Fill.style.setProperty('--fill-percent', '0%');
      }
      const macro2Value = document.getElementById('macro2-value');
      if (macro2Value) macro2Value.textContent = '0';
      macro2Fill?.closest('.macro-knob-circle')?.classList.remove('active');
    }
    
    // 🗑️ (Beta cleanup): resetAdvancedMotionFX removed — confirmed legacy. It only reset
    // zoomOsc/zoomOscSpeed/zoomRings, the old motion-FX system that the Chaos slider has
    // since superseded. Zero UI buttons ever called it, and resetToDefaults (the actual
    // "Reset" button in the Motion Controls + EFX section) never called it internally —
    // resetToDefaults already resets #chaos directly, so nothing is lost by removing this.
    
    function resetOuterHaloCenterLayer() {
      const updateControl = (id: string, value: number | boolean | string) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          if (el.type === 'checkbox') {
            el.checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      updateControl('#halo', defaultParams.halo);
      updateControl('#bloom', defaultParams.bloom);
      updateControl('#orbitalEnergy', defaultParams.orbitalEnergy);
      updateControl('#orbitalWidth', defaultParams.orbitalWidth);
      updateControl('#orbitalDirection', Number(defaultParams.orbitalDirection) === -1);
      updateControl('#haloCometEnabled', defaultParams.haloCometEnabled);
      updateControl('#haloCometSpeed', defaultParams.haloCometSpeed);
      updateControl('#haloStrobeEnabled', defaultParams.haloStrobeEnabled);
      updateControl('#haloStrobeDivision', defaultParams.haloStrobeDivision);
      updateControl('#haloCometDirection', defaultParams.haloCometDirection);
      updateControl('#haloCometThickness', defaultParams.haloCometThickness);
      updateControl('#haloCometTailLength', defaultParams.haloCometTailLength);
      updateControl('#glowCenter', defaultParams.glowCenter);
      updateControl('#glowStrength', defaultParams.glowStrength);
      updateControl('#shockwave', defaultParams.shockwave);
      updateControl('#shockwaveThreshold', defaultParams.shockwaveThreshold);
      updateControl('#shockwaveRings', defaultParams.shockwaveRings);
      updateControl('#shockwaveSpeed', defaultParams.shockwaveSpeed);
      updateControl('#shockwaveDecay', defaultParams.shockwaveDecay);
    }
    
    function resetDots() {
      const updateControl = (id: string, value: number | boolean) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          if (el.type === 'checkbox') {
            el.checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      updateControl('#dotsOn', defaultParams.dotsOn);
      updateControl('#dotsPulse', defaultParams.dotsPulse);
      updateControl('#density', normalizeDotDensityForSlider(defaultParams.dotsDensity));
      updateControl('#dotSize', defaultParams.dotSize);
      updateControl('#dotGlow', defaultParams.dotGlow);
      updateControl('#dotRipple', defaultParams.dotRipple);
      // ❌ REMOVED: dotReactivity control (using unified params.reactivity)
    }
    
    function resetCenterGraphic() {
      const updateControl = (id: string, value: number | boolean | string) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          if (el.type === 'checkbox') {
            el.checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      // Scale slider uses 0-100 range, so multiply by 125
      updateControl('#centerImageScale', Math.round(defaultParams.centerImageScale * 125));
      updateControl('#centerImageOpacity', defaultParams.centerImageOpacity);
      updateControl('#centerImageXDrift', defaultParams.centerImageXDrift);
      updateControl('#centerImageYDrift', defaultParams.centerImageYDrift);
      updateControl('#centerImageReactive', defaultParams.centerImageReactive);
      updateControl('#centerImageAberration', defaultParams.centerImageAberration);
      updateControl('#centerImageJitter', defaultParams.centerImageJitter);
      updateControl('#centerImageKaleidoscope', defaultParams.centerImageKaleidoscope);
      updateControl('#centerImageAutoRotate', defaultParams.centerImageAutoRotate);
      ctx.centerImageRotationHomeTween.active = false;
      ctx.setCenterImageAutoRotationAngle(0);
      updateControl('#autoRotateSpeed', defaultParams.autoRotateSpeed);
      updateControl('#centerImageRGBOffset', defaultParams.centerImageRGBOffset);
      updateControl('#centerImageRGBAngle', defaultParams.centerImageRGBAngle);
      updateControl('#centerImageRGBAutoRotate', defaultParams.centerImageRGBAutoRotate);
      
      // New effects
      const colorGradeEl = $('#centerImageColorGrade') as HTMLSelectElement;
      if (colorGradeEl) {
        colorGradeEl.value = defaultParams.centerImageColorGrade;
        colorGradeEl.dispatchEvent(new Event('change'));
      }
      const colorSourceEl = $('#centerImageColorSource') as HTMLSelectElement;
      if (colorSourceEl) {
        colorSourceEl.value = (defaultParams as any).centerImageColorSource || 'master';
        colorSourceEl.dispatchEvent(new Event('change'));
      }
      updateControl('#centerImageSaturation', defaultParams.centerImageSaturation);
      updateControl('#centerImageHueShift', defaultParams.centerImageHueShift);
      updateControl('#centerImageHueShiftAuto', defaultParams.centerImageHueShiftAuto);
      updateControl('#centerImageDisplacement', defaultParams.centerImageDisplacement);
      updateControl('#centerImageKenBurns', defaultParams.centerImageKenBurns);
      updateControl('#centerImageKenBurnsSpeed', defaultParams.centerImageKenBurnsSpeed);
      updateControl('#centerImageMotionProfile', defaultParams.centerImageMotionProfile as any);
      updateControl('#centerImageMotionType', defaultParams.centerImageMotionType as any);
      updateControl('#centerImageMotionAmount', defaultParams.centerImageMotionAmount);
      updateControl('#centerImageMotionIntensity', defaultParams.centerImageMotionIntensity);
      updateControl('#centerImageMotionAudio', defaultParams.centerImageMotionAudio);
    }
    
    function resetSpikeRing() {
      const updateControl = (id: string, value: number | boolean) => {
        const el = $(id) as HTMLInputElement;
        if (el) {
          if (el.type === 'checkbox') {
            el.checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      updateControl('#fft', defaultParams.fftSize); // Default exponent 9 = 256 visible spikes
      updateControl('#mirror', defaultParams.mirror);
      updateControl('#spikeAttack', defaultParams.spikeAttack);
      updateControl('#spikeTightness', defaultParams.spikeTightness);
      updateControl('#spikeBloom', defaultParams.spikeBloom);
      updateControl('#spikeVariety', defaultParams.spikeVariety);
      updateControl('#transientBoost', defaultParams.transientBoost);
    }
    
    function resetLiquidMetalShaper() {
      const updateControl = (id: string, value: number | boolean | string) => {
        const el = $(id) as HTMLInputElement | HTMLSelectElement;
        if (el) {
          if (el.type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
            el.dispatchEvent(new Event('change'));
          } else {
            el.value = String(value);
            el.dispatchEvent(new Event('input'));
          }
        }
      };
      
      // Disable Liquid shaper first
      updateControl('#astralShaper', defaultParams.astralShaper); // false
      
      // Reset all Liquid shaper controls to defaults
      updateControl('#astralShape', defaultParams.astralShape);
      updateControl('#astralMorphAmount', defaultParams.astralMorphAmount);
      updateControl('#astralMorphDamping', defaultParams.astralMorphDamping);
      updateControl('#astralAutoCycle', defaultParams.astralAutoCycle);
      updateControl('#astralCycleSpeed', defaultParams.astralCycleSpeed);
      updateControl('#astralAudioInfluence', defaultParams.astralAudioInfluence);
      updateControl('#astralPulseDepth', defaultParams.astralPulseDepth);
      updateControl('#astralEnergyGlow', defaultParams.astralEnergyGlow);
      updateControl('#astralRotationMult', defaultParams.astralRotationMult);
      updateControl('#astralRotationJitter', defaultParams.astralRotationJitter);
      updateControl('#astralComplexity', defaultParams.astralComplexity);
      updateControl('#astralLineThickness', defaultParams.astralLineThickness);
      updateControl('#astralStrokeStyle', defaultParams.astralStrokeStyle);
      updateControl('#astralScale', defaultParams.astralScale);
      updateControl('#astralSymmetryFold', defaultParams.astralSymmetryFold);
      updateControl('#astralDepthEffect', defaultParams.astralDepthEffect);
      updateControl('#astralKaleidoscope', defaultParams.astralKaleidoscope);
      updateControl('#astralRainbowSpectrum', defaultParams.astralRainbowSpectrum);
      updateControl('#astralUseGlobalColor', defaultParams.astralUseGlobalColor);
      
      if (DEBUG_FLAGS.GENERAL) console.log('✅ Liquid Shaper reset to defaults (disabled)');
    }

    return {
      resetColorBPM,
      resetRotationSync,
      resetOuterHaloCenterLayer,
      resetDots,
      resetCenterGraphic,
      resetSpikeRing,
      resetLiquidMetalShaper,
    };
}
