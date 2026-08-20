/**
 * WebGL Liquid Metal Renderer
 * Provides GPU-accelerated liquid morphing between sacred geometry shapes.
 * Includes automated texture cleanup to prevent memory leaks during extended sessions.
 * Uses a bounded 1024px internal buffer and recoverable private-context lifecycle.
 */

const SHADER_SIZE = 1024;

export interface LiquidShaperRendererDiagnostics {
  status: 'ready' | 'context-lost' | 'rebuilding' | 'disposed';
  textureSize: number;
  estimatedTextureBytes: number;
  textureUploads: number;
  contextLosses: number;
  contextRestores: number;
}

const VS = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // Convert clip space (-1 to 1) to UV space (0 to 1)
    v_uv = a_position * 0.5 + 0.5;
    // Flip Y for WebGL texture coordinate system mapping to Canvas2D
    v_uv.y = 1.0 - v_uv.y;
  }
`;

function createLiquidFragmentShader(supportsDerivatives: boolean): string {
  const derivativeDirective = supportsDerivatives ? '#extension GL_OES_standard_derivatives : enable' : '';
  const adaptiveWidth = supportsDerivatives ? 'max(fwidth(field) * 1.35, 0.0035)' : '0.012';
  return `${derivativeDirective}
  precision highp float;
  varying vec2 v_uv;

  uniform sampler2D u_texA;
  uniform sampler2D u_texB;
  
  uniform float u_morphAmount;
  uniform float u_rotation;
  uniform float u_scale;
  uniform float u_time;
  uniform float u_audioInfluence;
  uniform float u_fieldModulation;
  uniform vec3 u_color;
  uniform float u_pulseDepth;
  uniform float u_energyGlow;

  // Simplex Noise 2D
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    // 1. Center UVs for rotation and scale
    vec2 uv = v_uv - 0.5;
    
    // Apply inverse scale
    float scaleMod = 1.0 / (u_scale + 0.001);
    uv *= scaleMod;
    
    // Apply inverse rotation
    float c = cos(-u_rotation);
    float s = sin(-u_rotation);
    uv = vec2(
      uv.x * c - uv.y * s,
      uv.x * s + uv.y * c
    );
    
    uv += 0.5;

    // Discard pixels outside the texture boundaries to prevent texture wrap smearing
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // 2. Liquid Field Modulation (Distortion)
    // FIX L1: Gate ALL distortion (including audio-reactive) on u_fieldModulation.
    //   Previously: distortStrength = fieldMod * 0.1875 + audioInfluence * 0.0625
    //   The audioInfluence term kept distortion running even when the Liquid Distortion
    //   slider was at zero — causing constant unwanted liquid movement.
    //   Now: both terms are scaled by fieldModulation, so slider=0 means zero distortion.
    float noiseFreq = 3.0;
    float noiseSpeed = 0.5;
    float timeMod = u_time * noiseSpeed;
    
    vec2 distortOffset = vec2(
      snoise(uv * noiseFreq + timeMod),
      snoise(uv * noiseFreq - timeMod + 100.0)
    );
    
    // FIX L1: Unified distortion gate — when fieldModulation=0, no distortion at all.
    //   audioInfluence now modulates the distortion AMPLITUDE, not adds to it independently.
    float distortStrength = u_fieldModulation * (0.1875 + u_audioInfluence * 0.0625);
    vec2 distortUv = uv + distortOffset * distortStrength;

    // 3. Sample the blurred shape canvases
    float valA = texture2D(u_texA, distortUv).a;
    float valB = texture2D(u_texB, distortUv).a;
    
    // 4. Endpoint-correct liquid union. Each opposite endpoint contributes
    // exactly zero, while the overlap window retains the metaball merge.
    float morph = clamp(u_morphAmount, 0.0, 1.0);
    float biasA = 1.0 - smoothstep(0.35, 1.0, morph);
    float biasB = smoothstep(0.0, 0.65, morph);
    float weightedA = valA * biasA;
    float weightedB = valB * biasB;
    float field = weightedA + weightedB - weightedA * weightedB;

    // 5. Liquid Metal Threshold
    // As audio hits, the threshold lowers, causing the "liquid" to expand/bulge
    float baseThreshold = 0.45;
    float pulseExpansion = u_audioInfluence * u_pulseDepth * 0.15;
    float threshold = max(0.1, baseThreshold - pulseExpansion);
    
    // Derivative-aware edge width adapts to scale and pixel density. The
    // constant fallback keeps WebGL1 implementations without derivatives safe.
    float aaWidth = ${adaptiveWidth};
    float fluidAlpha = smoothstep(threshold - aaWidth, threshold + aaWidth, field);
    
    if (fluidAlpha <= 0.01) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // 6. Pseudo-Normal Calculation for 3D Metal Reflection
    vec2 eps = vec2(0.005, 0.0);
    // FIX L2b: Compute neighbors using same liquid union formula for consistent normals
    float vA_dx = texture2D(u_texA, distortUv + eps.xy).a;
    float vB_dx = texture2D(u_texB, distortUv + eps.xy).a;
    float vA_dy = texture2D(u_texA, distortUv + eps.yx).a;
    float vB_dy = texture2D(u_texB, distortUv + eps.yx).a;
    float wA_dx = vA_dx * biasA; float wB_dx = vB_dx * biasB;
    float wA_dy = vA_dy * biasA; float wB_dy = vB_dy * biasB;
    float field_dx = wA_dx + wB_dx - wA_dx * wB_dx;
    float field_dy = wA_dy + wB_dy - wA_dy * wB_dy;
    float dX = field_dx - field;
    float dY = field_dy - field;
    
    // Construct normal vector based on gradient
    vec3 normal = normalize(vec3(dX * 15.0, dY * 15.0, 1.0));
    
    // 7. Lighting Model
    vec3 lightDir = normalize(vec3(-0.5, 0.5, 1.0)); // Top-left directional light
    
    // Diffuse wrap (soft lighting)
    float diffuse = max(dot(normal, lightDir), 0.0);
    diffuse = diffuse * 0.5 + 0.5; // Half-lambert for softer metal
    
    // Specular highlight (sharp reflection)
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float specAngle = max(dot(normal, halfDir), 0.0);
    float specular = pow(specAngle, 32.0);
    
    // Edge rim lighting follows both the pseudo-normal and the actual field
    // boundary, preventing disconnected white fragments on thin geometry.
    float rim = 1.0 - max(dot(normal, viewDir), 0.0);
    rim = smoothstep(0.6, 1.0, rim);
    float edgeBand = 1.0 - smoothstep(aaWidth * 0.75, aaWidth * 4.5, abs(field - threshold));

    // 8. Final Color Composition
    vec3 baseColor = u_color;
    
    // Saturated core plus a restrained, color-preserving rim. White is mixed
    // only slightly into the highlight so lines remain premium and coherent.
    vec3 coreColor = baseColor * (0.48 + diffuse * 0.72);
    vec3 rimColor = mix(baseColor, vec3(1.0), 0.16);
    vec3 color = coreColor;
    color += rimColor * edgeBand * (0.62 + rim * 0.78);
    color += mix(baseColor, vec3(1.0), 0.28) * specular * 0.48;
    
    // Modulate overall brightness with audio
    color *= (1.0 + u_audioInfluence * 0.5);
    
    // REMOVED: Energy glow edge bloom (now handled by Canvas shadowBlur + lighter composite)
    // This prevents white fill and provides proper saturated colored glow like Gamma effect

    gl_FragColor = vec4(color, fluidAlpha);
  }
