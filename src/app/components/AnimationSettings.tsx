import { memo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { applyMotionControlPreset } from '../controllers/motionControlsController';

interface AnimationSettingsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const BTN_BASE: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  borderRadius: '4px',
  fontSize: '10px',
  fontWeight: '600',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  background: 'transparent',
  border: 'none',
  transition: 'color 0.15s',
};

function AnimationSettings({ collapsed, onToggleCollapse }: AnimationSettingsProps) {
  const [activePreset, setActivePreset] = useState<'subtle' | 'balanced' | 'aggressive' | null>(null);
  const [macro2Active, setMacro2Active] = useState(false);
  const [motionBlurPersistenceValue, setMotionBlurPersistenceValue] = useState(0.35);

  useEffect(() => {
    const slider = document.getElementById('motionIntensity') as HTMLInputElement | null;
    if (!slider) return;
    const sync = () => {
      const v = parseFloat(slider.value);
      if (v <= 0.35) setActivePreset('subtle');
      else if (v >= 0.67) setActivePreset('aggressive');
      else setActivePreset('balanced');
    };
    slider.addEventListener('input', sync);
    return () => slider.removeEventListener('input', sync);
  }, []);

  useEffect(() => {
    // setMacroSlider never dispatches input events, so listening to #macro2-hidden 'input'
    // events misses most updates. Instead observe the fill element's --knob-angle CSS variable:
    // it's updated by both user drag and programmatic setProperty() calls.
    const fill = document.getElementById('macro2-fill');
    if (!fill) return;
    const check = () => {
      const angle = parseFloat((fill as HTMLElement).style.getPropertyValue('--knob-angle') || '0');
      setMacro2Active(angle > 0);
    };
    const obs = new MutationObserver(check);
    obs.observe(fill, { attributes: true, attributeFilter: ['style'] });
    return () => obs.disconnect();
  }, []);


  useEffect(() => {
    const slider = document.getElementById('motionBlurPersistence') as HTMLInputElement | null;
    if (!slider) return;

    const sync = () => {
      const next = Number.parseFloat(slider.value);
      if (Number.isFinite(next)) setMotionBlurPersistenceValue(next);
    };

    sync();
    slider.addEventListener('input', sync);
    slider.addEventListener('change', sync);
    return () => {
      slider.removeEventListener('input', sync);
      slider.removeEventListener('change', sync);
    };
  }, []);

  const presetStyle = (preset: 'subtle' | 'balanced' | 'aggressive'): React.CSSProperties => ({
    ...BTN_BASE,
    color: activePreset === preset ? '#1E90FF' : '#7a94aa',
  });

  return (
    <div className="section" style={{ background: '#1a1d23', border: '1px solid rgba(30,144,255,0.3)' }}>
      <div 
        className="collapsible-header" 
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onToggleCollapse();
        }}
        style={{ marginBottom: '4px' }}
      >
        <h3 style={{ color: 'var(--neonBlue)' }}>MOTION CONTROLS</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            id="resetToDefaults" 
            onClick={(e) => {
              e.stopPropagation();
              // resetToDefaults is called by id, so this button will still work
            }}
            title="Reset all sliders to default values"
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
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>
      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
      {/* Sprint 21B: User-Controlled Reactivity Routing */}
      <div style={{ border: '1px solid rgba(30,144,255,0.18)', borderRadius: '6px', padding: '8px', marginBottom: '10px', background: 'rgba(30,144,255,0.045)' }}>
        <div style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '800', marginBottom: '4px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>REACTIVITY ROUTING:</span>
          <span id="reactivityModeBadge" style={{ fontSize: '8px', color: '#a7d8ff', fontWeight: '700' }}>Layer Smart</span>
          <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic' }}>Instant hits + smooth motion balance</span>
        </div>
        <div className="row" style={{ gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
          <span className="label" style={{ fontSize: '11px' }}>Mode</span>
          <select id="reactivityMode" className="select" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '10px', padding: '4px 6px' }} defaultValue="hybrid" title="Controls how audio energy is routed across visual layers">
            <option value="hybrid">Hybrid / Layer Smart</option>
            <option value="instant">Instant / Punchy</option>
            <option value="smooth">Smooth / Cinematic</option>
            <option value="manual">Manual Blend</option>
          </select>
          <span className="label" style={{ fontSize: '10px', width: '18px', minWidth: '18px', textAlign: 'right' }}>Hz</span>
          <select id="reactivityHz" className="select" style={{ flex: '0 0 62px', width: '62px', fontSize: '10px', padding: '4px 5px' }} defaultValue="60" title="Audio-reactivity update rate. Visual rendering remains display-rate.">
            <option value="30">30 Hz</option>
            <option value="60">60 Hz</option>
          </select>
        </div>
        <div className="row control" style={{ marginBottom: 0 }}>
          <span className="label" style={{ fontSize: '11px' }}>Blend</span>
          <input id="reactivityBlend" type="range" min="0" max="1" step="0.01" defaultValue="0.45" title="Manual Blend: left = instant/transient, right = smooth/cinematic" />
          <span style={{ fontSize: '8px', color: '#6b7280', marginLeft: '4px', whiteSpace: 'nowrap' }}>Instant ←→ Smooth</span>
        </div>
      </div>

      {/* MOTION INTENSITY PRESETS — React-controlled active state, no DOM/className conflict */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '8px',
        background: 'rgba(30,144,255,0.05)',
        borderRadius: '6px',
        padding: '3px',
        border: '1px solid rgba(30,144,255,0.2)',
      }}>
        <button
          data-motion="0.20"
          onClick={() => { setActivePreset('subtle'); applyMotionControlPreset('subtle'); }}
          style={presetStyle('subtle')}
        >
          SUBTLE
        </button>
        <button
          data-motion="0.50"
          onClick={() => { setActivePreset('balanced'); applyMotionControlPreset('balanced'); }}
          style={presetStyle('balanced')}
        >
          BALANCED
        </button>
        <button
          data-motion="0.85"
          onClick={() => { setActivePreset('aggressive'); applyMotionControlPreset('aggressive'); }}
          style={presetStyle('aggressive')}
        >
          AGGRESSIVE
        </button>
      </div>
      <div className="row control"><span className="label">Motion Intensity</span><input id="motionIntensity" type="range" min="0" max="1" step="0.01" defaultValue="0.4" /></div>
      
      {/* Motion Smoothing Slider - Unified timing control for Core Particles */}
      <div className="row control">
        <span className="label">Motion Smoothing</span>
        <input id="motionSmoothing" type="range" min="0" max="1" step="0.01" defaultValue="0.35" title="Controls attack/decay timing across all layers (0=snappy, 1=smooth)" />
      </div>
      
      {/* Bass Boost Slider */}
      <div className="row control">
        <span className="label">Bass Boost</span>
        <input id="bassBoost" type="range" min="0" max="1" step="0.01" defaultValue="0.50" />
      </div>
      
      {/* Freq Smoothing & Beat Boost Toggles */}
      <div
        className="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '110px 40px 88px 40px',
          alignItems: 'center',
          columnGap: '8px',
          maxWidth: '100%',
          marginTop: '8px',
        }}
      >
        <span className="label" style={{ fontSize: '10px', width: '110px' }}>Freq Smoothing</span>
        <label className="switch" style={{ justifySelf: 'start' }}>
          <input id="frequencySmoothing" type="checkbox" defaultChecked />
          <span className="thumb"></span>
        </label>
        <span className="label" style={{ fontSize: '10px', width: '88px', marginLeft: '22px' }}>Beat Boost</span>
        <label className="switch" style={{ justifySelf: 'start', marginLeft: '22px' }}>
          <input id="beatReactivityBoost" type="checkbox" />
          <span className="thumb"></span>
        </label>
      </div>
      
      {/* Scroll Zoom & Auto Zoom Toggles */}
      <div
        className="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '110px 40px 88px 40px',
          alignItems: 'center',
          columnGap: '8px',
          maxWidth: '100%',
          marginBottom: '12px',
        }}
      >
        <span className="label" style={{ fontSize: '10px', width: '110px' }}>Scroll Zoom</span>
        <label className="switch" style={{ justifySelf: 'start' }}>
          <input id="zoomToggle" type="checkbox" />
          <span className="thumb"></span>
        </label>
        <span className="label" style={{ fontSize: '10px', width: '88px', marginLeft: '22px' }}>Auto Zoom</span>
        <label className="switch" style={{ justifySelf: 'start', marginLeft: '22px' }}>
          <input id="autoZoom" type="checkbox" />
          <span className="thumb"></span>
        </label>
      </div>
      
      <div className="row control"><span className="label">Chaos</span><input id="chaos" type="range" min="0" max="1" step="0.01" defaultValue="0" /></div>

      {/* Motion Blur — existing runtime trail control exposed as one aligned row. */}
      <div className="row control" style={{ flexWrap: 'nowrap' }}>
        <span className="label">Motion Blur</span>
        <label className="switch" style={{ flex: '0 0 40px' }} title="Enable motion blur trails">
          <input id="motionBlurEnabled" type="checkbox" />
          <span className="thumb"></span>
        </label>
        <input
          id="motionBlurPersistence"
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue="0.35"
          aria-label="Motion Blur Intensity"
          title="Motion Blur Intensity — higher values create stronger, longer trails"
        />
        <span
          className="slider-value"
          style={{
            marginLeft: '8px',
            color: '#1E90FF',
            fontSize: '10px',
            fontWeight: 600,
            minWidth: '45px',
            display: 'inline-block',
            textAlign: 'right',
            flex: '0 0 45px',
          }}
        >
          {Math.round(motionBlurPersistenceValue * 100)}%
        </span>
      </div>
      
      {/* Line break above Rotation Sync */}
      <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', paddingTop: '12px' }}></div>
      
      {/* TIER 1: ROTATION SYNC - styled like Energy Gate */}
      <div style={{ margin: '0', marginBottom: '0' }}>
        <div style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            ROTATION SYNC:
            {macro2Active && (
              <span title="Driven by Macro 2 — MOTION" style={{
                display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%',
                background: '#1E90FF', boxShadow: '0 0 4px #1E90FF', flexShrink: 0,
              }} />
            )}
            <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic' }}>Rhythm-locked rotation</span>
          </span>
          <button 
            onClick={() => (window as any).resetRotationSync?.()}
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
            title="Reset Rotation Sync to defaults"
          >
            ↺
          </button>
        </div>
        <div className="row" style={{ gap: '4px', marginBottom: '6px' }}>
          <select id="rotationSyncMode" className="select" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} defaultValue="free">
            <option value="free">Free (Manual)</option>
            <option value="bpm">BPM Sync</option>
            <option value="quantized">Quantized</option>
            <option value="pingpong">Ping Pong</option>
            <option value="oscillator">Oscillator</option>
          </select>
          <select id="rotationQuantize" className="select" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} defaultValue="2/1">
            <option value="4/1">4/1 (4 Bars)</option>
            <option value="2/1">2/1 (2 Bars)</option>
            <option value="1/1">1/1 (Bar)</option>
            <option value="1/2">1/2 (Half)</option>
            <option value="1/4">1/4 (Quarter)</option>
          </select>
        </div>
        <div className="row control">
          <span className="label" style={{ fontSize: '11px' }}>Rotation Speed</span>
          <input id="rot" type="range" min="-2" max="2" step="0.01" defaultValue="0.00" />
        </div>
      </div>
      </div>
      </div> {/* End collapsible-wrapper for Animation section */}
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedAnimationSettings = memo(AnimationSettings);
export { MemoizedAnimationSettings as AnimationSettings };