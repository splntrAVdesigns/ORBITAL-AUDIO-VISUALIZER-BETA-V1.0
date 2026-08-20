// WebGL Shader Code for ORBITAL Visualizer
// Extracted from App.tsx for better organization and syntax highlighting

/**
 * SPIKE RING VERTEX SHADER
 * Renders frequency-domain spectrum analyzer as circular equalizer bars
 * Features: thick spike mode, inward/outward direction, zoom, rotation
 */
export const spikeRingVertexShader = `
  attribute float a_index;
  attribute float a_amplitude;
  attribute float a_isEnd; // 0 = base, 1 = tip
  attribute float a_side; // -1 = left edge, +1 = right edge (for thick spikes)
  attribute float a_jitter; // 🔥 FIX: Angular jitter to break up cardinal point clustering
  
  uniform vec2 u_resolution;
  uniform float u_innerRadius;
  uniform float u_outerRadius;
  uniform float u_rotation;
  uniform float u_spikeCount;
  uniform float u_mirror; // Inward spike amplitude (0-1.0)
  uniform float u_spikeTightness; // Outward spike amplitude (0.2-2.0)
  uniform float u_spikeDirection; // 1.0 = outward, -1.0 = inward
  uniform float u_zoom;
  uniform float u_centerX;
  uniform float u_centerY;
  uniform float u_chaosAmount; // Phase 10I: 8-segment radial oscillation strength
  uniform float u_chaosTime;   // Phase 10I: eased segment oscillation phase
  
  varying float v_brightness;
  varying float v_hue;
  varying float v_sideCoord;
  varying float v_tipCoord;
  
  #define PI 3.14159265359
  #define TAU 6.28318530718
  
  void main() {
    // Calculate base angle for this spike (0 to 2π)
    float baseAngle = (a_index / u_spikeCount) * TAU + u_rotation;
    
    // 🔥 FIX: Add angular jitter to prevent cardinal point clustering
    baseAngle += a_jitter;
    
    // 🎨 THICK SPIKE MODE: Calculate width offset using a_side
    // spikeWidth is controlled by how many pixels to offset perpendicular to the spike
    float spikeWidthPixels = 3.5; // 3.5px thick spikes
    float gapAngle = TAU / u_spikeCount;
    float halfWidthAngle = (spikeWidthPixels / (u_innerRadius * TAU)) * a_side * 0.5;
    float angle = baseAngle + halfWidthAngle;
    
    // Apply amplitude (0-1 range from FFT data) with minimum height for visibility
    float minHeight = (u_outerRadius - u_innerRadius) * 0.0055;
    float spikeHeight = max(minHeight, (u_outerRadius - u_innerRadius) * a_amplitude);
    
    // Phase 10I: Chaos = controlled 8-segment radial split/oscillation, not random jitter.
    float segmentId = floor(mod(baseAngle, TAU) / TAU * 8.0);
    float segmentPhase = u_chaosTime * 2.35 + segmentId * 1.57079632679;
    float rawSeg = sin(segmentPhase);
    float easedSeg = sign(rawSeg) * smoothstep(0.0, 1.0, abs(rawSeg));
    float chaosOffset = easedSeg * u_chaosAmount * (u_outerRadius - u_innerRadius) * 0.42;

    // Calculate radius based on whether this is base or tip vertex
    float radius;
    if (a_isEnd < 0.5) {
      // Base vertex - always at innerRadius
      radius = u_innerRadius + chaosOffset;
    } else {
      // Tip vertex - direction and amplitude depend on mode
      if (u_spikeDirection > 0.0) {
        // Outward spike (scaled by spikeTightness)
        radius = u_innerRadius + chaosOffset + spikeHeight * u_spikeTightness;
      } else {
        // Inward spike (scaled by mirror)
        radius = u_innerRadius + chaosOffset - spikeHeight * u_mirror;
      }
    }
    
    // Apply global zoom
    radius *= u_zoom;
    
    // Convert polar to cartesian
    float x = u_centerX + cos(angle) * radius;
    float y = u_centerY + sin(angle) * radius;
    
    // Convert to clip space (-1 to 1)
    vec2 clipSpace = ((vec2(x, y) / u_resolution) * 2.0) - 1.0;
    clipSpace.y *= -1.0; // Flip Y (WebGL has Y-up, canvas has Y-down)

    v_sideCoord = (a_side + 1.0) * 0.5;
    v_tipCoord = a_isEnd;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
    
    // Pass brightness and hue to fragment shader
    v_brightness = a_amplitude;
    v_hue = baseAngle / TAU; // 0-1 range for hue cycling
  }
`;

