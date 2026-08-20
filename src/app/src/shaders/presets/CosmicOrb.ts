/**
 * Cosmic Orb — ORBITAL-native Core Texture preset.
 * Adapted from the supplied visual reference into the Core Textures lifecycle:
 * one owned WebGL canvas, no React, no DOM observers, and no private RAF.
 */
import type { AudioData, ShaderParams, ShaderPreset } from '../ShaderRegistry';

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let positionLocation = -1;
const uniforms: Record<string, WebGLUniformLocation | null> = {};
let activeArchetype = -1;
let smoothAudio = 0;
let smoothTreble = 0;
let smoothPulse = 0;
type PhaseClock = { anchor: number; anchorAt: number; rate: number };
let orbitalPhase: PhaseClock = { anchor: 0, anchorAt: 0, rate: 0 };
let spinPhase: PhaseClock = { anchor: 0, anchorAt: 0, rate: 0 };

function resolvePhase(clock: PhaseClock, now: number, nextRate: number): number {
  if (clock.anchorAt === 0) { clock.anchorAt = now; clock.rate = nextRate; return clock.anchor; }
  const current = clock.anchor + Math.max(0, now - clock.anchorAt) * clock.rate;
  if (Math.abs(nextRate - clock.rate) > 0.00001) { clock.anchor = current; clock.anchorAt = now; clock.rate = nextRate; }
  return clock.anchor + Math.max(0, now - clock.anchorAt) * clock.rate;
}

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec3 u_anchor;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform float u_time;
uniform float u_audio;
uniform float u_treble;
uniform float u_pulse;
uniform float u_archetype;
uniform float u_scale;
uniform float u_orbitalPhase;
uniform float u_spinPhase;
uniform float u_density;
uniform float u_stars;
uniform float u_lens;
uniform float u_paletteSpread;
uniform float u_voidDepth;
uniform float u_rimDensity;
uniform float u_rimColorPull;
uniform float u_starParallax;
uniform float u_depthOfField;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p = p * 2.03 + 13.7; amplitude *= .5; }
  return value;
}
vec3 palette(float t) {
  vec3 ab = mix(u_colorA, u_colorB, smoothstep(0.0, 1.0, t));
  return mix(ab, u_colorC, smoothstep(0.55, 1.0, t) * u_paletteSpread);
}
void main() {
  vec2 p = (v_uv - .5) * 2.0;
  p.x *= u_resolution.x / max(1.0, u_resolution.y);
  float radius = length(p);
  float time = u_time;
  // Rotation stays time-driven. Audio only colors/intensifies the field; it
  // never changes the angular coordinate, which removes reactive twitching.
  // Lens is a continuous radial focus distortion. It has no audio input,
  // so the control remains clearly visible without reintroducing motion jitter.
  float lensField = exp(-radius * radius * 1.12);
  // Deliberately pronounced, but entirely time-driven, optical focus distortion.
  float lensWarp = u_lens * lensField * (.13 + .07 * sin(time * .72));
  p *= 1.0 + lensWarp;
  radius = length(p) / max(.35, u_scale);
  float angle = atan(p.y, p.x) + u_orbitalPhase;
  float innerAngle = angle + u_spinPhase;
  vec2 direction = vec2(cos(angle), sin(angle));

  float arch = u_archetype;
  if (arch < -.5) arch = floor(mod(floor(time * .15), 4.0));
  // Arms must be integral: a fractional angle multiplier has a discontinuity
  // at the atan wrap and was the remaining left-side seam in the screenshots.
  float arms = floor(4.0 + u_density * 5.0 + .5);
  float spiral = .5 + .5 * sin(innerAngle * arms - radius * (17.0 + u_density * 12.0) + time * 1.3);
  // Direction-space noise is periodic around the orb; unlike atan-based
  // texture coordinates it cannot introduce a visible +/-PI seam.
  float nebula = fbm(direction * (3.0 + u_density * 3.6) + vec2(radius * (5.0 + u_density * 2.4) - time * .16, radius * 1.7 + time * .09));
  float nebulosity = pow(clamp(nebula, 0.0, 1.0), 1.48 - u_density * .72);
  float band = exp(-pow(radius - (.48 + spiral * .18), 2.0) * (14.0 + u_density * 27.0));
  float core = exp(-radius * radius * (7.0 + u_audio * 5.0));
  float deep = smoothstep(.92, .20, radius) * (.24 + .76 * nebulosity);
  float voidRadius = .11 + u_voidDepth * .32;
  float voidMask = smoothstep(voidRadius, voidRadius + .18, radius);
  float rimCenter = .58 + u_rimColorPull * .18;
  float rimBand = exp(-pow(radius - rimCenter, 2.0) * (15.0 + u_rimDensity * 35.0));
  float deepField = rimBand * (.28 + nebulosity * (.72 + u_rimDensity * .75)) * voidMask;
  float deepMode = step(2.5, arch);
  float field = arch < .5 ? band * (.34 + nebulosity * (1.02 + u_density * .36)) : arch < 1.5 ? nebulosity * smoothstep(1.08, .08, radius) * (.6 + u_density * .7) : arch < 2.5 ? core + band * (.25 + u_density * .32) : deepField;

  // Round SDF stars replace the previous grid-cell hash squares. Deep uses a
  // second, gently parallaxed star layer and keeps its color at the rim.
  vec2 deepParallax = p + direction * time * (.018 + u_starParallax * .075);
  vec2 starGrid = mix(p, deepParallax, deepMode) * (48.0 + u_stars * 112.0);
  vec2 starId = floor(starGrid);
  vec2 starUv = fract(starGrid) - .5;
  float starSeed = hash21(starId);
  float starDot = 1.0 - smoothstep(.055 + starSeed * .02, .09 + starSeed * .025, length(starUv));
  float stars = starDot * step(.83 - u_stars * .24, starSeed) * smoothstep(1.15, .25, radius) * (.38 + u_treble * .85 + u_audio * .32);
  vec2 nearGrid = deepParallax * (25.0 + u_stars * 44.0);
  float nearSeed = hash21(floor(nearGrid) + 23.7);
  float nearDot = 1.0 - smoothstep(.07, .13 + u_depthOfField * .05, length(fract(nearGrid) - .5));
  float deepStars = (stars * (.9 + u_starParallax * .5) + nearDot * step(.93 - u_stars * .12, nearSeed) * (.45 + u_depthOfField * .7)) * voidMask;
  stars = mix(stars, deepStars, deepMode);
  float travelingWave = .5 + .5 * sin(radius * 22.0 - time * 3.4 + angle * 2.0);
  float hueWave = .5 + .5 * sin(innerAngle * 2.0 - radius * 4.5 + time * .78);
  float colorPulse = travelingWave * (.18 + u_audio * .78 + u_pulse * .82);
  vec3 nebulaColor = palette(clamp(.06 + nebulosity * .58 + spiral * .12 + hueWave * (.20 + u_audio * .22) + colorPulse * .34, 0.0, 1.0));
  vec3 deepColor = palette(clamp(.34 + hueWave * (.18 + u_rimColorPull * .38) + colorPulse * .24, 0.0, 1.0));
  vec3 color = u_anchor * (.025 + deep * .09) * mix(1.0, voidMask, deepMode);
  color += mix(nebulaColor, deepColor, deepMode) * field * (1.0 + colorPulse * .82);
  color += mix(u_colorB, vec3(1.0), .25) * core * (.32 + u_audio * .58 + u_pulse * .62) * mix(1.0, voidMask * .12, deepMode);
  color += mix(u_colorA, u_colorC, starSeed) * stars;
  float edge = smoothstep(1.08, .48, radius);
  color *= edge;
  gl_FragColor = vec4(color, edge);
}`;

function compile(type: number, source: string): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
  return shader;
}
function hslToRgb01(hue: number, saturation = .86, lightness = .58): [number, number, number] {
  const h = ((hue % 360) + 360) % 360 / 360;
  const hueToRgb = (p: number, q: number, t: number) => { let x = t; if (x < 0) x += 1; if (x > 1) x -= 1; if (x < 1 / 6) return p + (q - p) * 6 * x; if (x < .5) return q; if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6; return p; };
  if (saturation === 0) return [lightness, lightness, lightness];
  const q = lightness < .5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}
function selectedEnergy(audio: AudioData, range: ShaderParams['frequencyRange']): number {
  return range === 'low' ? audio.bass : range === 'mid' ? audio.mid : range === 'high' ? audio.treble : audio.energy;
}
function archetypeIndex(value: unknown): number {
  return value === 'spiral' ? 0 : value === 'nebula' ? 1 : value === 'core' ? 2 : value === 'deep' ? 3 : -1;
}
function uniform1f(name: string, value: number): void { if (gl && uniforms[name]) gl.uniform1f(uniforms[name], value); }
function uniform3f(name: string, color: [number, number, number]): void { if (gl && uniforms[name]) gl.uniform3f(uniforms[name], color[0], color[1], color[2]); }

export const CosmicOrbShader: ShaderPreset = {
  id: 'cosmic-orb', name: 'Cosmic Orb', description: 'Audio-reactive nebular orb with archetypal depth fields',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23060a1c" width="100" height="100"/%3E%3CradialGradient id="g" cx="50%25" cy="50%25" r="50%25"%3E%3Cstop stop-color="%23c4f3ff"/%3E%3Cstop offset=".35" stop-color="%2338bdf8"/%3E%3Cstop offset=".72" stop-color="%236366f1"/%3E%3Cstop offset="1" stop-color="%23060a1c"/%3E%3C/radialGradient%3E%3Ccircle cx="50" cy="50" r="43" fill="url(%23g)"/%3E%3C/svg%3E',
  type: 'webgl', category: 'experimental',
  defaults: { audioIntensity: .58, frequencyRange: 'full', beatSync: true, scale: 1, speed: .72, opacity: 1, blendMode: 'screen', orbArchetype: 'auto', orbScale: 1, orbSpeed: .72, orbSpin: .35, nebulaDensity: .58, starDetail: .38, lensEnabled: true, lensAmount: .42, audioPulseAmount: .62, paletteSpread: .7, deepVoidDepth: .68, deepRimDensity: .72, deepRimColorPull: .78, deepStarParallax: .42, deepDepthOfField: .55, colorSource: 'global', accentHue: 215 },
  controls: {
    orbArchetype: { type: 'select', label: 'Archetype', options: ['auto', 'spiral', 'nebula', 'core', 'deep'], default: 'auto' },
    orbScale: { type: 'slider', label: 'Orb Scale', min: .55, max: 1.5, step: .05, default: 1 },
    orbSpeed: { type: 'slider', label: 'Orb Speed', min: .05, max: 2.0, step: .05, default: .72 },
    orbSpin: { type: 'slider', label: 'Inner Spin', min: -1, max: 1, step: .05, default: .35 },
    nebulaDensity: { type: 'slider', label: 'Nebula Density', min: 0, max: 1, step: .05, default: .58 },
    starDetail: { type: 'slider', label: 'Star Detail', min: 0, max: 1, step: .05, default: .38 },
    lensEnabled: { type: 'toggle', label: 'Lens Warp', default: true },
    lensAmount: { type: 'slider', label: 'Lens Amount', min: 0, max: 1, step: .05, default: .42 },
    audioPulseAmount: { type: 'slider', label: 'Audio Pulse', min: 0, max: 2.0, step: .05, default: .62 },
    deepVoidDepth: { type: 'slider', label: 'Void Depth', min: 0, max: 1, step: .05, default: .68 },
    deepRimDensity: { type: 'slider', label: 'Rim Density', min: 0, max: 1, step: .05, default: .72 },
    deepRimColorPull: { type: 'slider', label: 'Rim Color Pull', min: 0, max: 1, step: .05, default: .78 },
    deepStarParallax: { type: 'slider', label: 'Star Parallax', min: 0, max: 1, step: .05, default: .42 },
    deepDepthOfField: { type: 'slider', label: 'Depth of Field', min: 0, max: 1, step: .05, default: .55 },
    paletteSpread: { type: 'slider', label: 'Palette Spread', min: 0, max: 1, step: .05, default: .7 },
    colorSource: { type: 'select', label: 'Color Source', options: ['global', 'custom-accent'], default: 'global' },
    accentHue: { type: 'slider', label: 'Accent Hue', min: 0, max: 360, step: 1, default: 215 },
  },
  init(canvas) {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false }) as WebGLRenderingContext | null;
    if (!gl) return;
    const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    program = gl.createProgram(); if (!program) return;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); program = null; return; }
    positionBuffer = gl.createBuffer(); if (!positionBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    positionLocation = gl.getAttribLocation(program, 'a_position');
    for (const name of ['u_resolution', 'u_anchor', 'u_colorA', 'u_colorB', 'u_colorC', 'u_time', 'u_audio', 'u_treble', 'u_pulse', 'u_archetype', 'u_scale', 'u_orbitalPhase', 'u_spinPhase', 'u_density', 'u_stars', 'u_lens', 'u_paletteSpread', 'u_voidDepth', 'u_rimDensity', 'u_rimColorPull', 'u_starParallax', 'u_depthOfField']) uniforms[name] = gl.getUniformLocation(program, name);
    activeArchetype = -1; smoothAudio = 0; smoothTreble = 0; smoothPulse = 0; orbitalPhase = { anchor: 0, anchorAt: 0, rate: 0 }; spinPhase = { anchor: 0, anchorAt: 0, rate: 0 };
  },
  render(audio, params, time) {
    if (!gl || !program || !positionBuffer) return;
    // A user-selected archetype is authoritative and persists. Only explicit
    // Auto (-1) delegates variation to the shader's slow automatic cycle.
    const requestedArchetype = archetypeIndex(params.orbArchetype);
    activeArchetype = requestedArchetype;
    const motionNow = time / 1000;
    // Rebased phase clocks retain the exact current angle when a rate changes.
    // Orb Speed owns whole-orb rotation; Inner Spin only twists internal arms.
    const orbitRate = .10 + Number(params.orbSpeed ?? params.speed ?? .72) * .54;
    const innerSpinRate = Number(params.orbSpin ?? .35) * .72;
    const resolvedOrbitalPhase = resolvePhase(orbitalPhase, motionNow, orbitRate) % (Math.PI * 2);
    const resolvedSpinPhase = resolvePhase(spinPhase, motionNow, innerSpinRate) % (Math.PI * 2);
    const energy = Math.max(0, Math.min(1, selectedEnergy(audio, params.frequencyRange) * (params.audioIntensity ?? .58)));
    // Low-pass all audio inputs before they reach the shader. This preserves
    // reactive luminance and pulse without destabilising the orbital rotation.
    smoothAudio += (energy - smoothAudio) * .11;
    smoothTreble += (Math.max(0, Math.min(1, audio.treble)) - smoothTreble) * .11;
    const pulseTarget = params.beatSync ? Math.max(0, Math.min(1, audio.beatIntensity)) : 0;
    smoothPulse += (pulseTarget - smoothPulse) * (pulseTarget > smoothPulse ? .2 : .075);
    const hue = params.colorSource === 'custom-accent' ? Number(params.accentHue ?? 215) : Number(params.hue ?? 210);
    const spread = Number(params.paletteSpread ?? .7);
    const anchor = hslToRgb01(hue, .72, .38), colorA = hslToRgb01(hue + 24 + spread * 16, .88, .60), colorB = hslToRgb01(hue + 86 + spread * 34, .82, .61), colorC = hslToRgb01(hue + 188 + spread * 42, .78, .58);
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.enableVertexAttribArray(positionLocation); gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    const audioWaveAmount = Number(params.audioPulseAmount ?? .62);
    const perceptualAudio = Math.pow(Math.max(0, smoothAudio), .56);
    uniform1f('u_time', time / 1000); uniform1f('u_audio', perceptualAudio * audioWaveAmount); uniform1f('u_treble', smoothTreble); uniform1f('u_pulse', smoothPulse * audioWaveAmount); uniform1f('u_archetype', activeArchetype); uniform1f('u_scale', Number(params.orbScale ?? params.scale ?? 1)); uniform1f('u_orbitalPhase', resolvedOrbitalPhase); uniform1f('u_spinPhase', resolvedSpinPhase); uniform1f('u_density', Number(params.nebulaDensity ?? .58)); uniform1f('u_voidDepth', Number(params.deepVoidDepth ?? .68)); uniform1f('u_rimDensity', Number(params.deepRimDensity ?? .72)); uniform1f('u_rimColorPull', Number(params.deepRimColorPull ?? .78)); uniform1f('u_starParallax', Number(params.deepStarParallax ?? .42)); uniform1f('u_depthOfField', Number(params.deepDepthOfField ?? .55)); uniform1f('u_stars', Number(params.starDetail ?? .38)); uniform1f('u_lens', params.lensEnabled === false ? 0 : Number(params.lensAmount ?? .42)); uniform1f('u_paletteSpread', spread);
    if (uniforms.u_resolution) gl.uniform2f(uniforms.u_resolution, gl.canvas.width, gl.canvas.height);
    uniform3f('u_anchor', anchor); uniform3f('u_colorA', colorA); uniform3f('u_colorB', colorB); uniform3f('u_colorC', colorC);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
  resize(width, height) { gl?.viewport(0, 0, width, height); },
  cleanup() { if (gl && program) gl.deleteProgram(program); if (gl && positionBuffer) gl.deleteBuffer(positionBuffer); gl = null; program = null; positionBuffer = null; positionLocation = -1; activeArchetype = -1; smoothAudio = 0; smoothTreble = 0; smoothPulse = 0; orbitalPhase = { anchor: 0, anchorAt: 0, rate: 0 }; spinPhase = { anchor: 0, anchorAt: 0, rate: 0 }; Object.keys(uniforms).forEach(key => { uniforms[key] = null; }); },
};
