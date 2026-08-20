# 🏗️ ORBITAL ARCHITECTURE GUIDE

**Version:** 1.0 BETA  
**Last Updated:** June 20, 2026

---

## 📐 SYSTEM OVERVIEW

ORBITAL is a high-performance audio-reactive visualizer built with **React**, **Canvas2D**, **WebGL**, and the **Web Audio API**.

### **Core Technologies:**

| Technology | Purpose | Performance |
|------------|---------|-------------|
| **React** | UI framework & state management | 60 FPS UI updates |
| **Canvas2D** | Baseline rendering (strokes, fills, dots, halo, center graphic) | CPU-bound |
| **WebGL** | GPU-accelerated spike ring & Liquid Shaper engine | GPU-bound |
| **Web Audio API** | Real-time audio analysis | Hardware-accelerated |
| **TypeScript** | Type-safe development | Compile-time safety |

---

## 🔊 AUDIO PIPELINE

### **1. Audio Input Sources**

```
┌─────────────────────────────────────────┐
│ AUDIO SOURCES                            │
├─────────────────────────────────────────┤
│ • Microphone (navigator.mediaDevices)   │
│ • File Upload (MP3, WAV, FLAC, etc.)    │
│ • Demo Audio Files (built-in)           │
└─────────────────────────────────────────┘
                ↓
         AudioContext
```

### **2. Dual-Analyser Architecture**

ORBITAL uses **TWO** separate analysers for optimal performance:

```typescript
// ANALYSER 1: Spike Ring Visualization (variable FFT)
analyser = AC.createAnalyser();
analyser.fftSize = params.fft; // 128-2048 (user-adjustable)
analyser.getByteFrequencyData(freqArr); // Frequency spectrum

// ANALYSER 2: Beat Detection (fixed FFT 2048)
energyAnalyser = AC.createAnalyser();
energyAnalyser.fftSize = 2048; // FIXED for stable beat detection
energyAnalyser.getByteFrequencyData(energyFreqArr); // Energy analysis
```

**Why Two Analysers?**
- Spike ring needs variable FFT (user control)
- Beat detection needs fixed FFT (stable thresholds)
- Prevents energy glitches when user changes FFT slider

**Confirmed optimal setting:** `smoothingTimeConstant = 0.48` on the primary analyser. This value has been tested extensively — `0.65` was identified as one of the most damaging settings ever tried, flattening spike variation and introducing audio lag simultaneously.

### **3. Audio Data Flow**

```
AudioSource
    ↓
AudioContext
    ├─→ analyser (FFT 128-2048) ──→ freqArr ──→ Spike Ring
    ├─→ energyAnalyser (FFT 2048) ─→ energyFreqArr ──→ Beat Detection
    └─→ gainNode ──→ destination (speakers)
```

---

## 🎨 RENDERING ARCHITECTURE

### **Dual-Canvas System**

```
┌─────────────────────────────────────────────┐
│ RENDERING LAYERS (Z-INDEX ORDER)            │
├─────────────────────────────────────────────┤
│ #glCanvas (WebGL) ──→ Z-INDEX: 2           │
│  • GPU-accelerated spike ring (thick bars) │
│  • Liquid Shaper sacred-geometry engine    │
│  • Additive blending (lighter mode)        │
│  • Pre-allocated buffers (zero GC)         │
├─────────────────────────────────────────────┤
│ #canvas (Canvas2D) ──→ Z-INDEX: 1          │
│  • Baseline spike strokes (fallback only — │
│    only renders if WebGL is unavailable)   │
│  • Dots, halo, center graphic (always-on)  │
│  • Motion blur trails                      │
│  • Effects (bloom, gamma, chaos)           │
└─────────────────────────────────────────────┘
```

**Important architectural note:** the Canvas2D spike-stroke path and the WebGL spike path are **mutually exclusive**, not simultaneously layered. WebGL renders the spike ring whenever its context and shader program initialize successfully (the default case on any working browser/GPU). Canvas2D only takes over rendering spikes specifically if WebGL context creation fails, shader compilation fails, or the context is lost at runtime (e.g. driver crash, tab backgrounded too long). This is a genuine, intentional safety fallback — without it, the spike ring would simply disappear if WebGL ever drops out mid-session. Everything *else* on the Canvas2D layer (dots, halo, center graphic, effects) always renders regardless of which spike path is active.