/**
 * SPIKE RING FRAGMENT SHADER
 * Applies color with HSL support and spectrum/solid color modes
 */
export const spikeRingFragmentShader = `
  precision highp float;
  
  uniform vec3 u_baseColor; // HSL base color
  uniform float u_alpha;
  uniform float u_spectrum; // 0 = solid color, 1 = spectrum mode
  uniform float u_saturation;
  uniform float u_lightness;
  uniform float u_colorWaveActive; // Color Wave effect enabled (0.0 or 1.0)
  uniform float u_colorWaveTime; // Rotation phase for Color Wave
  uniform float u_colorWaveAmount; // Effect intensity (0.0-1.0)
  uniform float u_bloom; // 🔥 Bloom/glow intensity (0.0-1.0)
  uniform float u_gammaFx; // PHASE 10F: visual gamma energy strength
  uniform float u_gammaFlash; // beat/onset gamma flash lane
  uniform float u_gammaTipBoost; // tip-only luminance boost
  uniform float u_iridize; // shader-owned chroma shell/fringe strength
  uniform float u_iridizeTime; // scheduler-owned iridescent phase
  uniform float u_iridizeBeat; // beat accent without geometry changes
  
  varying float v_brightness;
  varying float v_hue;
  varying float v_sideCoord;
  varying float v_tipCoord;
  
  // HSL to RGB conversion
  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c * 0.5;
    
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    
    return rgb + m;
  }
  
  void main() {
    // 🌊 COLOR WAVE vs SPECTRUM MODE: Color Wave overrides spectrum when active!
    float hue;
    
    if (u_colorWaveActive > 0.5) {
      // COLOR WAVE ACTIVE: Create variations around BASE color picker (ignore spectrum!)
      hue = u_baseColor.x; // Start with color picker hue
      
      // Calculate angle-based hue offset
      float angle = v_hue * 6.28318; // Convert to radians (0-2π)
      float rotatedAngle = angle + u_colorWaveTime; // Add rotation
      
      // Calculate hue offset: sine wave creates smooth ±range variation
      // Range: 0-60° (0.167 in 0-1 hue space) at 100% effectAmount
      float hueRange = u_colorWaveAmount * 0.167; // 60° = 60/360 = 0.167
      float offset = sin(rotatedAngle * 3.0) * hueRange; // 3 cycles around ring
      
      // Apply offset to base hue (keep in 0-1 range)
      hue = mod(hue + offset + 1.0, 1.0);
    } else {
      // COLOR WAVE INACTIVE: Respect spectrum mode setting
      // spectrum=1.0 → rainbow (v_hue), spectrum=0.0 → solid (u_baseColor.x)
      hue = mix(u_baseColor.x, v_hue, u_spectrum);
    }
    
    // PHASE 10F: Gamma is a visual-energy lane, not just amplitude shaping.
    float gammaStrength = clamp(u_gammaFx, 0.0, 1.0);
    float gammaSquared = gammaStrength * gammaStrength;
    float hotTip = smoothstep(0.42, 0.96, v_brightness) * v_tipCoord;
    // Phase 13B: make the Gamma slider visibly useful again as a luminance/tip-energy control.
    float gammaLumLift = gammaSquared * (10.0 + hotTip * 34.0 + u_gammaFlash * 16.0);
    float gammaSatLift = gammaSquared * (2.0 + hotTip * 14.0);

    // Convert HSL to RGB
    vec3 color = hsl2rgb(vec3(
      hue,
      clamp((u_saturation + gammaSatLift) / 100.0, 0.0, 1.0),
      clamp((u_lightness + gammaLumLift) / 100.0, 0.0, 1.0)
    ));

    // Phase 4.6.4A: Iridize is analytic shader color, never a Canvas2D overlay.
    // The shell follows both quad edges, the fringe travels through hue space,
    // and the tip accent responds to amplitude/beat without changing geometry.
    float iridizeStrength = clamp(u_iridize, 0.0, 1.0);
    float edgeDistance = min(v_sideCoord, 1.0 - v_sideCoord);
    float shell = 1.0 - smoothstep(0.04, 0.34, edgeDistance);
    float tipAccent = smoothstep(0.58, 1.0, v_tipCoord) *
                      smoothstep(0.18, 0.92, v_brightness);
    float fringePhase = fract(v_hue * 3.0 + u_iridizeTime * 0.055 + v_brightness * 0.17);
    float fringeHue = fract(hue + 0.08 + fringePhase * 0.28 + u_iridizeBeat * 0.05);
    vec3 fringeColor = hsl2rgb(vec3(
      fringeHue,
      clamp((u_saturation + 18.0 + iridizeStrength * 34.0) / 100.0, 0.0, 1.0),
      clamp((u_lightness + 8.0 + tipAccent * 18.0) / 100.0, 0.0, 1.0)
    ));
    float fringeMix = iridizeStrength * clamp(
      shell * (0.24 + v_brightness * 0.34) +
      tipAccent * (0.42 + u_iridizeBeat * 0.24),
      0.0,
      0.88
    );
    color = mix(color, fringeColor, fringeMix);
    
    // Apply brightness from amplitude, plus tip-only gamma energy flash.
    float gammaTipEnergy = 1.0 + u_gammaTipBoost * hotTip * (1.05 + u_gammaFlash * 0.95);
    color *= (0.5 + v_brightness * 0.5) * gammaTipEnergy;

    // 🔥 SPIKE BLOOM: Dynamic glow/aura effect (AMPLIFIED for more noticeable impact!)
    // 0% = Sharp edges (0.10 feather), 50% = Soft glow (0.35 feather), 100% = Intense bloom (0.70 feather)
    float edgeFeather = 0.10 + u_bloom * 0.60; // 0.10-0.70 range (increased from 0.40)
    
    float sideFeather = smoothstep(0.0, edgeFeather, v_sideCoord) *
                        smoothstep(0.0, edgeFeather, 1.0 - v_sideCoord);

    // Bloom also softens tip feathering (more dramatic fade)
    float tipStart = 0.82 - u_bloom * 0.35; // Earlier fade with bloom (increased from 0.20)
    float tipFeather = 1.0 - smoothstep(tipStart, 1.0, v_tipCoord);
    tipFeather = mix(0.80, 1.0, tipFeather);

    float featherAlpha = sideFeather * tipFeather;
    
    // Bloom brightness boost: glow multiplier on bright spikes (AMPLIFIED!)
    float gammaBloom = 1.0 + gammaSquared * hotTip * (0.70 + u_gammaFlash * 0.85);
    float bloomBoost = (1.0 + u_bloom * v_brightness * 1.2) * gammaBloom; // Gamma adds mild energy bloom separate from spikeBloom
    vec3 bloomColor = color * bloomBoost;

    gl_FragColor = vec4(bloomColor, u_alpha * featherAlpha);
  }
`;

