import { memo, useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { defaultParams } from '../config/defaultParams';
import {
  dispatchRuntimeParameterTransaction,
  readRuntimeParameterTransaction,
  RUNTIME_PARAMETER_TRANSACTION_EVENT,
} from '../runtime/parameters/RuntimeParameterTransactions';

type CoreParticleShapeMode = 'dot' | 'tri' | 'dia' | 'all';

const SHAPE_MODES: readonly CoreParticleShapeMode[] = ['dot', 'tri', 'dia', 'all'];

function normalizeShapeMode(value: unknown): CoreParticleShapeMode {
  if (value === 'tri' || value === 'dia' || value === 'all') return value;
  return 'dot';
}

function applyCoreParticleShapeMode(mode: CoreParticleShapeMode): void {
  dispatchRuntimeParameterTransaction({ coreParticlesShapeMode: mode }, 'control');
}

function resetInput(id: string, value: number | boolean): void {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (!element) return;
  if (element.type === 'checkbox') {
    element.checked = Boolean(value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  element.value = String(value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function CoreParticlesSettingsComponent() {
  const [collapsed, setCollapsed] = useState(true);
  const [activeParticleMode, setActiveParticleMode] = useState<CoreParticleShapeMode>(() =>
    normalizeShapeMode(typeof window !== 'undefined' ? (window as any).params?.coreParticlesShapeMode : 'dot'),
  );

  useEffect(() => {
    const syncShapeMode = (event: Event) => {
      const detail = readRuntimeParameterTransaction(event);
      if (detail?.patch.coreParticlesShapeMode !== undefined) {
        setActiveParticleMode(normalizeShapeMode(detail.patch.coreParticlesShapeMode));
      }
    };
    window.addEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, syncShapeMode as EventListener);
    return () => window.removeEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, syncShapeMode as EventListener);
  }, []);

  const selectShapeMode = useCallback((mode: CoreParticleShapeMode) => {
    setActiveParticleMode(mode);
    applyCoreParticleShapeMode(mode);
  }, []);

  const resetCoreParticles = useCallback(() => {
    resetInput('shapeOscillate', defaultParams.shapeOscillate);
    resetInput('shapeEdgeTrails', defaultParams.shapeEdgeTrails);
    resetInput('shapeDistortion', defaultParams.shapeDistortion);
    resetInput('shapeTurbulence', defaultParams.shapeTurbulence);
    resetInput('shapeDecay', defaultParams.shapeDecay);
    resetInput('shapeBurstStrength', defaultParams.shapeBurstStrength);
    resetInput('shapeOrbitDrift', defaultParams.shapeOrbitDrift);
    resetInput('shapeDensity', defaultParams.shapeDensity);
    selectShapeMode(normalizeShapeMode(defaultParams.coreParticlesShapeMode));
  }, [selectShapeMode]);

  return (
    <div className="section">
      <div
        className="collapsible-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          setCollapsed((value) => !value);
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setCollapsed((value) => !value);
        }}
        style={{ marginBottom: '4px' }}
      >
        <h3>Core Particles</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              resetCoreParticles();
            }}
            title="Reset Core Particles to defaults"
            aria-label="Reset Core Particles to defaults"
            style={{
              fontSize: '14px',
              padding: '2px',
              background: 'transparent',
              border: 'none',
              color: 'var(--neonBlue)',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s',
              fontWeight: '400',
            }}
            onMouseEnter={(event) => { event.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(event) => { event.currentTarget.style.opacity = '0.7'; }}
          >
            ↺
          </button>
          <ChevronDown className={`collapsible-chevron ${collapsed ? 'collapsed' : ''}`} size={10} />
        </div>
      </div>

      <div className={`collapsible-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="label" style={{ color: 'var(--neonBlue)', fontWeight: 800, letterSpacing: '0.04em' }}>
                Enable Particles
              </span>
              <label className="switch">
                <input id="shapeOscillate" type="checkbox" defaultChecked={defaultParams.shapeOscillate} />
                <span className="thumb"></span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '4px' }} aria-label="Core Particle shape">
              {SHAPE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => selectShapeMode(mode)}
                  aria-pressed={activeParticleMode === mode}
                  style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(30,144,255,0.2)',
                    background: activeParticleMode === mode ? 'rgba(30,144,255,0.9)' : 'transparent',
                    color: activeParticleMode === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(30,144,255,0.2)', marginTop: '10px', marginBottom: '10px' }} />
          <div className="row control"><span className="label">Intensity</span><input id="shapeEdgeTrails" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeEdgeTrails} /></div>
          <div className="row control"><span className="label">Pulse</span><input id="shapeDecay" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeDecay} /></div>
          <div className="row control"><span className="label">Spread</span><input id="shapeDistortion" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeDistortion} /></div>
          <div className="row control"><span className="label">Chaos</span><input id="shapeTurbulence" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeTurbulence} /></div>
          <div className="row control"><span className="label">Burst Strength</span><input id="shapeBurstStrength" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeBurstStrength} /></div>
          <div className="row control"><span className="label">Edge Fallback</span><input id="shapeOrbitDrift" type="range" min="0" max="1" step="0.01" defaultValue={defaultParams.shapeOrbitDrift} /></div>
          <div className="row control"><span className="label">Density</span><input id="shapeDensity" type="range" min="0.25" max="1" step="0.01" defaultValue={defaultParams.shapeDensity} /></div>
        </div>
      </div>
    </div>
  );
}

export const CoreParticlesSettings = memo(CoreParticlesSettingsComponent);
