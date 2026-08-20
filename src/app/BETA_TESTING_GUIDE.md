# 🧪 ORBITAL V1.0 BETA - Testing Guide

**Version:** 1.0 BETA  
**Date:** April 3, 2026  
**Status:** Ready for Beta Testing

---

## 📋 Testing Overview

This guide provides a comprehensive checklist for testing all features of the ORBITAL Audio-Reactive Visualizer Engine. Each section includes specific test cases, expected behavior, and areas to watch for potential issues.

---

## 🎯 Testing Priorities

### **Priority 1: Core Functionality** ⭐⭐⭐
- Audio input and playback
- Visualization rendering
- Basic controls
- Performance (55-65 FPS target)

### **Priority 2: Advanced Features** ⭐⭐
- Core Astral Shaper morphing system
- Beat detection and reactivity
- Recording system
- Preset system

### **Priority 3: Polish & UX** ⭐
- UI responsiveness
- Error handling
- Tutorial system
- Visual quality

---

## 🎵 1. AUDIO INPUT TESTING

### 1.1 Microphone Input
**Test Steps:**
1. Click "MIC" button
2. Grant microphone permissions
3. Speak/play audio near microphone

**Expected Behavior:**
- ✅ Browser requests microphone permission
- ✅ VU meter responds to audio input
- ✅ Mini spectrum analyzer shows frequency data
- ✅ Visualization reacts to audio in real-time
- ✅ BPM detector shows beats (if rhythmic audio)

**Test Cases:**
- [ ] Quiet audio (whisper)
- [ ] Loud audio (shout/music)
- [ ] Silence (should show minimal activity)
- [ ] Microphone disconnect/reconnect

**Known Issues to Watch:**
- Latency between audio and visuals
- Gain/sensitivity calibration

---

### 1.2 File Upload
**Test Steps:**
1. Click "FILE" button
2. Select audio file from disk
3. File should load and start playing

**Expected Behavior:**
- ✅ File picker opens
- ✅ Audio loads without errors
- ✅ Playback controls appear (play/pause)
- ✅ Seek bar shows progress
- ✅ Duration displays correctly

**Test Cases:**
- [ ] MP3 file
- [ ] WAV file
- [ ] OGG file
- [ ] FLAC file (if supported)
- [ ] Large file (>50MB)
- [ ] Corrupted file (should show error)
- [ ] Non-audio file (should reject)

**Known Issues to Watch:**
- File format compatibility
- Memory usage with large files

---

### 1.3 Demo Tracks
**Test Steps:**
1. Click demo track buttons (1, 2, 3)
2. Each should load immediately

**Expected Behavior:**
- ✅ Audio plays instantly
- ✅ No loading delay
- ✅ Track metadata displays
- ✅ Playback controls work

**Test Cases:**
- [ ] Demo Track 1
- [ ] Demo Track 2
- [ ] Demo Track 3
- [ ] Switch between tracks mid-playback

---

## 🎨 2. VISUALIZATION MODES

### 2.1 Electric Chaos Mode
**Test Steps:**
1. Select "Electric Chaos" mode
2. Play audio
3. Adjust parameters

**Expected Behavior:**
- ✅ Radial spikes emanate from center
- ✅ Spikes react to audio amplitude
- ✅ WebGL rendering (check for smooth graphics)
- ✅ Color shifts work correctly

**Test Cases:**
- [ ] Low frequency audio (bass)
- [ ] High frequency audio (treble)
- [ ] Full spectrum audio
- [ ] Adjust spike count
- [ ] Adjust spike thickness
- [ ] Test color palettes

**Known Issues to Watch:**
- WebGL performance on older GPUs
- Spike rendering artifacts

---

### 2.2 Particle Storm Mode
**Test Steps:**
1. Select "Particle Storm" mode
2. Play audio
3. Adjust particle parameters

**Expected Behavior:**
- ✅ Particles spawn and move
- ✅ Particles react to audio beats
- ✅ Gravity/physics applies correctly
- ✅ Particle count slider works

**Test Cases:**
- [ ] Increase particle count to maximum
- [ ] Decrease particle count to minimum
- [ ] Adjust gravity
- [ ] Adjust velocity
- [ ] Test with low-end CPU (performance check)

