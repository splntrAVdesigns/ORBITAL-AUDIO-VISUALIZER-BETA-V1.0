export type PresetNameListener = (name: string) => void;

const listeners = new Set<PresetNameListener>();
let activePresetName = 'DEFAULT';

function normalizePresetName(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return normalized || 'DEFAULT';
}

export function getActivePresetName(): string {
  return activePresetName;
}

export function setActivePresetName(value: unknown): string {
  const next = normalizePresetName(value);
  if (next === activePresetName) return activePresetName;
  activePresetName = next;
  listeners.forEach(listener => listener(activePresetName));
  return activePresetName;
}

export function subscribeActivePresetName(listener: PresetNameListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
