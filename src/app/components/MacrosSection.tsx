// ORBITAL - Macros Section Component
// Extracted from App.tsx as part of PHASE 2 refactoring

import { memo, useEffect, useState } from 'react';
import type { MidiStatus } from '../engine/MidiController';
import { MacroKnob } from './MacroKnob';

interface MacrosSectionProps {
  macroSet: 'classic' | 'advanced';
  macroValues: {
    macro1: number;
    macro2: number;
    macro3: number;
    macro4: number;
    macro5: number;
    macro6: number;
    macro7: number;
    macro8: number;
  };
  onMacroSetChange: (set: 'classic' | 'advanced') => void;
  onMacroChange: (macroId: string, value: number) => void;
  onMacroCommit: (macroId: string, value: number) => void;
}

function MacrosSection({ 
  macroSet, 
  macroValues, 
  onMacroSetChange, 
  onMacroChange,
  onMacroCommit,
}: MacrosSectionProps) {
  const [midiStatus, setMidiStatus] = useState<MidiStatus | null>(null);
  useEffect(() => {
    const handler = (e: Event) => setMidiStatus((e as CustomEvent).detail);
    window.addEventListener('orbital:midi-status', handler as EventListener);
    return () => window.removeEventListener('orbital:midi-status', handler as EventListener);
  }, []);
  const toggleMidi = (enabled: boolean) => {
    window.dispatchEvent(new CustomEvent('orbital:midi-toggle', { detail: { enabled } }));
    if (enabled) window.dispatchEvent(new Event('orbital:midi-open'));
  };
  return (
    <>
      {/* Thin line break above MACROS */}
      <div style={{ 
        width: '100%', 
        height: '1px', 
        background: 'rgba(122, 148, 170, 0.2)', 
        margin: '12px 0' 
      }} />
      
      {/* MACROS - Hardware style section with dual tabs */}
      <div className="section" style={{ background: 'transparent', border: 'none', padding: '0' }}>
        {/* Header Row: Reset Button (left) | Tab Switcher (center) | MIDI Toggle (right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          {/* Left: Reset Button */}
          <button 
            id="resetMacros"
            style={{ 
              fontSize: '14px', 
              padding: '2px', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--neonBlue)', 
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            title="Reset all macros to default"
          >
            ↺
          </button>
          
          {/* Center: Simple Tab Text Switcher (no borders/backgrounds) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => onMacroSetChange('classic')}
              style={{
                fontSize: '9px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontWeight: macroSet === 'classic' ? '700' : '500',
                padding: '0',
                background: 'transparent',
                border: 'none',
                color: macroSet === 'classic' ? 'var(--neonBlue)' : '#7a94aa',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
            >
              Classic Macros
            </button>
            <span style={{ color: '#555', fontSize: '10px' }}>|</span>
            <button
              onClick={() => onMacroSetChange('advanced')}
              style={{
                fontSize: '9px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontWeight: macroSet === 'advanced' ? '700' : '500',
                padding: '0',
                background: 'transparent',
                border: 'none',
                color: macroSet === 'advanced' ? 'var(--neonBlue)' : '#7a94aa',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
            >
              Advanced Macros
            </button>
          </div>
          
          {/* Right: MIDI Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '8px', color: '#7a94aa' }}>MIDI</span>
            <label className="switch" style={{ transform: 'scale(0.8)' }}><input id="enableMIDI" type="checkbox" checked={!!midiStatus?.enabled} onChange={(e) => toggleMidi(e.target.checked)} /><span className="thumb"></span></label><button type="button" aria-label="Open MIDI settings" onClick={() => window.dispatchEvent(new Event('orbital:midi-open'))} style={{fontSize:'8px',background:'transparent',border:0,color:'var(--neonBlue)',cursor:'pointer',padding:0}}>SET</button>
          </div>
        </div>
        
        {/* Classic Macros (1-4) */}
        {macroSet === 'classic' && (
          <div className="macro-knobs">
            <MacroKnob
              id="macro1"
              label="ENERGY"
              value={macroValues.macro1}
              onChange={(val) => onMacroChange('macro1', val)}
              onCommit={(val) => onMacroCommit('macro1', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro2"
              label="MOTION"
              value={macroValues.macro2}
              onChange={(val) => onMacroChange('macro2', val)}
              onCommit={(val) => onMacroCommit('macro2', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro3"
              label="CHAOS"
              value={macroValues.macro3}
              onChange={(val) => onMacroChange('macro3', val)}
              onCommit={(val) => onMacroCommit('macro3', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro4"
              label="ATMOSPHERE"
              value={macroValues.macro4}
              onChange={(val) => onMacroChange('macro4', val)}
              onCommit={(val) => onMacroCommit('macro4', val)}
              deferRuntimeUpdates
            />
          </div>
        )}
        
        {/* Advanced Macros (5-8) */}
        {macroSet === 'advanced' && (
          <div className="macro-knobs">
            <MacroKnob
              id="macro5"
              label="SPIKES"
              value={macroValues.macro5}
              onChange={(val) => onMacroChange('macro5', val)}
              onCommit={(val) => onMacroCommit('macro5', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro6"
              label="DOTS"
              value={macroValues.macro6}
              onChange={(val) => onMacroChange('macro6', val)}
              onCommit={(val) => onMacroCommit('macro6', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro7"
              label="TEXTURE"
              value={macroValues.macro7}
              onChange={(val) => onMacroChange('macro7', val)}
              onCommit={(val) => onMacroCommit('macro7', val)}
              deferRuntimeUpdates
            />
            <MacroKnob
              id="macro8"
              label="CENTER FX"
              value={macroValues.macro8}
              onChange={(val) => onMacroChange('macro8', val)}
              onCommit={(val) => onMacroCommit('macro8', val)}
              deferRuntimeUpdates
            />
          </div>
        )}
        
        {/* Hidden inputs for backward compatibility with MIDI/presets */}
        <input type="hidden" id="macro1-hidden" defaultValue="0" />
        <input type="hidden" id="macro2-hidden" defaultValue="0" />
        <input type="hidden" id="macro3-hidden" defaultValue="0" />
        <input type="hidden" id="macro4-hidden" defaultValue="0" />
        <input type="hidden" id="macro5-hidden" defaultValue="0" />
        <input type="hidden" id="macro6-hidden" defaultValue="0" />
        <input type="hidden" id="macro7-hidden" defaultValue="0" />
        <input type="hidden" id="macro8-hidden" defaultValue="0" />
      </div>
    </>
  );
}
// 🚀 (Beta cleanup, Sprint B): memoized — pairs with Sprint A's deferred macroValues commit.
// Sprint A reduced how often macroValues itself changes; this ensures MacrosSection doesn't
// also re-render when some unrelated ControlPanel prop changes elsewhere.
const MemoizedMacrosSection = memo(MacrosSection);
export { MemoizedMacrosSection as MacrosSection };