**Known Issues to Watch:**
- Performance drop with high particle count
- Particle spawning lag

---

### 2.3 Heatmap Bars Mode
**Test Steps:**
1. Select "Heatmap Bars" mode
2. Play audio with varied frequencies
3. Check gradient heat mapping

**Expected Behavior:**
- ✅ Frequency bars display radially
- ✅ Colors shift based on amplitude (heat)
- ✅ Smooth gradient transitions
- ✅ FFT size affects detail

**Test Cases:**
- [ ] Low FFT size (512)
- [ ] Medium FFT size (8192)
- [ ] High FFT size (32768)
- [ ] Frequency band isolation (Low/Mid/High)

**Known Issues to Watch:**
- Color mapping accuracy
- Bar rendering overlaps

---

### 2.4 Waveform Trails Mode
**Test Steps:**
1. Select "Waveform Trails" mode
2. Play audio
3. Enable motion blur

**Expected Behavior:**
- ✅ Circular waveform draws smoothly
- ✅ Motion blur creates trails
- ✅ Trails decay over time
- ✅ No flickering

**Test Cases:**
- [ ] Motion blur ON
- [ ] Motion blur OFF
- [ ] Adjust trail decay speed
- [ ] Test with complex waveforms

**Known Issues to Watch:**
- Trail rendering performance
- Blur artifacts

---

## 🌀 3. CORE ASTRAL SHAPER (CRITICAL NEW FEATURE)

### 3.1 Shape Selection
**Test Steps:**
1. Open "Astral Shaper Settings"
2. Browse through 60+ shapes
3. Select different shapes

**Expected Behavior:**
- ✅ Shape preview displays
- ✅ Shape name shows
- ✅ Smooth morphing to new shape (not crossfade)
- ✅ 256-point vertex morphing visible

**Test Cases:**
- [ ] Circle → Triangle (simple to simple)
- [ ] Triangle → Star (simple to complex)
- [ ] Star → Flower of Life (complex to complex)
- [ ] Random shape selection (10+ shapes)
- [ ] Rapid shape switching

**Known Issues to Watch:**
- Morphing artifacts
- Performance during morph
- Point correspondence issues

---

### 3.2 Morph Origins
**Test Steps:**
1. Select two different shapes
2. Test each morph origin mode
3. Observe morphing behavior

**Expected Behavior:**
- ✅ **Uniform Mode:** All points morph at same rate
- ✅ **Center Mode:** Points morph from center outward
- ✅ **Polarity Mode:** Points alternate morph timing

**Test Cases:**
- [ ] Uniform morph origin
- [ ] Center morph origin
- [ ] Polarity morph origin
- [ ] Switch origins mid-morph
- [ ] Audio-reactive morph speed

**Known Issues to Watch:**
- Morph origin visual differences
- Field modulation interactions

---

### 3.3 Field Modulation
**Test Steps:**
1. Enable field modulation
2. Adjust field strength
3. Play audio and observe

**Expected Behavior:**
- ✅ Shape distorts based on audio
- ✅ Field strength affects distortion amount
- ✅ Smooth transitions
- ✅ No jarring jumps

**Test Cases:**
- [ ] Field strength 0% (off)
- [ ] Field strength 50%
- [ ] Field strength 100% (maximum)
- [ ] Audio-reactive field modulation

**Known Issues to Watch:**
- Over-distortion
- Performance impact

---

## 🎛️ 4. MACRO KNOBS

### 4.1 Intensity Knob
**Test Steps:**
1. Rotate Intensity knob
2. Observe multiple parameters changing

**Expected Behavior:**
- ✅ Visual feedback ring updates
- ✅ Amplitude increases
- ✅ Reactivity increases
- ✅ Other mapped parameters update

**Test Cases:**
- [ ] 0% intensity
- [ ] 50% intensity
- [ ] 100% intensity
- [ ] Real-time adjustment during playback

---

### 4.2 Motion Knob
**Test Steps:**
1. Rotate Motion knob
2. Check rotation and movement effects

