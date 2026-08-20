import { memo } from 'react';
import { ChevronDown } from 'lucide-react';

interface DotsSettingsProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  embedded?: boolean;
}

function DotsControls() {
  return (
    <>
      <div className="row">
        <span className="label">Activate Dots</span>
        <label className="switch"><input id="dotsOn" type="checkbox" defaultChecked /><span className="thumb"></span></label>
        <span className="label" style={{ width: 'auto', marginLeft: '12px' }}>Fade</span>
        <label className="switch"><input id="dotsPulse" type="checkbox" /><span className="thumb"></span></label>
      </div>
      <div className="row control"><span className="label">Density</span><input id="density" type="range" min="0" max="1" step="0.01" defaultValue="0.25" /></div>
      <div className="row control"><span className="label">Dot Size</span><input id="dotSize" type="range" min="0.5" max="5.0" step="0.1" defaultValue="2.0" /></div>
      <div className="row control"><span className="label">Dot Glow</span><input id="dotGlow" type="range" min="0" max="5.0" step="0.1" defaultValue="0.5" /></div>
    </>
  );
}

function DotsSettings({ collapsed = false, onToggleCollapse = () => {}, embedded = false }: DotsSettingsProps) {
  if (embedded) {
    return (
      <div style={{ borderTop: '1px solid rgba(30,144,255,0.22)', marginTop: '10px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: 'var(--neonBlue)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Dots</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetDots?.();
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
            title="Reset Dots to defaults"
          >
            ↺
          </button>
        </div>
        <DotsControls />
      </div>
    );
  }

  return (
    <div className="section">
      <div 
        className="collapsible-header" 
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onToggleCollapse();
        }}
        style={{ marginBottom: '4px' }}
      >
        <h3>Dots</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetDots?.();
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
            title="Reset Dots to defaults"
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>
      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
        <DotsControls />
      </div>
      </div> {/* End collapsible-wrapper for Dots section */}
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — see SpikeRingSettings.tsx for the rationale.
const MemoizedDotsSettings = memo(DotsSettings);
export { MemoizedDotsSettings as DotsSettings };