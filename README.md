# 🎵 ORBITAL Audio-Reactive Visualizer Engine - V1.0 BETA

**Production-Ready | Performance Optimized | Professional Audio Visualization**

![ORBITAL Audio Visualizer](https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop)

> **V1.0 BETA** - Built February 2025 | Full-featured audio-reactive visualizer with 60+ sacred geometry shapes, 20 curated presets, playlist system, intro tutorial, mobile blocking, MIDI support, and professional-grade recording capabilities.

---

## 🌟 Overview

ORBITAL is a cutting-edge audio visualizer engine that transforms sound into mesmerizing radial visuals. Built with React, Canvas API, and Web Audio API, it delivers real-time audio analysis with **4 distinct visualization modes**, **Core Astral Shaper with 60+ sacred geometry patterns**, **60+ parameters**, **beat detection**, **playlist system**, **MIDI support**, **browser-based recording**, and professional-grade motion effects.

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
- **Electric Chaos** - Dynamic energy-based radial waveforms with reactive spikes
- **Particle Storm** - Physics-based particle system with audio reactivity
- **Heatmap Bars** - Frequency spectrum with gradient heat mapping
- **Waveform Trails** - Smooth circular waveform with motion blur trails

### 🎛️ **Real-Time Control System**
- **8 Macro Knobs** with intelligent parameter mapping
  - Intensity, Motion, Color FX, and Detail
  - Visual feedback rings with real-time parameter display
- **60+ Fine-Tune Parameters** including:
  - Amplitude, rotation speed, thickness, smoothing
  - Particle count, size, velocity, gravity
  - Motion FX: turbulence, displacement, grain, bloom
  - Color: hue shift, saturation, brightness, speed
  - Dots: density, size, alpha, mode, spiral controls
- **Frequency Band Isolation** (Low/Mid/High/Full)
- **20 Preset System** with favorites, import/export
- **Collapsible UI** for distraction-free creation

### 🎵 **Audio Input & Processing**
- **Multiple Input Methods:**
  - 🎤 Microphone input with live monitoring
  - 📁 Audio file upload (MP3, WAV, OGG, FLAC, M4A, AAC)
  - 🎼 3 built-in demo tracks
- **Beat Detection Engine:**
  - Automatic BPM detection and display
  - Beat accent with visual flash effects
  - Rotation sync to beat (1/4, 1/8, 1/16)
- **FFT Analysis:** 512 to 32768 bins
- **VU Meter & Mini Spectrum Analyzer**

### 🎬 **Recording & Export System**
- **In-App Recording** - Capture directly from the main window, no separate window needed
- **Recording Options:**
  - Resolution presets: 720p, 1080p, 1440p, 4K (2160p)
  - FPS control: 30, 60, 120 fps
  - Duration: 15s, 30s, 60s, or manual loop/stop
  - Codec choice: WebM (VP9, recommended), WebM (VP8), H.264
  - Quality/bitrate presets: 2-20 Mbps
  - Quick presets (e.g. "Quick Clip" for fast, small files)
  - Keyboard shortcut: `R` to start/stop
- **Recording Library** - Store up to 8 recordings, with preview, delete, and download
- **Video Preview** before download
- **Auto-download** with timestamp filenames

### 🖼️ **Center Image System**
- **Multi-image upload** (4 images max)
- **Drag-and-drop** image management
- **Image/video support** (PNG, JPG, GIF, WebP, MP4, WebM)
- **Star favorites** for quick access
- **Rotation modes:** Static, Sync, Opposite

### 🎹 **MIDI Controller Support**
- **Auto-detection** of MIDI devices
- **CC mapping** to any parameter
- **Real-time control** for live performance

### 🎨 **Color Schemes**
- **40 Color Palettes** including:
  - Electric Blue (default)
  - Cyberpunk Neon
  - Sunset Gradient
  - Ocean Waves
  - Fire & Ice
  - Custom palettes via preset system

