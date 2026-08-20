import { useEffect, useState } from 'react';
import { Smartphone, Monitor, Tablet } from 'lucide-react';

import { orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';

const SPLNTR_MICROTOOLS_URL = 'HTTP://SPLNTR-MICROTOOLS.COM';

export function MobileBlocker() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Keep the recovery destination stable across preview and production hosts.
    const targetUrl = encodeURIComponent(SPLNTR_MICROTOOLS_URL);
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${targetUrl}`);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1e24 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ORBITAL Logo */}
      <img 
        src={orbitalLogo} 
        alt="ORBITAL"
        onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')} 
        style={{
          width: '120px',
          height: 'auto',
          marginBottom: '2rem',
          opacity: 0.9,
        }}
      />

      {/* Icon */}
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(30,144,255,0.2) 0%, rgba(138,43,226,0.2) 100%)',
        border: '2px solid rgba(30,144,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
      }}>
        <Monitor size={32} color="#1E90FF" strokeWidth={1.5} />
      </div>

      {/* Main Message */}
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: '0.75rem',
        letterSpacing: '0.02em',
      }}>
        Desktop & Tablet Only
      </h1>

      <p style={{
        fontSize: '0.95rem',
        color: '#94afc4',
        lineHeight: '1.6',
        marginBottom: '2rem',
        maxWidth: '320px',
      }}>
        ORBITAL Audio Visualizer requires a larger screen and landscape orientation for the best experience.
      </p>

      {/* Supported Devices */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'rgba(30,144,255,0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(30,144,255,0.2)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={28} color="#1E90FF" strokeWidth={1.5} />
          <span style={{ fontSize: '0.75rem', color: '#b0c9dd' }}>Desktop</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <Tablet size={28} color="#1E90FF" strokeWidth={1.5} />
          <span style={{ fontSize: '0.75rem', color: '#b0c9dd' }}>Tablet</span>
        </div>
      </div>

      {/* QR Code Section */}
      <div style={{
        marginTop: '1rem',
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{
          fontSize: '0.85rem',
          color: '#94afc4',
          marginBottom: '1rem',
        }}>
          Scan to visit SPLNTR Micro Tools
        </p>
        {qrCodeUrl && (
          <img 
            src={qrCodeUrl} 
            alt="QR Code" 
            style={{
              width: '150px',
              height: '150px',
              borderRadius: '4px',
            }}
          />
        )}
      </div>

      {/* Footer Note */}
      <p style={{
        fontSize: '0.7rem',
        color: 'rgba(148,175,196,0.5)',
        marginTop: '2rem',
      }}>
        Minimum screen width: 768px (landscape)
      </p>
    </div>
  );
}