**Expected Behavior:**
- ✅ Rotation speed changes
- ✅ Orbit drift changes (if enabled)
- ✅ Shape motion increases
- ✅ Smooth parameter transitions

**Test Cases:**
- [ ] 0% motion (static)
- [ ] 50% motion
- [ ] 100% motion (maximum)

---

### 4.3 Color FX Knob
**Test Steps:**
1. Rotate Color FX knob
2. Observe color effects

**Expected Behavior:**
- ✅ Hue shift speed changes
- ✅ Saturation changes
- ✅ Color cycle speed increases
- ✅ Rainbow effects appear

**Test Cases:**
- [ ] 0% color FX
- [ ] 50% color FX
- [ ] 100% color FX
- [ ] Test with different color palettes

---

### 4.4 Detail Knob
**Test Steps:**
1. Rotate Detail knob
2. Check visual complexity

**Expected Behavior:**
- ✅ Particle count increases (Particle mode)
- ✅ FFT bins increase (Heatmap mode)
- ✅ Dot density increases
- ✅ Shape detail increases

**Test Cases:**
- [ ] 0% detail (minimal)
- [ ] 50% detail
- [ ] 100% detail (maximum)
- [ ] Performance check at max detail

---

## 🎨 5. BEAT REACTIVE COLOR FX

### 5.1 Effect Types
**Test Steps:**
1. Enable "Beat Reactive Color FX"
2. Test each effect type
3. Play rhythmic audio

**Expected Behavior:**
- ✅ **Hue Shift:** Color shifts on beat
- ✅ **Saturation Pulse:** Saturation increases on beat
- ✅ **Brightness Flash:** Brightness flashes on beat
- ✅ **Spark Impact:** ⭐ NEW - Radial sparks burst on beat

