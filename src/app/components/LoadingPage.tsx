import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { iconLogo, orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';

interface LoadingPageProps {
  onComplete: () => void;
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

export function LoadingPage({ onComplete }: LoadingPageProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // 🐛 BUG FIX (Beta cleanup): same fix as LandingPage.tsx's identical retry loop —
    // no unmount guard, no tracked timeout reference, no maximum retry count previously.
    // See LandingPage.tsx for the full explanation; applied here for the same reasons.
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
        console.log('🎨 Generating loading particles with dimensions:', width, 'x', height);
        setParticles(generateParticles(width, height));
        return;
      }

      retryCount++;
      if (retryCount >= MAX_RETRIES) {
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

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2.5; // Faster progress (reaches 100% in ~2.4s)
      });
    }, 60);

    // Update messages every 600ms (faster than before)
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= loadingMessages.length - 1) {
          clearInterval(messageInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    // Complete loading after 2.5 seconds
    const completeTimer = setTimeout(() => {
      console.log('✅ Loading complete - transitioning to main app');
      onComplete();
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const loadingMessages = [
    'Initializing Audio Engine...',
    'Loading Visualizer...',
    'Calibrating Frequency Bands...',
    'Preparing Effects...',
    'Launching...',
  ];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
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

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {/* Spinning Icon Logo - matched to landing page */}
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
          <motion.img
            src={iconLogo}
            alt="Loading"
            onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'iconLogo')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            animate={{
              filter: [
                'drop-shadow(0 0 20px rgba(30, 144, 255, 0.6))',
                'drop-shadow(0 0 40px rgba(30, 144, 255, 0.9))',
                'drop-shadow(0 0 20px rgba(30, 144, 255, 0.6))',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* ORBITAL Text Logo (fading out) */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          <img
            src={orbitalLogo}
            alt="ORBITAL"
            onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')}
            style={{
              height: '58px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 15px rgba(30, 144, 255, 0.4))',
            }}
          />
        </motion.div>

        {/* Linear Progress Bar */}
        <div
          style={{
            width: '400px',
            height: '3px',
            background: 'rgba(30, 144, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #1E90FF 0%, #00BFFF 100%)',
              borderRadius: '2px',
              boxShadow: '0 0 10px rgba(30, 144, 255, 0.8)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        {/* Loading Messages */}
        <div style={{ height: '24px', position: 'relative' }}>
          {loadingMessages.map((message, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: idx === messageIndex ? 1 : 0,
                y: idx === messageIndex ? 0 : 10,
              }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '13px',
                color: '#7a94aa',
                letterSpacing: '0.05em',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
            >
              {message}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}