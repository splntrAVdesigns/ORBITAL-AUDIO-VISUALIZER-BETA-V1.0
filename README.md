# 🎵 ORBITAL Audio-Reactive Visualizer Engine — V1.0 BETA

**Production-Ready | Performance Optimized | Professional Audio Visualization**

![ORBITAL Audio Visualizer](https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop)

> **V1.0 BETA** — Full-featured audio-reactive visualizer with a 60+ pattern sacred-geometry Liquid Shaper, 25+ curated presets, 40+ color palettes, a playlist system, versioned onboarding, mobile blocking, MIDI support, and browser-based recording up to 4K.

---

## 🌟 Overview

ORBITAL is an audio visualizer engine that transforms sound into real-time radial visuals. Built with React, Canvas API, WebGL, and the Web Audio API, it combines **4 visualization modes**, a **WebGL-accelerated Liquid Shaper** with 60+ sacred-geometry patterns, **60+ tunable parameters**, **beat detection**, a **playlist system**, **MIDI support**, **in-app recording**, and a **Session Resilience** layer that recovers from a lost WebGL context without reloading the page or interrupting audio.

**Perfect for:**
- 🎭 VJs and live performances
- 🎧 Music producers and DJs
- 📹 Content creators and streamers
- 🎨 Audio-visual artists
- 🌐 Web developers learning WebAudio API
- 🎬 Professional video production

---

## ✨ Key Features

### 🎨 **4 Visualization Modes**
- **Electric Chaos** — Dynamic energy-based radial waveforms with reactive spikes
- **Particle Storm** — Physics-based particle system with audio reactivity
- **Heatmap Bars** — Frequency spectrum with gradient heat mapping
- **Waveform Trails** — Smooth circular waveform with motion blur trails

