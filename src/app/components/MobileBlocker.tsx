import { useEffect, useState } from 'react';
import { Smartphone, Monitor, Tablet } from 'lucide-react';

import { orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';

// Sprint M4: HTTPS, and the QR now points at ORBITAL itself so a tablet/desktop
// can open the app directly instead of landing on the SPLNTR index page.
const ORBITAL_APP_URL = 'https://orbital-visualizer.splntr-microtools.com';
const ORBITAL_APP_URL_LABEL = 'orbital-visualizer.splntr-microtools.com';

export function MobileBlocker() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Keep the recovery destination stable across preview and production hosts.
    const targetUrl = encodeURIComponent(ORBITAL_APP_URL);
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${targetUrl}`);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100%',
      // 100vh on iOS Safari includes the area behind the toolbar; dvh tracks the
      // visible viewport so the logo and QR stay on screen at 100% page zoom.
      height: '100dvh',
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1e24 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 999999,
      padding: 'max(env(safe-area-inset-top), 0.75rem) 1rem max(env(safe-area-inset-bottom), 0.75rem)',
      boxSizing: 'border-box',
      overflowY: 'auto',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* margin:auto on the inner wrapper centers it when there is spare room and
          degrades to top-aligned scroll (never clipping the logo) when there is not. */}
      <div style={{
        margin: 'auto',
        width: '100%',
        maxWidth: '360px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* ORBITAL Logo */}
        <img
          src={orbitalLogo}
          alt="ORBITAL"
          onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')}
          style={{
            display: 'block',
            width: '150px',
            height: 'auto',
            marginBottom: '1rem',
            opacity: 0.9,
          }}
        />

        {/* Main Message */}
        <h1 style={{
          fontSize: '1.35rem',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0 0 0.5rem',
          letterSpacing: '0.02em',
        }}>
          Desktop & Tablet Only
        </h1>

        <p style={{
          fontSize: '0.9rem',
          color: '#94afc4',
          lineHeight: '1.5',
          margin: '0 0 1rem',
          maxWidth: '320px',
        }}>
          ORBITAL Audio Visualizer requires a larger screen and landscape orientation for the best experience.
        </p>

        {/* Supported Devices */}
        <div style={{
          display: 'flex',
          gap: '1.75rem',
          marginBottom: '1rem',
          padding: '0.75rem 1.25rem',
          background: 'rgba(30,144,255,0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(30,144,255,0.2)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            <Monitor size={26} color="#1E90FF" strokeWidth={1.5} />
            <span style={{ fontSize: '0.75rem', color: '#b0c9dd' }}>Desktop</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            <Tablet size={26} color="#1E90FF" strokeWidth={1.5} />
            <span style={{ fontSize: '0.75rem', color: '#b0c9dd' }}>Tablet</span>
          </div>
        </div>

        {/* QR Code Section */}
        <div style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.85rem 1rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <p style={{
            fontSize: '0.8rem',
            color: '#94afc4',
            margin: '0 0 0.6rem',
          }}>
            Scan to open ORBITAL on a tablet or desktop
          </p>
          {qrCodeUrl && (
            <img
              src={qrCodeUrl}
              alt="QR code linking to the ORBITAL web app"
              style={{
                display: 'block',
                margin: '0 auto',
                width: '112px',
                height: '112px',
                borderRadius: '4px',
              }}
            />
          )}
          <p style={{ fontSize: '0.7rem', color: '#7a94aa', margin: '0.6rem 0 0', wordBreak: 'break-all' }}>
            {ORBITAL_APP_URL_LABEL}
          </p>
        </div>

        {/* Footer Note */}
        <p style={{
          fontSize: '0.65rem',
          color: 'rgba(148,175,196,0.5)',
          margin: '0.75rem 0 0',
        }}>
          Minimum screen width: 768px (landscape)
        </p>
      </div>
    </div>
  );
}
