import { memo } from 'react';

interface Props { missing: string[]; onClose: () => void; }
export const CompatibilityWarning = memo(function CompatibilityWarning({ missing, onClose }: Props) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(8px)' }} onClick={onClose}>
      <div style={{ background:'linear-gradient(135deg, rgba(20,20,30,.95), rgba(30,30,50,.95))', border:'2px solid rgba(255,100,100,.6)', borderRadius:12, padding:32, maxWidth:500, boxShadow:'0 16px 48px rgba(255,0,0,.3)', textAlign:'center' }} onClick={(e)=>e.stopPropagation()}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h2 style={{ color:'#ff6b6b', marginBottom:16, fontSize:20 }}>Browser Compatibility Warning</h2>
        <p style={{ color:'#e0e0e0', marginBottom:20, lineHeight:1.6 }}>Your browser is missing some required features for ORBITAL Audio Visualizer to work properly:</p>
        <ul style={{ textAlign:'left', color:'#ffd700', marginBottom:24, listStyle:'none', padding:0 }}>
          {missing.map((feature, i)=><li key={`${feature}-${i}`} style={{ marginBottom:8, paddingLeft:24, position:'relative' }}><span style={{ position:'absolute', left:0 }}>❌</span>{feature}</li>)}
        </ul>
        <p style={{ color:'#b0b0b0', marginBottom:24, fontSize:14 }}>Please use a modern browser like Chrome, Firefox, Safari, or Edge (latest versions).</p>
        <button onClick={onClose} style={{ background:'linear-gradient(135deg, rgba(30,144,255,.8), rgba(138,43,226,.8))', color:'white', border:'none', padding:'12px 32px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(30,144,255,.4)' }}>Continue Anyway</button>
      </div>
    </div>
  );
});
