import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { CENTER_COLOR_GRADES } from '../utils/centerColorGrades';

function CenterGraphicSettings() {
  return (
    <div className="section" style={{ background: '#1a1d23', border: '1px solid rgba(30,144,255,0.3)' }}>
      <div className="collapsible-header" onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const wrapper = e.currentTarget.nextElementSibling;
        const chevron = e.currentTarget.querySelector('.collapsible-chevron');
        if (wrapper && chevron) {
          wrapper.classList.toggle('collapsed');
          chevron.classList.toggle('collapsed');
        }
      }}>
        <h3 style={{ color: 'var(--neonBlue)' }}>CENTER GRAPHIC + CONTROLS</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetCenterGraphic?.();
            }}
            style={{
              fontSize: '14px',
              padding: '2px',
              background: 'transparent',
              border: 'none',
              color: 'var(--neonBlue)',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s',
              fontWeight: '400'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            title="Reset Center Graphic + Controls to defaults"
          >
            ↺
          </button>
          <ChevronDown className="collapsible-chevron" size={10} />
        </div>
      </div>
      <div className="collapsible-wrapper">
        <div className="row control"><span className="label">Media Fit</span><select id="centerMediaFitMode" className="select" defaultValue="auto" onChange={(e) => (window as any).centerGraphicController?.setActiveFitMode?.(e.target.value)}><option value="auto">Auto Fit</option><option value="contain">Contain</option><option value="cover">Cover</option><option value="logo">Logo Fit</option><option value="manual">Manual</option></select></div>
        <div className="collapsible-content">
          {/* Image Preview Grid */}
          <div style={{ marginTop: '0px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', justifyContent: 'space-between' }}>
              <span className="label">Graphic Preview:</span>
              <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic' }}>Click slot to upload • Use arrow keys or 1-6 to switch</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '5px' }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ position: 'relative' }}>
                  <div
                    id={`imagePreview${i}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      border: '1px dashed rgba(30,144,255,0.3)',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ color: 'rgba(30,144,255,0.5)', fontSize: '18px', fontWeight: '300' }}>+</div>
                  </div>
                  <button
                    id={`deleteImage${i}`}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '2px',
                      background: 'rgba(0,0,0,0.7)',
                      border: '1px solid rgba(255,50,50,0.5)',
                      color: '#ff5050',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0',
                      lineHeight: '1'
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="row">
            <button id="hideImage" className="btn" style={{ flex: 1, fontSize: '11px' }}>Hide Image</button>
            <label className="btn" htmlFor="centerImageInput" style={{ flex: 1, textAlign: 'center', fontSize: '11px' }}>Upload Image/Video</label>
            <input id="centerImageInput" type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.m4v" style={{ display: 'none' }} />
            <button id="clearCenterImage" className="btn" title="Clear image" style={{ padding: '.35rem .5rem' }}>🗑️</button>
          </div>

          {/* Photo / Video Effects Section - moved directly below upload controls */}
          <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', paddingTop: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--neonBlue)', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.5px' }}>PHOTO/VIDEO EFFECTS</div>
            <div className="row" style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 44px 68px', alignItems: 'center', gap: '8px' }}>
              <span className="label">Transitions</span>
              <select id="transitionType" className="select" style={{ fontSize: '11px', width: '100%', minWidth: 0 }}>
                <option value="fade">Fade</option>
                <option value="crossfade">Crossfade</option>
                <option value="zoom">Zoom</option>
                <option value="instant">Instant</option>
                <option value="flashZoom">Flash Zoom</option>
                <option value="pushFade">Push Fade</option>
                <option value="signalScan">Signal Scan</option>
                <option value="glitchCut">Glitch Cut</option>
              </select>
              <span className="label" style={{ fontSize: '10px', width: 'auto', minWidth: 'fit-content', justifySelf: 'end' }}>Speed</span>
              <select id="cycleSpeed" className="select" style={{ fontSize: '11px', width: '100%', minWidth: 0 }}>
                <option value="2000">2s</option>
                <option value="4000">4s</option>
                <option value="8000">8s</option>
              </select>
            </div>
            <div className="row">
              <span className="label">Color Style</span>
              <select id="centerImageColorGrade" className="select" style={{ flex: 1, fontSize: '11px' }}>
                {CENTER_COLOR_GRADES.map((grade) => (
                  <option key={grade.id} value={grade.id}>{grade.label}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <span className="label">Color Source</span>
              <select id="centerImageColorSource" className="select" defaultValue="master" style={{ flex: 1, fontSize: '11px' }}>
                <option value="master">Master Palette</option>
                <option value="center">Center Graphic Only</option>
                <option value="lut">LUT Driven</option>
                <option value="manual">Manual</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="row control"><span className="label">Zoom Level</span><input id="centerImageScale" type="range" min="0" max="150" step="1" defaultValue="12" /></div>
            <div className="row control"><span className="label">Opacity</span><input id="centerImageOpacity" type="range" min="0" max="1" step="0.01" defaultValue="1" /></div>
            <div className="row control"><span className="label">Saturation</span><input id="centerImageSaturation" type="range" min="0" max="2" step="0.01" defaultValue="1" /></div>
            <div className="row control"><span className="label">Hue Shift</span><input id="centerImageHueShift" type="range" min="0" max="180" step="1" defaultValue="0" /></div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 40px 58px 40px 58px 40px',
                columnGap: '8px',
                rowGap: '6px',
                alignItems: 'center',
                marginTop: '8px'
              }}
            >
              <span className="label" style={{ width: 'auto', fontSize: '10px', minWidth: 0 }}>Auto Hue</span>
              <label className="switch"><input id="centerImageHueShiftAuto" type="checkbox" /><span className="thumb"></span></label>
              <span className="label" style={{ width: 'auto', fontSize: '10px', minWidth: 0, textAlign: 'right' }}>Reactive</span>
              <label className="switch"><input id="centerImageReactive" type="checkbox" defaultChecked /><span className="thumb"></span></label>
              <span className="label" style={{ width: 'auto', fontSize: '10px', minWidth: 0, textAlign: 'right' }}>A.Cycle</span>
              <label className="switch"><input id="autoCycle" type="checkbox" /><span className="thumb"></span></label>
            </div>
          </div>

          {/* Motion FX Section */}
          <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', paddingTop: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--neonBlue)', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.5px' }}>MOTION FX</div>
            <input id="centerImageMotionProfile" type="hidden" value="static" readOnly />
            <input id="centerImageMotionAudio" type="hidden" value="false" readOnly />
            <input id="centerImageKenBurns" type="hidden" value="false" readOnly />
            <input id="centerImageKenBurnsSpeed" type="hidden" value="0.5" readOnly />
            <div className="row" style={{ gap: '8px' }}>
              <span className="label">Motion Type</span>
              <select id="centerImageMotionType" className="select" style={{ flex: 1, fontSize: '11px' }}>
                <option value="none">None</option>
                <optgroup label="Ambient Motion">
                  <option value="slowDrift">Slow Drift</option>
                  <option value="verticalFloat">Vertical Float</option>
                  <option value="horizontalFloat">Horizontal Float</option>
                  <option value="orbitDrift">Orbit Drift</option>
                  <option value="organicDrift">Organic Flow</option>
                  <option value="hologramDrift">Hologram Shimmer</option>
                  <option value="pendulumSwing">Pendulum Swing</option>
                </optgroup>
                <optgroup label="Cinematic Motion">
                  <option value="kenBurnsDrift">Ken Burns Drift</option>
                  <option value="cinematicZoom">Cinematic Zoom</option>
                  <option value="cinematicPush">Cinematic Push</option>
                  <option value="breathingZoom">Breathing Zoom</option>
                  <option value="logoRevealLoop">Logo Reveal Loop</option>
                  <option value="rockBack">Rock Back</option>
                </optgroup>
                <optgroup label="Transition / Broadcast">
                  <option value="downSlide">Down Slide</option>
                  <option value="fallTicker">Fall Ticker</option>
                  <option value="tickerScroll">Ticker Scroll L→R</option>
                  <option value="broadcastSweep">Broadcast Sweep R→L</option>
                  <option value="sideSweep">Side Sweep</option>
                  <option value="popIn">Pop In</option>
                </optgroup>
                <optgroup label="FX / Reactive">
                  <option value="glitchSnap">Glitch Snap</option>
                  <option value="shakeBurst">Shake Burst</option>
                  <option value="dataCorruption">Data Corruption</option>
                  <option value="digitalSkip">Digital Skip</option>
                  <option value="pulseBurst">Pulse Burst</option>
                  <option value="microJitter">Micro Jitter</option>
                  <option value="beatPunch">Beat Punch</option>
                  <option value="signalLock">Signal Lock</option>
                </optgroup>
              </select>
            </div>
            <div className="row control"><span className="label">Motion Speed</span><input id="centerImageMotionAmount" type="range" min="0" max="1" step="0.01" defaultValue="0" /></div>
            <div className="row control"><span className="label">Motion Intensity</span><input id="centerImageMotionIntensity" type="range" min="0" max="1" step="0.01" defaultValue="0" /></div>
            <div className="row control"><span className="label">Displacement</span><input id="centerImageDisplacement" type="range" min="0" max="100" step="1" defaultValue="0" /></div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 40px 58px 40px 58px 40px',
                columnGap: '8px',
                rowGap: '6px',
                alignItems: 'center',
                marginTop: '8px'
              }}
            >
              <span className="label" style={{ fontSize: '10px', width: 'auto', minWidth: 0 }}>Rotation</span>
              <label className="switch"><input id="centerImageAutoRotate" type="checkbox" /><span className="thumb"></span></label>
              <span className="label" style={{ fontSize: '10px', width: 'auto', minWidth: 0, textAlign: 'right' }}>X Drift</span>
              <label className="switch"><input id="centerImageXDrift" type="checkbox" /><span className="thumb"></span></label>
              <span className="label" style={{ fontSize: '10px', width: 'auto', minWidth: 0, textAlign: 'right' }}>Y Drift</span>
              <label className="switch"><input id="centerImageYDrift" type="checkbox" /><span className="thumb"></span></label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedCenterGraphicSettings = memo(CenterGraphicSettings);
export { MemoizedCenterGraphicSettings as CenterGraphicSettings };