**Test Cases:**
- [ ] Hue Shift effect
- [ ] Saturation Pulse effect
- [ ] Brightness Flash effect
- [ ] Spark Impact effect (verify it's in Color FX, not Outer Halo)
- [ ] Switch effects mid-playback

**Known Issues to Watch:**
- Spark Impact performance
- Effect timing sync with beats

---

### 5.2 Center Glow
**Test Steps:**
1. Enable Center Glow
2. Adjust glow intensity
3. Play audio and check for strobing

**Expected Behavior:**
- ✅ Glow pulses with beats
- ✅ NO strobing or flashing issues
- ✅ Hue isolated from saturation multiplier
- ✅ Smooth glow transitions

**Test Cases:**
- [ ] Center Glow 0%
- [ ] Center Glow 50%
- [ ] Center Glow 100%
- [ ] Check for strobe bug (should be fixed)

**Known Issues to Watch:**
- ⚠️ FIXED: Center Glow strobe bug (verify fix)

---

## 🎥 6. RECORDING SYSTEM

### 6.1 Recording

**Test Steps:**
1. Press `H` (optional) to hide the control panel for a clean capture
2. Choose resolution, FPS, duration, codec, and quality in the Recording section
3. Press `R` (or click the record button) to start
4. Press `R` again to stop

**Expected Behavior:**
- ✅ Recording indicator appears with a duration counter
- ✅ Recording stops cleanly (manually or at the chosen duration)
- ✅ Video preview displays in the Recording Library
- ✅ Download button works
- ✅ No UI visible in the recorded video if the panel was hidden first

**Test Cases:**
- [ ] Short recording (10-15 seconds)
- [ ] Long recording (2+ minutes, Loop mode)
- [ ] Recording with panel visible vs. hidden
- [ ] Cancel recording mid-capture
- [ ] 720p recording
- [ ] 1080p recording
- [ ] 1440p recording
- [ ] 4K (2160p) recording
- [ ] 30 FPS recording
- [ ] 60 FPS recording
- [ ] 120 FPS recording (if supported by hardware)
- [ ] Each codec option (VP9, VP8, H.264)
- [ ] Each quality preset (Low/Medium/High/Ultra)
- [ ] Recording Library fills up to 8 entries and oldest is handled correctly
- [ ] Delete a single recording from the library
- [ ] Clear all recordings

**Known Issues to Watch:**
- Recording quality/bitrate at each preset
- File size for long recordings at high resolution

---

### 6.2 Keyboard Shortcuts (Recording)

**Test Steps:**
1. Test each keyboard shortcut while a track is loaded

**Expected Behavior:**
- ✅ `R` - Start/Stop recording
- ✅ `H` - Hide/show control panel
- ✅ `SPACE` - Play/Pause
- ✅ `F` - Fullscreen toggle

**Test Cases:**
- [ ] R key (recording)
- [ ] H key (panel hide/show)
- [ ] SPACE key (play/pause)
- [ ] F key (fullscreen)

---

## 🎯 7. PRESET SYSTEM

### 7.1 Preset Loading
**Test Steps:**
1. Open "Presets" section
2. Click on different presets
3. Verify all settings load

**Expected Behavior:**
- ✅ All 20 curated presets load
- ✅ Parameters update instantly
- ✅ Visual style changes
- ✅ Preset name displays

**Test Cases:**
- [ ] Load all 20 presets
- [ ] Switch rapidly between presets
- [ ] Verify preset favorites (stars)

---

### 7.2 Preset Import/Export
**Test Steps:**
1. Adjust parameters to custom settings
2. Click "EXPORT"
3. Save JSON file
4. Click "IMPORT"
5. Load saved JSON file

**Expected Behavior:**
- ✅ Export saves all 60+ parameters
- ✅ JSON file downloads
- ✅ Import loads all parameters correctly
- ✅ Custom preset matches original settings

**Test Cases:**
- [ ] Export preset
- [ ] Import preset
- [ ] Export/import with custom shapes
- [ ] Import invalid JSON (error handling)

---

## 🎹 8. MIDI CONTROLLER SUPPORT

### 8.1 MIDI Device Detection
**Test Steps:**
1. Connect MIDI controller
2. Open MIDI settings
3. Check device list

**Expected Behavior:**
- ✅ MIDI device auto-detected
- ✅ Device name displays
- ✅ Connection status shows

**Test Cases:**
- [ ] Connect MIDI device before app launch
- [ ] Connect MIDI device after app launch
- [ ] Disconnect/reconnect MIDI device

---

### 8.2 CC Mapping
**Test Steps:**
1. Select parameter to map
2. Move MIDI knob/slider
3. Verify mapping works

**Expected Behavior:**
- ✅ Parameter responds to MIDI input
- ✅ Smooth value transitions
- ✅ Full range (0-100%) covered
- ✅ Real-time control

**Test Cases:**
- [ ] Map to macro knob
- [ ] Map to fine-tune parameter
- [ ] Map multiple parameters
- [ ] Clear MIDI mapping

---

## 🌊 9. EDGE FALLBACK & MOTION

### 9.1 Torus Motion (Edge Fallback)
**Test Steps:**
1. Trigger Edge Fallback mode (if applicable)
2. Adjust "Shape Orbit Drift" slider
3. Observe torus motion

**Expected Behavior:**
- ✅ Torus spins and orbits
- ✅ Better physics than before
- ✅ Drift slider controls motion speed
- ✅ Smooth rotation

**Test Cases:**
- [ ] Orbit drift 0% (static)
- [ ] Orbit drift 50%
- [ ] Orbit drift 100% (maximum)

**Known Issues to Watch:**
- ⚠️ ENHANCED: Edge Fallback torus motion (verify improvement)

---

## 📊 10. PERFORMANCE TESTING

### 10.1 FPS Monitoring
**Test Steps:**
1. Enable Performance HUD in Session Settings
2. Monitor FPS counter
3. Test various scenarios

**Expected Behavior:**
- ✅ **Target:** 55-65 FPS
- ✅ Stable framerate during playback
- ✅ No significant drops
- ✅ Debug overlay shows FPS, render time, audio latency

**Test Cases:**
- [ ] Electric Chaos mode FPS
- [ ] Particle Storm mode FPS (max particles)
- [ ] Heatmap Bars mode FPS (max FFT)
- [ ] Waveform Trails mode FPS (motion blur ON)
- [ ] 4K resolution FPS
- [ ] Recording mode FPS

**Performance Targets:**
- ✅ 1080p @ 60 FPS minimum
- ✅ 4K @ 30 FPS acceptable
- ✅ No stuttering or freezing

---

### 10.2 Memory Leaks
**Test Steps:**
1. Open Chrome DevTools → Performance → Memory
2. Run app for 5+ minutes
3. Monitor memory usage
4. Stop audio and check cleanup

**Expected Behavior:**
- ✅ Memory usage stabilizes
- ✅ No continuous growth
- ✅ Cleanup on audio stop
- ✅ No "sawtooth" memory pattern

**Test Cases:**
- [ ] Long playback session (10+ minutes)
- [ ] Switch modes repeatedly
- [ ] Load/unload files repeatedly
- [ ] Start/stop recording repeatedly

---

### 10.3 Console Logs (DEBUG Flags)
**Test Steps:**
1. Open browser console
2. Check for excessive logging
3. Verify DEBUG flags are off in production

**Expected Behavior:**
- ✅ Minimal console output (production mode)
- ✅ DEBUG flags disabled
- ✅ No performance impact from logging
- ✅ Only warnings/errors show

**Test Cases:**
- [ ] Check console on app launch
- [ ] Check console during playback
- [ ] Check console during recording
- [ ] Verify DevTools closed = better performance

**Known Issues to Watch:**
- ⚠️ FIXED: DEBUG flags system (verify cleanup)

---

## 🎨 11. COLOR PALETTE TESTING

### 11.1 Palette Selection
**Test Steps:**
1. Open color palette dropdown
2. Select each palette
3. Verify colors apply correctly

**Expected Behavior:**
- ✅ All palettes load instantly
- ✅ Colors apply to all visualization elements
- ✅ Smooth color transitions
- ✅ No color artifacts

**Test Cases:**
- [ ] Electric Blue (default)
- [ ] Cyberpunk Neon
- [ ] Sunset Gradient
- [ ] Ocean Waves
- [ ] Fire & Ice
- [ ] Test 10+ random palettes

---

## 🖼️ 12. CENTER IMAGE SYSTEM

### 12.1 Image Upload
**Test Steps:**
1. Click "Upload Image"
2. Select image file
3. Verify display

**Expected Behavior:**
- ✅ Image appears in center
- ✅ Drag-and-drop works
- ✅ Multiple images (up to 4)
- ✅ Image navigation (arrow keys)

**Test Cases:**
- [ ] PNG upload
- [ ] JPG upload
- [ ] GIF upload (animated)
- [ ] WebP upload
- [ ] Large image (>5MB)
- [ ] Star favorite images

---

### 12.2 Rotation Modes
**Test Steps:**
1. Upload center image
2. Select rotation mode
3. Observe behavior

**Expected Behavior:**
- ✅ **Static:** No rotation
- ✅ **Sync:** Rotates with visualization
- ✅ **Opposite:** Rotates opposite direction

**Test Cases:**
- [ ] Static rotation
- [ ] Sync rotation
- [ ] Opposite rotation

---

## 🎓 13. UI/UX TESTING

### 13.1 Landing Page
**Test Steps:**
1. Launch app
2. View landing page
3. Click "LAUNCH ORBITAL"

**Expected Behavior:**
- ✅ Logo displays
- ✅ Hero section clear
- ✅ Call-to-action prominent
- ✅ Smooth transition to app

**Test Cases:**
- [ ] Desktop view
- [ ] Tablet view (should block or adapt)
- [ ] Mobile view (should show blocker)

---

### 13.2 Intro Tutorial
**Test Steps:**
1. First-time user launches app
2. Tutorial overlay appears
3. Step through tutorial

**Expected Behavior:**
- ✅ Tutorial shows automatically
- ✅ Clear instructions
- ✅ Skip button works
- ✅ "Don't show again" persists

**Test Cases:**
- [ ] Complete tutorial
- [ ] Skip tutorial
- [ ] Disable "show on startup"

---

### 13.3 Mobile Blocker
**Test Steps:**
1. Open app on mobile device
2. Check for blocker message

**Expected Behavior:**
- ✅ Mobile blocker displays
- ✅ Clear message about desktop-only
- ✅ No app functionality on mobile

**Test Cases:**
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] iPad (may allow)

