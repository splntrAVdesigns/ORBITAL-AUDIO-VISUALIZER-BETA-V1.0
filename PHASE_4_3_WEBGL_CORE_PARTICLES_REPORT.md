# Phase 4.3 — WebGL Core Particles GPU Migration

## Renderer authority

- WebGL2 transform feedback updates position and velocity entirely on the GPU.
- One transform-feedback draw and one SDF point-sprite draw are submitted by the existing authoritative RAF.
- WebGL2 is initialized only after Core Particles is enabled.
- Canvas2D stays frozen and renders only when WebGL2 cannot initialize, loses context, or fails a frame.
- Inactive GPU state is cleared and hidden once; it is not cleared on every disabled frame.
- `dot`, `tri`, `dia`, and deterministic `all` modes are preserved.

## Motion and control parity

The shader path consumes the existing intensity, spread, chaos, pulse, edge fallback,
density, burst strength/impulse, smoothing, color, spectrum, stereo, and energy-gate
values. Stateful transform feedback preserves velocity, damping, bounded return force,
radial bass/transient expansion, mid tangential swirl, high-frequency depth motion,
phase offsets, and edge return.

No new user control, preset field, dependency, or scheduler was added.

## Phase 4.3.1 field correction

Field testing found that the original GPU radius occupied only 4.5–15% of the short
canvas side and that the power-of-2.5 seed curve concentrated most particles at the
origin. Phase 4.3.1 expands the usable Spread range to 11.5–31.5%, uses an area-weighted
seed distribution, gives Pulse/Burst direct zero-preserving control curves, lifts the
live analyser bands perceptually, and routes the current low-latency onset lane into
the GPU frame. Shape glow now follows each SDF silhouette instead of rounding triangle
and diamond modes into dot-like halos.

The Canvas2D fallback block remains unchanged and is certified by
`PHASE_4_3_CORE_PARTICLES_CANVAS2D_FALLBACK_FREEZE.json`.

### Figma field checks

- At 30% Spread, the calm field should occupy roughly 19% of the short canvas side.
- At 90% Spread, it should approach 30% and feel visibly closer/expanded.
- `DOT`, `TRI`, `DIA`, and `ALL` must produce distinct silhouettes.
- Burst Strength must remain fully off at zero and become clearly transient-driven above 20%.
- Silence must still hide the GPU particles.
- `window.__ORBITAL_CORE_PARTICLES_GPU__` should report the selected `shapeMode`,
  actual `fieldRadius`, mapped `intensity`, `burstStrength`, and submission timing.

## Deterministic references

`docs/core-particles-parity` contains deterministic SVG reference captures for all
four shape modes and three canonical audio-response states. The manifest stores their
SHA-256 signatures and the fixed seed contract.

These reference captures validate distribution and control direction. Final visual
approval still requires the Figma/Vercel field pass because the build environment does
not provide a hardware WebGL2 screenshot surface.

## Performance measurement

Development builds publish:

```js
window.__ORBITAL_CORE_PARTICLES_GPU__
```

The snapshot includes draw count, submitted frames, context losses/recoveries,
fallback frames, and last/average/maximum CPU submission time. The structural contract
is two GPU draws and zero CPU particle loops per visible frame.

## Context/fallback certification

- `webglcontextlost` is prevented and immediately hides the GPU layer.
- The same RAF selects Canvas2D while context is unavailable.
- `webglcontextrestored` recompiles programs, buffers, VAOs, and transform feedback.
- Session disposal removes listeners, deletes GPU resources, and releases the context.
