/**
 * Sprint N: Core Particles "Spread" was re-scaled so slider 100% equals the former 45%
 * (the old upper range pushed particles out over the spike ring). Stored values written
 * before this change are on the old scale and are converted once, tagged with
 * `spreadScale: 2`, so saved presets keep their exact look.
 */
export const CORE_PARTICLE_SPREAD_SCALE_VERSION = 2;
export const LEGACY_SPREAD_FULL_SCALE = 0.45;
/** Default Spread on the new scale (old 30% -> 67%). */
export const CORE_PARTICLE_SPREAD_DEFAULT = 0.67;

export function migrateLegacySpread(value: number): number {
  if (!Number.isFinite(value)) return CORE_PARTICLE_SPREAD_DEFAULT;
  return Math.round(Math.min(1, Math.max(0, value) / LEGACY_SPREAD_FULL_SCALE) * 100) / 100;
}

/** Migrates a settings-like record in place. Returns true when it changed. */
export function migrateSpreadRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const r = record as Record<string, unknown>;
  if (r.spreadScale === CORE_PARTICLE_SPREAD_SCALE_VERSION) return false;
  if (typeof r.shapeDistortion === 'number') r.shapeDistortion = migrateLegacySpread(r.shapeDistortion);
  r.spreadScale = CORE_PARTICLE_SPREAD_SCALE_VERSION;
  return true;
}

/** Custom-preset list entries look like { name, settings }. */
export function migrateCustomPresetList(list: unknown): boolean {
  if (!Array.isArray(list)) return false;
  let changed = false;
  for (const entry of list) {
    if (entry && typeof entry === 'object' && migrateSpreadRecord((entry as any).settings)) changed = true;
  }
  return changed;
}
