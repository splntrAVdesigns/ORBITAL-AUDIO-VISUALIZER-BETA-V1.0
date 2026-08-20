// ORBITAL Settings - Export Section
// Handles PNG screenshot, JSON settings export, and recording with countdown

import { useState, useRef, useEffect } from 'react';
import { Camera, Download, Video, Clock } from 'lucide-react';

interface ExportSectionProps {
  onCaptureScreenshot: () => void;
  onExportSettings: () => void;
  onStartRecording?: () => void;
  recordingTimeLeft?: number;
  isRecording?: boolean;
}

export function ExportSection({
  onCaptureScreenshot,
  onExportSettings,
  onStartRecording,
  recordingTimeLeft = 0,
  isRecording = false
}: ExportSectionProps) {
  const [countdown, setCountdown] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const countdownInterval = useRef<number | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setShowCountdown(false);
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
            }
            // Trigger recording start
            if (onStartRecording) {
              onStartRecording();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [countdown, onStartRecording]);

  const handleRecordClick = () => {
    if (!isRecording) {
      setCountdown(5);
      setShowCountdown(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        CAPTURE & EXPORT
      </div>

      {/* Countdown Overlay */}
      {showCountdown && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          fontSize: '120px',
          fontWeight: '900',
          color: countdown <= 2 ? '#FF4444' : '#1E90FF',
          textShadow: '0 0 40px currentColor, 0 0 80px currentColor',
          animation: 'pulse 1s ease-in-out',
          pointerEvents: 'none'
        }}>
          {countdown}
        </div>
      )}

      {/* Screenshot Button */}
      <button
        onClick={onCaptureScreenshot}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '8px',
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
        <Camera size={14} />
        CAPTURE SCREENSHOT (PNG)
      </button>

      {/* Export Settings Button */}
      <button
        onClick={onExportSettings}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '8px',
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
        <Download size={14} />
        EXPORT SETTINGS (JSON)
      </button>

      {/* Recording Button - Future Feature */}
      {onStartRecording && (
        <button
          onClick={handleRecordClick}
          disabled={isRecording}
          style={{
            width: '100%',
            padding: '10px',
            background: isRecording 
              ? 'linear-gradient(135deg, rgba(255,68,68,0.25) 0%, rgba(255,68,68,0.15) 100%)'
              : 'linear-gradient(135deg, rgba(30,144,255,0.15) 0%, rgba(30,144,255,0.05) 100%)',
            border: isRecording 
              ? '1px solid rgba(255,68,68,0.5)'
              : '1px solid rgba(30,144,255,0.3)',
            borderRadius: '6px',
            color: isRecording ? '#FF4444' : '#94AFB4',
            fontSize: '11px',
            fontWeight: '600',
            cursor: isRecording ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            opacity: isRecording ? 1 : 0.7
          }}
          onMouseEnter={(e) => {
            if (!isRecording) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.25) 0%, rgba(30,144,255,0.15) 100%)';
              e.currentTarget.style.borderColor = 'rgba(30,144,255,0.5)';
              e.currentTarget.style.color = '#1E90FF';
              e.currentTarget.style.opacity = '1';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecording) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.15) 0%, rgba(30,144,255,0.05) 100%)';
              e.currentTarget.style.borderColor = 'rgba(30,144,255,0.3)';
              e.currentTarget.style.color = '#94AFB4';
              e.currentTarget.style.opacity = '0.7';
            }
          }}
        >
          {isRecording ? (
            <>
              <Video size={14} className="recording-pulse" />
              RECORDING: {formatTime(recordingTimeLeft)}
            </>
          ) : (
            <>
              <Clock size={14} />
              START RECORDING (5s countdown)
            </>
          )}
        </button>
      )}

      {/* Info Text */}
      <div style={{
        marginTop: '12px',
        fontSize: '9px',
        color: 'rgba(148,175,180,0.6)',
        lineHeight: '1.4'
      }}>
        Screenshots capture current canvas frame as PNG. Settings export includes all parameters and custom presets.
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
        }
        
        .recording-pulse {
          animation: recording-blink 1s ease-in-out infinite;
        }
        
        @keyframes recording-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}} />
    </div>
  );
}