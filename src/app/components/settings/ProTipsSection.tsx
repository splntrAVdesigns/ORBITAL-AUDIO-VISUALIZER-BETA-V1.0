// ORBITAL Settings - ProTips Section
// Quick reference guide for formats, features, and shortcuts

import { useState } from 'react';
import { HelpCircle, Keyboard, ChevronDown } from 'lucide-react';

export function ProTipsSection() {
  const [activeTab, setActiveTab] = useState<'intro' | 'shortcuts'>('intro');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Section Header */}
      <div style={{
        fontSize: '11px',
        fontWeight: '700',
        color: '#1E90FF',
        letterSpacing: '1px',
        marginBottom: '12px',
        textTransform: 'uppercase'
      }}>
        PROTIPS
      </div>

      <div style={{
        fontSize: '9px',
        color: 'rgba(148,175,180,0.7)',
        marginBottom: '12px',
        lineHeight: '1.4'
      }}>
        Quick reference guide for formats, features, and shortcuts
      </div>

      {/* Tab Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('intro')}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: activeTab === 'intro' 
              ? 'rgba(30,144,255,0.2)' 
              : 'rgba(30,144,255,0.05)',
            border: activeTab === 'intro'
              ? '1px solid rgba(30,144,255,0.4)'
              : '1px solid rgba(30,144,255,0.2)',
            borderRadius: '4px',
            color: activeTab === 'intro' ? '#1E90FF' : '#7a94aa',
            fontSize: '9px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s'
          }}
        >
          <HelpCircle size={12} />
          Intro Tips
        </button>

        <button
          onClick={() => setActiveTab('shortcuts')}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: activeTab === 'shortcuts' 
              ? 'rgba(30,144,255,0.2)' 
              : 'rgba(30,144,255,0.05)',
            border: activeTab === 'shortcuts'
              ? '1px solid rgba(30,144,255,0.4)'
              : '1px solid rgba(30,144,255,0.2)',
            borderRadius: '4px',
            color: activeTab === 'shortcuts' ? '#1E90FF' : '#7a94aa',
            fontSize: '9px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s'
          }}
        >
          <Keyboard size={12} />
          Shortcuts
        </button>
      </div>

      {/* Content Area */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(30,144,255,0.15)',
        borderRadius: '6px',
        padding: '12px',
        maxHeight: '400px',
        overflowY: 'auto',
        fontSize: '9px',
        lineHeight: '1.5',
        color: 'rgba(148,175,180,0.9)',
        position: 'relative'
      }}>
        <div style={{
          opacity: 1,
          transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        {activeTab === 'intro' ? (
          <>
            {/* Audio Formats */}
            <CollapsibleItem
              title="Audio Formats"
              expanded={expandedSection === 'audio'}
              onToggle={() => toggleSection('audio')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                <strong style={{ color: '#1E90FF' }}>Supported:</strong> MP3, WAV, AIFF, M4A, OGG, FLAC
              </div>
            </CollapsibleItem>

            {/* Image/Video Formats */}
            <CollapsibleItem
              title="Image / Video Formats"
              expanded={expandedSection === 'media'}
              onToggle={() => toggleSection('media')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '8px' }}>
                <strong style={{ color: '#1E90FF' }}>Images:</strong> JPG, PNG, GIF, WebP
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '8px' }}>
                <strong style={{ color: '#1E90FF' }}>Videos:</strong> MP4, WebM, MOV
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '8px' }}>
                <strong style={{ color: '#1E90FF' }}>Images:</strong> 1080×1080px+ (square) for best fit
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                <strong style={{ color: '#1E90FF' }}>Videos:</strong> H.264/VP9, 30-60fps, &lt;50MB
              </div>
            </CollapsibleItem>

            {/* Tips */}
            <CollapsibleItem
              title="Pro Tips"
              expanded={expandedSection === 'tips'}
              onToggle={() => toggleSection('tips')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                • <strong style={{ color: '#94AFB4' }}>Convert videos to MP4 (H.264)</strong> - Browsers only support H.264 video codec
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                • <strong style={{ color: '#94AFB4' }}>Lower scale if images clip</strong> during reactive pulses
              </div>
            </CollapsibleItem>

            {/* Performance Mode */}
            <CollapsibleItem
              title="Performance Mode"
              expanded={expandedSection === 'performance'}
              onToggle={() => toggleSection('performance')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                Auto-optimizes settings for smoother FPS on lower-end hardware.
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                Monitors FPS, CPU, resolution, and memory usage in real-time.
              </div>
            </CollapsibleItem>

            {/* Export/Import */}
            <CollapsibleItem
              title="Export/Import Settings"
              expanded={expandedSection === 'export'}
              onToggle={() => toggleSection('export')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                Save complete scenes as JSON files for live performances.
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                Perfect for DJs—load different visual setups instantly between sets!
              </div>
            </CollapsibleItem>

            {/* Microphone Feedback */}
            <CollapsibleItem
              title="Microphone Feedback Prevention"
              expanded={expandedSection === 'mic'}
              onToggle={() => toggleSection('mic')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                When enabling Microphone, Monitor automatically disables to prevent audio feedback.
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                Re-enable Monitor after switching back to file playback.
              </div>
            </CollapsibleItem>

            {/* OBS Capture */}
            <CollapsibleItem
              title="OBS Canvas Capture Guide"
              expanded={expandedSection === 'obs'}
              onToggle={() => toggleSection('obs')}
            >
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                1. Add <strong style={{ color: '#94AFB4' }}>Browser Source</strong> in OBS
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                2. Set URL to ORBITAL web address
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                3. Resolution: 1920×1080 (or custom)
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)', marginBottom: '6px' }}>
                4. FPS: 60fps for smooth capture
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                5. Enable <strong style={{ color: '#94AFB4' }}>Shutdown source when not visible</strong> for better performance
              </div>
            </CollapsibleItem>
          </>
        ) : (
          <>
            {/* Keyboard Shortcuts */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                color: '#1E90FF', 
                fontWeight: '700', 
                marginBottom: '8px',
                fontSize: '10px'
              }}>
                Keyboard Shortcuts:
              </div>
              
              <ShortcutItem shortcut="SPACE" description="Play/Pause" />
              <ShortcutItem shortcut="M" description="Mute" />
              <ShortcutItem shortcut="1-4" description="Modes" />
              <ShortcutItem shortcut="C" description="Colors" />
              <ShortcutItem shortcut="F" description="Fullscreen (ESC to exit)" />
              <ShortcutItem shortcut="S" description="Screenshot" />
              <ShortcutItem shortcut="R" description="Record" />
              <ShortcutItem shortcut="H" description="Hide Panel" />
              <ShortcutItem shortcut="?" description="Help" />
            </div>

            {/* Additional Tips */}
            <div style={{
              background: 'rgba(30,144,255,0.08)',
              border: '1px solid rgba(30,144,255,0.2)',
              borderRadius: '4px',
              padding: '8px',
              marginTop: '8px'
            }}>
              <div style={{ color: '#1E90FF', fontWeight: '600', marginBottom: '4px' }}>
                Quick Tip:
              </div>
              <div style={{ color: 'rgba(148,175,180,0.8)' }}>
                Use presets to quickly switch between visual styles. Save your custom setups for instant recall during live performances!
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// Collapsible Item Component
function CollapsibleItem({ 
  title, 
  expanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  expanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div style={{
      marginBottom: '8px',
      background: expanded ? 'rgba(30,144,255,0.05)' : 'transparent',
      border: expanded ? '1px solid rgba(30,144,255,0.15)' : '1px solid transparent',
      borderRadius: '4px',
      overflow: 'hidden',
      transition: 'background 0.3s cubic-bezier(0.4, 0, 0.2, 1), border 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '8px',
          background: 'transparent',
          border: 'none',
          color: expanded ? '#1E90FF' : '#94AFB4',
          fontSize: '9px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'color 0.2s'
        }}
      >
        <span>{title}</span>
        <ChevronDown 
          size={12} 
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </button>
      {expanded ? (
        <div
          role="region"
          aria-label={`${title} tips`}
          style={{
            padding: '8px',
            paddingTop: '0',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Shortcut Item Component
function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '6px',
      paddingBottom: '6px',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    }}>
      <span style={{
        background: 'rgba(30,144,255,0.15)',
        border: '1px solid rgba(30,144,255,0.3)',
        borderRadius: '3px',
        padding: '2px 6px',
        fontSize: '8px',
        fontWeight: '700',
        color: '#1E90FF',
        fontFamily: 'monospace'
      }}>
        {shortcut}
      </span>
      <span style={{ color: 'rgba(148,175,180,0.8)', fontSize: '9px' }}>
        {description}
      </span>
    </div>
  );
}