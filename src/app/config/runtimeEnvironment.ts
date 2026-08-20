type RuntimeImportMetaEnvironment = Record<string, string | boolean | undefined>;
type RuntimeImportMeta = ImportMeta & { env?: RuntimeImportMetaEnvironment };

/**
 * Figma Make's preview/reload path can evaluate bundled modules with an
 * `import.meta` object that has no `env` property. Never dereference
 * `import.meta` environment fields directly in runtime code that can execute in preview,
 * workers, or production bundles.
 */
function resolveImportMetaEnvironment(): RuntimeImportMetaEnvironment {
  try {
    return (import.meta as RuntimeImportMeta).env ?? {};
  } catch {
    return {};
  }
}

const RUNTIME_IMPORT_META_ENV = resolveImportMetaEnvironment();

export function getRuntimeEnvironmentValue(name: string): string | boolean | undefined {
  return RUNTIME_IMPORT_META_ENV[name];
}

export const RUNTIME_IS_DEVELOPMENT =
  RUNTIME_IMPORT_META_ENV.DEV === true || RUNTIME_IMPORT_META_ENV.DEV === 'true';

function fieldCertificationOptIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const query = new URLSearchParams(window.location.search);
    // Phase 4.6.3: field mode is session-explicit. Remove the legacy persistent
    // flag so a previous certification run cannot burden normal app sessions.
    window.localStorage.removeItem('orbital.fieldCertification');
    return query.get('orbitalFieldCert') === '1' || query.get('orbitalDiagnostics') === '1';
  } catch {
    return false;
  }
}

/** Lightweight lifecycle/error evidence remains available in development previews. */
// SessionStorage-only lifecycle evidence is safe in production: no network export, no audio payloads.
export const RUNTIME_TELEMETRY_ENABLED = true;

/** Minimal production-safe measurements enabled only for an explicit field run. */
export const FIELD_CERTIFICATION_ENABLED = fieldCertificationOptIn();

/** High-frequency snapshots are opt-in and are always stripped from production. */
export const DEVELOPMENT_DIAGNOSTICS_ENABLED = RUNTIME_IS_DEVELOPMENT && FIELD_CERTIFICATION_ENABLED;
