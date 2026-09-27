import { memo } from 'react';
import { KEYBOARD_SHORTCUTS, type KeyboardShortcutEntry } from '../../config/keyboardShortcuts';

const keyStyle = { background:'rgba(30,144,255,0.2)', padding:'2px 6px', borderRadius:'3px', marginRight:'6px' } as const;
const sectionStyle = { color:'#7a94aa', fontSize:'10px', fontWeight:700, marginTop:'8px', marginBottom:'4px' } as const;

// Sprint L6: grouped from the shared registry instead of a second hardcoded copy.
const SECTION_ORDER: readonly KeyboardShortcutEntry['section'][] = ['Playback', 'Visualization', 'Capture', 'Controls'];
const SHORTCUTS_BY_SECTION = SECTION_ORDER.map((section) => ({
  section,
  items: KEYBOARD_SHORTCUTS.filter((entry) => entry.section === section),
}));

export const KeyboardShortcutOverlay = memo(function KeyboardShortcutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position:'fixed', bottom:20, right:20, background:'rgba(10,10,20,.92)', border:'1px solid rgba(30,144,255,.5)', borderRadius:8, padding:'16px 20px', zIndex:9998, boxShadow:'0 8px 32px rgba(0,0,0,.6)', backdropFilter:'blur(12px)', maxWidth:320, fontFamily:'monospace', fontSize:11, color:'#e0e0e0', userSelect:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, borderBottom:'1px solid rgba(30,144,255,.3)', paddingBottom:8 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'var(--neonBlue)', letterSpacing:'.5px' }}>⌨️ KEYBOARD SHORTCUTS</div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.6)', fontSize:18, cursor:'pointer', padding:0, lineHeight:1, width:20, height:20 }} title="Close (? to toggle)">×</button>
      </div>
      <div style={{ lineHeight:1.8 }}>
        {SHORTCUTS_BY_SECTION.map(({ section, items }, sectionIndex) => (
          <div key={section}>
            <div style={sectionIndex === 0 ? { ...sectionStyle, marginTop: 0 } : sectionStyle}>{section.toUpperCase()}:</div>
            {items.map((entry) => (
              <div key={entry.keys}><kbd style={keyStyle}>{entry.keys}</kbd>{entry.description}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(30,144,255,.2)', fontSize:9, color:'rgba(255,255,255,.4)', fontStyle:'italic' }}>Press <kbd style={{ ...keyStyle, padding:'1px 4px', marginRight:0 }}>?</kbd> to hide</div>
    </div>
  );
});
