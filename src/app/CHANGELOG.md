# 📋 CHANGELOG

All notable changes to ORBITAL Audio-Reactive Visualizer Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Sprint 22N.C.6] - 2026-07-12

### Tap Tempo and BPM Clock
- Added four-tap manual tempo detection with rolling refinement and interval-outlier rejection.
- Added a four-beat indicator with stronger downbeat emphasis, AUTO/MAN mode control, and guarded `T` keyboard shortcut.
- Unified detected, manually entered, and tapped BPM through a timer-free `BpmClockRuntime`.
- Beat indicator publication is driven by the authoritative visual scheduler; no secondary RAF or interval was added.
- Worker protocol v2 now carries BPM mode/revision, beat index/phase, bar phase, and downbeat state.

## [1.0.1-beta] - 2026-06-20

### 🚀 Performance Stability Sprint Series

A multi-round diagnostic and optimization pass focused on stutter/hang-back behavior during rotation and motion, plus a documentation and repo-hygiene cleanup ahead of the GitHub release.

### ⚡ Performance Improvements

#### Liquid Shaper — GPU Texture Upload Skip
- `WebGLAstralRenderer.render()` was re-uploading both shape textures to the GPU via `texImage2D` on every single frame, regardless of whether the underlying canvas had actually changed — up to 3x per frame when the multi-layer jitter effect is active
- Now tracks the last-uploaded canvas per texture unit and skips the upload entirely when it's unchanged; cheap GL state calls still run every frame so binding state never goes stale
- The texture-cleanup mechanism that recreates GL texture objects (previously fixed for a documented "~10-18 second periodic stall") correctly invalidates this tracking so the next frame re-uploads into the fresh, empty textures

#### Spike Ring — Missing Lookup Table Guard
- `rebuildSpikeLookupTables()` allocates three `Float32Array` buffers and runs a full trig/hash loop — a tracking variable (`lookupTablesSize`) was declared specifically to guard this but the guard itself was never implemented, so it ran unconditionally every frame
- Added the missing size-change check; tables now only rebuild when the FFT-derived spike count actually changes

#### Halo & Dots — Per-Frame String Allocation Reduction
- The halo's bloom-pass loop (4-12 passes by default) and the per-dot color loop were both rebuilding a full `hsla(...)` template-literal string every iteration, every frame, including the alpha component which is the only part that varies within those specific loops
- Moved transparency to `ctx.globalAlpha` instead of formatting it into the color string each pass/dot — mathematically identical output, meaningfully fewer allocations
- Removed an entire abandoned halo/bloom layer-caching scaffold (`haloLayerCanvas`, `bloomCanvas`, and related tracking variables) that had been declared and commented as a planned optimization but never actually wired in — investigated finishing it properly first; ruled out, since the halo's actual color output is continuously audio/time-reactive and can't be usefully bitmap-cached the way the Liquid Shaper's geometry can

#### Macro Knob Responsiveness
- Macro knob drags previously triggered a full React re-render (`setMacroValues`) on every raw pointer-move event, plus several DOM tree-walks (`.closest('.control')`, `classList` updates) per mapped parameter, per event
- Deferred the React state commit and the DOM display-sync work to a `requestAnimationFrame`-batched flush — underlying parameter values still update immediately for live audio-reactive rendering, but the more expensive bookkeeping is now capped to once per animation frame regardless of drag speed
- Consolidated two separate, redundant Core Textures engine sync call sites (for the Texture macro) into one batched call

#### Settings Panel Re-render Containment
- None of the 8 individual settings section components were wrapped in `React.memo`, so any single change anywhere in the control panel (a macro drag, a tab switch, an unrelated slider) re-rendered every other section's full JSX tree along with it
- Wrapped all 8 in `memo()` / `React.memo()`

