import type { SpikeProgramLocations } from '../../../utils/webglShaders';
import { WebGLSpikeRenderer } from '../renderers/WebGLSpikeRenderer';

export interface LegacyWebGLSetupOptions {
  glCanvas: HTMLCanvasElement;
  shouldInitLegacyGL: boolean;
  debugGeneral: boolean;
  debugWebGL: boolean;
  setUseWebGL: (value: boolean) => void;
  useWebGLRef: { current: boolean };
  compileShader: (gl: WebGLRenderingContext, type: number, source: string) => WebGLShader | null;
  linkProgram: (gl: WebGLRenderingContext, vertex: WebGLShader, fragment: WebGLShader) => WebGLProgram | null;
  vertexShader: string;
  fragmentShader: string;
}

export interface LegacyWebGLSetup {
  gl: WebGL2RenderingContext | null;
  spikeRenderer: WebGLSpikeRenderer | null;
  dispose(): void;
}

function getSpikeLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): SpikeProgramLocations {
  return {
    a_index: gl.getAttribLocation(program, 'a_index'),
    a_amplitude: gl.getAttribLocation(program, 'a_amplitude'),
    a_isEnd: gl.getAttribLocation(program, 'a_isEnd'),
    a_side: gl.getAttribLocation(program, 'a_side'),
    a_jitter: gl.getAttribLocation(program, 'a_jitter'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
    u_innerRadius: gl.getUniformLocation(program, 'u_innerRadius'),
    u_outerRadius: gl.getUniformLocation(program, 'u_outerRadius'),
    u_rotation: gl.getUniformLocation(program, 'u_rotation'),
    u_spikeCount: gl.getUniformLocation(program, 'u_spikeCount'),
    u_mirror: gl.getUniformLocation(program, 'u_mirror'),
    u_spikeTightness: gl.getUniformLocation(program, 'u_spikeTightness'),
    u_spikeDirection: gl.getUniformLocation(program, 'u_spikeDirection'),
    u_zoom: gl.getUniformLocation(program, 'u_zoom'),
    u_centerX: gl.getUniformLocation(program, 'u_centerX'),
    u_centerY: gl.getUniformLocation(program, 'u_centerY'),
    u_chaosAmount: gl.getUniformLocation(program, 'u_chaosAmount'),
    u_chaosTime: gl.getUniformLocation(program, 'u_chaosTime'),
    u_baseColor: gl.getUniformLocation(program, 'u_baseColor'),
    u_alpha: gl.getUniformLocation(program, 'u_alpha'),
    u_spectrum: gl.getUniformLocation(program, 'u_spectrum'),
    u_saturation: gl.getUniformLocation(program, 'u_saturation'),
    u_lightness: gl.getUniformLocation(program, 'u_lightness'),
    u_colorWaveActive: gl.getUniformLocation(program, 'u_colorWaveActive'),
    u_colorWaveTime: gl.getUniformLocation(program, 'u_colorWaveTime'),
    u_colorWaveAmount: gl.getUniformLocation(program, 'u_colorWaveAmount'),
    u_bloom: gl.getUniformLocation(program, 'u_bloom'),
    u_gammaFx: gl.getUniformLocation(program, 'u_gammaFx'),
    u_gammaFlash: gl.getUniformLocation(program, 'u_gammaFlash'),
    u_gammaTipBoost: gl.getUniformLocation(program, 'u_gammaTipBoost'),
    u_iridize: gl.getUniformLocation(program, 'u_iridize'),
    u_iridizeTime: gl.getUniformLocation(program, 'u_iridizeTime'),
    u_iridizeBeat: gl.getUniformLocation(program, 'u_iridizeBeat'),
  };
}

export function createLegacyWebGLSetup(options: LegacyWebGLSetupOptions): LegacyWebGLSetup {
  const {
    glCanvas,
    shouldInitLegacyGL,
    debugGeneral,
    debugWebGL,
    setUseWebGL,
    useWebGLRef,
    compileShader,
    linkProgram,
    vertexShader,
    fragmentShader,
  } = options;

  let gl: WebGL2RenderingContext | null = null;
  let spikeProgram: WebGLProgram | null = null;
  let spikeRenderer: WebGLSpikeRenderer | null = null;
  if (shouldInitLegacyGL) {
    try {
      gl = glCanvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      console.warn('⚠️ WebGL2 not supported, preserving the Canvas2D spike fallback:', error);
      gl = null;
    }
  }

  const handleWebglContextLost = (event: Event): void => {
    event.preventDefault();
    setUseWebGL(false);
    useWebGLRef.current = false;
  };
  const handleWebglContextRestored = (): void => {
    if (debugGeneral) console.log('✅ WebGL2 context restored; reload to reinitialize spike resources.');
  };
  if (gl) {
    glCanvas.addEventListener('webglcontextlost', handleWebglContextLost);
    glCanvas.addEventListener('webglcontextrestored', handleWebglContextRestored);
  }

  try {
    if (gl && !(gl.isContextLost?.() ?? false)) {
      const spikeVS = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const spikeFS = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      if (!spikeVS || !spikeFS) throw new Error('Spike shader compilation failed.');
      spikeProgram = linkProgram(gl, spikeVS, spikeFS);
      gl.deleteShader(spikeVS);
      gl.deleteShader(spikeFS);
      if (!spikeProgram) throw new Error('Spike shader program linking failed.');

      const locations = getSpikeLocations(gl, spikeProgram);
      const invalidLocations = Object.entries(locations).filter(([, value]) =>
        value === null || (typeof value === 'number' && value < 0));
      if (invalidLocations.length > 0) {
        throw new Error(`Invalid spike shader locations: ${invalidLocations.map(([key]) => key).join(', ')}`);
      }
      spikeRenderer = new WebGLSpikeRenderer(gl, spikeProgram, locations, debugWebGL);
      setUseWebGL(true);
      useWebGLRef.current = true;
      if (debugGeneral) console.log('✅ Dedicated WebGL2 spike renderer initialized.');
    } else {
      setUseWebGL(false);
      useWebGLRef.current = false;
    }
  } catch (error) {
    console.warn('⚠️ WebGL2 spike initialization failed; preserving the Canvas2D fallback.', error);
    spikeRenderer?.dispose();
    spikeRenderer = null;
    if (gl && spikeProgram) gl.deleteProgram(spikeProgram);
    spikeProgram = null;
    gl = null;
    setUseWebGL(false);
    useWebGLRef.current = false;
  }

  return {
    gl,
    spikeRenderer,
    dispose(): void {
      glCanvas.removeEventListener('webglcontextlost', handleWebglContextLost);
      glCanvas.removeEventListener('webglcontextrestored', handleWebglContextRestored);
      spikeRenderer?.dispose();
      if (gl && spikeProgram) gl.deleteProgram(spikeProgram);
    },
  };
}
