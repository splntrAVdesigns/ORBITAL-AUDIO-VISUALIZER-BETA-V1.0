/**
 * Core Textures Settings Panel Component
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { SHADER_REGISTRY } from '../src/shaders/ShaderRegistry';

interface ShaderCard {
  id: string;
  name: string;
  thumbnail: string;
  isFavorite: boolean;
}

interface CoreTexturesSettingsProps {
  onReset?: () => void;
}

function CoreTexturesSettingsComponent({ onReset }: CoreTexturesSettingsProps) {
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [shaders, setShaders] = useState<ShaderCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const getParams = () => ((window as any).params || {});
  const getEngine = () => ((window as any).coreTexturesEngine);
  const bump = () => forceTick(v => v + 1);

  const hydrateFromRegistry = useCallback(() => {
    const engine = getEngine();
    const params = getParams();
    setShaders(SHADER_REGISTRY.map((s: any) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail,
      isFavorite: engine?.isFavorite ? engine.isFavorite(s.id) : false,
    })));
    setSelectedId(engine?.getCurrentShaderId?.() || params.coreTexturesShaderId || SHADER_REGISTRY[0]?.id || null);
    bump();
    return true;
  }, []);

  const syncFromEngine = useCallback(() => {
    const engine = getEngine();
    if (!engine) return false;
    setShaders(SHADER_REGISTRY.map((s: any) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail,
      isFavorite: engine.isFavorite ? engine.isFavorite(s.id) : false,
    })));
    setSelectedId(engine.getCurrentShaderId?.() || getParams().coreTexturesShaderId || SHADER_REGISTRY[0]?.id || null);
    bump();
    return true;
  }, []);

  useEffect(() => {
    hydrateFromRegistry();
    const onReady = () => {
      syncFromEngine();
      const engine = getEngine();
      const params = getParams();
      if (engine) {
        engine.setEnabled?.(Boolean(params.coreTexturesEnabled));
        if (!engine.getCurrentShader?.() && (params.coreTexturesShaderId || selectedId || SHADER_REGISTRY[0]?.id)) {
          engine.selectShader?.(params.coreTexturesShaderId || selectedId || SHADER_REGISTRY[0]?.id);
        }
      }
    };
    window.addEventListener('core-textures-ready', onReady as EventListener);
    // 🚀 CF-05: Removed 300ms setInterval (was causing ~200 React re-renders/min).
    // Enabled state: owned by the onChange handler below — no polling needed.
    // Shader list: synced by core-textures-ready on init.
    // Favorites: synced by shader-favorites-updated event listener (separate useEffect below).
    return () => {
      window.removeEventListener('core-textures-ready', onReady as EventListener);
    };
  }, [hydrateFromRegistry, syncFromEngine, selectedId]);

  useEffect(() => {
    const onFavUpdate = () => syncFromEngine();
    window.addEventListener('shader-favorites-updated', onFavUpdate);
    return () => window.removeEventListener('shader-favorites-updated', onFavUpdate);
  }, [syncFromEngine]);

  useEffect(() => {
    const params = getParams();
    (window as any).__coreTexturesUIEnabled = Boolean(params.coreTexturesEnabled);
    (window as any).__coreTexturesSelectedShader = selectedId || params.coreTexturesShaderId || SHADER_REGISTRY[0]?.id || null;
  }, [selectedId]);


  useEffect(() => {
    const params = getParams();
    const engine = getEngine();
    if (!engine) return;

    const enabled = Boolean(params.coreTexturesEnabled);
    const desiredId = selectedId || params.coreTexturesShaderId || SHADER_REGISTRY[0]?.id || null;

    engine.setEnabled?.(enabled);
    if (desiredId && engine.getCurrentShaderId?.() !== desiredId) {
      engine.selectShader?.(desiredId);
    }
  }, [selectedId, shaders.length]);

  const handleSelect = useCallback((id: string) => {
    const engine = getEngine();
    const params = getParams();
    const preset = SHADER_REGISTRY.find((s: any) => s.id === id);
    params.coreTexturesShaderId = id;
    (window as any).__coreTexturesSelectedShader = id;
    setSelectedId(id);
    const shaderDefaults = preset?.defaults || {};
    params.coreTexturesOpacity = shaderDefaults.opacity ?? 0.8;
    params.coreTexturesAudioIntensity = shaderDefaults.audioIntensity ?? params.coreTexturesAudioIntensity ?? 0.6;
    params.coreTexturesFrequencyRange = shaderDefaults.frequencyRange ?? params.coreTexturesFrequencyRange ?? 'full';
    params.coreTexturesBeatSync = shaderDefaults.beatSync ?? params.coreTexturesBeatSync ?? true;
    params.coreTexturesBlendMode = shaderDefaults.blendMode ?? params.coreTexturesBlendMode ?? 'screen';
    params.coreTexturesScale = shaderDefaults.scale ?? params.coreTexturesScale ?? 1;
    params.coreTexturesSpeed = shaderDefaults.speed ?? params.coreTexturesSpeed ?? 1;
    if (preset?.controls) {
      Object.entries(preset.controls).forEach(([key, control]: any) => {
        const paramKey = formatParamKey(key);
        if (control?.default !== undefined) {
          params[paramKey] = control.default;
        }
      });
    }
    if (engine) {
      engine.selectShader?.(id);
      (window as any).updateShaderControls?.(preset, engine, params);
      engine.updateParams?.({
        ...(preset?.defaults || {}),
        opacity: params.coreTexturesOpacity,
        audioIntensity: params.coreTexturesAudioIntensity,
        frequencyRange: params.coreTexturesFrequencyRange,
        beatSync: params.coreTexturesBeatSync,
        blendMode: params.coreTexturesBlendMode,
        scale: params.coreTexturesScale,
        speed: params.coreTexturesSpeed,
      });
      if (preset?.controls) {
        const controlDefaults: Record<string, any> = {};
        Object.entries(preset.controls).forEach(([key, control]: any) => {
          if (control?.default !== undefined) controlDefaults[key] = params[formatParamKey(key)];
        });
        engine.updateParams?.(controlDefaults);
      }
      engine.setEnabled?.(Boolean(params.coreTexturesEnabled));
    }
    bump();
  }, []);

  const handleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const engine = getEngine();
    if (!engine) return;
    engine.toggleFavorite(id);
    window.dispatchEvent(new CustomEvent('shader-favorites-updated'));
  }, []);

  const visible = showFavoritesOnly ? shaders.filter(s => s.isFavorite) : shaders;
  const selectedShader = useMemo(
    () => SHADER_REGISTRY.find((s: any) => s.id === (selectedId || SHADER_REGISTRY[0]?.id)) || null,
    [selectedId]
  );

  const formatParamKey = (key: string) => `coreTextures${key.charAt(0).toUpperCase() + key.slice(1)}`;

  const renderShaderControl = (key: string, control: any) => {
    const engine = getEngine();
    const params = getParams();
    const paramKey = formatParamKey(key);
    const currentValue = params[paramKey] ?? control.default;

    if (control.type === 'slider') {
      return (
        <div key={key} className="row control" style={{ marginBottom: '8px' }}>
          <span className="label">{control.label}</span>
          <input
            type="range"
            min={String(control.min ?? 0)}
            max={String(control.max ?? 1)}
            step={String(control.step ?? 0.1)}
            value={String(currentValue)}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              params[paramKey] = value;
              engine?.updateParams?.({ [key]: value });
              bump();
            }}
          />
          <span style={{ color: '#1E90FF', fontSize: '10px', fontWeight: 600, minWidth: '36px', textAlign: 'right', display: 'inline-block' }}>{(() => { if (typeof currentValue !== 'number') return String(currentValue); const min = control.min ?? 0; const max = control.max ?? 1; return (min === 0 && max === 1) ? Math.round(currentValue * 100) + '%' : (Number.isInteger(currentValue) ? String(currentValue) : String(Number(currentValue.toFixed(2)))); })()}</span>
        </div>
      );
    }

    if (control.type === 'select' || control.type === 'dropdown') {
      return (
        <div key={key} className="row" style={{ marginBottom: '8px' }}>
          <span className="label">{control.label}</span>
          <select
            className="select"
            style={{ flex: 1, fontSize: '11px' }}
            value={String(currentValue)}
            onChange={(e) => {
              const value = e.target.value;
              params[paramKey] = value;
              engine?.updateParams?.({ [key]: value });
              bump();
            }}
          >
            {(control.options || []).map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    if (control.type === 'toggle') {
      return (
        <div key={key} className="row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="label" style={{ width: 'auto' }}>{control.label}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(currentValue)}
              onChange={(e) => {
                const value = e.target.checked;
                params[paramKey] = value;
                engine?.updateParams?.({ [key]: value });
                bump();
              }}
            />
            <span className="thumb"></span>
          </label>
        </div>
      );
    }

    return null;
  };

  const params = getParams();
  const engine = getEngine();
  const liveParams = getParams();
  const liveEngine = getEngine();

  return (
    <div className="section" style={{
      background: '#1a1d23',
      border: '1px solid rgba(255,20,147,0.3)'
    }}>
      <div className="collapsible-header" onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const wrapper = e.currentTarget.nextElementSibling;
        const chevron = e.currentTarget.querySelector('.collapsible-chevron');
        if (wrapper && chevron) {
          wrapper.classList.toggle('collapsed');
          chevron.classList.toggle('collapsed');
        }
      }}>
        <h3 style={{ color: '#FF1493' }}>CORE TEXTURES</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onReset?.(); }}
            title="Reset Core Textures to defaults"
            style={{ fontSize: '14px', padding: '2px', background: 'transparent', border: 'none', color: '#FF1493', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s', fontWeight: '400' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >↺</button>
          <ChevronDown className="collapsible-chevron collapsed" size={10} />
        </div>
      </div>

      <div className="collapsible-wrapper collapsed">
        <div className="collapsible-content">
          <div className="row">
            <span className="label">Enable Textures</span>
            <label className="switch">
              <input
                id="coreTexturesEnabled"
                type="checkbox"
                checked={Boolean(params.coreTexturesEnabled)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const liveParams = getParams();
                  const liveEngine = getEngine();
                  liveParams.coreTexturesEnabled = enabled;
                  (window as any).__coreTexturesUIEnabled = enabled;
                  liveEngine?.setEnabled?.(enabled);
                  const nextId = selectedId || liveParams.coreTexturesShaderId || SHADER_REGISTRY[0]?.id;
                  if (enabled && nextId) {
                    liveParams.coreTexturesShaderId = nextId;
                    (window as any).__coreTexturesSelectedShader = nextId;
                    setSelectedId(nextId);
                    liveEngine?.selectShader?.(nextId);
                  }
                  bump();
                }}
              />
              <span className="thumb"></span>
            </label>
            <span style={{ fontSize: '9px', color: '#FF1493', fontStyle: 'italic', marginLeft: '12px' }}>audio-reactive shader presets</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,20,147,0.2)', marginTop: '8px', marginBottom: '12px' }}></div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="label" style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>SHADER PRESETS</span>
              <button
                id="toggleFavoritesFilter"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                style={{ fontSize: '9px', padding: '2px 6px', background: showFavoritesOnly ? 'rgba(255,215,0,0.2)' : 'transparent', border: '1px solid rgba(255,215,0,0.5)', borderRadius: '3px', color: '#FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Star size={10} fill={showFavoritesOnly ? '#FFD700' : 'none'} />
                {showFavoritesOnly ? 'SHOW ALL' : 'FAVORITES'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,20,147,0.5) rgba(0,0,0,0.3)' }}>
              {visible.length === 0 && (
                <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', padding: '8px' }}>
                  {shaders.length === 0 ? 'Loading shaders…' : 'No favorites yet'}
                </div>
              )}
              {visible.map(shader => (
                <div key={shader.id} onClick={() => handleSelect(shader.id)} style={{ minWidth: '80px', height: '80px', borderRadius: '6px', flexShrink: 0, border: selectedId === shader.id ? '2px solid #FF1493' : '2px solid rgba(255,20,147,0.3)', boxShadow: selectedId === shader.id ? '0 0 20px rgba(255,20,147,0.6)' : 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
                  <img src={shader.thumbnail} alt={shader.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', background: 'rgba(0,0,0,0.8)', color: '#FF1493', fontSize: '9px', textAlign: 'center', fontWeight: '600' }}>{shader.name}</div>
                  <svg width="16" height="16" viewBox="0 0 24 24" onClick={(e) => handleFavorite(e, shader.id)} style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', stroke: shader.isFavorite ? '#FFD700' : 'currentColor', fill: shader.isFavorite ? '#FFD700' : 'none', transition: 'all 0.2s', color: '#aaa' }}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          <div className="row control">
            <span className="label">Opacity</span>
            <input id="shaderOpacity" type="range" min="0" max="1" step="0.01" value={params.coreTexturesOpacity ?? 0.8} onChange={(e)=>{ const v=parseFloat(e.target.value); liveParams.coreTexturesOpacity=v; liveEngine?.updateParams?.({opacity:v}); bump(); }} />
            <span style={{ color: '#1E90FF', fontSize: '10px', fontWeight: 600, minWidth: '36px', textAlign: 'right', display: 'inline-block' }}>{Math.round((params.coreTexturesOpacity ?? 0.8) * 100)}%</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,20,147,0.2)', marginTop: '12px', marginBottom: '8px' }}></div>
          <div style={{ fontSize: '10px', color: '#FF1493', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>AUDIO REACTIVITY</div>

          <div className="row control">
            <span className="label">Audio Intensity</span>
            <input id="shaderAudioIntensity" type="range" min="0" max="1" step="0.05" value={params.coreTexturesAudioIntensity ?? 0.6} onChange={(e)=>{ const v=parseFloat(e.target.value); liveParams.coreTexturesAudioIntensity=v; liveEngine?.updateParams?.({audioIntensity:v}); bump(); }} />
            <span style={{ color: '#1E90FF', fontSize: '10px', fontWeight: 600, minWidth: '36px', textAlign: 'right', display: 'inline-block' }}>{Math.round((params.coreTexturesAudioIntensity ?? 0.6) * 100)}%</span>
          </div>

          <div className="row">
            <span className="label">Frequency Range</span>
            <select id="shaderFrequencyRange" className="select" style={{ flex: 1, fontSize: '11px' }} value={params.coreTexturesFrequencyRange ?? 'full'} onChange={(e)=>{ const v=e.target.value; liveParams.coreTexturesFrequencyRange=v; liveEngine?.updateParams?.({frequencyRange:v}); bump(); }}>
              <option value="low">Low (Bass)</option>
              <option value="mid">Mid</option>
              <option value="high">High (Treble)</option>
              <option value="full">Full Spectrum</option>
            </select>
          </div>

          <div className="row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="label" style={{ fontSize: '10px', width: 'auto' }}>Beat Sync</span>
            <label className="switch"><input id="shaderBeatSync" type="checkbox" checked={Boolean(params.coreTexturesBeatSync ?? true)} onChange={(e)=>{ const v=e.target.checked; liveParams.coreTexturesBeatSync=v; liveEngine?.updateParams?.({beatSync:v}); bump(); }} /><span className="thumb"></span></label>
            <span style={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic', marginLeft: 'auto' }}>pulses on detected beats</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,20,147,0.2)', marginTop: '12px', marginBottom: '8px' }}></div>
          <div style={{ fontSize: '10px', color: '#FF1493', fontWeight: '800', marginBottom: '6px', letterSpacing: '0.5px' }}>SHADER CONTROLS</div>
          <div id="shaderSpecificControls" style={{ minHeight: '40px' }}>
            {selectedShader ? (
              <div>
                {Object.entries((selectedShader as any).controls || {}).map(([key, control]) => renderShaderControl(key, control))}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                Select a shader to see controls
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const CoreTexturesSettings = React.memo(CoreTexturesSettingsComponent);
