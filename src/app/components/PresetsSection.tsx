// ORBITAL - Presets Section Component
// Extracted from App.tsx as part of PHASE 2 refactoring

import { memo } from 'react';

function PresetsSectionComponent() {
  return (
    <div style={{ background: 'transparent', border: 'none', margin: '8px 0 12px 0', padding: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span className="label" style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--neonBlue)', fontWeight: '700' }}>PRESETS</span>
      </div>
      <div className="row" style={{ gap: '6px', margin: '0' }}>
        <select id="presetSelect" className="select" style={{ flex: 1 }}>
          <option value="-1">— Choose Preset —</option>
          <option value="0">DEFAULT</option>
          <option value="1">Chill Lofi</option>
          <option value="2">Bass Earthquake</option>
          <option value="3">Electric Tempest</option>
          <option value="4">Neon Arcade</option>
          <option value="5">Hypnotic Trance</option>
          <option value="6">Minimal Zen</option>
          <option value="7">Minimalscape</option>
          <option value="8">Cinematic Epic</option>
          <option value="9">Retro Synthwave</option>
          <option value="10">Glitch Matrix</option>
          <option value="11">Blang it Out</option>
          <option value="12">Sacred Mandala</option>
          <option value="13">Cosmic Geometry</option>
          <option value="14">Fractal Dreams</option>
          <option value="15">Particle Storm</option>
          <option value="16">Deep Bass Vision</option>
          <option value="17">Logo Spinner</option>
          <option value="18">Frequency Chaos</option>
          <option value="19">Ethereal Bloom</option>
        </select>
        <button id="savePreset" className="btn" title="Save current settings as preset" style={{ padding: '.35rem .5rem', fontSize: '12px' }}>💾</button>
        <button id="randomize" className="btn" title="Randomize all parameters" style={{ padding: '.35rem .5rem', fontSize: '12px' }}>🎲</button>
      </div>
    </div>
  );
}

export const PresetsSection = memo(PresetsSectionComponent);
