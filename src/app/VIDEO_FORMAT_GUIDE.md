# 🎥 Video Format Guide for ORBITAL Audio Visualizer

## ✅ Supported Video Formats

The center image system supports videos, but they **must use browser-compatible codecs**.

### **Recommended Format:**
- **Container:** MP4 (`.mp4`)
- **Video Codec:** H.264 (also called AVC)
- **Audio Codec:** AAC
- **Resolution:** Any (1080p, 4K, etc.)
- **Frame Rate:** Any

---

## ❌ Common Issues

### **Error: "Video format/codec not supported by browser"**

This happens when your video uses:
- ❌ **H.265/HEVC codec** (most common issue)
- ❌ **AV1 codec** (limited browser support)
- ❌ **ProRes or other professional codecs**

---

## 🔧 How to Convert Your Videos

### **Option 1: HandBrake (Recommended - FREE & Easy)**

1. Download **[HandBrake](https://handbrake.fr/)** (free, open-source)
2. Open your video file
3. Select preset: **"Web" → "Gmail Medium"** (works perfectly)
4. Click **"Start Encode"**
5. Upload the converted file to ORBITAL

### **Option 2: Online Converter**

- **[CloudConvert](https://cloudconvert.com/mp4-converter)** (free, no signup for small files)
- **[FreeConvert](https://www.freeconvert.com/video-converter)** (free)

Settings:
- Output format: **MP4**
- Video codec: **H.264**
- Audio codec: **AAC**

### **Option 3: FFmpeg (Command Line - Advanced)**

```bash
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -crf 23 -preset medium output.mp4
```

**Parameters explained:**
- `-c:v libx264` = Use H.264 video codec
- `-c:a aac` = Use AAC audio codec
- `-crf 23` = Quality (lower = better, 18-28 is good range)
- `-preset medium` = Encoding speed vs compression

---

## 📋 Quick Checklist

Before uploading a video to ORBITAL:

- [ ] File extension is `.mp4` or `.webm`
- [ ] Video codec is **H.264** (for MP4) or **VP8/VP9** (for WebM)
- [ ] Audio codec is **AAC** (for MP4) or **Vorbis/Opus** (for WebM)
- [ ] File size is reasonable (< 100MB recommended for web use)

---

## 🔍 How to Check Your Video Codec

### **macOS:**
1. Select video file in Finder
2. Press `Cmd + I` (Get Info)
3. Look for "Codecs" section

### **Windows:**
1. Right-click video file
2. Select "Properties"
3. Go to "Details" tab
4. Look at "Video codec" field

### **VLC Media Player (All Platforms):**
1. Open video in VLC
2. Go to **Tools → Codec Information** (or press `Cmd + I` / `Ctrl + J`)
3. Check "Codec" field

---

## 💡 Tips

- **File Size:** Videos will be looped in the background, so shorter clips (5-30 seconds) work great
- **Resolution:** 1080p is usually sufficient; 4K is overkill for this use case
- **Transparency:** Videos don't support transparency; use PNG sequences for transparent animations
- **Multiple Videos:** You can upload up to 6 videos in the image slots

---

## ❓ Still Having Issues?

If your converted video still doesn't work:

1. Make sure it plays in your web browser (drag & drop into Chrome/Firefox)
2. Try re-encoding with HandBrake using the "Web → Gmail Small" preset
3. Check file size - very large files (>100MB) may cause performance issues

---

**Made for ORBITAL Audio Visualizer v1.0 Beta** 🎵
