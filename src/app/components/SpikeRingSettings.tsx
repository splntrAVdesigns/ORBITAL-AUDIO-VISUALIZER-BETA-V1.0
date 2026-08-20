import { memo, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { spikeFftExponentToVisibleCount } from '../config/parameterConversions';

interface SpikeRingSettingsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  spikeCount: number;
  setSpikeCount: (value: number) => void;
  spikeThickness: number;
  setSpikeThickness: (value: number) => void;
  spikeMirror: number;
  setSpikeMirror: (value: number) => void;
  spikeAttackVal: number;
  setSpikeAttackVal: (value: number) => void;
  spikeBloomVal: number; // 🔥 RENAMED: spikeTexture → spikeBloom
  setSpikeBloomVal: (value: number) => void;
  transientBoostVal: number; // 🔥 NEW: Transient emphasis slider
  setTransientBoostVal: (value: number) => void;
  children?: ReactNode;
}

function SpikeRingSettings({
  collapsed,
  onToggleCollapse,
  spikeCount,
  setSpikeCount,
  spikeThickness,
  setSpikeThickness,
  spikeMirror,
  setSpikeMirror,
  spikeAttackVal,
  setSpikeAttackVal,
  spikeBloomVal, // 🔥 RENAMED
  setSpikeBloomVal,
  transientBoostVal, // 🔥 NEW
  setTransientBoostVal,
  children
}: SpikeRingSettingsProps) {
  useEffect(() => {
    const syncVisibleSpikeCount = (event?: Event) => {
      const detail = (event as CustomEvent<{ exponent?: unknown }> | undefined)?.detail;
      const input = document.getElementById('fft') as HTMLInputElement | null;
      setSpikeCount(spikeFftExponentToVisibleCount(detail?.exponent ?? input?.value ?? 9));
    };
    syncVisibleSpikeCount();
    window.addEventListener('orbital:spike-fft-change', syncVisibleSpikeCount);
    return () => window.removeEventListener('orbital:spike-fft-change', syncVisibleSpikeCount);
  }, [setSpikeCount]);

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
        <h3>Spike Ring + Dots</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              (window as any).resetSpikeRing?.();
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
            title="Reset Spike Ring to defaults"
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>
      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
        <div className="row control" title="Number of frequency bins for SPIKE RING ONLY (2^N) - Higher = more spikes, more detail">
          <span className="label">Spike FFT</span>
          <input 
            id="fft" 
            type="range" 
            min="9" 
            max="13" 
            step="1" 
            defaultValue="9" 
            onInput={(e) => setSpikeCount(spikeFftExponentToVisibleCount(e.currentTarget.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{spikeCount}</span>
        </div>
        <div className="row control" title="Controls spike amplitude/spread - Lower = tight to ring, Higher = larger spikes">
          <span className="label">Thickness</span>
          <input 
            id="spikeTightness" 
            type="range" 
            min="0.2" 
            max="1.5" 
            step="0.01" 
            defaultValue="0.8" 
            onChange={(e) => setSpikeThickness(parseFloat(e.target.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{Math.min(150, Math.round(((spikeThickness - 0.2) / (1.5 - 0.2)) * 150))}%</span>
        </div>
        <div className="row control" title="Creates mirrored spikes inward from the ring">
          <span className="label">Mirror Spikes</span>
          <input 
            id="mirror" 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            defaultValue="0" 
            onChange={(e) => setSpikeMirror(parseFloat(e.target.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{(spikeMirror * 100).toFixed(0)}%</span>
        </div>
        <div className="row control" title="Attack speed - how fast spikes grow (Lower = rounder/smoother, Higher = sharper/faster)">
          <span className="label">Spike Attack</span>
          <input 
            id="spikeAttack" 
            type="range" 
            min="0.1" 
            max="1.2" 
            step="0.01" 
            defaultValue="0.30" 
            onChange={(e) => setSpikeAttackVal(parseFloat(e.target.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{spikeAttackVal.toFixed(2)}</span>
        </div>
        <div className="row control" title="Controls outer glow/aura intensity - 0% = sharp clean bars, 50% = soft energy aura, 100% = intense bloom (cyberpunk!)">
          <span className="label">Spike Bloom</span>
          <input 
            id="spikeBloom" 
            type="range" 
            min="0" 
            max="1.0" 
            step="0.01" 
            defaultValue="0" 
            onChange={(e) => setSpikeBloomVal(parseFloat(e.target.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{((spikeBloomVal / 1.0) * 100).toFixed(0)}%</span>
        </div>
        <div className="row control" title="Exaggerates audio attack/pop on beats - 0% = smooth averaged motion, 50% = balanced punch, 100% = hyper-reactive snap!">
          <span className="label">Transient Boost</span>
          <input 
            id="transientBoost" 
            type="range" 
            min="0" 
            max="1.0" 
            step="0.01" 
            defaultValue="0" 
            onChange={(e) => setTransientBoostVal(parseFloat(e.target.value))}
          />
          <span className="slider-value" style={{ fontSize: '10px', color: 'var(--neonBlue)', fontWeight: '700' }}>{((transientBoostVal / 1.0) * 100).toFixed(0)}%</span>
        </div>
        {children}
      </div>
      </div> {/* End collapsible-wrapper for Spike Ring section */}
    </div>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized so this section only re-renders when its own
// props actually change, instead of on every ControlPanel re-render (macro drag, tab
// switch, any other slider's value change, etc.) regardless of relevance.
const MemoizedSpikeRingSettings = memo(SpikeRingSettings);
export { MemoizedSpikeRingSettings as SpikeRingSettings };
