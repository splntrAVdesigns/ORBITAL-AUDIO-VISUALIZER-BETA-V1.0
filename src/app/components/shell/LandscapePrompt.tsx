import { memo } from 'react';

export const LandscapePrompt = memo(function LandscapePrompt() {
  return (
    <div style={{ position:'fixed', inset:0, background:'linear-gradient(135deg, #0a0e17 0%, #1a1e24 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#fff', textAlign:'center', padding:'2rem', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📱</div>
      <h2 style={{ fontSize:'1.5rem', marginBottom:'0.5rem', color:'#1E90FF' }}>Rotate to Landscape</h2>
      <p style={{ color:'#94afc4', maxWidth:'320px' }}>Please rotate your device to landscape orientation for the best experience.</p>
    </div>
  );
});
