import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Play, Sliders, Radio, Zap, Sparkles } from 'lucide-react';

import { orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';
import { safeLocalStorage } from '../utils/browserCompat';

interface IntroTutorialProps {
  onClose: () => void;
}

export function IntroTutorial({ onClose }: IntroTutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 5;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        setCurrentSlide(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(prev => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const handleSkip = () => {
    safeLocalStorage.setItem('orbital-intro-completed', 'true');
    onClose();
  };

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleSkip(); // Last slide "Get Started" button
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const slides = [
    // Slide 1: Welcome
    {
      icon: <img src={orbitalLogo} alt="ORBITAL" onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')} style={{ width: '80px', height: 'auto' }} />,
      title: 'Welcome to ORBITAL',
      subtitle: 'Audio-Reactive Visualizer Engine',
      content: (
        <div style={{ color: '#94afc4', lineHeight: '1.7' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1rem' }}>
            {/* Left Column */}
            <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>4 Visualization Modes:</strong> Chaos, Storm, Heat, Wave</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>60+ Parameters:</strong> Fine-tune every visual element</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>MIDI Controller:</strong> Hardware integration support</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>Playlist System:</strong> Queue multiple tracks seamlessly</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>RGB Offset & Jitter:</strong> Chromatic distortion effects</span>
              </div>
            </div>
            
            {/* Right Column */}
            <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>60+ Sacred Shapes:</strong> Geometric pattern library</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>Smart Beat Detection:</strong> Adaptive real-time rhythm analysis</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>4K Recording:</strong> Export high-quality video & GIF</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>40 Color Palettes:</strong> Curated gradient collections</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ color: '#1E90FF', fontSize: '1rem' }}>▶</span>
                <span><strong style={{ color: '#b0c9dd' }}>Custom Center Images:</strong> Upload your own logos</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#7a94aa', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(30,144,255,0.2)' }}>
            Optimized for Desktop & Tablets • Performance-tuned for 60fps
          </div>
        </div>
      ),
    },
    // Slide 2: Quick Start
    {
      icon: <Play size={48} color="#1E90FF" strokeWidth={1.5} />,
      title: 'Quick Start',
      subtitle: 'Get up and running in seconds',
      content: (
        <div style={{ textAlign: 'left', color: '#94afc4', lineHeight: '1.8', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#1E90FF', fontWeight: '700', fontSize: '1.2rem' }}>1.</span>
            <span><strong style={{ color: '#b0c9dd' }}>Load Audio:</strong> Upload a file, enable your microphone, or use demo sounds</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#1E90FF', fontWeight: '700', fontSize: '1.2rem' }}>2.</span>
            <span><strong style={{ color: '#b0c9dd' }}>Choose a Preset:</strong> Browse 20 built-in visual styles in the Presets panel</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#1E90FF', fontWeight: '700', fontSize: '1.2rem' }}>3.</span>
            <span><strong style={{ color: '#b0c9dd' }}>Customize:</strong> Tweak controls to create your perfect visual experience</span>
          </div>
        </div>
      ),
    },
    // Slide 3: Performance Tips
    {
      icon: <Zap size={48} color="#00D9FF" strokeWidth={1.5} />,
      title: 'Best Performance',
      subtitle: 'Recommended settings for smooth visuals',
      content: (
        <div style={{ textAlign: 'left', color: '#94afc4', lineHeight: '1.8', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Use Google Chrome</strong> for best compatibility and performance</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Enable Hardware Acceleration</strong> in browser settings</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Close Other Tabs</strong> to free up system resources</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Lower Quality Settings</strong> if you experience frame drops</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Disable Motion Blur</strong> for maximum FPS in complex scenes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#00D9FF', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Check ProTips</strong> in Session Settings for detailed guidance</span>
          </div>
        </div>
      ),
    },
    // Slide 4: Key Features
    {
      icon: <Radio size={48} color="#8A2BE2" strokeWidth={1.5} />,
      title: 'Powerful Features',
      subtitle: 'Explore what ORBITAL can do',
      content: (
        <div style={{ textAlign: 'left', color: '#94afc4', lineHeight: '1.8', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#8A2BE2', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>20+ Presets:</strong> From cosmic fractals to sacred geometry</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#8A2BE2', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>MIDI Support:</strong> Control visuals with your MIDI controller</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#8A2BE2', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>60+ Sacred Shapes:</strong> Metatron's Cube, Flower of Life, and more</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#8A2BE2', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Record Sessions:</strong> Capture visuals in WebM & GIF formats</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#8A2BE2', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Real-Time Analytics:</strong> FPS tracking and performance monitoring</span>
          </div>
        </div>
      ),
    },
    // Slide 5: Controls Guide
    {
      icon: <Sliders size={48} color="#FF6B9D" strokeWidth={1.5} />,
      title: 'Master the Controls',
      subtitle: 'Tips for navigating the interface',
      content: (
        <div style={{ textAlign: 'left', color: '#94afc4', lineHeight: '1.8', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#FF6B9D', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Collapsible Panels:</strong> Click section headers to expand/collapse</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#FF6B9D', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Macro Knobs:</strong> Click and drag circular controls for precise adjustments</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#FF6B9D', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Global Minimize:</strong> Collapse all sections with one click for clean workspace</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#FF6B9D', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>ProTips Section:</strong> Find keyboard shortcuts, format guides, and more</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
            <span style={{ color: '#FF6B9D', fontSize: '1rem' }}>▶</span>
            <span><strong style={{ color: '#b0c9dd' }}>Preset Switching:</strong> Use arrow keys to navigate presets quickly</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem',
      }}
      onClick={(e) => {
        // Close if clicking outside the modal
        if (e.target === e.currentTarget) {
          handleSkip();
        }
      }}
    >
      {/* Modal Card */}
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'linear-gradient(135deg, rgba(26,29,35,0.95) 0%, rgba(15,17,21,0.95) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(30,144,255,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(30,144,255,0.1)',
        padding: '2.5rem 2rem',
        position: 'relative',
      }}>
        {/* Close Button */}
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: '#7a94aa',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(30,144,255,0.1)';
            e.currentTarget.style.color = '#1E90FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#7a94aa';
          }}
        >
          <X size={20} />
        </button>

        {/* Slide Content */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            {slides[currentSlide].icon}
          </div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '0.5rem',
            letterSpacing: '0.02em',
          }}>
            {slides[currentSlide].title}
          </h2>
          <p style={{
            fontSize: '0.9rem',
            color: '#7a94aa',
            marginBottom: '1.5rem',
          }}>
            {slides[currentSlide].subtitle}
          </p>
        </div>

        <div style={{
          minHeight: '200px',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'rgba(30,144,255,0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(30,144,255,0.15)',
        }}>
          {slides[currentSlide].content}
        </div>

        {/* Navigation Dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              style={{
                width: index === currentSlide ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: index === currentSlide 
                  ? 'linear-gradient(90deg, #1E90FF 0%, #8A2BE2 100%)'
                  : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}>
          {/* Back Button */}
          <button
            onClick={handleBack}
            disabled={currentSlide === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: currentSlide === 0 ? '#444' : '#94afc4',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: currentSlide === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: currentSlide === 0 ? 0.3 : 1,
            }}
            onMouseEnter={(e) => {
              if (currentSlide > 0) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(30,144,255,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              color: '#7a94aa',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textDecoration: 'underline',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#94afc4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#7a94aa';
            }}
          >
            Skip Tutorial
          </button>

          {/* Next/Get Started Button */}
          <button
            onClick={handleNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #1E90FF 0%, #8A2BE2 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(30,144,255,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30,144,255,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,144,255,0.3)';
            }}
          >
            {currentSlide === totalSlides - 1 ? 'Get Started' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}