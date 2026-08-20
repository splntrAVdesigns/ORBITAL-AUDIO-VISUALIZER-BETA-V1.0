// ORBITAL Settings Panel - Main Container
// Slidable panel with Export, Import, ProTips, Performance, and more

import { Settings, X, Maximize2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { ExportSection } from './settings/ExportSection';
import { ImportSection } from './settings/ImportSection';
import { ProTipsSection } from './settings/ProTipsSection';
import { PerformanceHUD } from './settings/PerformanceHUD';
import { RecordingSection } from './settings/RecordingSection';
import type { RecordingCodec, RecordingQuality, RecordingStartOptions } from '../engine/recording/RecordingRuntimeController';

interface RecordingLibraryItem {
  blob: Blob;
  url: string;
  timestamp: number;
  duration: number;
  resolution?: string;
  fps?: number;
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaptureScreenshot: () => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
  onToggleFullscreen: () => void;
  performanceHUDEnabled: boolean;
  onPerformanceHUDToggle: (enabled: boolean) => void;
  sessionState: string;
  sessionReason: string;
  sessionPreviousExit: string;
  onSafeGraphicsRecovery: () => void;
  // Recording props
  onStartRecording: (options: RecordingStartOptions) => void;
  onStopRecording: () => void;
  isRecording: boolean;
  recordingTimeLeft: number;
  recordingLibrary: RecordingLibraryItem[];
  onDeleteRecording: (index: number) => void;
  onClearAllRecordings: () => void;
  recordingResolution: string;
  recordingFPS: number;
  recordingDuration: number;
  recordingCodec: RecordingCodec;
  recordingQuality: RecordingQuality;
  onResolutionChange: (resolution: string) => void;
  onFPSChange: (fps: number) => void;
  onDurationChange: (duration: number) => void;
  onCodecChange: (codec: RecordingCodec) => void;
  onQualityChange: (quality: RecordingQuality) => void;
}

export function SettingsPanel({
  open,
  onOpenChange,
  onCaptureScreenshot,
  onExportSettings,
  onImportSettings,
  onToggleFullscreen,
  performanceHUDEnabled,
  onPerformanceHUDToggle,
  sessionState,
  sessionReason,
  sessionPreviousExit,
  onSafeGraphicsRecovery,
  onStartRecording,
  onStopRecording,
  isRecording,
  recordingTimeLeft,
  recordingLibrary,
  onDeleteRecording,
  onClearAllRecordings,
  recordingResolution,
  recordingFPS,
  recordingDuration,
  recordingCodec,
  recordingQuality,
  onResolutionChange,
  onFPSChange,
  onDurationChange,
  onCodecChange,
  onQualityChange
}: SettingsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right"
        className="settings-panel-content"
        style={{
          width: '350px',
          maxWidth: '100vw',
          background: 'linear-gradient(180deg, rgba(40,44,52,.98) 0%, rgba(35,38,45,.98) 100%)',
          borderLeft: '1px solid rgba(30,144,255,0.3)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <SheetHeader style={{
          padding: '16px',
          borderBottom: '2px solid rgba(30,144,255,0.3)',
          background: 'rgba(0,0,0,0.3)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <SheetTitle style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#1E90FF',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0
            }}>
              <Settings size={16} />
              SESSION SETTINGS
            </SheetTitle>
            <SheetDescription style={{ display: 'none' }}>
              Configure export, import, and performance settings
            </SheetDescription>
            <button
              onClick={() => onOpenChange(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#7a94aa',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1E90FF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#7a94aa'}
            >
              <X size={18} />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          <section style={{ padding: '16px', borderBottom: '1px solid rgba(30,144,255,0.18)' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#1E90FF', marginBottom: '8px' }}>
              SESSION RESILIENCE
            </div>
            <div style={{ fontSize: '9px', color: sessionState === 'running' ? 'rgba(128,220,170,0.9)' : '#f6c56c', fontFamily: 'monospace', marginBottom: '6px' }}>
              {sessionState.toUpperCase()}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(148,175,180,0.82)', lineHeight: '1.45', marginBottom: '10px' }}>
              {sessionReason}
            </div>
            {sessionPreviousExit && (
              <div style={{ fontSize: '8px', color: 'rgba(246,197,108,0.8)', lineHeight: '1.4', marginBottom: '10px', borderLeft: '2px solid rgba(246,197,108,0.55)', paddingLeft: '7px' }}>
                Previous session: {sessionPreviousExit}
              </div>
            )}
            <button
              type="button"
              onClick={onSafeGraphicsRecovery}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '5px', border: '1px solid rgba(30,144,255,0.52)', background: 'rgba(30,144,255,0.12)', color: '#d8efff', cursor: 'pointer', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' }}
            >
              SAFE GRAPHICS RECOVERY
            </button>
            <div style={{ fontSize: '8px', color: 'rgba(148,175,180,0.62)', lineHeight: '1.4', marginTop: '8px' }}>
              Reclaims renderer resources and switches to a safe graphics fallback without reloading the page or stopping audio.
            </div>
          </section>
          {/* Recording Section - Moved to top for easy access */}
          <RecordingSection
              onStartRecording={onStartRecording}
              onStopRecording={onStopRecording}
              isRecording={isRecording}
              recordingTimeLeft={recordingTimeLeft}
              recordingLibrary={recordingLibrary}
              onDeleteRecording={onDeleteRecording}
              onClearAllRecordings={onClearAllRecordings}
              recordingResolution={recordingResolution}
              recordingFPS={recordingFPS}
              recordingDuration={recordingDuration}
              recordingCodec={recordingCodec}
              recordingQuality={recordingQuality}
              onResolutionChange={onResolutionChange}
              onFPSChange={onFPSChange}
              onDurationChange={onDurationChange}
              onCodecChange={onCodecChange}
              onQualityChange={onQualityChange}
          />

          {/* Export Section */}
          <ExportSection
            onCaptureScreenshot={onCaptureScreenshot}
            onExportSettings={onExportSettings}
          />

          {/* Import Section */}
          <ImportSection
            onImportSettings={onImportSettings}
          />

          {/* Fullscreen Button */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#1E90FF',
              letterSpacing: '1px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              DISPLAY
            </div>
            <button
              onClick={onToggleFullscreen}
              style={{
                width: '100%',
                padding: '10px',
                background: '#353a45',
                border: '1px solid #4a5563',
                borderRadius: '2px',
                color: '#1E90FF',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(30,144,255,.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Maximize2 size={14} />
              TOGGLE FULLSCREEN (F)
            </button>
            <div style={{
              marginTop: '8px',
              fontSize: '9px',
              color: 'rgba(148,175,180,0.6)',
              lineHeight: '1.4'
            }}>
              Press <strong style={{ color: '#1E90FF' }}>F</strong> or <strong style={{ color: '#1E90FF' }}>ESC</strong> to toggle fullscreen mode
            </div>
          </div>

          {/* Performance HUD */}
          <PerformanceHUD
            enabled={performanceHUDEnabled}
            onToggle={onPerformanceHUDToggle}
          />

          {/* ProTips Section */}
          <ProTipsSection />

          {/* Control Panel Descriptions */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#1E90FF',
              letterSpacing: '1px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              CONTROL PANEL GUIDE
            </div>
            <div style={{
              fontSize: '9px',
              lineHeight: '1.6',
              color: 'rgba(148,175,180,0.8)'
            }}>
              <DescriptionItem
                title="Audio Input"
                description="Select audio source: Microphone for live input, File for audio playback, or Demo for built-in test sounds"
              />
              <DescriptionItem
                title="Visualization Mode"
                description="Choose between Radial, Waveform, Particle, or Hybrid visualization styles"
              />
              <DescriptionItem
                title="Color Theme"
                description="Select color palette and customize hue shift, saturation burst, and color wave effects"
              />
              <DescriptionItem
                title="Reactivity Controls"
                description="Adjust Motion Intensity, Motion Smoothing, and Bass Boost for audio responsiveness"
              />
              <DescriptionItem
                title="Animation Controls"
                description="Configure rotation speed, beat sync, energy gate, and orbital energy effects"
              />
              <DescriptionItem
                title="Visual Effects"
                description="Enable motion blur, iridize, color wave, and saturation burst effects"
              />
              <DescriptionItem
                title="Liquid Shaper"
                description="WebGL-powered sacred geometry engine with 40+ patterns including Flower of Life, Sri Yantra, and Metatron's Cube"
              />
              <DescriptionItem
                title="Core Particles"
                description="Dynamic particle system with size, glow, chaos, spread, and intensity controls"
              />
              <DescriptionItem
                title="Center Graphic"
                description="Upload custom images/videos for reactive center content with scale and effect controls"
              />
            </div>
          </div>

          {/* Footer Info */}
          <div style={{
            padding: '16px',
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(30,144,255,0.2)'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'rgba(30,144,255,0.8)',
              letterSpacing: '0.5px',
              fontFamily: 'monospace',
              textAlign: 'center'
            }}>
              ORBITAL v1.0 BETA
            </div>
            <div style={{
              fontSize: '8px',
              color: 'rgba(148,175,180,0.5)',
              textAlign: 'center',
              marginTop: '4px'
            }}>
              Audio-Reactive Visualizer Engine
            </div>
          </div>
        </div>

        {/* Custom Scrollbar Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          .settings-panel-content::-webkit-scrollbar {
            width: 8px;
          }
          .settings-panel-content::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
          }
          .settings-panel-content::-webkit-scrollbar-thumb {
            background: rgba(30,144,255,0.3);
            border-radius: 4px;
          }
          .settings-panel-content::-webkit-scrollbar-thumb:hover {
            background: rgba(30,144,255,0.5);
          }
        `}} />
      </SheetContent>
    </Sheet>
  );
}

// Description Item Component
function DescriptionItem({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      marginBottom: '10px',
      paddingBottom: '10px',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{
        color: '#1E90FF',
        fontWeight: '600',
        marginBottom: '4px',
        fontSize: '9px'
      }}>
        {title}
      </div>
      <div style={{
        color: 'rgba(148,175,180,0.7)',
        fontSize: '8px',
        lineHeight: '1.5'
      }}>
        {description}
      </div>
    </div>
  );
}