// ORBITAL - Color + BPM Adapt Section Component
// Extracted from App.tsx as part of PHASE 2 refactoring

import { memo } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { TapTempoControl } from './TapTempoControl';

interface ColorBPMSectionProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function ColorBPMSection({ collapsed, onToggleCollapse }: ColorBPMSectionProps) {
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
        <h3 style={{ color: 'var(--neonBlue)' }}>COLOR + BPM ADAPT</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetColorBPM?.();
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
            title="Reset Color + BPM to defaults"
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>
      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
          <div className="row">
            <div id="customPaletteDropdown" style={{ flex: 1, position: 'relative' }}>
              <button id="paletteBtn" className="select" style={{ width: '100%', textAlign: 'left', padding: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}>
                <span id="paletteLabel">Electric Blue</span>
                <ChevronDown size={10} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </button>
              <div id="paletteMenu" style={{ 
                display: 'none',
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'rgba(10, 15, 25, 0.98)',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                marginTop: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
              }}>
                {/* Options will be populated dynamically */}
              </div>
            </div>
            <button 
              id="fav" 
              className="btn star-btn" 
              title="Show/Hide favorites" 
              style={{ 
                width: '38px', 
                padding: '.35rem 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Star 
                size={18} 
                style={{ 
                  color: '#1E90FF',
                  fill: 'none',
                  strokeWidth: 2,
                  transition: 'fill 0.2s ease'
                }}
                className="star-icon"
              />
            </button>
          </div>
          <div className="row">
            <span className="label">Color Mode</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <label className="switch" title="Spectrum colors around the circle">
                <input id="spectrum" type="checkbox" /><span className="thumb"></span>
              </label>
              <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic' }}>Spectrum</span>
            </div>
          </div>
          <div className="row">
            <span className="label">Color Cycle</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <label className="switch" title="Cycle through favorite color schemes only">
                <input id="cycleSource" type="checkbox" /><span className="thumb"></span>
              </label>
              <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic' }}>Favorites</span>
            </div>
          </div>
          <div className="row">
            <span className="label">Auto Cycle</span>
            <label className="switch"><input id="auto" type="checkbox" defaultChecked /><span className="thumb"></span></label>
          </div>
          <div className="row control">
            <span className="label">Hue Speed</span>
            <input id="hueSpeed" type="range" min="0" max="3" step="0.1" defaultValue="1.0" />
          </div>
          <div className="row control">
            <span className="label">Iridize</span>
            <input id="iridize" type="range" min="0" max="1" step="0.01" defaultValue="0" />
          </div>
          <div className="row control">
            <span className="label">Gamma</span>
            <input id="gamma" type="range" min="0" max="1" step="0.01" defaultValue="0.0" />
          </div>
          <div className="bpm-section-divider" aria-hidden="true" />
          <div className="bpm-control-row">
            <span className="label bpm-control-label">BPM Sync</span>
            <label className="switch bpm-sync-switch" title="Synchronize color cycling and motion to the BPM clock">
              <input id="bpmSync" type="checkbox" defaultChecked aria-label="Enable BPM synchronization" />
              <span className="thumb"></span>
            </label>
            <div className="bpm-value-group" role="group" aria-label="BPM and beat count">
              <input
                id="bpm"
                className="number bpm-value-input"
                type="number"
                min="40"
                max="220"
                step="1"
                defaultValue="174"
                aria-label="Beats per minute"
                title="Beats per minute"
              />
              <span className="bpm-value-divider" aria-hidden="true" />
              <input
                id="bars"
                className="number bpm-bars-input"
                type="number"
                min="1"
                max="32"
                step="1"
                defaultValue="8"
                aria-label="Beat count"
                title="Beat count"
              />
            </div>
            <TapTempoControl />
          </div>
          
          <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', paddingTop: '12px' }}></div>
          
          {/* TIER 1: ENERGY GATE */}
          <div style={{ margin: '0', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
              ENERGY GATE: <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic', marginLeft: '6px' }}>Silence detection & graceful settling</span>
            </div>
            <div className="row">
              <span className="label" style={{ fontSize: '11px' }}>Enable</span>
              <label className="switch"><input id="energyGate" type="checkbox" defaultChecked={true} /><span className="thumb"></span></label>
            </div>
            <div className="row control">
              <span className="label" style={{ fontSize: '11px' }}>Threshold</span>
              <input id="energyThreshold" type="range" min="0.05" max="0.5" step="0.05" defaultValue="0.15" />
              <span style={{ fontSize: '8px', color: '#6b7280', marginLeft: '4px' }}>←Sensitive | Tolerant→</span>
            </div>
            <div className="row control">
              <span className="label" style={{ fontSize: '11px' }}>Release</span>
              <input id="energyRelease" type="range" min="0.1" max="1.0" step="0.1" defaultValue="0.5" />
              <span style={{ fontSize: '8px', color: '#6b7280', marginLeft: '4px' }}>←Fast | Slow→</span>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginBottom: '12px' }}></div>
          
          {/* BEAT DETECTION */}
          <div style={{ margin: '0' }}>
            <div style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>
              BEAT REACTIVE COLOR FX: <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: '400', fontStyle: 'italic', marginLeft: '6px' }}>Saturation breathing + rotating color zones</span>
            </div>
            <div className="row">
              <span className="label" style={{ fontSize: '11px' }}>Enable</span>
              <label className="switch"><input id="beatDetect" type="checkbox" /><span className="thumb"></span></label>
            </div>
            <div className="row control">
              <span className="label" style={{ fontSize: '11px' }}>Effect Amount</span>
              <input id="effectAmount" type="range" min="0" max="1" step="0.05" defaultValue="0.5" />
              <span style={{ fontSize: '8px', color: '#6b7280', marginLeft: '4px' }}>0% ←→ 100%</span>
            </div>
            <div className="row">
              <span className="label" style={{ fontSize: '11px' }}>Effect Type</span>
              <select id="beatPulseType" className="select" style={{ flex: 1 }} defaultValue="flash">
                <option value="flash">Saturation Burst</option>
                <option value="color">Color Wave</option>
                <option value="rainbow">Rainbow Canvas</option>
                <option value="spark">Spark Impact</option>
                <option value="dark-strobe">Dark Strobe</option>
                <option value="all">All Effects</option>
              </select>
            </div>

            <div className="row control" id="darkStrobeDepthControl" style={{ display: 'none' }}>
              <span className="label" style={{ fontSize: '11px' }}>Black Depth</span>
              <input id="darkStrobeDepth" type="range" min="0" max="1" step="0.01" defaultValue="0.65" title="Controls the opacity and depth of each black beat flash." />
            </div>
            <div className="row control" id="darkStrobeDisplacementControl" style={{ display: 'none' }}>
              <span className="label" style={{ fontSize: '11px' }}>Displacement</span>
              <input id="darkStrobeDisplacement" type="range" min="0" max="1" step="0.01" defaultValue="0.35" title="Adds horizontal black tear bands for sporadic glitch displacement." />
            </div>
            
            {/* Spark Impact Intensity Controls - Only visible when Spark Impact or All Effects selected */}
            <div className="row control" id="sparkAmpsControl" style={{ display: 'none' }}>
              <span className="label" style={{ fontSize: '11px' }}>Spark Intensity</span>
              <input id="sparkAmps" type="range" min="0" max="1" step="0.01" defaultValue="0.5" />
            </div>
            <div className="row control" id="sparkTrailControl" style={{ display: 'none' }}>
              <span className="label" style={{ fontSize: '11px' }}>Spark Trail</span>
              <input id="sparkTrail" type="range" min="0" max="1" step="0.01" defaultValue="0.5" />
            </div>
            <div className="row control" id="sparkDispersionControl" style={{ display: 'none' }}>
              <span className="label" style={{ fontSize: '11px' }}>Spark Dispersion</span>
              <input id="sparkDispersion" type="range" min="0" max="1" step="0.01" defaultValue="0.45" title="Low keeps comets near the halo; high sends them across and beyond the canvas." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedColorBPMSection = memo(ColorBPMSection);
export { MemoizedColorBPMSection as ColorBPMSection };
