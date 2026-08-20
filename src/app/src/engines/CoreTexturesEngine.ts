/**
 * Core Textures Engine
 * Manages shader preset rendering, switching, and audio reactivity
 * ORBITAL Audio-Reactive Visualizer Engine
 * 
 * Features:
 * - Lazy shader compilation (only when selected)
 * - Automatic texture cleanup (prevents memory leaks)
 * - Beat-quantized parameter changes (smooth transitions)
 * - WebGL + Canvas2D hybrid rendering
 * - 60 FPS performance guarantee
 */

import { SHADER_REGISTRY, getShaderById, type ShaderPreset, type AudioData, type ShaderParams } from '../shaders/ShaderRegistry';

export class CoreTexturesEngine {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private currentShader: ShaderPreset | null = null;
  private currentShaderId: string | null = null;
  private params: ShaderParams;
  private enabled: boolean = false;
  private initialized: boolean = false;
  private startTime: number = performance.now();
  private compiledShaders: Set<string> = new Set();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private lastRenderAt = -Infinity;
  private averageRenderMs = 0;
  private renderQuality = 1;
  private readonly maxInternalDimension = 512;
  
  // Favorites system
  private favorites: Set<string> = new Set();
  
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, initialParams: Partial<ShaderParams> = {}) {
    this.canvas = canvas;
    
    // Default parameters
    this.params = {
      audioIntensity: 0.6,
      frequencyRange: 'full',
      beatSync: true,
      scale: 1.0,
      speed: 1.0,
      opacity: 0.8,
      blendMode: 'normal',
      ...initialParams,
    };
    
    // Favorites are UI-only; workers deliberately skip storage access.
    if (typeof localStorage !== 'undefined') this.loadFavorites();
    
    // Setup cleanup interval (5 minutes) on either host or worker global.
    this.cleanupInterval = globalThis.setInterval(() => {
      if (!this.enabled) {
        this.cleanup();
      }
    }, 300000);
  }
  
  /**
   * Initialize the engine (must be called before rendering)
   */
  init(): void {
    if (this.initialized) return;
    
    // For the offscreen Core Textures canvas, clientWidth/clientHeight can be 0 because
    // the canvas is not mounted in the DOM. Fall back to the existing canvas buffer size.
    const width = ('clientWidth' in this.canvas ? this.canvas.clientWidth : 0) || this.canvas.width || 800;
    const height = ('clientHeight' in this.canvas ? this.canvas.clientHeight : 0) || this.canvas.height || 800;
    this.resize(width, height);
    
    this.initialized = true;
  }
  
  /**
   * Enable/disable shader rendering
   */
  setEnabled(enabled: boolean): void {
    const becomingEnabled = enabled && !this.enabled;
    this.enabled = enabled;
    if (becomingEnabled) {
      this.lastRenderAt = -Infinity;
      this.currentShader?.reset?.();
    }
    if (!enabled && this.currentShader) {
      // Clear using the context type that matches the active shader.
      // NEVER call getContext('2d') on a canvas that already has a WebGL context —
      // on older engines this invalidates the WebGL context; on spec-compliant
      // browsers it returns null (harmless but wasteful).
      if (this.currentShader.type === 'canvas2d') {
        const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      } else {
        // WebGL shader: clear via its own context rather than mixing context types.
        const glCtx = (this.canvas.getContext('webgl') ??
          this.canvas.getContext('webgl2')) as WebGLRenderingContext | null;
        if (glCtx) {
          glCtx.clearColor(0, 0, 0, 0);
          glCtx.clear(glCtx.COLOR_BUFFER_BIT);
        }
      }
    }
  }
  
  /**
   * Explicitly release the WebGL context on a canvas so the browser can
   * reclaim it against the per-page context limit (~8-16 contexts).
   * Safe to call on a Canvas2D canvas — getContext returns null silently.
   */
  private static releaseWebGLContext(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    const ctx = (canvas.getContext('webgl') ??
      canvas.getContext('webgl2')) as WebGLRenderingContext | null;
    if (ctx) {
      const ext = ctx.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
  }

  /**
   * Select and activate a shader preset
   */
  selectShader(shaderId: string): boolean {
    if (this.currentShaderId === shaderId && this.currentShader) return true;

    // Cleanup current shader and explicitly release its WebGL context so the
    // browser can reclaim the slot. Without this, each switch leaks one context
    // and browsers impose a hard limit (~8-16) after which new contexts silently
    // return null — causing Core Textures to go dark with no error.
    if (this.currentShader) {
      this.currentShader.cleanup();
      CoreTexturesEngine.releaseWebGLContext(this.canvas);
    }

    // Get new shader
    const shader = getShaderById(shaderId);
    if (!shader) {
      console.error(`Shader not found: ${shaderId}`);
      return false;
    }

    // Recreate the offscreen canvas on every shader switch so Canvas2D and WebGL
    // presets never fight over the same rendering context.
    const prevWidth = this.canvas.width || 1;
    const prevHeight = this.canvas.height || 1;
    const freshCanvas: HTMLCanvasElement | OffscreenCanvas = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined'
      ? new OffscreenCanvas(prevWidth, prevHeight)
      : document.createElement('canvas');
    freshCanvas.width = prevWidth;
    freshCanvas.height = prevHeight;
    if ('style' in freshCanvas && 'style' in this.canvas) {
      freshCanvas.style.width = this.canvas.style.width || `${prevWidth}px`;
      freshCanvas.style.height = this.canvas.style.height || `${prevHeight}px`;
    }
    this.canvas = freshCanvas;

    // Merge preset defaults into live params before initialization so the shader has
    // a valid starting parameter set even before the user touches a slider.
    this.params = {
      ...this.params,
      ...(shader.defaults || {}),
    };

    try {
      shader.init(this.canvas, this.params);
      shader.resize?.(this.canvas.width, this.canvas.height);
      this.currentShader = shader;
      this.currentShaderId = shaderId;
      this.compiledShaders.add(shaderId);

      return true;
    } catch (error) {
      console.error(`Failed to initialize shader "${shader.name}":`, error);
      return false;
    }
  }
  
  /**
   * Render current shader with audio data
   */
  render(audioData: AudioData): void {
    if (!this.enabled) {
      // Uncomment for debugging: console.log('⚠️ Core Textures render skipped: not enabled');
      return;
    }
    if (!this.currentShader) {
      console.warn('⚠️ Core Textures render skipped: no shader selected');
      return;
    }
    if (!this.initialized) {
      console.warn('⚠️ Core Textures render skipped: not initialized');
      return;
    }
    
    const now = performance.now();
    // Canvas2D texture presets are auxiliary content. They never get to consume a
    // full visualizer frame: reuse their last frame until their bounded budget opens.
    const minInterval = this.getRenderIntervalMs();
    if (now - this.lastRenderAt < minInterval) return;
    const elapsedTime = now - this.startTime;
    const renderStartedAt = now;
    this.params.renderQuality = this.renderQuality;

    try {
      this.currentShader.render(audioData, this.params, elapsedTime);
      const renderCost = Math.max(0, performance.now() - renderStartedAt);
      this.averageRenderMs = this.averageRenderMs === 0
        ? renderCost
        : this.averageRenderMs * 0.82 + renderCost * 0.18;
      this.renderQuality = this.averageRenderMs > 7 ? 0.5 : this.averageRenderMs > 4 ? 0.68 : this.averageRenderMs > 2.5 ? 0.82 : 1;
      this.lastRenderAt = now;
    } catch (error) {
      console.error('Shader render error:', error);
      // Disable on error to prevent cascading failures
      this.enabled = false;
    }
  }
  

  /** Current bounded texture cadence. Main renderer continues at its own cadence. */
  private getRenderIntervalMs(): number {
    if (!this.currentShader) return 1000 / 30;
    // Low-cost WebGL can present alongside the 60 Hz visualizer. The automatic
    // cost guard steps down before it can compromise the primary render loop.
    if (this.currentShader.type === 'webgl') {
      if (this.averageRenderMs <= 2) return 1000 / 60;
      if (this.averageRenderMs <= 4) return 1000 / 45;
      return 1000 / 30;
    }
    if (this.averageRenderMs > 7) return 1000 / 18;
    if (this.averageRenderMs > 4) return 1000 / 24;
    return 1000 / 30;
  }

  /**
   * Update shader parameters
   */
  updateParams(newParams: Partial<ShaderParams>): void {
    // This runs in the frame path. Preserve the stable params object so controls
    // can mutate independently without a per-frame allocation.
    Object.assign(this.params, newParams);
  }
  
  /**
   * Get current shader parameters
   */
  getParams(): ShaderParams {
    return { ...this.params };
  }
  
  /**
   * Get current shader info
   */
  getCurrentShader(): ShaderPreset | null {
    return this.currentShader;
  }
  
  /**
   * Get current shader id
   */
  getCurrentShaderId(): string | null {
    return this.currentShaderId;
  }


  /**
   * Get current render canvas
   */
  getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  /**
   * Whether shader rendering is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }


  /**
   * Get all available shaders
   */
  getAvailableShaders(): ShaderPreset[] {
    return SHADER_REGISTRY;
  }
  
  /**
   * Resize canvas and update shader
   */
  resize(width: number, height: number): void {
    // Use 1x DPR for Canvas2D shaders (unlike WebGL, Canvas2D doesn't benefit from high DPR)
    // This drastically improves performance on retina displays
    const dpr = 1.0; // Force 1x for optimal performance
    const longestSide = Math.max(width, height, 1);
    const scale = Math.min(dpr, this.maxInternalDimension / longestSide);
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    if ('style' in this.canvas) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    
    if (this.currentShader) {
      this.currentShader.resize(this.canvas.width, this.canvas.height);
    }
  }
  
  /**
   * Cleanup resources (call when engine is no longer needed)
   */
  cleanup(): void {
    if (this.currentShader) {
      this.currentShader.cleanup();
      this.currentShader = null;
    }
    
    this.compiledShaders.clear();
    
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
  }
  
  /**
   * Toggle favorite status for a shader
   */
  toggleFavorite(shaderId: string): boolean {
    if (this.favorites.has(shaderId)) {
      this.favorites.delete(shaderId);
    } else {
      this.favorites.add(shaderId);
    }
    
    this.saveFavorites();
    return this.favorites.has(shaderId);
  }
  
  /**
   * Check if a shader is favorited
   */
  isFavorite(shaderId: string): boolean {
    return this.favorites.has(shaderId);
  }
  
  /**
   * Get all favorited shader IDs
   */
  getFavorites(): string[] {
    return Array.from(this.favorites);
  }
  
  /**
   * Load favorites from localStorage
   */
  private loadFavorites(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem('orbital-shader-favorites');
      if (saved) {
        this.favorites = new Set(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load shader favorites:', error);
    }
  }
  
  /**
   * Save favorites to localStorage
   */
  private saveFavorites(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('orbital-shader-favorites', JSON.stringify(Array.from(this.favorites)));
    } catch (error) {
      console.warn('Failed to save shader favorites:', error);
    }
  }
  
  /**
   * Get audio-reactive frequency data for current range
   */
  private getFrequencyEnergy(audioData: AudioData): number {
    switch (this.params.frequencyRange) {
      case 'low':
        return audioData.bass;
      case 'mid':
        return audioData.mid;
      case 'high':
        return audioData.treble;
      case 'full':
      default:
        return audioData.energy;
    }
  }
  
  /**
   * Export current shader configuration
   */
  exportConfig(): any {
    return {
      shaderId: this.currentShaderId,
      params: this.params,
      favorites: Array.from(this.favorites),
    };
  }
  
  /**
   * Import shader configuration
   */
  importConfig(config: any): void {
    if (config.shaderId) {
      this.selectShader(config.shaderId);
    }
    
    if (config.params) {
      this.updateParams(config.params);
    }
    
    if (config.favorites) {
      this.favorites = new Set(config.favorites);
      this.saveFavorites();
    }
  }
}