### **Render Loop Structure**

```typescript
function loop(timestamp: number) {
  // 1. Calculate delta time (clamped — see Performance Optimizations below)
  const dt = (timestamp - lastT) / 1000;
  
  // 2. Get audio data (ONCE per frame)
  analyser.getByteFrequencyData(freqArr);
  energyAnalyser.getByteFrequencyData(energyFreqArr);
  
  // 3. Process audio reactivity
  //    - Beat detection (bass, mid, high)
  //    - BPM estimation
  //    - Energy smoothing
  
  // 4. Update time-based effects
  //    - Color Wave rotation
  //    - Saturation Burst wave
  //    - BPM-synced color cycling
  
  // 5. Render WebGL layer (if active)
  //    - Upload audio data to GPU buffers
  //    - Draw spike ring / Liquid Shaper with shaders
  
  // 6. Render Canvas2D layer
  //    - Motion blur trail
  //    - Spike ring baseline (fallback only)
  //    - Dots, halo, center graphic
  //    - Effects (bloom, gamma, etc.)
  
  // 7. Update UI (throttled)
  //    - FPS counter
  //    - Audio meters
  //    - Performance stats
  
  // 8. Schedule next frame
  requestAnimationFrame(loop);
}
```

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### **Phase 1: Zero-Allocation Render Loop**

**Problem:** Garbage collection pauses every 3-5 seconds  
**Solution:** Pre-allocate all buffers and arrays

```typescript
// ✅ BEFORE LOOP: Pre-allocate everything
const MAX_SPIKES = 2048;
const indexData = new Float32Array(MAX_SPIKES * 4);
const amplitudeData = new Float32Array(MAX_SPIKES * 4);
const dotRPrev = new Float32Array(2000);
const dotAPrev = new Float32Array(2000);

// ✅ IN LOOP: Reuse buffers (no allocation!)
indexData[i] = value; // Just write to existing buffer
```

**Results:**
- 240 allocations/sec → **0 allocations/sec**
- GC pauses eliminated
- Stable 60 FPS

### **Phase 2: Pre-Allocated WebGL Buffers**

**Problem:** Creating 4 WebGL buffers every frame (60x/sec)  
**Solution:** Create once, reuse with `bufferSubData`

```typescript
// ✅ AT INIT: Create buffers once
webglIndexBuffer = gl.createBuffer();
gl.bufferData(gl.ARRAY_BUFFER, maxSize, gl.DYNAMIC_DRAW);

// ✅ IN LOOP: Update data only
gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count));
```

**Results:**
- 240 WebGL allocations/sec → **0**
- 80% reduction in GC pressure
- Smoother framerate

### **Phase 3: Infinite Phase Accumulation**

**Problem:** Modulo wrap creates micro-discontinuities  
**Solution:** Infinite accumulation (trig functions handle wrapping)

```typescript
// ❌ OLD: Modulo wrap every 8.4 seconds
const rotation = (time * 0.00075) % (Math.PI * 2);

// ✅ NEW: Infinite accumulation
colorWavePhase += dt * 0.75; // No modulo!
const rotation = colorWavePhase; // Use directly
```

**Why It Works:**
- `sin(x)` and `sin(x + 2π)` are identical
- No need for modulo - trig is periodic
- Eliminates wrap discontinuity

### **Phase 4: Liquid Shaper Texture Upload Skip**