`;
}

export class WebGLAstralRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGLRenderingContext;
  private contextLost = false;
  private needsRebuild = false;
  private contextLosses = 0;
  private contextRestores = 0;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;

  // 🚀 (Beta cleanup, Sprint E): tracks the last-uploaded canvas per texture unit so
  // updateTexture() can skip the GPU upload (texImage2D) when the source canvas hasn't
  // actually changed. generateShapeTexture() in astralShaper.ts returns the SAME canvas
  // object whenever its inputs (shape/complexity/style) are unchanged — true on nearly
  // every frame — so this was re-uploading an identical ~16MB 2048x2048 texture every
  // single frame, up to 3x per frame when the multi-layer jitter effect is active.
  private lastUploadedCanvasA: CanvasImageSource | null = null;
  private lastUploadedCanvasB: CanvasImageSource | null = null;
  
  private uniforms: Record<string, WebGLUniformLocation> = {};
  
  // Automated cleanup for long-running sessions
  private textureUploadCount: number = 0;
  private lastCleanupTime: number = 0;
  private cleanupIdleHandle: number | null = null;
  private cleanupTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly CLEANUP_THRESHOLD = 10000; // Trigger after 10k texture uploads
  private readonly supportsDerivatives: boolean;
  
  constructor() {
    this.canvas = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined'
      ? new OffscreenCanvas(SHADER_SIZE, SHADER_SIZE)
      : document.createElement('canvas');
    this.canvas.width = SHADER_SIZE;
    this.canvas.height = SHADER_SIZE;

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL not supported for Liquid Metal Shader');
    this.gl = gl;
    this.supportsDerivatives = Boolean(gl.getExtension('OES_standard_derivatives'));
    this.installContextLifecycle();
    this.createResources();
    this.lastCleanupTime = performance.now();
  }

  private emitLifecycle(type: 'context-lost' | 'context-restored' | 'rebuild-failed'): void {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
    window.dispatchEvent(new CustomEvent('orbital:astral-webgl', {
      detail: { type, ...this.getDiagnostics() },
    }));
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault?.();
    if (this.disposed) return;
    this.contextLost = true;
    this.needsRebuild = true;
    this.contextLosses += 1;
    this.cancelScheduledTextureCleanup();
    this.emitLifecycle('context-lost');
  };

  private readonly handleContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    this.needsRebuild = true;
    this.contextRestores += 1;
    this.emitLifecycle('context-restored');
  };

  private installContextLifecycle(): void {
    this.canvas.addEventListener?.('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener?.('webglcontextrestored', this.handleContextRestored, false);
  }

  private removeContextLifecycle(): void {
    this.canvas.removeEventListener?.('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener?.('webglcontextrestored', this.handleContextRestored, false);
  }

  private createResources(): void {
    const shaderResources = this.initShader();
    this.program = shaderResources.program;
    this.vertexShader = shaderResources.vertexShader;
    this.fragmentShader = shaderResources.fragmentShader;
    this.vertexBuffer = this.initBuffers();
    this.texA = this.gl.createTexture();
    this.texB = this.gl.createTexture();
    if (!this.texA || !this.texB) throw new Error('Liquid Shaper texture allocation failed');
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texA);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texB);
    this.lastUploadedCanvasA = null;
    this.lastUploadedCanvasB = null;
  }

  private rebuildResources(): boolean {
    if (this.contextLost || this.gl.isContextLost?.()) return false;
    try {
      this.releaseResources();
      this.createResources();
      this.needsRebuild = false;
      return true;
    } catch {
      this.contextLost = true;
      this.needsRebuild = true;
      this.emitLifecycle('rebuild-failed');
      return false;
    }
  }
  
  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error("Shader compile failed");
    }
    return shader;
  }
  
  private initShader(): { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader } {
    const vs = this.compile(this.gl.VERTEX_SHADER, VS);
    const fs = this.compile(this.gl.FRAGMENT_SHADER, createLiquidFragmentShader(this.supportsDerivatives));
    
    const prog = this.gl.createProgram()!;
    this.gl.attachShader(prog, vs);
    this.gl.attachShader(prog, fs);
    this.gl.linkProgram(prog);
    
    if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
      console.error(this.gl.getProgramInfoLog(prog));
      this.gl.deleteProgram(prog);
      this.gl.deleteShader(vs);
      this.gl.deleteShader(fs);
      throw new Error("Program link failed");
    }
    
    this.gl.useProgram(prog);
    
    ['u_texA', 'u_texB', 'u_morphAmount', 'u_rotation', 'u_scale', 'u_time', 
     'u_audioInfluence', 'u_fieldModulation', 'u_color', 'u_pulseDepth', 'u_energyGlow'].forEach(name => {
      this.uniforms[name] = this.gl.getUniformLocation(prog, name)!;
    });
    
    this.gl.uniform1i(this.uniforms.u_texA, 0);
    this.gl.uniform1i(this.uniforms.u_texB, 1);
    
    return { program: prog, vertexShader: vs, fragmentShader: fs };
  }
  
  private initBuffers(): WebGLBuffer | null {
    // Standard full-screen quad
    const verts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    const vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, verts, this.gl.STATIC_DRAW);
    
    if (!this.program) return null;
    const a_pos = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(a_pos);
    this.gl.vertexAttribPointer(a_pos, 2, this.gl.FLOAT, false, 0, 0);
    return vbo;
  }
  
  private updateTexture(unit: number, tex: WebGLTexture, image: CanvasImageSource, lastUploaded: CanvasImageSource | null): CanvasImageSource {
    this.gl.activeTexture(unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    // Wrap CLAMP_TO_EDGE is required for non-power-of-2 textures, though ours is 1024
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    // 🚀 (Beta cleanup, Sprint E): generateShapeTexture() returns the same canvas object
    // whenever shape/complexity/kaleidoscope/symmetryFold/lineThickness/strokeStyle are
    // unchanged — true on nearly every frame. The bind/texParameteri calls above are cheap
    // GL state updates and always run (so binding state can never go stale); only the actual
    // ~16MB texImage2D upload — the expensive part — is skipped when nothing changed.
    if (image === lastUploaded) {
      return lastUploaded;
    }
    
    // Upload canvas to texture
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image as TexImageSource);
    
    // 🔧 FIX STUTTER: Texture cleanup was called SYNCHRONOUSLY inside RAF causing a
    //    ~10-18 second periodic stall (gl.deleteTexture stalls GPU pipeline on main thread).
    //    Fix: schedule cleanup via requestIdleCallback so it runs between frames.
    //    The textures stay valid until idle — no visual artifact, no frame drop.
    this.textureUploadCount++;
    const currentTime = performance.now();
    if (this.textureUploadCount >= this.CLEANUP_THRESHOLD || currentTime - this.lastCleanupTime >= this.CLEANUP_INTERVAL) {
      this.lastCleanupTime = currentTime;
      this.textureUploadCount = 0;
      this.scheduleTextureCleanup();
    }

    return image;
  }

  private scheduleTextureCleanup(): void {
    if (this.disposed || this.cleanupIdleHandle !== null || this.cleanupTimeoutHandle !== null) return;
    const doCleanup = () => {
      this.cleanupIdleHandle = null;
      this.cleanupTimeoutHandle = null;
      if (!this.disposed) this.cleanupTextures();
    };
    const scope = (typeof window !== 'undefined' ? window : globalThis) as any;
    if (typeof scope.requestIdleCallback === 'function') {
      this.cleanupIdleHandle = scope.requestIdleCallback(doCleanup, { timeout: 2000 });
    } else {
      this.cleanupTimeoutHandle = scope.setTimeout(doCleanup, 100);
    }
  }

  private cancelScheduledTextureCleanup(): void {
    const scope = (typeof window !== 'undefined' ? window : globalThis) as any;
    if (this.cleanupIdleHandle !== null && typeof scope.cancelIdleCallback === 'function') {
      scope.cancelIdleCallback(this.cleanupIdleHandle);
    }
    if (this.cleanupTimeoutHandle !== null) scope.clearTimeout(this.cleanupTimeoutHandle);
    this.cleanupIdleHandle = null;
    this.cleanupTimeoutHandle = null;
  }

  private releaseResources(): void {
    if (this.texA) { try { this.gl.deleteTexture(this.texA); } catch {} }
    if (this.texB) { try { this.gl.deleteTexture(this.texB); } catch {} }
    if (this.vertexBuffer) { try { this.gl.deleteBuffer(this.vertexBuffer); } catch {} }
    if (this.program && this.vertexShader) { try { this.gl.detachShader(this.program, this.vertexShader); } catch {} }
    if (this.program && this.fragmentShader) { try { this.gl.detachShader(this.program, this.fragmentShader); } catch {} }
    if (this.vertexShader) { try { this.gl.deleteShader(this.vertexShader); } catch {} }
    if (this.fragmentShader) { try { this.gl.deleteShader(this.fragmentShader); } catch {} }
    if (this.program) { try { this.gl.deleteProgram(this.program); } catch {} }
    this.texA = null;
    this.texB = null;
    this.vertexBuffer = null;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.uniforms = {};
    this.lastUploadedCanvasA = null;
    this.lastUploadedCanvasB = null;
  }

  private cleanupTextures(): void {
    if (this.disposed || !this.texA || !this.texB) return;
    const nextA = this.gl.createTexture();
    const nextB = this.gl.createTexture();
    if (!nextA || !nextB) {
      if (nextA) this.gl.deleteTexture(nextA);
      if (nextB) this.gl.deleteTexture(nextB);
      return;
    }

    this.gl.deleteTexture(this.texA);
    this.gl.deleteTexture(this.texB);
    this.texA = nextA;
    this.texB = nextB;
    
    // Pre-bind texture units
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texA);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texB);

    // 🚀 (Beta cleanup, Sprint E): the new texture objects are empty — force the next
    // render() call to actually re-upload, even if the source canvas hasn't changed.
    this.lastUploadedCanvasA = null;
    this.lastUploadedCanvasB = null;
  }

  public render(
    canvasA: CanvasImageSource, 
    canvasB: CanvasImageSource,
    morphAmount: number,
    rotation: number,
    scale: number,
    time: number,
    audioInfluence: number,
    fieldModulation: number,
    colorHex: string,
    pulseDepth: number,
    energyGlow: number = 0
  ): (HTMLCanvasElement | OffscreenCanvas) | null {
    if (this.disposed) throw new Error('WebGLAstralRenderer has been disposed');
    if (this.contextLost || this.gl.isContextLost?.()) return null;
    if (this.needsRebuild && !this.rebuildResources()) return null;
    if (!this.program || !this.texA || !this.texB) return null;
    this.gl.useProgram(this.program);
    
    // Upload textures (skips the actual GPU upload internally if unchanged since last call)
    this.lastUploadedCanvasA = this.updateTexture(this.gl.TEXTURE0, this.texA, canvasA, this.lastUploadedCanvasA);
    this.lastUploadedCanvasB = this.updateTexture(this.gl.TEXTURE1, this.texB, canvasB, this.lastUploadedCanvasB);
    
    // Parse Color
    let r = 1, g = 1, b = 1;
    if (colorHex.startsWith('#')) {
      const num = parseInt(colorHex.slice(1), 16);
      r = ((num >> 16) & 255) / 255.0;
      g = ((num >> 8) & 255) / 255.0;
      b = (num & 255) / 255.0;
    } else if (colorHex.startsWith('rgb')) {
      const match = colorHex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]) / 255.0;
        g = parseInt(match[2]) / 255.0;
        b = parseInt(match[3]) / 255.0;
      }
    }
    
    // Set uniforms
    this.gl.uniform1f(this.uniforms.u_morphAmount, morphAmount);
    this.gl.uniform1f(this.uniforms.u_rotation, rotation);
    this.gl.uniform1f(this.uniforms.u_scale, scale);
    this.gl.uniform1f(this.uniforms.u_time, time);
    this.gl.uniform1f(this.uniforms.u_audioInfluence, audioInfluence);
    this.gl.uniform1f(this.uniforms.u_fieldModulation, fieldModulation);
    this.gl.uniform3f(this.uniforms.u_color, r, g, b);
    this.gl.uniform1f(this.uniforms.u_pulseDepth, pulseDepth);
    this.gl.uniform1f(this.uniforms.u_energyGlow, energyGlow);
    
    // Clear and Draw
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    return this.canvas;
  }

  public getLastCanvas(): (HTMLCanvasElement | OffscreenCanvas) | null {
    return this.contextLost || this.disposed ? null : this.canvas;
  }

  public getDiagnostics(): LiquidShaperRendererDiagnostics {
    return {
      status: this.disposed ? 'disposed' : this.contextLost ? 'context-lost' : this.needsRebuild ? 'rebuilding' : 'ready',
      textureSize: SHADER_SIZE,
      estimatedTextureBytes: SHADER_SIZE * SHADER_SIZE * 4 * 2,
      textureUploads: this.textureUploadCount,
      contextLosses: this.contextLosses,
      contextRestores: this.contextRestores,
    };
  }

  public get isDisposed(): boolean { return this.disposed; }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduledTextureCleanup();
    this.removeContextLifecycle();
    this.releaseResources();
    const loseContext = this.gl.getExtension('WEBGL_lose_context');
    try { loseContext?.loseContext(); } catch { /* best-effort release */ }
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}

// Singleton instance
let instance: WebGLAstralRenderer | null = null;

export function getWebGLAstralRenderer(): WebGLAstralRenderer {
  if (!instance) {
    instance = new WebGLAstralRenderer();
  }
  return instance;
}

export function disposeWebGLAstralRenderer(): void {
  instance?.dispose();
  instance = null;
}
