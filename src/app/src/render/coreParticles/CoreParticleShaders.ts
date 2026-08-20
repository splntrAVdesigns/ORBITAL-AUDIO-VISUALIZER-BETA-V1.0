export const CORE_PARTICLE_UPDATE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec4 a_state;
layout(location = 1) in vec4 a_seed0;
layout(location = 2) in vec4 a_seed1;

uniform float u_time;
uniform float u_dtFrame;
uniform float u_fieldRadius;
uniform float u_chaos;
uniform float u_intensity;
uniform float u_smoothing;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_transient;
uniform float u_beatPulse;
uniform float u_impulse;
uniform float u_edgeFallback;
uniform float u_audioActive;
uniform float u_stereoPan;
uniform float u_stereoWidth;
uniform float u_vectorAmount;

out vec4 v_nextState;

void main() {
  float angle = a_seed0.x;
  float radiusFactor = a_seed0.y;
  float phase = a_seed0.z;
  float zone = a_seed0.w;
  float randomX = a_seed1.x;
  float randomY = a_seed1.y;
  float depth = a_seed1.z;

  float zoneEnergy = zone < 0.5 ? u_bass : (zone < 1.5 ? u_mid : u_high);
  float fieldRadius = u_fieldRadius;
  float phaseWave = sin(u_time * (1.7 + zone * 0.45) + phase - radiusFactor * 1.8);

  float radialExpansion =
    u_bass * (0.16 + radiusFactor * 0.28) +
    u_transient * (0.10 + 0.18 * max(phaseWave, 0.0)) +
    u_beatPulse * (0.08 + depth * 0.12) +
    u_impulse * (0.40 + depth * 0.36);

  float baseRadius = fieldRadius * (0.10 + pow(radiusFactor, 0.88) * 0.82);
  float radius = baseRadius * (1.0 + radialExpansion * (0.78 + u_intensity * 0.48));
  vec2 radial = vec2(cos(angle), sin(angle));
  vec2 tangent = vec2(-radial.y, radial.x);

  float swirl = u_mid * (0.10 + 0.25 * radiusFactor) + u_chaos * (0.12 + zoneEnergy * 0.12);
  float swirlWave = sin(u_time * 1.9 + phase * 1.3 + randomY);
  vec2 target = radial * radius + tangent * fieldRadius * swirl * swirlWave;

  float chaosDrive = u_chaos * (0.18 + zoneEnergy * 0.82 + u_impulse * 0.42);
  target += vec2(randomX, randomY) * fieldRadius * chaosDrive * 0.44;
  target += vec2(
    sin(u_time * (0.72 + depth * 0.24) + phase * 1.7),
    cos(u_time * (0.61 + radiusFactor * 0.31) + phase * 1.3)
  ) * fieldRadius * u_chaos * 0.14;

  // High-frequency energy moves particles through an implied Z plane without a CPU loop.
  float depthMotion = sin(u_time * (2.6 + depth) + phase * 1.5) * u_high;
  target *= 1.0 + depthMotion * (0.070 + depth * 0.075);
  target.y += depthMotion * fieldRadius * 0.080;

  float vectorAmount = clamp(u_vectorAmount, 0.0, 1.0);
  target.x += u_stereoPan * fieldRadius * vectorAmount * (0.12 + depth * 0.16) * sin(phase);
  target.y += (u_stereoWidth - 0.55) * fieldRadius * vectorAmount * 0.12 * cos(phase * 1.3);

  vec2 position = a_state.xy;
  vec2 velocity = a_state.zw;
  float liveRadius = length(position);
  float edgeStart = fieldRadius * mix(0.94, 0.68, u_edgeFallback);
  float edge = smoothstep(edgeStart, fieldRadius * 1.22, liveRadius);
  vec2 liveRadial = liveRadius > 0.0001 ? position / liveRadius : radial;
  vec2 liveTangent = vec2(-liveRadial.y, liveRadial.x);

  // Edge fallback combines tangential travel and a bounded inward return force.
  target += liveTangent * edge * u_edgeFallback * fieldRadius * 0.32 * sin(u_time * 1.4 + phase);
  target -= liveRadial * edge * u_edgeFallback * fieldRadius * 0.46;

  float spring = mix(0.24, 0.095, clamp(u_smoothing, 0.0, 1.0));
  spring += u_intensity * 0.055 + u_transient * 0.060;
  float damping = mix(0.68, 0.86, clamp(u_smoothing, 0.0, 1.0));
  velocity += (target - position) * spring * u_dtFrame;
  velocity += radial * fieldRadius * u_impulse * (0.035 + u_intensity * 0.050) * u_dtFrame;
  velocity *= pow(damping, u_dtFrame);

  float maxVelocity = fieldRadius * mix(0.15, 0.32, clamp(u_intensity + u_impulse, 0.0, 1.0));
  float speed = length(velocity);
  if (speed > maxVelocity) velocity *= maxVelocity / max(speed, 0.0001);
  position += velocity * u_dtFrame;

  float maxRadius = fieldRadius * 1.22;
  liveRadius = length(position);
  if (liveRadius > maxRadius) {
    position *= maxRadius / max(liveRadius, 0.0001);
    velocity = velocity * 0.42 - normalize(position + vec2(0.0001)) * fieldRadius * 0.025;
  }

  // Continue simulating toward rest while muted; fragment visibility remains zero.
  if (u_audioActive < 0.5) velocity *= pow(0.90, u_dtFrame);

  v_nextState = vec4(position, velocity);
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

export const CORE_PARTICLE_UPDATE_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`;

export const CORE_PARTICLE_RENDER_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec4 a_state;
layout(location = 1) in vec4 a_seed0;
layout(location = 2) in vec4 a_seed1;

uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_time;
uniform float u_intensity;
uniform float u_visualEnergy;
uniform float u_diameterGain;
uniform float u_baseHue;
uniform float u_saturation;
uniform float u_spectrum;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_beatPulse;
uniform float u_pulse;
uniform float u_audioActive;
uniform float u_energyGate;
uniform float u_shapeMode;
uniform float u_density;
uniform float u_rotation;
uniform float u_qualityScale;

out vec3 v_color;
out float v_alpha;
out float v_shape;
out float v_seed;
out float v_hotCore;
out float v_flash;

vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb = clamp(abs(mod(hsl.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return hsl.z + hsl.y * (rgb - 0.5) * (1.0 - abs(2.0 * hsl.z - 1.0));
}

void main() {
  float zone = a_seed0.w;
  float phase = a_seed0.z;
  float depth = a_seed1.z;
  float zoneEnergy = zone < 0.5 ? u_bass : (zone < 1.5 ? u_mid : u_high);
  float flashWave = 0.5 + 0.5 * sin(u_time * (11.0 + zone * 1.7) + phase * 2.4);
  float flashJitter = 0.5 + 0.5 * sin(u_time * 23.0 + phase * 6.1 + a_seed1.x * 8.0);
  float phasePulse = clamp(u_pulse * (0.28 + flashWave * 0.48 + flashJitter * 0.24), 0.0, 1.0);
  float zShimmer = u_high * (0.5 + 0.5 * sin(u_time * 3.1 + phase * 1.4));

  float rotationCos = cos(u_rotation);
  float rotationSin = sin(u_rotation);
  vec2 rotatedPosition = mat2(rotationCos, -rotationSin, rotationSin, rotationCos) * a_state.xy;
  vec2 screenPosition = u_resolution * 0.5 + rotatedPosition;
  vec2 clip = screenPosition / u_resolution * 2.0 - 1.0;
  clip.y *= -1.0;
  gl_Position = vec4(clip, 0.0, 1.0);

  float densityCompensation = mix(1.16, 0.88, clamp(u_density, 0.0, 1.0));
  float bodyDiameter = (
    2.7 + depth * 1.8 +
    clamp(u_intensity, 0.0, 1.0) * 4.15 +
    zoneEnergy * 2.4 + zShimmer * 0.7
  ) * densityCompensation * u_diameterGain;
  float shapeScale = u_shapeMode > 0.5 ? 1.16 : 1.0;
  // Oversized point bounds contain the SDF glow while the solid body stays compact.
  gl_PointSize = clamp(bodyDiameter * 2.55 * shapeScale * u_dpr * u_qualityScale, 6.0 * u_dpr, 36.0 * u_dpr);

  float signedFlash = phasePulse * sin(phase * 3.7 + u_time * 17.0);
  float hueShift = a_seed1.w + zoneEnergy * 8.0 + signedFlash * 34.0;
  if (u_spectrum > 0.5) hueShift += a_seed0.x * 57.2958 * 0.31;
  float hue = fract((u_baseHue + hueShift) / 360.0);
  float lightness = clamp(0.40 + zoneEnergy * 0.10 + phasePulse * 0.15, 0.0, 0.70);
  float flashSaturation = clamp(u_saturation * (0.84 + phasePulse * 0.24), 0.0, 1.0);
  v_color = hsl2rgb(vec3(hue, flashSaturation, lightness));
  float reactiveGate = clamp(u_audioActive * u_energyGate, 0.0, 1.0);
  float presenceGate = mix(0.42, 1.0, reactiveGate);
  float alphaGain = u_visualEnergy / max(1.0, u_diameterGain * u_diameterGain);
  v_alpha = presenceGate * alphaGain * clamp(
    0.16 + u_intensity * 0.60 + zoneEnergy * 0.18 + u_beatPulse * 0.06,
    0.0,
    0.94
  );
  v_alpha = clamp(v_alpha, 0.0, 0.96);
  v_shape = u_shapeMode;
  v_seed = fract(sin(a_seed0.x * 17.23 + phase * 3.1) * 43758.5453);
  v_hotCore = clamp(zoneEnergy * 0.72 + u_intensity * 0.28, 0.0, 1.0);
  v_flash = phasePulse;
}
`;

export const CORE_PARTICLE_RENDER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_color;
in float v_alpha;
in float v_shape;
in float v_seed;
in float v_hotCore;
in float v_flash;
out vec4 fragColor;

float circleSdf(vec2 p) { return length(p) - 0.43; }
float diamondSdf(vec2 p) { return (abs(p.x) + abs(p.y)) * 0.78 - 0.43; }
float triangleSdf(vec2 p) {
  p.y += 0.07;
  return max(abs(p.x) * 0.866 + p.y * 0.50, -p.y) - 0.41;
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float shape = v_shape;
  if (shape > 2.5) shape = v_seed < 0.50 ? 0.0 : (v_seed < 0.75 ? 1.0 : 2.0);

  float distanceToBody = circleSdf(p);
  if (shape > 0.5 && shape < 1.5) distanceToBody = triangleSdf(p);
  else if (shape > 1.5) distanceToBody = diamondSdf(p);

  float aa = max(fwidth(distanceToBody), 0.006);
  float body = 1.0 - smoothstep(-aa, aa, distanceToBody);
  float rim = smoothstep(-0.11, -0.015, distanceToBody) * body;
  float core = 1.0 - smoothstep(-0.30, -0.10, distanceToBody);
  // Shape-distance glow preserves triangle and diamond silhouettes instead of
  // rounding every mode back into the same circular sprite.
  float shapeGlow = exp(-8.5 * max(distanceToBody, 0.0));
  float outerMask = 1.0 - smoothstep(0.78, 1.0, length(p));
  float glow = shapeGlow * outerMask * (1.0 - body * 0.68);

  float alpha = v_alpha * (body * 0.82 + rim * 0.20 + glow * (0.16 + v_hotCore * 0.10));
  if (alpha < 0.002) discard;

  vec3 flashColor = mix(vec3(0.56, 0.82, 1.0), vec3(1.0, 0.48, 0.86), v_seed);
  vec3 glowColor = mix(v_color, flashColor, 0.08 + v_hotCore * 0.06 + v_flash * 0.16);
  vec3 color = mix(glowColor, v_color, body);
  float highlight = exp(-42.0 * dot(p - vec2(-0.12, -0.16), p - vec2(-0.12, -0.16))) * body;
  color += vec3(core * (0.035 + v_hotCore * 0.055) + rim * 0.045 + highlight * 0.16);
  fragColor = vec4(color, alpha);
}
`;