### ⚡ **Performance Optimizations**
- **Adaptive quality system** - Auto-adjusts based on FPS
- **Frame skipping** for non-critical UI updates
- **GPU acceleration** via Canvas desync mode
- **Memory leak prevention** with comprehensive cleanup
- **2.5× performance improvement** from optimization phase
- **Real-time FPS monitoring** in debug mode

---

## 🚀 Getting Started

### **Live Demo**
Visit: [ORBITAL on Vercel](https://your-vercel-url.vercel.app) *(Update with your deployment URL)*

### **Local Development**

```bash
# Clone repository
git clone https://github.com/yourusername/orbital-visualizer.git
cd orbital-visualizer

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### **Quick Start Guide**

1. **Launch App** - Click \"LAUNCH ORBITAL\" on landing page
2. **Choose Audio Source:**
   - Click \"MIC\" for live microphone input
   - Click \"FILE\" to upload audio (MP3, WAV, etc.)
   - Click demo track buttons (1, 2, 3)
3. **Control Visualization:**
   - Use the **8 macro knobs** for quick adjustments
   - Expand sections for fine-tune controls
   - Try different **modes** (Electric Chaos, Particle Storm, etc.)
   - Select **color schemes** from dropdown
4. **Record Output:**
   - Press `R` to start/stop recording (or click the record button)
   - Press `H` first to hide the control panel for a clean, UI-free capture

---

## 📖 Documentation

- **[QUICK_START.md](./src/app/QUICK_START.md)** - Fast-track guide for first-time users
- **[RECORDING_GUIDE.md](./src/app/RECORDING_GUIDE.md)** - Complete recording system documentation  
- **[VIDEO_FORMAT_GUIDE.md](./src/app/VIDEO_FORMAT_GUIDE.md)** - Video export and format guide
- **[DEPLOYMENT.md](./src/app/DEPLOYMENT.md)** - Deployment instructions for Vercel/Netlify
- **[CONTRIBUTING.md](./src/app/CONTRIBUTING.md)** - Contribution guidelines
- **[CHANGELOG.md](./src/app/CHANGELOG.md)** - Version history and updates
- **[ATTRIBUTIONS.md](./ATTRIBUTIONS.md)** - Licenses and credits

---

## 🎮 Keyboard Shortcuts

- `SPACE` - Play/Pause audio
- `M` - Mute
- `1` - `4` - Switch visualization mode
- `C` - Cycle color theme
- `F` - Toggle fullscreen
- `S` - Capture screenshot
- `R` - Start/Stop recording
- `H` - Hide/show control panel
- `?` - Toggle keyboard shortcuts helper
- `ESC` - Close settings panel / exit fullscreen
- `Arrow Keys` - Navigate center images (when focused)

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Canvas Rendering:** 2D Canvas API with GPU acceleration
- **Audio Processing:** Web Audio API (AnalyserNode, FFT)
- **Recording:** MediaRecorder API (VP9/VP8/H264)
- **Styling:** Tailwind CSS v4 + Custom CSS variables
- **Icons:** Lucide React
- **MIDI:** Web MIDI API
- **Deployment:** Vercel (recommended)

---

## 📂 Project Structure

```
src/app/
├── App.tsx                    # Main visualizer engine & render loop
├── components/
│   ├── LandingPage.tsx        # Landing page component
│   ├── LoadingPage.tsx        # Loading screen
│   ├── settings/              # Individual settings panel sections
│   └── ui/                    # UI components (buttons, sliders, etc.)
├── engine/                    # WebGL renderers, MIDI, recording
├── data/
│   ├── presets.ts             # 20 preset configurations
│   └── colorPalettes.ts       # 40 color palettes
├── utils/                     # Audio processing, shape generation, helpers
├── config/                    # Macro definitions, default parameters
├── styles/                    # Global styles and CSS variables
└── public/                    # Static assets (logos, icons)
```

See **[ARCHITECTURE.md](./src/app/ARCHITECTURE.md)** for the full file-by-file breakdown.

---


## 🎯 Use Cases

### **Live Performance (VJ)**
1. Connect MIDI controller for real-time control
2. Use microphone input for live audio
3. Switch presets mid-performance
4. Project output to external display

### **Content Creation (YouTube/Twitch)**
1. Upload your audio track
2. Dial in perfect visual settings
3. Press `H` to hide the control panel for a clean view
4. Press `R` to start recording at your chosen resolution (up to 4K)
5. Export and upload to platform

### **OBS Streaming**
1. Add a **Browser Source** (or Window Capture) in OBS pointed at ORBITAL
2. Press `H` to hide the control panel for a clean capture
3. Set your resolution and FPS to match your stream settings
4. Control visualization in real-time, then stream to Twitch/YouTube

### **Music Production Showcase**
1. Upload finished track
2. Apply color scheme matching album art
3. Upload album art as center image
4. Record at 1440p or 4K
5. Use in music video or promotional content

---

## 🔧 Configuration

### **Preset System**

Presets are stored in `/data/presets.ts`. Each preset includes:
- Visualization mode
- All 60+ parameters
- Color palette
- Frequency band isolation
- Beat detection settings

**Import/Export:**
- Click \"EXPORT\" to save current settings as JSON
- Click \"IMPORT\" to load preset from file
- Star presets to mark favorites

---

## 🐛 Troubleshooting

### **Audio not playing?**
- ✅ Check browser audio permissions
- ✅ Verify audio file format (use MP3/WAV)
- ✅ Ensure volume is not muted
- ✅ Try different audio source (mic/file/demo)

### **Recording not working?**
- ✅ Check browser supports MediaRecorder API
- ✅ Use Chrome/Firefox (Safari limited support)
- ✅ Ensure enough disk space
- ✅ Check browser console for errors

### **Performance issues?**
- ✅ Lower FFT size (8192 → 4096)
- ✅ Reduce particle count
- ✅ Disable dots if not needed
- ✅ Record at a lower resolution (720p)
- ✅ Close other browser tabs

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

**MIT License** - See LICENSE file for details.

This project uses open-source libraries. See **[ATTRIBUTIONS.md](./ATTRIBUTIONS.md)** for full credits.

---

## 🙏 Acknowledgments

- **React Team** - For the amazing framework
- **Vite Team** - For blazing fast build tooling
- **Web Audio API** - For powerful audio analysis capabilities
- **Figma Make** - For rapid prototyping and development
- **Open Source Community** - For inspiration and tools

---

## 📞 Contact & Support

- **GitHub:** [github.com/yourusername/orbital-visualizer](https://github.com/yourusername/orbital-visualizer)
- **Issues:** [Report a bug](https://github.com/yourusername/orbital-visualizer/issues)
- **Discussions:** [Community forum](https://github.com/yourusername/orbital-visualizer/discussions)

---

## 🎉 What's New in V1.0.1 BETA

### Latest Improvements:
- ✅ **Performance Stability Pass** - Eliminated redundant per-frame GPU texture uploads in the Liquid Shaper engine, fixed a missing guard that was rebuilding spike-ring lookup tables every frame, and reduced per-frame allocation in the halo and dots rendering paths
- ✅ **Macro Knob Responsiveness** - Drag handling deferred to per-frame batching instead of firing a full re-render on every pointer-move event
- ✅ **Settings Panel Re-render Containment** - All settings sections now memoized so unrelated UI changes no longer cascade into re-rendering the whole control panel
- ✅ **Resolution Presets** - 720p, 1080p, 1440p, 4K support for recording
- ✅ **20 Presets** - Curated visualization presets
- ✅ **40 Color Palettes** - Curated gradient collections
- ✅ **Reset Button Audit** - Fixed several reset controls (including the main "Reset to Defaults") that were silently failing partway through
- ✅ **Memory & Allocation Fixes** - Comprehensive cleanup of dead code, unused dependencies, and orphaned files ahead of the public repository release

### See **[CHANGELOG.md](./src/app/CHANGELOG.md)** for full version history.

---

**Built with ❤️ for the audio-visual community**

**⭐ Star this repo if you find it useful!**