**Problem:** `WebGLAstralRenderer.render()` was re-uploading both shape textures to the GPU via `texImage2D` on *every single frame*, even though the source canvas (from `generateShapeTexture`'s own cache) is almost always identical to the previous frame. A full ~16MB 2048×2048 texture upload, repeated needlessly, up to 3x per frame when the multi-layer jitter effect is active.

**Solution:** Track the last-uploaded canvas reference per texture unit; skip the `texImage2D` call entirely when the reference hasn't changed. Cheap GL state calls (`bindTexture`, `texParameteri`) still run every time so binding state can never go stale — only the expensive upload itself is conditional.

**Result:** Eliminates redundant GPU uploads during Liquid Shaper rotation/morph, the dominant remaining per-frame cost in that subsystem.

### **Phase 5: Spike Ring Lookup Table Guard**

**Problem:** `rebuildSpikeLookupTables()` — which allocates three fresh `Float32Array` buffers and runs a full N-iteration trig/hash loop — had a tracking variable (`lookupTablesSize`) declared specifically to guard it, but the guard was never actually wired up. It ran unconditionally, every frame, regardless of whether the spike count had changed.

**Solution:** Added the missing `if (N !== lookupTablesSize)` guard. The tables now only rebuild when the FFT-derived spike count actually changes — which in normal use is essentially never, since it only changes when the user moves the FFT slider.

### **Phase 6: Per-Frame String Allocation Reduction (Halo & Dots)**

**Problem:** The halo's bloom-pass loop (4-12 passes, active by default) and the per-dot rendering loop were both building a brand-new `hsla(...)` template-literal string every single iteration, every frame — much of it for color data (hue, saturation) that doesn't actually change within that loop, only the transparency does.

**Solution:** Moved the transparency component to `ctx.globalAlpha` instead of formatting it into the color string each time. `globalAlpha` multiplies with the color's own alpha, so this is mathematically identical to the previous output — a pure allocation reduction, not a visual change.

### **Delta Time Clamping**

`MAX_DT = 0.033` (33ms) caps how much simulated time a single frame can advance, regardless of how much real wall-clock time actually elapsed. This was tightened from an earlier 100ms clamp specifically because the looser clamp allowed visible "catch-up" jumps in rotation and particle motion after a stall. The tighter clamp reduces the *size* of any catch-up jump; it does not eliminate the underlying stall if one occurs, which is why reducing real allocation/GPU-upload sources (Phases 4-6 above) matters independently of this clamp.

---

## 🎭 BEAT REACTIVE COLOR FX SYSTEM

### **Architecture**

```
Beat Detection (bass energy threshold)
    ↓
isBeat flag = true
    ↓
┌───────────────────────────────────────┐
│ BEAT PULSE TYPE (user selection)     │
├───────────────────────────────────────┤
│ • Rainbow Canvas (rotating gradient)  │
│ • Color Wave (hue modulation)        │
│ • Saturation Burst (color breathing) │
│ • All (all effects simultaneously)    │
└───────────────────────────────────────┘
    ↓
Effect Amount slider (0-100%)
    ↓
Visual effect applied to canvas
```

### **Effect Amount Slider**

**Purpose:** Unified intensity control for whichever effect is selected

- **0%** = Effect disabled (even if beat pulse type is selected)
- **50%** = Moderate intensity
- **100%** = Maximum intensity

**Technical Implementation:**
```typescript
// Color Wave
const hueShift = Math.sin(angle + colorWaveRotation) * (params.effectAmount * 60);

// Saturation Burst
const saturation = baseSaturation * (1 + waveIntensity * params.effectAmount);

// Rainbow Canvas
const alpha = baseAlpha * params.effectAmount;
```

---

## 🔄 ROTATION SYNC SYSTEM

### **Three Modes**

#### **1. Free Mode (Default)**
```typescript
angle += params.rotation * dt; // User controls speed directly
```

#### **2. BPM Mode**
```typescript
// Continuous rotation synced to BPM
const bpm = params.bpm || 174;
const bars = params.bars || 8;
const rotationSpeed = (Math.PI * 2) / ((60/bpm) * 4 * bars * 2 * 1000);
angle += rotationSpeed * (dt * 1000);
```

#### **3. Quantized Mode**
```typescript
// Discrete "tutting" snaps every 4th beat
if (beatCounter >= 4) {
  targetAngle += rotationAmount; // 45°, 90°, or 180°
}
// Frame-rate independent interpolation
currentAngle += (targetAngle - currentAngle) * Math.min(1.0, dt * 12.0);
```

---

## 🎨 VISUALIZATION MODES

| Mode | Description | Primary Tech |
|------|-------------|--------------|
| **0: Electric Chaos** | Radial spike ring + glow effects | WebGL + Canvas2D |
| **1: Particle Storm** | Energy-reactive particle bursts | Canvas2D |
| **2: Heatmap Bars** | Vertical frequency bars with bloom | Canvas2D |
| **3: Waveform Trails** | Flowing waveform with motion blur | Canvas2D |

**Spike ring 4-fold frequency mirroring** (`mirroredFourLobeNorm` in `spikeSignalChain.ts`) is intentional — it produces the deliberate 4-quadrant symmetrical look. This is a design choice, not a bug, and should not be "simplified" to 2-fold.

---

## 🎛️ MACRO SYSTEM

ORBITAL ships with **8 macro knobs** (`macro1` through `macro8`, defined in `config/macroDefinitions.ts`), each mapping a single physical control to multiple underlying parameters at once:

```typescript
const macroMappings = {
  macro1: [ /* Motion FX — bloom, gamma, trail, etc. */ ],
  macro2: [ /* Rotation & Center Motion */ ],
  macro3: [ /* Zoom Oscillation */ ],
  macro4: [ /* Glow & Sparks */ ],
  // ...through macro8 (Center Hue Auto / Glow)
  macro7: [ /* Core Textures shader opacity, intensity, speed, density, glow */ ],
};
```

**Usage:**
- A single knob controls multiple related parameters
- Prevents overwhelming users with 60+ individual sliders
- Professional workflow (like audio mixing)

**Performance note:** macro knob drag handling is deferred via a ref + `requestAnimationFrame` batching pattern — the underlying parameter values update immediately (so visuals stay responsive), but the React state commit and the DOM display-sync work (slider value labels, `.control` highlighting, Core Textures engine sync) are batched to at most once per animation frame, regardless of how many raw pointer-move events fire during a drag.

---

## 📦 PRESET SYSTEM

### **Structure**

```typescript
interface Preset {
  name: string;
  params: {
    [key: string]: number | boolean | string;
  };
}
```

### **Preset Management**

- **Built-in Presets:** 20 curated presets (`data/presets.ts`)
- **Custom Presets:** User-created (saved to localStorage)
- **Import/Export:** JSON format for sharing
- **Favorites:** Star presets for quick access
- **Auto-cycle:** Optional automatic palette/preset cycling with adjustable speed

---

## 🚀 WEBGL SPIKE RING ARCHITECTURE

### **Shader Pipeline**

```glsl
// VERTEX SHADER
attribute float a_index;       // Spike index (0-N)
attribute float a_amplitude;   // Audio amplitude
attribute float a_isEnd;       // 0=base, 1=tip
attribute float a_side;        // -1=left, +1=right

uniform float u_angle;         // Current rotation
uniform vec2 u_center;         // Canvas center
uniform float u_innerRadius;   // Ring inner radius

void main() {
  // Calculate spike position in polar coordinates
  float angle = u_angle + (a_index / u_count) * TAU;
  float radius = u_innerRadius + a_amplitude * a_isEnd * 200.0;
  
  // Apply thickness
  float thickness = a_side * 3.0;
  
  // Convert to screen coordinates
  vec2 pos = u_center + vec2(
    cos(angle) * radius + sin(angle) * thickness,
    sin(angle) * radius - cos(angle) * thickness
  );
  
  gl_Position = vec4((pos / u_resolution) * 2.0 - 1.0, 0.0, 1.0);
}
```

```glsl
// FRAGMENT SHADER
uniform vec3 u_color;          // Base color (HSL)
uniform float u_lightness;     // Brightness
uniform float u_colorWaveTime; // Color Wave rotation

void main() {
  // Color Wave effect (optional)
  float hueShift = sin(vAngle + u_colorWaveTime) * u_colorWaveAmount * 60.0;
  vec3 color = hslToRgb(u_color.x + hueShift, u_color.y, u_color.z);
  
  gl_FragColor = vec4(color * u_lightness, 1.0);
}
```

### **Static Geometry Buffers**

`utils/spikeGeometry.ts` provides pre-computed index/isEnd/side/jitter attribute buffers — geometry that doesn't depend on amplitude or frequency mapping, and so only needs to be built once rather than every frame.

### **Liquid Shaper Texture Caching**

The Liquid Shaper engine (`utils/astralShaper.ts` + `engine/WebGLAstralRenderer.ts`) caches each shape's geometry as a texture keyed on shape/complexity/style — **deliberately excluding rotation** from the cache key, since rotation is applied separately as a shader/transform parameter at draw time rather than baked into the cached bitmap. This is what allows smooth continuous rotation without re-rendering the underlying sacred-geometry shape every frame.

---

## 🎯 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                    AUDIO INPUT                          │
│  (Microphone / File / Demo) → AudioContext              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├──→ analyser (FFT 128-2048) ────→ SPIKE RING (frequency-based)
                 │                              ────→ DOTS amplitude
                 │                              ────→ HALO size
                 │
                 └──→ energyAnalyser (FFT 2048) ───→ BEAT DETECTION (bass energy)
                                                  ───→ BPM ESTIMATION
                                                  
┌─────────────────────────────────────────────────────────┐
│                 TIME-BASED SYSTEMS                       │
│  performance.now() → currentTime                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├──→ colorWavePhase ─────→ COLOR WAVE (hue modulation)
                 ├──→ satBurstPhase ──────→ SATURATION BURST (breathing)
                 ├──→ BPM clock ──────────→ COLOR CYCLING (palette changes)
                 └──→ Rotation sync ───────→ SPIKE RING ROTATION

┌─────────────────────────────────────────────────────────┐
│                  EVENT-BASED SYSTEMS                     │
│  Beat Detection → isBeat flag                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├──→ satBurstTrigger ─────→ SATURATION BURST (trigger)
                 ├──→ beatCounter ─────────→ ROTATION SYNC (quantized)
                 └──→ beatColorShift ──────→ HUE SHIFT (mid-freq reactive)
```

---

## 📊 PERFORMANCE METRICS

### **Target Performance**

| Metric | Target | Achieved |
|--------|--------|----------|
| **FPS** | 60 sustained | ✅ 58-60 |
| **Frame Time** | < 16.67ms | ✅ 12-14ms |
| **GC Pauses** | < 1/min | ✅ Rare |
| **Memory** | Stable | ✅ Flat |

### **Bottleneck Analysis**

| System | CPU Cost | GPU Cost | Notes |
|--------|----------|----------|-------|
| **WebGL Spikes** | Low (~1ms) | Medium | GPU-accelerated |
| **Canvas2D Strokes** | Medium (~3ms) | None | CPU-bound, fallback-only path |
| **Dots (up to 120x)** | Low-Medium | None | `ctx.arc()` calls, density-capped |
| **Motion Blur** | Low (~0.5ms) | None | Alpha compositing |
| **Effects** | Low (~1ms) | None | Filter stacking |

---

## 🔧 DEVELOPMENT WORKFLOW

### **File Structure**

```
src/app/
├── App.tsx                       # Main visualizer component & render loop
├── components/
│   ├── IntroTutorial.tsx        # First-time user guide
│   ├── LandingPage.tsx          # Landing screen
│   ├── LoadingPage.tsx          # Loading screen
│   ├── ControlPanel.tsx         # Main settings panel host
│   ├── MacrosSection.tsx        # Macro knob controls
│   ├── settings/                # Individual settings sections
│   └── ui/                      # Shared/shadcn-derived UI primitives
├── engine/
│   ├── WebGLAstralRenderer.ts   # Liquid Shaper GPU renderer
│   ├── AstralMorphEngine.ts     # Shape morphing logic
│   ├── MidiController.ts        # MIDI input handling
│   └── RecordingEngine.ts       # WebM/GIF recording
├── utils/
│   ├── astralShaper.ts          # Liquid Shaper shape generation & caching
│   ├── presetActions.ts         # Preset/palette/macro logic (extracted from App.tsx)
│   ├── spikeGeometry.ts         # Static spike-ring geometry buffers
│   ├── spikeSignalChain.ts      # Live frequency-to-spike mapping
│   ├── audioProcessing.ts       # Beat detection, BPM estimation
│   ├── motionBlur.ts            # Motion blur engine
│   └── webglShaders.ts          # WebGL shader source
├── config/
│   └── macroDefinitions.ts      # The 8 macro-to-parameter mappings
└── data/
    ├── presets.ts                # The 20 built-in presets
    └── colorPalettes.ts          # The 40 built-in color palettes
```

### **Adding a New Feature**

1. **Define parameter** in `defaultParams`
2. **Create UI binding** with `bind()` helper
3. **Implement rendering** in render loop
4. **Add to presets** (if applicable)
5. **Update documentation**

---

## 🐛 DEBUGGING TIPS

### **Performance Issues**

```typescript
// Enable Performance HUD in Session Settings
// Shows FPS, CPU%, Memory, Resolution

// Check for allocations in Chrome DevTools:
// 1. Open Performance tab
// 2. Record for 10-20 seconds of idle playback
// 3. Look for GC spikes and long tasks
// 4. If recording inside an embedded/iframe environment (e.g. a
//    Figma Make preview), check which script each long task actually
//    belongs to before assuming it's app code — platform/host overhead
//    can dominate a recording without it being obvious from the flame
//    chart shape alone.
```

### **Audio Issues**

```typescript
// Check audio routing:
console.log('AudioContext state:', AC.state); // Should be 'running'
console.log('Source connected:', !!sourceNode);
console.log('Analyser connected:', !!analyser);

// Verify audio data:
analyser.getByteFrequencyData(freqArr);
console.log('Max frequency:', Math.max(...Array.from(freqArr)));
```

### **WebGL Issues**

```typescript
// Check WebGL context:
console.log('WebGL support:', !!gl);
console.log('Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));

// Verify shader compilation:
console.log('Vertex shader compiled:', gl.getShaderParameter(vs, gl.COMPILE_STATUS));
console.log('Fragment shader compiled:', gl.getShaderParameter(fs, gl.COMPILE_STATUS));
```

---

## BPM CLOCK + TAP TEMPO

- `runtime/bpm/BpmClockRuntime.ts` is the single authority for automatic and manual BPM.
- Four taps commit tempo; later taps refine a rolling window while rejecting large interval outliers.
- The clock owns no React state, DOM access, timer, interval, or RAF.
- `RuntimeFrameScheduler` publishes the resolved four-beat clock through `MainThreadUIRefreshBus` at 30 Hz.
- `TapTempoControl.tsx` only re-renders when beat index, BPM, mode, or tap progress changes.
- Worker protocol v2 carries `bpmMode`, `bpmRevision`, `beatIndex`, `beatPhase`, `barPhase`, and `downbeat`. Tap timestamps remain main-thread-only.

---

## 🚀 FUTURE ROADMAP

### **Phase 3: Advanced Features** (Post-Beta)

- [ ] WebGL 2.0 upgrade where not already adopted (compute shaders, instancing)
- [ ] GPU particle system (move dots to GPU)
- [ ] Preset morphing (crossfade between presets)
- [ ] VR/AR visualization mode
- [ ] Custom shader editor

### **Phase 4: Platform Expansion**

- [ ] Electron desktop app
- [ ] Mobile web support (touch controls)
- [ ] Twitch/OBS integration
- [ ] Hardware audio input (external mixers)

*Note: MIDI controller support has already shipped (`engine/MidiController.ts`) and is no longer a roadmap item.*

---

## 📚 ADDITIONAL RESOURCES

- **User Guide:** `/src/app/QUICK_START.md`
- **Recording Guide:** `/src/app/RECORDING_GUIDE.md`
- **Video Export:** `/src/app/VIDEO_FORMAT_GUIDE.md`
- **Deployment:** `/src/app/DEPLOYMENT.md`
- **Contributing:** `/src/app/CONTRIBUTING.md`
- **Changelog:** `/src/app/CHANGELOG.md`

---

*Last Updated: July 12, 2026 - Pre-worker certification with Tap Tempo and BPM clock protocol v2*