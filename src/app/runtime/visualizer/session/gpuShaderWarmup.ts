/**
 * ORBITAL — GPU shader warmup registrations (Sprint M1).
 *
 * Attribution (headless profile, one switch per preset, 2026-09-27): the only
 * multi-second main-thread stalls happened on the FIRST activation of each GPU
 * engine and never again in the session —
 *   Hypnotic Trance  (first WebGL Core Texture)   ~2.0 s  → not solved by warmup (see below)
 *   Cinematic Epic   (first Core Particles)       ~1.5 s  → 0 ms after warmup
 *   Sacred Mandala   (first Liquid Shaper GPU)    ~1.1 s  → 0 ms after warmup
 * i.e. cold shader compile + link, not a leak. Figures are SwiftShader (CPU)
 * numbers; real GPUs are an order of magnitude faster but the hitch is the same
 * shape. These warmups pay the cost behind the loader instead.
 *
 * Each warmup is isolated: throwaway canvases/contexts, released immediately,
 * so the live render canvases, their visibility and GL state are never touched.
 */
import type { SessionBootSequence } from './SessionBootSequence';
import { CoreParticlesGpuRenderer } from '../../../src/render/coreParticles/CoreParticlesGpuRenderer';
import { getWebGLAstralRenderer } from '../../../engine/WebGLAstralRenderer';

export function registerGpuShaderWarmups(bootSequence: SessionBootSequence): void {
  // Liquid Shaper: the renderer is a session singleton, so creating it now removes
  // the compile from the first Liquid Shaper preset entirely.
  bootSequence.addWarmup('liquid-shaper-gpu', () => {
    getWebGLAstralRenderer();
  });

  // Core Particles: compile both programs on a scratch canvas, then release it.
  // The live renderer shares the spike overlay canvas, so it must not be created
  // early — its constructor hides that canvas.
  bootSequence.addWarmup('core-particles-gpu', () => {
    if (typeof document === 'undefined') return;
    const scratch = document.createElement('canvas');
    scratch.width = 64;
    scratch.height = 64;
    const renderer = new CoreParticlesGpuRenderer(scratch);
    renderer.dispose();
    scratch.width = 1;
    scratch.height = 1;
  });

  // Core Textures is deliberately NOT warmed here. Measured: compiling the WebGL
  // texture presets on scratch contexts did not reduce the later cost on the live
  // context (18.8 s warmup, liquid-gradient select still 4.7 s on SwiftShader), so it
  // was pure added boot time. The fix for textures is non-blocking compilation via
  // KHR_parallel_shader_compile inside each preset — tracked as a follow-up.
}