### 🌀 **Liquid Shaper**
WebGL-accelerated sacred-geometry morphing engine — 60+ patterns (Flower of Life, Sri Yantra, Metatron's Cube, Vesica Piscis, and more), including a curated 20-shape auto-cycle. Continuous noise-based rotation and field modulation, with automated texture cleanup for long-running sessions.

### 🖼️ **Core Textures**
A second, independent GPU shader layer — Digital Matrix, Liquid Gradient, and Geometric Pattern presets — with lazy shader compilation (compiles only when selected) and beat-quantized parameter changes for smooth transitions.

### ✨ **Beat Reactive FX**
Six beat-pulse styles layered on top of the main visualization: Flash, Color, Rainbow, Dark Strobe, and **Star Field Tunnel** (a full-canvas warp-speed starfield with bass-driven speed, mid-driven turbulence, and beat-synced glitter). Iridize adds a metallic/pearlescent shimmer with smooth, seamless hue banding around the ring.

### 🎛️ **Real-Time Control System**
- **8 Macro Knobs** with intelligent parameter mapping (Intensity, Motion, Color FX, Detail) and live feedback rings
- **60+ Fine-Tune Parameters**, including amplitude, rotation speed, thickness, smoothing, particle count/size/velocity/gravity, motion FX (turbulence, displacement, grain, bloom), and color (hue shift, saturation, brightness, speed)
- **Frequency Band Isolation** (Low/Mid/High/Full)
- **25+ Preset System** with favorites, import/export
- **Display Resolution Modes** — Performance, Balanced (default), Large Display, and Ultra — control internal canvas DPR/backing resolution independently of the visual layout
- **Collapsible UI** for distraction-free creation

### 🎵 **Audio Input & Processing**
- **Multiple Input Methods:**
  - 🎤 Microphone input with live monitoring
  - 📁 Audio file upload (MP3, WAV, AIFF, M4A, OGG, FLAC)
  - 🎼 Built-in demo tracks
- **Beat Detection Engine:**
  - Automatic BPM detection and display, with manual tap-tempo
  - Beat accent with visual flash effects
  - Rotation sync to beat (1/4, 1/8, 1/16)
- **FFT Analysis:** 512 to 32768 bins
- **VU Meter & Mini Spectrum Analyzer**

### 🎬 **Recording & Export System**
- **In-App Recording** — Capture directly from the main window, no separate window needed
- **Recording Options:**
  - Resolution presets: 720p, 1080p, 1440p, 4K (2160p)
  - FPS control: 30, 60, 120 fps
  - Duration: 15s, 30s, 60s, or manual loop/stop
  - Codec choice: WebM (VP9, recommended), WebM (VP8), H.264
  - Quality/bitrate presets: 2–20 Mbps
  - Quick presets (e.g. "Quick Clip" for fast, small files)
  - Keyboard shortcut: `R` to start/stop
- **Recording Library** — Store up to 8 recordings, with preview, delete, and download
- **GIF Export** — Screenshot capture and animated GIF export, loaded on demand so it never delays first paint
- **Auto-download** with timestamp filenames

### 🖼️ **Center Image System**
- **Multi-image upload** (4 images max)
- **Drag-and-drop** image management
- **Image/video support** (JPG, PNG, GIF, WebP, MP4, WebM, MOV)
- **Star favorites** for quick access
- **Rotation modes:** Static, Sync, Opposite

### 🎹 **MIDI Controller Support**
- **Auto-detection** of MIDI devices
- **CC mapping** to any parameter
- **Real-time control** for live performance

### 🎨 **Color System**
- **40+ Color Palettes**, gradient- and hue-based, selectable via dropdown or macro-driven auto-cycle
- **Custom palettes** via the preset import/export system

### 🛡️ **Session Resilience**
- **Safe Graphics Recovery** — reclaims renderer resources and switches to a Canvas2D fallback without reloading the page or interrupting audio, if the WebGL context is lost
- **Session state indicator** in Settings, showing the current run state and (if relevant) the reason for the previous exit

### ⚡ **Performance Optimizations**
- **Adaptive quality system** — auto-adjusts based on FPS
- **Frame skipping** for non-critical UI updates
- **GPU acceleration** via Canvas desync mode
- **Memory leak prevention** with comprehensive session-scoped cleanup
- **Real-time FPS monitoring** via the Performance HUD

---

## 🚀 Getting Started

### **Local Development**

```bash
# Clone repository
git clone https://github.com/splntrAVdesigns/ORBITAL-AUDIO-VISUALIZER-BETA-V1.0.git
cd ORBITAL-AUDIO-VISUALIZER-BETA-V1.0

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview a production build locally
npx vite preview
```

### **Quick Start Guide**

1. **Launch App** — Click "LAUNCH ORBITAL" on the landing page (this is also the browser's required audio-unlock gesture)
2. **Choose Audio Source:**
   - Click "MIC" for live microphone input
   - Click "FILE" to upload audio (MP3, WAV, AIFF, M4A, OGG, FLAC)
   - Click a demo track button
3. **Control Visualization:**
   - Use the **8 macro knobs** for quick adjustments
   - Expand sections for fine-tune controls
   - Try different **modes** (Electric Chaos, Particle Storm, etc.)
   - Select a **color palette** from the dropdown, or step through presets with `↑` / `↓`
4. **Record Output:**
   - Press `R` to start/stop recording (or click the record button)
   - Press `H` first to hide the control panel for a clean, UI-free capture

---

## 📖 Documentation

- **[RECORDING_GUIDE.md](./src/app/RECORDING_GUIDE.md)** — Complete recording system documentation
- **[VIDEO_FORMAT_GUIDE.md](./src/app/VIDEO_FORMAT_GUIDE.md)** — Video export and format guide
- **[DEPLOYMENT.md](./src/app/DEPLOYMENT.md)** — Deployment instructions for Vercel/Netlify
- **[CONTRIBUTING.md](./src/app/CONTRIBUTING.md)** — Contribution guidelines
- **[CHANGELOG.md](./src/app/CHANGELOG.md)** — Version history and updates
- **[ARCHITECTURE.md](./src/app/ARCHITECTURE.md)** — Full file-by-file breakdown
- **[BETA_TESTING_GUIDE.md](./src/app/BETA_TESTING_GUIDE.md)** — Beta tester walkthrough
- **[ATTRIBUTIONS.md](./ATTRIBUTIONS.md)** — Licenses and credits

The in-app **Session Settings → PROTIPS** panel also has a live "Shortcuts" tab that mirrors the table below, and the `?` overlay shows a compact version at any time.

---

## 🎮 Keyboard Shortcuts

| Key | Action |
|---|---|
| `SPACE` | Play/Pause audio |
| `M` | Mute/Unmute |
| `1`–`4` | Switch visualization mode |
| `C` | Cycle color theme |
| `↑` / `↓` | Previous / next preset scene |
| `F` | Toggle fullscreen (`ESC` to exit) |
| `S` | Capture screenshot |
| `R` | Start/Stop recording |
| `H` | Hide/show control panel |
| `?` | Toggle keyboard shortcuts helper |
| `ESC` | Close settings panel / exit fullscreen |

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Canvas Rendering:** 2D Canvas API + WebGL, with a certified main-thread render authority and a Canvas2D fallback
- **Audio Processing:** Web Audio API (AnalyserNode, FFT), with a Worker-based BPM analyzer
- **Recording:** MediaRecorder API (VP9/VP8/H264)
- **Styling:** Tailwind CSS v4 + custom CSS variables
- **Icons:** Lucide React
- **MIDI:** Web MIDI API
- **Deployment:** Vercel (recommended)

---

## 📂 Project Structure

```
src/app/
├── App.tsx                    # Main visualizer engine & render loop
├── boot/                      # First-load device gating, boot readiness, session model
├── components/
│   ├── LandingPage.tsx        # Landing page component
│   ├── LoadingPage.tsx        # Readiness-gated boot overlay
│   ├── settings/               # Individual settings panel sections
│   └── ui/                     # UI components (buttons, sliders, etc.)
├── engine/                    # WebGL renderers, MIDI, recording
├── runtime/                   # Session lifecycle, control binding, frame pipeline
├── data/
│   ├── presets.ts             # 25+ preset configurations
│   └── colorPalettes.ts       # 40+ color palettes
├── utils/                     # Audio processing, shape generation, helpers
├── config/                    # Macro definitions, default parameters, shortcut registry
├── styles/                    # Global styles and CSS variables
└── public/                    # Static assets (logos, icons)
```

See **[ARCHITECTURE.md](./src/app/ARCHITECTURE.md)** for the full file-by-file breakdown.

---

## 🎯 Use Cases

### **Live Performance (VJ)**
1. Connect a MIDI controller for real-time control
2. Use microphone input for live audio
3. Switch presets mid-performance with `↑` / `↓`
4. Project output to an external display

### **Content Creation (YouTube/Twitch)**
1. Upload your audio track
2. Dial in perfect visual settings
3. Press `H` to hide the control panel for a clean view
4. Press `R` to start recording at your chosen resolution (up to 4K)
5. Export and upload to your platform

### **OBS Streaming**
1. Add a **Browser Source** (or Window Capture) in OBS pointed at ORBITAL
2. Press `H` to hide the control panel for a clean capture
3. Set your resolution and FPS to match your stream settings
4. Control the visualization in real time while streaming to Twitch/YouTube

### **Music Production Showcase**
1. Upload the finished track
2. Apply a color palette matching the album art
3. Upload the album art as a center image
4. Record at 1440p or 4K
5. Use in a music video or promotional content

---

## 🔧 Configuration

### **Preset System**

Presets are stored in `src/app/data/presets.ts`. Each preset includes:
- Visualization mode
- All 60+ parameters
- Color palette
- Frequency band isolation
- Beat detection settings

**Import/Export:**
- Click "EXPORT" to save current settings as JSON
- Click "IMPORT" to load a preset from a file
- Star presets to mark favorites

---

## 🐛 Troubleshooting

### **Audio not playing?**
- ✅ Check browser audio permissions
- ✅ Verify the audio file format (MP3, WAV, AIFF, M4A, OGG, FLAC)
- ✅ Ensure volume is not muted
- ✅ Try a different audio source (mic/file/demo)

### **Recording not working?**
- ✅ Check the browser supports the MediaRecorder API
- ✅ Use Chrome/Firefox (Safari has limited support)
- ✅ Ensure there's enough disk space
- ✅ Check the browser console for errors

### **Performance issues?**
- ✅ Switch Display Resolution to "Performance" or "Balanced" in Settings
- ✅ Lower the FFT size (e.g. 8192 → 4096)
- ✅ Reduce particle count
- ✅ Disable dots if not needed
- ✅ Record at a lower resolution (720p)
- ✅ Close other browser tabs

### **Visuals look off for the first moment after launch, or a device is unexpectedly blocked?**
- The landing page's Launch button doubles as the browser's required audio-unlock gesture — the visualizer won't start without it
- Onboarding reappears once per browser session by default; check "Don't show this again" on the tutorial to opt out for that version
- If the renderer ever needs to recover, use **Settings → Session Resilience → Safe Graphics Recovery** rather than reloading the page

---

## 🤝 Contributing

We welcome contributions! See **[CONTRIBUTING.md](./src/app/CONTRIBUTING.md)** for guidelines.

**Ways to contribute:**
- 🐛 Report bugs via GitHub Issues
- 💡 Suggest new features
- 🎨 Create new presets
- 📝 Improve documentation
- 🔧 Submit pull requests

---

## 📜 License

**MIT License** — see the LICENSE file for details.

This project uses open-source libraries. See **[ATTRIBUTIONS.md](./ATTRIBUTIONS.md)** for full credits.

---

## 🙏 Acknowledgments

- **React Team** — for the framework
- **Vite Team** — for fast build tooling
- **Web Audio API** — for real-time audio analysis
- **Figma Make** — for rapid prototyping and development
- **Open Source Community** — for inspiration and tools

---

## 📞 Contact & Support

- **GitHub:** [github.com/splntrAVdesigns/ORBITAL-AUDIO-VISUALIZER-BETA-V1.0](https://github.com/splntrAVdesigns/ORBITAL-AUDIO-VISUALIZER-BETA-V1.0)
- **Issues:** [Report a bug](https://github.com/splntrAVdesigns/ORBITAL-AUDIO-VISUALIZER-BETA-V1.0/issues)

---

### See **[CHANGELOG.md](./src/app/CHANGELOG.md)** for full version history.

**Built with ❤️ for the audio-visual community**
