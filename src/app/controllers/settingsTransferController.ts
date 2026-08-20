import { DEBUG_FLAGS } from '../src/app/config/debugFlags';
import { markUserRequestedReload } from '../runtime/crashTelemetry';
import {
  validateCustomPresetResource,
  validateSettingsImportResource,
} from '../config/resourceLimits';
import { syncLiquidShapeSelect, type ShapeType } from '../utils/astralShaper';

const PARAM_IDS = ['gain','smoothing','motionIntensity','motionSmoothing','bassBoost','rotationSpeed','effectAmount','darkStrobeDepth','darkStrobeDisplacement','motionBlurAmount','iridizeAmount','colorWaveAmount','saturationBurstAmount'] as const;
const SELECT_IDS = ['beatPulseType', 'astralShape'] as const;
const CHECKBOX_IDS = ['beatDetect', 'astralAutoCycle'] as const;

function readSlider(id: string): number {
  const element = document.getElementById(id) as HTMLInputElement | null;
  return element ? Number.parseFloat(element.value) || 0 : 0;
}

function readSelect(id: string): string {
  return (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';
}

function readCheckbox(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
}

export function captureOrbitalScreenshot(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orbital-${Date.now()}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function exportOrbitalSettings() {
  let customPresets: unknown[] = [];
  try {
    const saved = localStorage.getItem('orbitalCustomPresets');
    if (saved) customPresets = JSON.parse(saved);
  } catch (error) {
    console.warn('Could not load custom presets for export:', error);
  }

  const params = {
    ...Object.fromEntries(PARAM_IDS.map((id) => [id, readSlider(id)])),
    ...Object.fromEntries(SELECT_IDS.map((id) => [id, readSelect(id)])),
    ...Object.fromEntries(CHECKBOX_IDS.map((id) => [id, readCheckbox(id)])),
  };
  const payload = { version:'1.0.0', name:'ORBITAL Settings', timestamp:new Date().toISOString(), params, customPresets };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `orbital-settings-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importOrbitalSettings(file: File) {
  const fileValidation = validateSettingsImportResource(file);
  if (!fileValidation.valid) {
    alert(`❌ ${fileValidation.reason}`);
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data: unknown = JSON.parse(String(event.target?.result ?? ''));
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        alert('❌ Invalid settings file format.');
        return;
      }
      const record = data as { version?: unknown; params?: unknown; customPresets?: unknown };
      if (record.version !== '1.0.0' || !record.params || typeof record.params !== 'object' || Array.isArray(record.params)) {
        alert('❌ Invalid or unsupported settings file format.');
        return;
      }

      const importedParams = record.params as Record<string, unknown>;
      for (const key of PARAM_IDS) {
        const value = importedParams[key];
        const element = document.getElementById(key) as HTMLInputElement | null;
        if (!element || typeof value !== 'number' || !Number.isFinite(value)) continue;
        const minimum = element.min === '' ? Number.NEGATIVE_INFINITY : Number(element.min);
        const maximum = element.max === '' ? Number.POSITIVE_INFINITY : Number(element.max);
        const clamped = Math.min(maximum, Math.max(minimum, value));
        element.value = String(clamped);
        element.dispatchEvent(new Event('input', { bubbles:true }));
      }

      for (const key of SELECT_IDS) {
        const value = importedParams[key];
        const element = document.getElementById(key) as HTMLSelectElement | null;
        if (!element || typeof value !== 'string') continue;
        if (key === 'astralShape') syncLiquidShapeSelect(element, value as ShapeType);
        else element.value = value;
        element.dispatchEvent(new Event('change', { bubbles:true }));
      }

      for (const key of CHECKBOX_IDS) {
        const value = importedParams[key];
        const element = document.getElementById(key) as HTMLInputElement | null;
        if (!element || typeof value !== 'boolean') continue;
        element.checked = value;
        element.dispatchEvent(new Event('change', { bubbles:true }));
      }

      if (record.customPresets !== undefined) {
        const presetValidation = validateCustomPresetResource(record.customPresets);
        if (!presetValidation.valid) {
          alert(`❌ ${presetValidation.reason}`);
          return;
        }
        const customPresets = record.customPresets as unknown[];
        localStorage.setItem('orbitalCustomPresets', JSON.stringify(customPresets));
        if (DEBUG_FLAGS.GENERAL) console.log(`✅ Imported ${customPresets.length} custom preset(s)`);
        if (customPresets.length > 0) {
          alert(`✅ Settings and ${customPresets.length} custom preset(s) imported successfully!\n\nThe page will reload to apply custom presets.`);
          markUserRequestedReload('settings-import');
          window.setTimeout(() => window.location.reload(), 500);
          return;
        }
      }
      alert('✅ Settings imported successfully!');
    } catch {
      alert('❌ Failed to import settings. Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}