---

## 🐛 14. ERROR HANDLING

### 14.1 Audio Errors
**Test Steps:**
1. Deny microphone permission
2. Upload corrupted audio file
3. Disconnect audio during playback

**Expected Behavior:**
- ✅ Clear error messages
- ✅ Graceful fallback
- ✅ No app crash
- ✅ User can retry

**Test Cases:**
- [ ] Mic permission denied
- [ ] Invalid audio file
- [ ] Audio device disconnect
- [ ] Network error (demo tracks)

---

### 14.2 WebGL Errors
**Test Steps:**
1. Test on system without WebGL support
2. Trigger WebGL context loss

**Expected Behavior:**
- ✅ Compatibility warning displays
- ✅ Canvas fallback works (if available)
- ✅ Clear error message
- ✅ No white screen of death

**Test Cases:**
- [ ] WebGL unavailable
- [ ] WebGL context loss
- [ ] GPU driver crash

---

## 📝 15. BUG REPORTING TEMPLATE

When reporting bugs, please include:

**Bug Title:**
[Short descriptive title]

**Severity:**
- [ ] Critical (app crash, data loss)
- [ ] High (major feature broken)
- [ ] Medium (feature partially broken)
- [ ] Low (cosmetic, minor issue)

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Browser: [Chrome 125 / Firefox 115 / Safari 17]
- OS: [Windows 11 / macOS 14 / Linux Ubuntu 22.04]
- Screen Resolution: [1920x1080]
- GPU: [NVIDIA RTX 3060 / Integrated Graphics]

