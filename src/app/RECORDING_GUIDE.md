# 🎬 ORBITAL RECORDING SYSTEM GUIDE

ORBITAL records directly from the main app window using the browser-based **MediaRecorder API** — no separate window, no extra setup. What you see is what gets recorded.

---

## 📊 WHAT IT RECORDS

**Captures:**
- ✅ The visualization canvas
- ✅ Press `H` first if you want a clean, UI-free capture (hides the control panel)
- ✅ Size matches your chosen resolution preset, independent of your browser window size

**Best for:**
- Quick captures and testing
- VJ practice sessions
- Social media clips
- Professional video exports (up to 4K)
- OBS / live streaming capture
- Client deliverables

---

## ▶️ HOW TO USE

1. Upload audio or use the microphone
2. Press `H` (optional) to hide the control panel for a clean capture
3. Open the **Recording** section and choose your settings:
   - **Resolution:** 720p, 1080p, 1440p, or 4K (3840×2160)
   - **FPS:** 30, 60, or 120
   - **Duration:** 15s, 30s, 60s, or Loop (manual stop)
   - **Codec:** WebM (VP9, recommended), WebM (VP8), or H.264
   - **Quality:** Low (2 Mbps) / Medium (5 Mbps) / High (10 Mbps, recommended) / Ultra (20 Mbps)
   - Or pick a **Quick Preset** (e.g. "Quick Clip" — 720p/30fps/15s/VP8/Medium, for fast, small files)
4. Press `R` (or click the record button) to start
5. Press `R` again (or click stop) to end — or let it auto-stop if you chose a fixed duration
6. Find your recording in the **Recording Library** (stores up to 8 at a time), preview it, and download

---

## 🎨 WORKFLOW EXAMPLES

### Example 1: YouTube Video

**Goal:** A clean 1080p60 video, no UI

**Steps:**
1. Upload your audio track
2. Dial in your visual settings, mode, colors, effects
3. Press `H` to hide the control panel
4. Set resolution to 1080p, FPS to 60, duration to Loop
5. Press `R` to start, press play (or `SPACE`) on your audio
6. Press `R` to stop once the track ends
7. Download from the Recording Library
8. Import to your video editor and export as MP4 for YouTube

---

### Example 2: Live Streaming with OBS

**Goal:** Clean visualization on a Twitch/YouTube stream

**Steps:**
1. In OBS, add a **Browser Source** pointed at your ORBITAL URL (or a **Window Capture** source if running it as a desktop window)
2. In ORBITAL, press `H` to hide the control panel
3. Match your resolution/FPS to your stream settings
4. Go live in OBS — control the visualization in real time from the (hidden but still active) control panel by pressing `H` again to bring it back when you need to adjust something

---

### Example 3: Client Deliverable (4K)

**Goal:** High-quality 4K export

**Steps:**
1. Load the client's audio and apply their brand colors/preset
2. Set resolution to 4K, quality to High or Ultra
3. Press `H` to hide the control panel, verify the visualization looks right
4. Press `R`, play the audio, press `R` again once it ends
5. Deliver the downloaded `.webm` file (convert to MP4 first if the client needs it — see below)

---

## ⚙️ CODEC SUPPORT

### Browser Compatibility:

| Browser | VP9 | VP8 | H.264 | WebM | MP4 |
|---------|-----|-----|-------|------|-----|
| Chrome | ✅ | ✅ | ✅ | ✅ | ❌ |
| Firefox | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edge | ✅ | ✅ | ✅ | ✅ | ❌ |
| Safari | ❌ | ❌ | ✅ | ✅ | ✅ |

VP9 (recommended default) gives the best quality on Chrome/Firefox/Edge. If you need Safari compatibility, choose H.264 instead.

---

## 📁 FILE FORMATS & CONVERSION

Recordings save as `.webm`. Most modern video editors (Premiere, DaVinci Resolve, Final Cut Pro) accept `.webm` directly — converting isn't usually necessary.

**To convert to MP4 anyway:**

**Using FFmpeg (command line):**
```bash
ffmpeg -i your-recording.webm -c:v libx264 -preset slow -crf 18 output.mp4
```

**Using an online tool:** CloudConvert.com, Online-Convert.com, or Convertio.co

### Approximate File Sizes

| Resolution | Quality | Duration | Approx. Size |
|------------|---------|----------|--------------|
| 720p | Medium (5 Mbps) | 1 min | ~38 MB |
| 1080p | High (10 Mbps) | 1 min | ~75 MB |
| 1440p | High (10 Mbps) | 1 min | ~75 MB |
| 4K | Ultra (20 Mbps) | 1 min | ~150 MB |

For longer recordings, drop to a lower quality preset or convert to MP4 afterward for better compression.

---

## 🚀 PERFORMANCE TIPS

1. **Match resolution to your actual need** — 1080p/High is a good balance for most uses; reserve 4K/Ultra for final deliverables on a capable machine
2. **Close other tabs/apps** before recording to free up CPU/GPU and avoid dropped frames
3. **Use the Performance HUD** (Session Settings) to check your FPS is staying near your target before committing to a long recording
4. **Wired connection for OBS streaming** reduces latency and improves frame delivery stability

---

## 🐛 TROUBLESHOOTING

### Recording not starting?

**Check:**
- ✅ Audio is loaded
- ✅ Canvas is visible
- ✅ Browser supports MediaRecorder API (Chrome/Firefox recommended)
- ✅ Not already recording

**If it still won't start:** check the browser console (F12) for errors, and confirm microphone/audio permissions are granted if using mic input.

### Recording file is huge?

See the file-size table above for what to expect at each setting. If a file is unexpectedly large, convert to MP4 (better compression than WebM for delivery) or drop to a lower quality preset for future recordings.

### Recording drops frames?

**Check:** CPU/GPU usage (Task Manager / Activity Monitor), other apps competing for resources, and your FPS via the Performance HUD.

**Solutions:** lower resolution, lower the FPS target, close other apps/tabs, disable unnecessary browser extensions, and use a dedicated GPU rather than integrated graphics if you have the option.

---

## 📋 QUICK REFERENCE

- `R` - Start/Stop recording
- `H` - Hide/show control panel (for a clean capture)
- `SPACE` - Play/Pause audio
- `F` - Toggle fullscreen

---

**Enjoy creating with ORBITAL! 🚀**