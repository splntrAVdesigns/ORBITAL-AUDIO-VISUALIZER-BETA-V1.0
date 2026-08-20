/**
 * Liquid Shaper Settings Panel Component
 * Extracted from App.tsx to reduce file size and improve code organization
 * WebGL-powered sacred geometry morphing engine
 * ENHANCED: Reorganized UI layout, Energy Glow as slider, improved control ranges
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AstralShaperSettingsProps {
  onReset?: () => void;
  onResetAutoCycle?: () => void;
}

function AstralShaperSettings({ onReset, onResetAutoCycle }: AstralShaperSettingsProps) {
  return (
    <div className="section" style={{ background: '#1a1d23', border: '1px solid rgba(138,43,226,0.3)' }}>
      <div className="collapsible-header" onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const wrapper = e.currentTarget.nextElementSibling;
        const chevron = e.currentTarget.querySelector('.collapsible-chevron');
        if (wrapper && chevron) {
          wrapper.classList.toggle('collapsed');
          chevron.classList.toggle('collapsed');
        }
      }}>
        <h3 style={{ color: '#BA55D3' }}>LIQUID SHAPER</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              // 🐛 BUG FIX (Beta cleanup): this previously only called the optional onReset
              // prop, which ControlPanel.tsx never supplied — clicking this button did
              // nothing, silently. Now calls window.resetAstralShaper directly, matching
              // every other settings section's reset button. Still calls onReset too, in
              // case a future caller ever does supply it.
              (window as any).resetAstralShaper?.();
              onReset?.();
            }}
            title="Reset Liquid Shaper to defaults (disable & reset all controls)"
            style={{ 
              fontSize: '14px', 
              padding: '2px',
              background: 'transparent',
              border: 'none',
              color: '#BA55D3',
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
          <ChevronDown className="collapsible-chevron collapsed" size={10} />
        </div>
      </div>
      <div className="collapsible-wrapper collapsed">
        <div className="collapsible-content">
        {/* Enable Toggle */}
        <div className="row">
          <span className="label">Enable Shaper</span>
          <label className="switch"><input id="astralShaper" type="checkbox" /><span className="thumb"></span></label>
          <span style={{ fontSize: '9px', color: '#BA55D3', fontStyle: 'italic', marginLeft: '12px' }}>audio-reactive geometry shapes</span>
        </div>
        
        <div style={{ borderTop: '1px solid rgba(138,43,226,0.2)', marginTop: '8px', marginBottom: '12px' }}></div>
        
        {/* Shape Selection & Auto-Cycle */}
        <div
          className="row"
          style={{
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div style={{ fontSize: '10px', color: '#BA55D3', fontWeight: '800', letterSpacing: '0.5px', flex: 1 }}>
            SHAPE & MORPHING
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span className="label" style={{ flex: '0 0 auto' }}>Auto-Cycle</span>
            <label className="switch"><input id="astralAutoCycle" type="checkbox" defaultChecked /><span className="thumb"></span></label>
          </div>
          <button
            id="resetAutoCycle"
            title="Reset Auto-Cycle (restart from first shape)"
            style={{
              fontSize: '14px',
              padding: '2px',
              background: 'transparent',
              border: 'none',
              color: '#BA55D3',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            ↺
          </button>
        </div>

        <div className="row" style={{ gap: '4px', marginBottom: '8px' }}>
          <select id="astralShape" className="select" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} defaultValue="sg-vesica-chain">
            <optgroup label="═══ Sacred Geometry ═══">
              <option value="sg-vesica-chain">SG: Vesica Chain</option>
              <option value="sg-sri-yantra">SG: Sri Yantra</option>
              <option value="sg-merkaba">SG: Merkaba Wireframe</option>
              <option value="sg-dodecahedron">SG: Dodecahedron Wireframe</option>
              <option value="sg-metatron-cube">SG: Metatron's Cube</option>
            </optgroup>
            <optgroup label="═══ Kaleidoscope & Symmetry ═══">
              <option value="kx-polar-wedge">KX: Polar Wedge</option>
              <option value="kx-rosette">KX: Rosette</option>
              <option value="kx-mirror-hex">KX: Mirror Hex</option>
              <option value="kx-mandala-rings">KX: Mandala Rings</option>
              <option value="kx-dihedral">KX: Dihedral Symmetry</option>
            </optgroup>
            <optgroup label="═══ Flow Curves ═══">
              <option value="fx-guilloche-ribbon">FX: Guilloché Ribbon Rings</option>
              <option value="fx-lissajous">FX: Lissajous Knot</option>
            </optgroup>
            <optgroup label="═══ Glyph & Rune ═══">
              <option value="gl-runic-ring">GL: Runic Ring</option>
              <option value="gl-compass-rose">GL: Compass Rose</option>
              <option value="gl-circuit-glyph">GL: Circuit Glyph</option>
              <option value="gl-lotus-mandala">GL: Lotus Mandala</option>
            </optgroup>
            <optgroup label="═══ Geometric Standard (VJ) ═══">
              <option value="vj-orbital-nodes">VJ: Orbital Nodes + Links</option>
              <option value="vj-hex-grid">VJ: Wire Hex Grid</option>
              <option value="vj-concentric-squares">VJ: Concentric Squares</option>
              <option value="vj-star-polygon">VJ: Star Polygon</option>
            </optgroup>
          </select>
          <select id="astralCycleSpeed" className="select" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} defaultValue="slow">
            <option value="slug">Slug (32 beats)</option>
            <option value="slow">Slow (24 beats)</option>
            <option value="medium">Medium (16 beats)</option>
            <option value="fast">Fast (8 beats)</option>
            <option value="chaos">Chaos (4 beats)</option>
          </select>
        </div>
        
        <div style={{ borderTop: '1px solid rgba(138,43,226,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
        
        {/* Geometry Properties - MOVED TO TOP */}
        <div style={{ fontSize: '10px', color: '#BA55D3', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
          GEOMETRY PROPERTIES
        </div>
        
        <div className="row control"><span className="label">Line Thickness</span><input id="astralLineThickness" type="range" min="0.5" max="4" step="0.1" defaultValue="1.0" title="Stroke width of geometry lines (0.5-4 pixels)" /></div>
        <div className="row control"><span className="label">Scale</span><input id="astralScale" type="range" min="0.3" max="1.5" step="0.05" defaultValue="1" title="Overall size multiplier for geometry" /></div>
        
        <div className="row" style={{ marginBottom: '6px' }}>
          <span className="label">Stroke Style</span>
          <select id="astralStrokeStyle" className="select" style={{ flex: 1 }} defaultValue="solid" title="Line rendering style - solid, dashed, dotted, or glowing">
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="glowing">Glowing</option>
          </select>
        </div>
        
        <div className="row" style={{ marginBottom: '6px' }}>
          <span className="label">Symmetry Fold</span>
          <select id="astralSymmetryFold" className="select" style={{ flex: 1 }} defaultValue="6" title="Radial symmetry count - how many times the pattern repeats around center">
            <option value="3">3-Fold</option>
            <option value="6">6-Fold</option>
            <option value="8">8-Fold</option>
            <option value="12">12-Fold</option>
          </select>
        </div>
        
        <div
          style={{
            margin: '6px 0 6px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap'
          }}
        >
          <span className="label" style={{ flex: '0 0 110px' }}>Kaleidoscope</span>
          <label className="switch" style={{ flex: '0 0 40px' }}><input id="astralKaleidoscope" type="checkbox" /><span className="thumb"></span></label>
          <span style={{ flex: '0 0 30px' }} />
          <span style={{ color: '#8ea4bd', fontWeight: 650, fontSize: '12px', flex: '0 0 auto' }}>Depth Effect</span>
          <label className="switch" style={{ flex: '0 0 40px', marginLeft: '8px' }}><input id="astralDepthEffect" type="checkbox" defaultChecked /><span className="thumb"></span></label>
        </div>
        
        <div style={{ borderTop: '1px solid rgba(138,43,226,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
        
        {/* Liquid Metal Morphing Controls */}
        <div style={{ fontSize: '10px', color: '#BA55D3', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
          LIQUID MORPHING
        </div>

        <div className="row control">
          <span className="label">Morph Amount</span>
          <input
            id="astralMorphAmount"
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0"
            title="Manual morph control - blend between shapes (disable Auto-Cycle to use)"
          />
        </div>
        
        <div className="row control">
          <span className="label">Morph Damping</span>
          <input
            id="astralMorphDamping"
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.5"
            title="Smoothing for morph transitions - higher values = smoother (works with Auto-Cycle)"
          />
        </div>

        <div className="row control">
          <span className="label">Liquid Distortion</span>
          <input
            id="astralFieldModulation"
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0"
            title="Noise-based distortion strength - creates flowing liquid effect"
          />
        </div>
          
        <div style={{ borderTop: '1px solid rgba(138,43,226,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
        
        {/* Reactivity & Animation - MERGED SECTION */}
        <div style={{ fontSize: '10px', color: '#BA55D3', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
          REACTIVITY & ANIMATION
        </div>
        
        <div className="row control"><span className="label">Audio Influence</span><input id="astralAudioInfluence" type="range" min="0" max="1" step="0.01" defaultValue="0.3" title="How much audio energy affects the visuals" /></div>
        <div className="row control"><span className="label">Pulse Depth</span><input id="astralPulseDepth" type="range" min="0" max="1" step="0.01" defaultValue="0.5" title="Breathing/pulsing intensity with audio beats" /></div>
        <div className="row control"><span className="label">Rotation Multiplier</span><input id="astralRotationMult" type="range" min="0" max="4" step="0.1" defaultValue="0.5" title="Scales Liquid Shaper rotation against the main motion angle" /></div>
        <div className="row control"><span className="label">Rotation Jitter</span><input id="astralRotationJitter" type="range" min="0" max="1" step="0.01" defaultValue="0" /></div>
        
        <div className="row" style={{ marginBottom: '6px' }}>
          <span className="label">Rotation Speed Mod</span>
          <label className="switch"><input id="astralRotationSpeedMod" type="checkbox" /><span className="thumb"></span></label>
        </div>
          
        <div style={{ borderTop: '1px solid rgba(138,43,226,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
        
        {/* Visual Effects */}
        <div style={{ fontSize: '10px', color: '#BA55D3', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
          VISUAL EFFECTS
        </div>
        
        <div
          style={{
            margin: '6px 0 8px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap'
          }}
        >
          <span className="label" style={{ flex: '0 0 110px' }}>Global Color</span>
          <label className="switch" style={{ flex: '0 0 40px' }}><input id="astralUseGlobalColor" type="checkbox" defaultChecked /><span className="thumb"></span></label>
          <span style={{ flex: '0 0 30px' }} />
          <span style={{ color: '#8ea4bd', fontWeight: 650, fontSize: '12px', flex: '0 0 auto' }}>Color Spectrum</span>
          <label className="switch" style={{ flex: '0 0 40px', marginLeft: '8px' }}><input id="astralRainbowSpectrum" type="checkbox" /><span className="thumb"></span></label>
        </div>

        <div className="row control">
          <span className="label">Energy Glow</span>
          <input 
            id="astralEnergyGlow" 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            defaultValue="0" 
            title="Glow intensity that intensifies with audio energy - 0 = off, 1 = maximum" 
          />
        </div>        
      </div>
      </div>
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedAstralShaperSettings = React.memo(AstralShaperSettings);
export { MemoizedAstralShaperSettings as AstralShaperSettings };
