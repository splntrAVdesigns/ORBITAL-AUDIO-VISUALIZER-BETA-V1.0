import { SHADER_REGISTRY } from './ShaderRegistry';

const cap = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * Sprint N: writes a shader's own control defaults (Glitch Type, LED density, ...) into the
 * live params object. Called whenever a shader is SELECTED so a texture always opens on its
 * designed look instead of whatever the previous session left in params. Returns the
 * { controlKey: value } map so callers can also push it to the running engine.
 */
export function applyShaderControlDefaults(params: Record<string, any>, shaderId: string | null | undefined): Record<string, any> {
  const shader: any = SHADER_REGISTRY.find((s: any) => s.id === shaderId);
  const applied: Record<string, any> = {};
  if (!shader?.controls) return applied;
  for (const [key, control] of Object.entries<any>(shader.controls)) {
    if (control?.default === undefined) continue;
    params[`coreTextures${cap(key)}`] = control.default;
    applied[key] = control.default;
  }
  return applied;
}