**Screenshots/Videos:**
[Attach if applicable]

**Console Errors:**
```
[Paste any console errors]
```

---

## ✅ BETA TESTING CHECKLIST

### **Audio Input**
- [ ] Microphone input works
- [ ] File upload works (MP3, WAV, OGG)
- [ ] Demo tracks play
- [ ] Audio levels display correctly

### **Visualization Modes**
- [ ] Electric Chaos renders correctly
- [ ] Particle Storm performs well
- [ ] Heatmap Bars shows frequencies
- [ ] Waveform Trails are smooth

### **Core Astral Shaper**
- [ ] 60+ shapes available
- [ ] Vertex-to-vertex morphing works (no crossfade)
- [ ] Uniform morph origin works
- [ ] Center morph origin works
- [ ] Polarity morph origin works
- [ ] Field modulation works

### **Beat Reactive Color FX**
- [ ] Hue Shift effect works
- [ ] Saturation Pulse works
- [ ] Brightness Flash works
- [ ] Spark Impact works (in Color FX section, not Outer Halo)
- [ ] Center Glow has NO strobe bug

### **Edge Fallback**
- [ ] Torus motion enhanced
- [ ] Shape Orbit Drift slider controls motion

### **Macro Knobs**
- [ ] All 8 macro knobs adjust their mapped parameters correctly
- [ ] Macro knob drag feels responsive (no lag/stutter)

### **Recording System**
- [ ] Recording works
- [ ] Resolution presets work (720p, 1080p, 1440p, 4K)
- [ ] FPS settings work (30, 60, 120)
- [ ] Keyboard shortcuts work (R, H, SPACE, F)

### **Presets**
- [ ] All 20 presets load correctly
- [ ] Export preset works
- [ ] Import preset works

### **MIDI**
- [ ] MIDI device detected
- [ ] CC mapping works
- [ ] Real-time control works

### **Performance**
- [ ] 55-65 FPS achieved
- [ ] No memory leaks
- [ ] DEBUG flags disabled (console clean)

### **UI/UX**
- [ ] Landing page works
- [ ] Intro tutorial works
- [ ] Mobile blocker works
- [ ] Error handling graceful

---

## 🎉 BETA TESTING COMPLETION

Once you've completed testing:

1. **Fill out feedback form** (link TBD)
2. **Report bugs** via GitHub Issues
3. **Share recordings** (optional, for showcase)
4. **Suggest improvements** in Discussions

**Thank you for beta testing ORBITAL! 🚀**

---

**Questions?** Contact: [Your contact method]