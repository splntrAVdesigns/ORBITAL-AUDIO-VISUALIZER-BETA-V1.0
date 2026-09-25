import { defaultParams } from '../../../config/defaultParams';
import { dotDensityCountToSlider } from '../../../config/parameterConversions';
import type { RuntimeAsyncRegistry } from '../session/RuntimeAsyncRegistry';

export interface VisualizerControlDefaultsOptions {
  params: Record<string, any>;
  query: (selector: string) => Element | null;
  asyncRegistry: RuntimeAsyncRegistry;
}

/**
 * Schedules the initial DOM-to-runtime synchronization through the
 * session-owned async registry so unmount always cancels pending work.
 */
export function initializeVisualizerControlDefaults(
  options: VisualizerControlDefaultsOptions,
): void {
  const { params, query, asyncRegistry } = options;

    // Initialize Phase 4 controls manually to ensure they sync with params
    asyncRegistry.setTimeout(() => {
      const zoomOscEl = query("#zoomOsc") as HTMLInputElement;
      const zoomOscSpeedEl = query("#zoomOscSpeed") as HTMLInputElement;
      const zoomRingsEl = query("#zoomRings") as HTMLInputElement;

      if (zoomOscEl) params.zoomOsc = parseFloat(zoomOscEl.value) || 0;
      if (zoomOscSpeedEl) params.zoomOscSpeed = parseFloat(zoomOscSpeedEl.value) || 1.0;
      if (zoomRingsEl) params.zoomRings = parseInt(zoomRingsEl.value, 10) || 12;
    }, 100);

    // 🔥 INITIALIZATION: Set ALL UI elements to match defaultParams
    // This ensures the app honors the defaults on load
    const initializeUIFromDefaults = () => {

      // Helper to set slider value AND trigger event
      // Also used for <select> string values (e.g. rotationQuantize-style dropdowns);
      // the DOM write is String(value) either way, so the value type is widened.
      const setSlider = (id: string, value: number | string) => {
        const el = query(id) as HTMLInputElement;
        if (el) {
          el.value = String(value);
          el.dispatchEvent(new Event('input', { bubbles: true })); // Trigger bindings
        }
      };

      // Helper to set checkbox AND trigger event
      const setCheckbox = (id: string, checked: boolean) => {
        const el = query(id) as HTMLInputElement;
        if (el) {
          el.checked = checked;
          el.dispatchEvent(new Event('change', { bubbles: true })); // Trigger bindings
        }
      };

      // Helper to set select AND trigger event
      const setSelect = (id: string, value: string | number) => {
        const el = query(id) as HTMLSelectElement;
        if (el) {
          el.value = String(value);
          el.dispatchEvent(new Event('change', { bubbles: true })); // Trigger bindings
        }
      };

      // 🔥 DOTS DENSITY: Reverse the exponential curve to get slider value
      // Formula: dotsDensity = 22 + Math.pow(sliderValue, 2.2) * 248
      // Reverse: sliderValue = Math.pow((dotsDensity - 22) / 248, 1 / 2.2)
      setSlider('#density', dotDensityCountToSlider(defaultParams.dotsDensity));

      // All critical defaults - LOCKED IN!
      setSlider('#rotation', defaultParams.rotation);
      setSlider('#mirror', defaultParams.mirror);
      setSlider('#zoom', defaultParams.zoom);
      setSlider('#lineWidth', defaultParams.lineWidth);
      setSlider('#innerRadius', defaultParams.innerRadius);
      setSlider('#spikeAttack', defaultParams.tail); // 🎯 FIX: tail param maps to spikeAttack slider
      setSlider('#halo', defaultParams.halo);
      setSlider('#bloom', defaultParams.bloom);
      setSlider('#gamma', defaultParams.gamma);
      setSlider('#iridize', defaultParams.iridize);
      setSlider('#chaos', defaultParams.chaos);
      setSelect('#reactivityMode', defaultParams.reactivityMode);
      setSelect('#reactivityHz', defaultParams.reactivityHz);
      setSlider('#reactivityBlend', defaultParams.reactivityBlend);
      setSlider('#orbitalEnergy', defaultParams.orbitalEnergy);
      setSlider('#orbitalWidth', defaultParams.orbitalWidth);
      const orbitalDirCheckbox = query('#orbitalDirection') as HTMLInputElement;
      if (orbitalDirCheckbox) orbitalDirCheckbox.checked = (Number(defaultParams.orbitalDirection) === -1);
      setCheckbox('#haloCometEnabled', defaultParams.haloCometEnabled);
      setSlider('#haloCometSpeed', defaultParams.haloCometSpeed);
      setCheckbox('#haloStrobeEnabled', defaultParams.haloStrobeEnabled);
      setSlider('#haloStrobeDivision', defaultParams.haloStrobeDivision);
      setSlider('#haloCometDirection', defaultParams.haloCometDirection);
      setSlider('#haloCometThickness', defaultParams.haloCometThickness);
      setSlider('#haloCometTailLength', defaultParams.haloCometTailLength);

      // Dots
      setCheckbox('#dotsOn', defaultParams.dotsOn);
      // ❌ REMOVED: trail slider (fade is automatic from dotsPulse toggle)
      setSlider('#dotSize', defaultParams.dotSize);
      setSlider('#dotGlow', defaultParams.dotGlow);
      // ❌ REMOVED: dotReactivity slider (using unified params.reactivity)
      setCheckbox('#dotsPulse', defaultParams.dotsPulse);

      // Hue & Animation
      setSlider('#hueSpeed', defaultParams.hueSpeed);
      setSelect('#centerImageColorGrade', defaultParams.centerImageColorGrade);
      setSelect('#centerImageColorSource', defaultParams.centerImageColorSource);

      // Spike Ring
      setSlider('#fft', defaultParams.fftSize); // Default exponent 9 = 256 visible spikes
      setSlider('#spikeAttack', defaultParams.tail); // 🎯 Uses tail parameter (spike attack/tail length)
      setSlider('#spikeTightness', defaultParams.spikeTightness); // 🎯 Spike thickness slider
      setSlider('#spikeBloom', defaultParams.spikeBloom);
      setSlider('#spikeVariety', defaultParams.spikeVariety);
      setSlider('#transientBoost', defaultParams.transientBoost);

      // Effects
      setCheckbox('#glowCenter', defaultParams.glowCenter);
      setSlider('#glowStrength', defaultParams.glowStrength);
      setCheckbox('#autoZoom', defaultParams.autoZoom);
      setCheckbox('#shockwave', defaultParams.shockwave);
      setSlider('#shockwaveThreshold', defaultParams.shockwaveThreshold);

      // Liquid Shaper
      setCheckbox('#astralShaper', defaultParams.astralShaper);
      setCheckbox('#astralAutoCycle', defaultParams.astralAutoCycle);
      setSlider('#astralAudioInfluence', defaultParams.astralAudioInfluence);
      setSlider('#astralPulseDepth', defaultParams.astralPulseDepth);

      // Beat Detection
      setCheckbox('#beatDetect', defaultParams.beatDetect); // DEFAULT: OFF

    };

    // Call initialization after DOM is ready AND after bind() handlers are set up
    // This ensures the events triggered by setSlider/setCheckbox will update params correctly
    // 🚀 (Beta cleanup): tracked so cleanup can cancel it if it hasn't fired yet.
    asyncRegistry.setTimeout(initializeUIFromDefaults, 300); // 300ms ensures bind() calls are all registered
}