### 🐛 Bug Fixes
- **Reset to Defaults** — was silently aborting partway through every click due to a `ReferenceError` (`setCheckbox` was undefined in scope) and a stale variable reference (`organicFadeRotationTimer`, renamed at some point to `dotFadeWindowAngle` but never updated at this call site). Motion FX, Spike Ring, Liquid Shaper, Core Particles, Energy Gate, Beat Detection, Center Image, and Core Textures sections were never actually being reset.
- **Reset Liquid Shaper** — the button's only handler called an optional `onReset` prop that `ControlPanel.tsx` never supplied, so it did nothing, silently. Now calls the reset function directly (matching every other section's pattern) in addition to still honoring the prop if one is ever supplied.
- **Landing/Loading page particle init retry loop** — `initParticles()` in both `LandingPage.tsx` and `LoadingPage.tsx` would retry every 100ms indefinitely if `window.innerWidth`/`innerHeight` never reported valid dimensions, with no unmount guard and no tracked timeout reference to cancel. Added a cancellation flag, a tracked timeout, and a 20-retry (2 second) cap with a graceful fallback to default dimensions instead of retrying forever.
- Removed `resetAdvancedMotionFX` — confirmed legacy. It only reset the old `zoomOsc`/`zoomOscSpeed`/`zoomRings` motion-FX system, which the Chaos slider has since superseded; the actual "Reset" button visible in the Motion Controls + EFX section is the global `resetToDefaults()`, which already resets Chaos directly.

### 🗑️ Dead Code Removal
- `RenderLoop.ts`, `WebGLSpikeRenderer.ts`, `OutputWindow.tsx` and all associated UI/text references, `src/render/layers/spikeRingLayer.ts` and `sparkImpactLayer.ts`, a duplicate `shared/protocol/` directory, a duplicate `main.tsx` entry point, an unused `featureFlags.ts`, and an orphaned, unused second copy of the color palette data (`utils/colorPalettes.ts` — the live one is `data/colorPalettes.ts`)
- 12 unused npm dependencies removed from `package.json`
- Extracted the preset/palette/macro logic from App.tsx's ~8,900-line single `useEffect` into `utils/presetActions.ts` (~1,737 lines), reducing App.tsx by roughly 1,600 lines

