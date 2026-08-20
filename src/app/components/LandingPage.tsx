import { motion } from 'motion/react';
import { Activity, Mic, Upload, Sliders, Radio, Save, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';

import { iconLogo, orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';

interface LandingPageProps {
  onLaunch: () => void;
}

// Particle generator (called after mount)
function generateParticles(width: number, height: number) {
  return Array.from({ length: 60 }, (_, i) => {
    const random = Math.random;
    
    // Distribute particles across entire viewport
    const startX = -50 + random() * (width + 100);
    const startY = -50 + random() * (height + 100);
    
    // Create more organic drift motion with multiple waypoints
    const driftDistance = 100 + random() * 200;
    const driftAngle1 = random() * Math.PI * 2;
    const driftAngle2 = random() * Math.PI * 2;
    const driftAngle3 = random() * Math.PI * 2;
    
    // Three waypoints for smooth organic motion
    const waypoint1X = startX + Math.cos(driftAngle1) * driftDistance;
    const waypoint1Y = startY + Math.sin(driftAngle1) * driftDistance;
    const waypoint2X = startX + Math.cos(driftAngle2) * driftDistance * 0.7;
    const waypoint2Y = startY + Math.sin(driftAngle2) * driftDistance * 0.7;
    const waypoint3X = startX + Math.cos(driftAngle3) * driftDistance * 0.5;
    const waypoint3Y = startY + Math.sin(driftAngle3) * driftDistance * 0.5;
    
    // Vary sizes more dramatically for depth
    const sizeRandom = random();
    const size = sizeRandom < 0.3 ? 1 + random() * 2 : // Small particles (30%)
                 sizeRandom < 0.7 ? 2 + random() * 3 : // Medium particles (40%)
                 3 + random() * 5; // Large particles (30%)
    
    // Base opacity varies with size (smaller = dimmer for depth)
    const baseOpacity = size < 2 ? 0.2 + random() * 0.3 :
                       size < 4 ? 0.3 + random() * 0.4 :
                       0.4 + random() * 0.5;
    
    // Color variation - blues, cyans, purples
    const colorType = random();
    const color = colorType < 0.5 ? '30, 144, 255' : // Blue
                  colorType < 0.8 ? '0, 191, 255' : // Cyan
                  '138, 43, 226'; // Purple
    
    return {
      id: i,
      startX,
      startY,
      waypoint1X,
      waypoint1Y,
      waypoint2X,
      waypoint2Y,
      waypoint3X,
      waypoint3Y,
      duration: 8 + random() * 12,
      delay: random() * 5,
      size,
      baseOpacity,
      opacity: baseOpacity,
      color,
      blur: size < 2 ? 1 : size < 4 ? 0.5 : 0,
    };
  });
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // 🐛 BUG FIX (Beta cleanup): this retry loop previously had no unmount guard, no
    // tracked timeout reference, and no maximum retry count — if window dimensions never
    // became valid (which is exactly what was happening, logged repeatedly as "Window
    // dimensions not ready, retrying..." for the entire session, well past the landing
    // page itself being gone), it would call setTimeout(initParticles, 100) forever,
    // indefinitely, regardless of whether this component was still mounted. Now it stops
    // cleanly on unmount and gives up gracefully after 2 seconds with fallback dimensions
    // instead of retrying forever.
    let cancelled = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 20; // 20 * 100ms = 2s before falling back

    // ⚡ FIX: Delay particle generation until window is properly sized
    // Use requestAnimationFrame to ensure browser has painted and dimensions are accurate
    const initParticles = () => {
      if (cancelled) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Safety check: only generate if we have valid dimensions
      if (width > 0 && height > 0) {
        console.log('🎨 Generating landing particles with dimensions:', width, 'x', height);
        setParticles(generateParticles(width, height));
        return;
      }

      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        // Dimensions never became available — fall back rather than retry forever.
        console.warn('⚠️ Window dimensions never became available after', MAX_RETRIES, 'retries — using fallback dimensions.');
        setParticles(generateParticles(1920, 1080));
        return;
      }

      // Retry after a brief delay if dimensions aren't ready
      console.warn('⚠️ Window dimensions not ready, retrying...');
      retryTimeoutId = setTimeout(initParticles, 100);
    };
    
    // Wait for next frame to ensure layout is complete
    let rafId1: number | null = null;
    let rafId2: number | null = null;
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(initParticles);
    });
    
    // Regenerate particles on window resize (with debounce)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (width > 0 && height > 0) {
          setParticles(generateParticles(width, height));
        }
      }, 300);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (rafId1 !== null) cancelAnimationFrame(rafId1);
      if (rafId2 !== null) cancelAnimationFrame(rafId2);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);
  
  // Feature list - split into left and right columns
  const leftFeatures = [
    { 
      icon: <Radio size={18} />, 
      text: 'Visual Modes & Custom Presets' 
    },
    { icon: <Activity size={18} />, text: 'Beat Detection & Band Isolation' },
    { icon: <Mic size={18} />, text: 'Audio Input & Upload Functionality' },
    { icon: <Save size={18} />, text: 'User Image Storage & Export Features' },
  ];

  const rightFeatures = [
    { 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2 L12 6 M12 18 L12 22 M4.93 4.93 L7.76 7.76 M16.24 16.24 L19.07 19.07 M2 12 L6 12 M18 12 L22 12 M4.93 19.07 L7.76 16.24 M16.24 7.76 L19.07 4.93" />
        </svg>
      ), 
      text: 'Real-Time Audio Response w/ BPM Sync' 
    },
    { 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6 L21 6 M3 12 L21 12 M3 18 L21 18" />
        </svg>
      ), 
      text: 'Color Themes & Customization' 
    },
    { icon: <Sliders size={18} />, text: 'Macro Controls for Creative Control' },
    { 
      icon: <Layers size={18} />, 
      text: 'Multi-layered Animation & Effects' 
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(30,144,255,0.15) 0%, rgba(0,0,0,0.95) 50%, #000 100%)',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {/* Random floating particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: `rgba(${p.color}, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(${p.color}, ${p.opacity * 0.8})`,
            filter: p.blur > 0 ? `blur(${p.blur}px)` : 'none',
            left: 0,
            top: 0,
          }}
          initial={{
            x: p.startX,
            y: p.startY,
            opacity: 0,
          }}
          animate={{
            x: [p.startX, p.waypoint1X, p.waypoint2X, p.waypoint3X, p.startX],
            y: [p.startY, p.waypoint1Y, p.waypoint2Y, p.waypoint3Y, p.startY],
            opacity: [0, p.baseOpacity, p.baseOpacity * 1.2, p.baseOpacity * 0.8, p.baseOpacity, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
            times: [0, 0.25, 0.5, 0.75, 0.9, 1], // Smooth timing for all keyframes
          }}
        />
      ))}

      {/* Main content container */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1200px', padding: '0 40px' }}>
        {/* Features - Left Column */}
        <div style={{ position: 'absolute', left: '-40px', top: '50%', transform: 'translateY(-50%)', maxWidth: '280px' }}>
          {leftFeatures.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.15, duration: 0.6 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
                color: '#1E90FF',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              <div style={{ flexShrink: 0 }}>{feature.icon}</div>
              <div style={{ color: '#d0e1f0' }}>{feature.text}</div>
            </motion.div>
          ))}
        </div>

        {/* Center Logo - positioned to match loading page */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '20px',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          {/* Rotating Icon Logo */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '260px',
              height: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={iconLogo}
              alt="Orbital Icon"
              onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'iconLogo')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 30px rgba(30, 144, 255, 0.6))',
              }}
            />
          </motion.div>

          {/* ORBITAL Text Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <img
              src={orbitalLogo}
              alt="ORBITAL"
              onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')}
              style={{
                height: '58px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 20px rgba(30, 144, 255, 0.5))',
              }}
            />
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            style={{
              fontSize: '13px',
              color: '#7a94aa',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: '600',
              marginTop: '0px',
            }}
          >
            Audio-Reactive Visualizer Engine
          </motion.div>

          {/* Made by SPLNTR */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            style={{
              fontSize: '11px',
              color: '#7a94aa',
              marginTop: '-12px',
              fontWeight: '400',
            }}
          >
            Made by SPLNTR - Micro Tools | v1.0 Beta
          </motion.div>

          {/* Launch Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLaunch}
            style={{
              marginTop: '20px',
              padding: '14px 50px',
              fontSize: '15px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#fff',
              background: 'linear-gradient(135deg, rgba(30,144,255,0.3) 0%, rgba(138,43,226,0.3) 100%)',
              border: '2px solid #1E90FF',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(30, 144, 255, 0.3)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 40px rgba(30, 144, 255, 0.6)';
              e.currentTarget.style.borderColor = '#00BFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(30, 144, 255, 0.3)';
              e.currentTarget.style.borderColor = '#1E90FF';
            }}
          >
            Launch
          </motion.button>
        </div>

        {/* Features - Right Column */}
        <div style={{ position: 'absolute', right: '-40px', top: '50%', transform: 'translateY(-50%)', maxWidth: '280px' }}>
          {rightFeatures.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.15, duration: 0.6 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
                color: '#1E90FF',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              <div style={{ flexShrink: 0 }}>{feature.icon}</div>
              <div style={{ color: '#d0e1f0' }}>{feature.text}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}