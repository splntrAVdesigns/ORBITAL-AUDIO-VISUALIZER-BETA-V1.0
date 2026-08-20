import { CoreParticlesGpuRenderer } from '../../render/coreParticles/CoreParticlesGpuRenderer';
import type {
  CoreParticleGpuDiagnostics,
  CoreParticleGpuFrame,
} from '../../render/coreParticles/CoreParticleTypes';

/**
 * Compatibility facade retained for App/runtime bindings.
 *
 * Construction is now deferred by createVisualizerRuntimeSession until Core Particles
 * is actually enabled. The underlying renderer owns no RAF, timer, or recurring task.
 */
export class WebGLEngine {
  private readonly coreParticles: CoreParticlesGpuRenderer;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: { enableGpuTimers?: boolean } = {}) {
    this.coreParticles = new CoreParticlesGpuRenderer(canvas, options);
  }

  init(): void {
    // Resource initialization occurs atomically in the renderer constructor so a
    // failed WebGL2/shader setup can immediately select the Canvas2D fallback.
  }

  resize(width: number, height: number, dpr = 1): void {
    this.coreParticles.resize(width, height, dpr);
  }

  render(input: CoreParticleGpuFrame): boolean {
    return this.coreParticles.render(input);
  }

  step(input: CoreParticleGpuFrame, present = true): boolean {
    return this.coreParticles.step(input, present);
  }

  suspend(): void {
    this.coreParticles.suspend();
  }

  getGL(): WebGL2RenderingContext {
    return this.coreParticles.getContext();
  }

  getDiagnostics(): CoreParticleGpuDiagnostics {
    return this.coreParticles.getDiagnostics();
  }

  dispose(): void {
    this.coreParticles.dispose();
  }
}