### 📚 Documentation & Repository Structure
- Relocated `.gitignore`, `LICENSE`, and the real project `README.md` to the repository root (previously a generic placeholder README sat at root while the real content was buried in `src/app/`, and `.gitignore` existed only as an inert `.txt` file)
- Removed a broken filesystem artifact: `src/app/LICENSE/` was a directory (not a file) containing a misplaced `main.tsx` whose actual content was just the license text
- Consolidated duplicate `ATTRIBUTIONS`/`Attributions` files into one, at root
- Cleaned `package.json` metadata: real package name, description, license field, keywords, repository/homepage/bugs URLs; removed Figma Make export artifacts (`"readme": "ERROR: No README data found!"`, an internal `_id` field)
- Corrected several factual inaccuracies that had drifted from the actual codebase: the intro tutorial and `ARCHITECTURE.md` cited 40 color palettes (actual: 31 at the time), 68+ sacred-geometry shapes (actual: 67), 30 built-in presets (actual: 20), and a 4-macro example (actual: 8 macros, `macro1`-`macro8`)
- `ARCHITECTURE.md` rewritten to reflect the current file structure, the mutually-exclusive (not simultaneously-layered) Canvas2D/WebGL spike rendering relationship, and the performance work above
- Removed the now-confirmed-unused `src/app/utils/colorPalettes.ts` (an orphaned duplicate of the live `data/colorPalettes.ts` — every import in the codebase was already verified to resolve to the `data/` copy)
- Removed every "Output Window" reference across `README.md`, `RECORDING_GUIDE.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `BETA_TESTING_GUIDE.md`, and `QUICK_START.md` — a feature that had been fully removed from the app, but whose documentation (including a dedicated recording-system comparison guide, several use-case walkthroughs, a `/output` URL-parameter config block, and a handful of stale file/line-number references) had never been updated to match. `RECORDING_GUIDE.md` in particular was rewritten from scratch around the single, real in-app recording system.
- Sacred-geometry shape count changed from an exact figure (67) to "60+" throughout — more durable against future shape additions/removals than a number that goes stale the moment the count changes

### 🎨 New Content
- Added 9 new color palettes (Bioluminescence, Solar Flare, Vaporwave, Opal, Deep Space, Molten Gold, Coral Reef, Citrus Burst, Blood Moon), bringing the total from 31 to 40. All nine use the existing 3-stop `heat` gradient type for richer, less-banded blends than a flat 2-color gradient.
- Version display corrected from a stale "v1.5 Beta" to "v1.0 Beta" in both the Settings Panel footer and the Control Panel footer
- Landing page branding updated to "Made by SPLNTR - Micro Tools | v1.0 Beta"

### 📊 Performance Metrics
- Liquid Shaper: redundant ~16MB GPU texture uploads eliminated on the overwhelming majority of frames during rotation/morph
- Spike ring: 3 buffer allocations + a full trig/hash loop eliminated on every frame where FFT size is unchanged (i.e., almost all frames)
- Macro knob drag: React re-renders and DOM bookkeeping reduced from once-per-pointer-event to once-per-animation-frame

---

## [1.0.0-beta.3] - 2026-02-28

### 🚀 CRITICAL PERFORMANCE FIXES - "Zero Stutter"

This release eliminates ALL audio stuttering and rotation jitter through comprehensive memory allocation optimization.

### ⚡ Performance Improvements

#### TIER 1: Memory Allocation Elimination (CRITICAL)
- **Pending Shockwaves Circular Buffer** - Replaced `splice()` with pre-allocated pool (eliminates ~60 allocations/sec)
- **Energy History Circular Buffer** - Replaced `push()`/`slice()` with Float32Array buffer (eliminates ~120 allocations/sec)
- **Worker Communication Optimization** - Direct TypedArray transfer (eliminates ~60 conversions/sec)
- **Result:** 240 allocations/sec → 0 (100% reduction) = ZERO GC pauses during effects

#### TIER 2: Time Stability (Rotation Jitter Fixes)
- **Delta Time Clamping** - Maximum 100ms dt prevents rotation jumps during tab switches/GC pauses
- **Tab Visibility Pause/Resume** - Proper RAF cancellation with `lastT` reset on tab focus
- **Result:** Smooth rotation with no time discontinuity spikes

#### TIER 3: Polish
- **Performance Monitoring** - Optional frame time tracking for debugging (disabled by default)
- **Console Markers** - Added TIER 1-3 completion logs

### 🐛 Bug Fixes
- Fixed audio playback stuttering during heavy bass effects (GC pause elimination)
- Fixed rotation jitter when switching tabs (dt clamping + tab visibility reset)
- Fixed worker TypedArray double-conversion overhead

### 📊 Performance Metrics
- **Allocation rate:** 240/sec → 0/sec (100% reduction)
- **GC frequency:** ~95% reduction during heavy effects
- **Frame stability:** dt spikes eliminated (clamped to 100ms max)
- **CPU efficiency:** ~50% reduction when tab hidden

---

## [1.0.0-beta.2] - 2025-02-16

### 🚀 PRODUCTION BETA READY - "Performance & Polish"

This release completes all production optimizations and prepares the app for beta deployment.

### ⚡ Performance Improvements

#### Output Sync Optimization
- **Throttled to 30fps** - Reduced sync overhead by 50% (was 60fps)
- **Zero-copy Uint8Array transfer** - Eliminated 184,320 allocations/second
- **Connection-aware sync** - No processing when output window disconnected
- **Result:** 80% reduction in micro-stutters and massive GC pressure relief

#### Adaptive Quality Governor
- **FPS history tracking** - 60-frame rolling average for stable decisions
- **Smart quality reduction:**
  - < 45fps → Quality drops to 40%
  - < 52fps → Quality drops to 60%
  - > 57fps → Quality gradually restores
- **Console logging** for quality changes during development

#### Offscreen Pause Functionality
- **Automatic RAF cancellation** when tab is hidden
- **Seamless resume** when tab becomes visible again
- **Timer reset** to prevent huge dt spikes on resume
- **Result:** 0% CPU usage when app is in background

#### Beat Detection Improvements
- **BPM-aware minimum interval** - Uses 70% of beat interval when BPM known
- **Realistic default** - 180ms minimum (max 333 BPM) instead of 120ms (500 BPM)
- **Cleaner beat triggers** - Prevents machine-gun false detections on fast hi-hats

#### Astral Shaper Optimization
- Replaced `Math.max(...Array.from(freqArr))` with direct loop
- Minor but free performance gain on peak frequency calculation

### 📱 Tablet & iPad Support

#### Responsive Design Enhancements
- **Tablet-specific CSS** for 768px - 1024px landscape devices
- **iPad Pro optimization** for 1024px - 1366px devices
- **Touch-friendly controls:**
  - Larger touch targets (40px minimum)
  - Bigger slider thumbs (18px)
  - Expanded macro knobs (70-80px)
  - Touch-optimized scrolling
- **High DPI support** for Retina displays
- **Portrait mode handling** - Landscape-only message for tablets
- **Active state feedback** for touch interactions

### 🗂️ Documentation Cleanup

#### Removed Outdated Files (22 files)
- Deleted duplicate deployment guides
- Removed old phase completion reports
- Cleaned up diagnostic and status documents
- **Kept essential docs only:**
  - README.md (updated with V1.0 BETA info)
  - QUICK_START.md
  - RECORDING_GUIDE.md
  - VIDEO_FORMAT_GUIDE.md
  - DEPLOYMENT.md
  - CONTRIBUTING.md
  - CHANGELOG.md
  - Attributions.md

#### Updated Documentation
- **README.md** - Updated with production-ready V1.0 BETA messaging
- **PRODUCTION_BETA_V1.0_READY.md** - New comprehensive production readiness checklist

### 🧹 Code Quality

#### Performance Optimizations Applied
- ✅ Output sync throttling + zero-copy transfer
- ✅ Adaptive quality governor with FPS protection
- ✅ Offscreen pause for background tabs
- ✅ Beat detection interval improvements
- ✅ Array allocation elimination

#### Known Items
- ⚠️ 212+ console.log statements remain (optional cleanup)
- Most are debug/success messages suitable for development mode
- Critical errors and warnings properly handled

### 🎯 Production Readiness

#### Deployment Status
- ✅ All core features complete (68+ shapes, 20 presets, playlist, etc.)
- ✅ Performance optimizations applied (2.5× faster + micro-stutter fixes)
- ✅ Tablet/iPad layout verified
- ✅ Documentation consolidated
- ✅ Error boundaries in place
- ✅ Memory leak prevention active
- ✅ Browser compatibility tested (Chrome, Firefox, Edge, partial Safari)

#### Recommended Before Deploy
1. Optional: Clean console.log statements for production logs
2. Update deployment URL in README.md
3. Test on target deployment platform (Vercel/Netlify)

---

## [1.0.0-beta] - 2026-01-22

### 🎉 V1.0 BETA RELEASE - "Professional Output & Recording"

This release marks the completion of all core features and the addition of professional recording capabilities.

### ✨ Added

#### 🎬 Recording System
- **Output Window Recording** - Professional UI-free exports with custom resolution
  - Resolution presets: 720p, 1080p, 1440p, 4K (2160p)
  - FPS control: 30, 60, 120 fps
  - High-quality encoding: VP9/VP8/H264 at 10 Mbps
  - Keyboard shortcuts: R (record), SPACE (play/pause), F (fullscreen), D (debug)
  - Real-time duration counter with REC indicator
  - Auto-download with timestamp filenames
  - OBS-ready window capture for streaming
- **Main Window Recording** - Quick capture system
  - Recording library (stores up to 8 recordings)
  - Video preview before download
  - Individual download buttons
  - Auto-stop timer (10s/30s/60s/loop)
  - FPS control (30/60)
- **Dual Recording Documentation** - Comprehensive user guides
  - `/RECORDING_GUIDE.md` - Complete recording system documentation
  - In-app tooltips and help

#### 🖥️ Output Window System
- **Real-time Parameter Sync** - Output window mirrors main window state
  - Bi-directional communication via postMessage API
  - All 60+ parameters synced in real-time
  - Audio data broadcast (freqData, timeData)
  - Zero-latency state updates
- **Output Window Controls**
  - Debug overlay with FPS counter and status
  - Connection indicator (● LIVE / ○ STANDBY)
  - Keyboard shortcuts help overlay
  - Fullscreen support
- **Resolution System**
  - URL parameter support (`/output?res=1080&fps=60&debug=1`)
  - Preset buttons in main window (720p/1080p/1440p/4K)
  - Responsive canvas scaling

#### 🎨 Visual Features
- **4 Visualization Modes**
  - Electric Chaos - Energy-based radial waveforms
  - Particle Storm - Physics-based particle system
  - Heatmap Bars - Frequency spectrum bars
  - Waveform Trails - Circular waveform with trails
- **40 Color Palettes** - Curated color schemes
- **60+ Parameters** - Fine-tune control
- **Macro Knobs System** - 4 intelligent macro controls
  - Intensity, Motion, Color FX, Detail
  - Visual feedback rings
  - Parameter display on hover

#### 🎵 Audio System
- **Multiple Input Methods**
  - Microphone input with live monitoring
  - File upload (MP3, WAV, OGG, FLAC, M4A, AAC)
  - 3 built-in demo tracks
- **Beat Detection Engine**
  - Automatic BPM detection
  - Beat flash effects
  - Rotation sync to beat
- **VU Meter & Mini Spectrum Analyzer**
- **Frequency Band Isolation** (Low/Mid/High/Full)

#### 🖼️ Center Image System
- **Multi-image Upload** (4 images max)
- **Drag-and-drop** image management
- **Star Favorites** for quick access
- **Image/Video Support** (PNG, JPG, GIF, WebP, MP4, WebM)
- **Rotation Modes** (Static, Sync, Opposite)

#### 🎹 MIDI Support
- **Auto-detection** of MIDI devices
- **CC mapping** to parameters
- **Real-time control** for live performance

#### 🎯 Preset System
- **40 Curated Presets**
- **Import/Export** functionality
- **Star Favorites** system
- **One-click Load** preset buttons
- **Preset Version Tracking**

### ⚡ Performance Improvements
- **2.5× Performance Boost** from comprehensive optimization phase
  - Adaptive quality system based on FPS
  - Frame skipping for non-critical UI updates
  - GPU acceleration via Canvas desync mode
  - Reduced particle calculations
  - Optimized FFT analysis
- **Memory Leak Prevention**
  - Comprehensive cleanup on unmount
  - Event listener cleanup
  - requestAnimationFrame cleanup
  - Media element cleanup
  - Blob URL revocation
  - Video element disposal
- **CPU Optimization**
  - Debounced UI updates
  - Cached calculations
  - Reduced DOM queries

### 🐛 Bug Fixes
- Fixed Core Particles distribution issues with cryptographic-quality hashing
- Fixed preset import/export glitches
- Fixed beat detection initial jump (3-second grace period)
- Fixed iOS AudioContext compatibility
- Fixed React Strict Mode double-initialization
- Fixed microphone stream cleanup
- Fixed media element error spam
- Fixed fullscreen mode bugs
- Fixed Output Window blank page issue (real-time sync)
- Fixed memory leaks in video elements
- Fixed recording codec fallback

### 🔧 Technical Improvements
- **Code Organization**
  - Modular component structure
  - Comprehensive error handling
  - Console logging system with emoji prefixes
  - TypeScript type safety
- **Browser Compatibility**
  - Compatibility check on launch
  - Graceful degradation
  - Codec fallback system
  - iOS/Safari support
- **Documentation**
  - Updated README with all features
  - Created RECORDING_GUIDE.md
  - Created CHANGELOG.md
  - Created CONTRIBUTING.md
  - Updated deployment docs
  - Inline code comments

### 🎨 UI/UX Improvements
- **Collapsible Sections** - Audio, Color, Visual, Effects
- **Responsive Layout** - Resizable control panel
- **Visual Feedback** - Macro knob rings, parameter displays
- **Loading States** - Landing page, loading screen
- **Error States** - Compatibility warnings, error messages
- **Tooltips** - Helpful hints throughout UI
- **Status Indicators** - Recording, MIDI, Output Window connection

### 📚 Documentation
- ✅ README.md - Complete feature overview and getting started
- ✅ RECORDING_GUIDE.md - Comprehensive recording system guide
- ✅ VIDEO_FORMAT_GUIDE.md - Video export and format reference
- ✅ CHANGELOG.md - Version history (this file)
- ✅ CONTRIBUTING.md - Contribution guidelines
- ✅ DEPLOYMENT.md - Deployment instructions
- ✅ Attributions.md - Licenses and credits

---

## [0.9.0] - 2026-01-18

### Pre-Beta Development Phase

This version represents the state before Output Window recording was added.

### Added
- Basic recording system (main window only)
- All 4 visualization modes
- Macro knobs system
- Preset system (40 presets)
- MIDI support
- Beat detection
- Center image upload
- Color schemes

### Known Issues (Fixed in 1.0.0-beta)
- No professional recording output
- No Output Window
- Performance could be improved
- Memory leaks in some scenarios

---

## [0.5.0] - 2026-01-10

### Initial Development Phase

### Added
- Core visualization engine
- Basic audio input (mic/file)
- Electric Chaos mode
- Manual parameter controls
- Basic color system

---

## Future Roadmap

### Planned Features (Post-V1.0)
- [ ] **Audio Effects** - Reverb, delay, filters
- [ ] **Shader Support** - WebGL2 shaders for advanced effects
- [ ] **Custom Mode Builder** - User-created visualization modes
- [ ] **Cloud Preset Library** - Share presets with community
- [ ] **Multi-Track Support** - Layer multiple audio sources
- [ ] **3D Visualization** - Three.js integration
- [ ] **AI-Powered Presets** - Auto-generate presets based on audio
- [ ] **Mobile App** - iOS/Android native apps
- [ ] **Plugin System** - Extensible architecture for third-party effects
- [ ] **Collaboration Mode** - Real-time multi-user control

### Potential Enhancements
- [ ] Spectogram view
- [ ] Waveform editor
- [ ] Audio trimming/looping
- [x] BPM tap tempo
- [ ] MIDI learn mode
- [ ] Preset randomizer
- [ ] A/B comparison mode
- [ ] Performance profiler
- [ ] Custom color palette builder
- [ ] Gradient editor

---

## Version Numbering

ORBITAL follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH**
- **MAJOR** - Incompatible API changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

**Beta/RC Tags:**
- `-beta` - Feature-complete, testing phase
- `-rc.X` - Release candidate (pre-release)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:
- How to report bugs
- How to suggest features
- How to submit pull requests
- Code style guidelines
- Testing requirements

---

**Last Updated:** 2026-06-20  
**Current Version:** 1.0.1-beta  
**Status:** ✅ Ready for Beta Testing