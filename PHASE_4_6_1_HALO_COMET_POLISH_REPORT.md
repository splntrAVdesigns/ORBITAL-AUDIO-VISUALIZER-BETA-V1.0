# ORBITAL Phase 4.6.1 — Halo Comet Visual Polish Hotfix

## Visual correction

- Replaced the former 5 px / thickness-only orbit offset with a bloom-aware separation model.
- The comet now clears the actual outer Halo bloom edge by a responsive 8–14 px visual gap.
- Comet stroke width is included in the clearance calculation, so thicker settings do not merge into the Halo.
- Preserved the existing normal, Auto Zoom and Scroll Zoom radius authority, including bounded offscreen travel and seamless re-entry.
- Rebuilt the six-step tail as 32 closely overlapping, rounded segments over one continuous underglow.
- Applied smoothstep easing to opacity, stroke width, hue, saturation and luminance from the faint tail to the bright head.
- Reduced the head highlight length slightly so it reads as a focused leading edge instead of a separate block.

## Runtime ownership

- Halo Comet remains inside the existing Halo Canvas2D pass.
- Orbit phase, Speed, LEFT/RIGHT reversal, Thickness and Tail Length mappings are unchanged.
- No RAF, timer, canvas, worker, WebGL context, simulation or per-frame React state was added.
- The active hotfix emits 34 bounded strokes only while Halo Comet is enabled: 32 tail segments, one underglow and one head highlight.
- Core Particles, `App.tsx`, parameters, controls, presets, dependencies and lockfile are unchanged.

## Source certification

- Full `npm run verify`: passed.
- Preflight tests: 58 passed, 0 failed.
- Root and runtime TypeScript scopes: passed.
- Source and dependency audits: passed.
- Core Particles fallback: 449 lines, unchanged.
- Main-thread fallback intentionally recertified at `c9b5b3047878…`.
- Audio, export, recording and async lifecycle tests: passed.
- Exactly one continuous visual RAF plus the bounded staging-proof callback confirmed.
- Virtual 15-minute soak: passed with stable resource counters.
- StrictMode mount/unmount: passed.
- Production build and emitted worker/dist verification: passed.

The certification runner used Node 24/npm 11; the project remains correctly pinned to Node 22/npm 10 for deployment.
