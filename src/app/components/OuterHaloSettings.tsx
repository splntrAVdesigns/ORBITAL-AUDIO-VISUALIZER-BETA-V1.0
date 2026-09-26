import { memo, useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { defaultParams } from '../config/defaultParams';

interface OuterHaloSettingsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function OuterHaloSettings({ collapsed, onToggleCollapse }: OuterHaloSettingsProps) {
  const [cometDirection, setCometDirectionState] = useState<-1 | 1>(defaultParams.haloCometDirection);

  useEffect(() => {
    const input = document.getElementById('haloCometDirection') as HTMLInputElement | null;
    if (!input) return;
    const syncDirection = () => setCometDirectionState(Number(input.value) < 0 ? -1 : 1);
    syncDirection();
    input.addEventListener('input', syncDirection);
    input.addEventListener('change', syncDirection);
    return () => {
      input.removeEventListener('input', syncDirection);
      input.removeEventListener('change', syncDirection);
    };
  }, []);

  const setCometDirection = useCallback((direction: -1 | 1) => {
    const input = document.getElementById('haloCometDirection') as HTMLInputElement | null;
    if (!input) return;
    input.value = String(direction);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  return (
    <div className="section">
      <div 
        className="collapsible-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onToggleCollapse();
        }}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onToggleCollapse();
        }}
        style={{ marginBottom: '4px' }}
      >
        <h3>Outer Halo + Inner Core</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetOuterHaloCenterLayer?.();
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
            title="Reset Outer Halo + Inner Core to defaults"
            aria-label="Reset Outer Halo + Inner Core to defaults"
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>
      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
      <div className="row control"><span className="label">Halo</span><input id="halo" type="range" min="0" max="1.5" step="0.01" defaultValue="1.0" /></div>
      <div className="row control"><span className="label">Bloom</span><input id="bloom" type="range" min="0" max="1.0" step="0.01" defaultValue="0.5" /></div>
      
      {/* 🌟 ORBITAL ENERGY - Animated pulse traveling around halo; grouped with Halo/Bloom */}
      <div className="row control"><span className="label">Orbital Energy</span><input id="orbitalEnergy" type="range" min="0" max="2.0" step="0.01" defaultValue="0" /></div>
      <div className="row control"><span className="label">Pulse Width</span><input id="orbitalWidth" type="range" min="0.1" max="1.5" step="0.01" defaultValue="0.3" /></div>
      <div className="row">
        <span className="label">Counter-Clockwise</span>
        <label className="switch"><input id="orbitalDirection" type="checkbox" /><span className="thumb"></span></label>
      </div>

      <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
      <div className="row">
        <span className="label" style={{ color: 'var(--neonBlue)', fontWeight: 800, letterSpacing: '0.04em' }}>Halo Comet</span>
        <label className="switch"><input id="haloCometEnabled" type="checkbox" defaultChecked={defaultParams.haloCometEnabled} /><span className="thumb"></span></label>
      </div>
      <div className="row control"><span className="label">Speed</span><input id="haloCometSpeed" type="range" min="0.05" max="1" step="0.01" defaultValue={defaultParams.haloCometSpeed} /></div>

      <div className="row" style={{ alignItems: 'center' }}>
        <span className="label">Direction</span>
        <input id="haloCometDirection" type="hidden" defaultValue={defaultParams.haloCometDirection} />
        <div style={{ display: 'flex', gap: '4px' }} role="group" aria-label="Halo Comet direction">
          {([[-1, 'LEFT'], [1, 'RIGHT']] as const).map(([direction, label]) => {
            const active = cometDirection === direction;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setCometDirection(direction)}
                aria-pressed={active}
                style={{
                  minWidth: '48px',
                  fontSize: '9px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(30,144,255,0.28)',
                  background: active ? 'rgba(30,144,255,0.88)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                  letterSpacing: '0.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row control"><span className="label">Thickness</span><input id="haloCometThickness" type="range" min="1" max="10" step="0.25" defaultValue={defaultParams.haloCometThickness} /></div>
      <div className="row control"><span className="label">Tail Length</span><input id="haloCometTailLength" type="range" min="0.05" max="0.65" step="0.01" defaultValue={defaultParams.haloCometTailLength} /></div>

      <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
      <div className="row">
        <span className="label" style={{ color: 'var(--neonBlue)', fontWeight: 800, letterSpacing: '0.04em' }}>Halo Strobe</span>
        <label className="switch"><input id="haloStrobeEnabled" type="checkbox" defaultChecked={defaultParams.haloStrobeEnabled} /><span className="thumb"></span></label>
      </div>
      <div className="row control">
        <span className="label">Rate</span>
        <select id="haloStrobeDivision" className="select" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} defaultValue={defaultParams.haloStrobeDivision}>
          <option value="1/1">1/1 (Bar)</option>
          <option value="1/2">1/2 (Half)</option>
          <option value="1/4">1/4 (Quarter)</option>
          <option value="1/8">1/8 (Eighth)</option>
        </select>
      </div>

      <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
      <div className="row">
        <span className="label" style={{ color: 'var(--neonBlue)', fontWeight: 800, letterSpacing: '0.04em' }}>Center Glow</span>
        <label className="switch"><input id="glowCenter" type="checkbox" /><span className="thumb"></span></label>
      </div>
      <div className="row control"><span className="label">Glow Strength</span><input id="glowStrength" type="range" min="0" max="1" step="0.01" defaultValue="0.8" /></div>
      <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '12px', marginBottom: '12px' }}></div>
      <div className="row">
        <span className="label" style={{ color: 'var(--neonBlue)', fontWeight: 800, letterSpacing: '0.04em' }}>Shockwave Rings</span>
        <label className="switch"><input id="shockwave" type="checkbox" /><span className="thumb"></span></label>
      </div>
      <div className="row control"><span className="label">Threshold</span><input id="shockwaveThreshold" type="range" min="0" max="2" step="0.01" defaultValue="0.7" /></div>
      <div className="row control"><span className="label">Ring Count</span><input id="shockwaveRings" type="range" min="1" max="5" step="1" defaultValue="3" /></div>
      <div className="row control"><span className="label">Speed</span><input id="shockwaveSpeed" type="range" min="0.1" max="3" step="0.1" defaultValue="1.0" /></div>
      <div className="row control"><span className="label">Decay</span><input id="shockwaveDecay" type="range" min="0.5" max="0.99" step="0.01" defaultValue="0.85" /></div>
      
      {/* 🔧 SPARK IMPACT MOVED: Now in Beat Reactive Color FX section as "Effect Type" */}

      </div>
      </div> {/* End collapsible-wrapper for Outer Halo section */}
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedOuterHaloSettings = memo(OuterHaloSettings);
export { MemoizedOuterHaloSettings as OuterHaloSettings };
