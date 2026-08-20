# Phase 4.5 — Frame-Pacing Recovery, Particle Control Separation & Field Certification

## Runtime corrections

- Burst Strength is applied once through a progressive curve and affects motion only.
- Pulse is a per-particle color flash/jitter envelope; it does not alter simulation, point size, alpha, or geometry.
- Intensity has stronger bounded body/contrast authority without Burst-driven overdraw.
- Late particle frames advance at most one normal simulation step.
- Core Particles use renderer-internal `full`, `balanced`, and `critical` quality tiers from rolling p95/p99 frame intervals.
- User-facing density and other controls are never rewritten by adaptive quality.
- Point-sprite area is budgeted by DPR and quality tier.
- CPU submission time and optional `EXT_disjoint_timer_query_webgl2` GPU completion time are reported separately.
- The unused AudioBridge analysis worker and its typed-array copies are removed.
- Stereo time-domain analysis runs only while Core Particles are active.
- Core Particle frame storage is reused without per-frame parameter-object creation.
- Development diagnostics require explicit opt-in; crash telemetry persists only lifecycle/error/reload/shutdown evidence.
- Render-scale diagnostics report committed pixel width × pixel height.

## Field mode

Field mode is explicit and production-safe. Enable it with either:

```text
?orbitalFieldCert=1
```

or:

```js
localStorage.setItem('orbital.fieldCertification', '1'); location.reload();
```

It publishes only the measurements required for certification:

- `window.__ORBITAL_FRAME_PACING__`
- `window.__ORBITAL_RENDER_COSTS__`
- `window.__ORBITAL_CORE_PARTICLES_GPU__`
- `window.__ORBITAL_INTERACTION_METRICS__`
- `window.__ORBITAL_AUDIO_VISUAL_STRESS__`
- `window.__ORBITAL_RENDER_SCALE__`

Run the deterministic hardware capture after `npm run build`:

```text
npm run field:phase4-5
npm run verify:phase4-5-field
```

The capture refuses software renderers such as SwiftShader/llvmpipe and records a deterministic stereo WAV stress scene with Core Particles, Burst 100%, Density 100%, rotation, panel scrolling, audio events, CPU submission time, and GPU timer-query results.

## Acceptance thresholds

- Stress p95 frame interval ≤ 25 ms.
- Stress p99 frame interval ≤ 34 ms.
- Maximum stress interruption ≤ 100 ms.
- Longest interaction gap ≤ 50 ms.
- Zero audio `waiting` and `stalled` events.
- One runtime session and one authoritative RAF scheduler.
- Hardware WebGL2 renderer; software GPU is a no-go.
- Figma and Vercel reports are captured separately before Phase 5.

The source/build gate cannot certify a physical GPU or the Figma host. Those remain explicit field gates and must not be represented as passed until their JSON reports pass the verifier.