/**
 * Shader attribute and uniform location type definitions
 */
export interface SpikeProgramLocations {
  a_index: number;
  a_amplitude: number;
  a_isEnd: number;
  u_resolution: WebGLUniformLocation | null;
  u_innerRadius: WebGLUniformLocation | null;
  u_outerRadius: WebGLUniformLocation | null;
  u_rotation: WebGLUniformLocation | null;
  u_spikeCount: WebGLUniformLocation | null;
  u_mirror: WebGLUniformLocation | null;
  u_spikeTightness: WebGLUniformLocation | null;
  u_spikeDirection: WebGLUniformLocation | null;
  u_zoom: WebGLUniformLocation | null;
  u_centerX: WebGLUniformLocation | null;
  u_centerY: WebGLUniformLocation | null;
  u_chaosAmount: WebGLUniformLocation | null;
  u_chaosTime: WebGLUniformLocation | null;
  u_baseColor: WebGLUniformLocation | null;
  u_alpha: WebGLUniformLocation | null;
  u_spectrum: WebGLUniformLocation | null;
  u_saturation: WebGLUniformLocation | null;
  u_lightness: WebGLUniformLocation | null;
  u_colorWaveActive: WebGLUniformLocation | null;
  u_colorWaveTime: WebGLUniformLocation | null;
  u_colorWaveAmount: WebGLUniformLocation | null;
  u_bloom: WebGLUniformLocation | null; // 🔥 Bloom/glow intensity
  u_gammaFx: WebGLUniformLocation | null;
  u_gammaFlash: WebGLUniformLocation | null;
  u_gammaTipBoost: WebGLUniformLocation | null;
  u_iridize: WebGLUniformLocation | null;
  u_iridizeTime: WebGLUniformLocation | null;
  u_iridizeBeat: WebGLUniformLocation | null;
  a_side: number;
  a_jitter: number;
}
