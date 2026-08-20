// ORBITAL Settings - Video Recording Section (Phase 2 Enhanced)
// Resolution, FPS, Duration, Codec, Quality, Presets, Recording Library, and Keyboard Shortcuts

import { useEffect, useRef, useState } from 'react';
import { Video, Square, Download, Trash2, Clock, Keyboard, Zap, AlertTriangle } from 'lucide-react';
import type { RecordingCodec, RecordingQuality, RecordingStartOptions } from '../../engine/recording/RecordingRuntimeController';

interface RecordingLibraryItem {
  blob: Blob;
  url: string;
  timestamp: number;
  duration: number;
  resolution?: string;
  fps?: number;
  codec?: RecordingCodec;
  quality?: RecordingQuality;
  mimeType?: string;
  extension?: 'webm' | 'mp4';
  videoBitsPerSecond?: number;
}

interface RecordingSectionProps {
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

export function RecordingSection({
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
}: RecordingSectionProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const previousLibraryLengthRef = useRef(recordingLibrary.length);

  useEffect(() => {
    if (previousLibraryLengthRef.current === 0 && recordingLibrary.length > 0) {
      setShowLibrary(true);
    }
    previousLibraryLengthRef.current = recordingLibrary.length;
  }, [recordingLibrary.length]);

  const resolutionOptions = [
    { value: '720p', label: '720p (1280×720)', impact: 'low' },
    { value: '1080p', label: '1080p (1920×1080)', impact: 'medium' },
    { value: '1440p', label: '1440p (2560×1440)', impact: 'high' },
    { value: '4k', label: '4K (3840×2160)', impact: 'extreme' }
  ];

  const fpsOptions = [
    { value: 30, label: '30 FPS', impact: 'low' },
    { value: 60, label: '60 FPS', impact: 'medium' }
  ];

  const durationOptions = [
    { value: 15, label: '15 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 60, label: '60 seconds' },
    { value: 0, label: 'Loop (manual stop, safety-limited)' }
  ];

  // Phase 2: Codec Options
  const codecOptions = [
    { value: 'vp9', label: 'WebM (VP9)', description: 'Best quality, modern browsers', recommended: true },
    { value: 'vp8', label: 'WebM (VP8)', description: 'Good compatibility' },
    { value: 'h264', label: 'H.264', description: 'Universal compatibility' }
  ];

  // Phase 2: Quality/Bitrate Options
  const qualityOptions = [
    { value: 'low', label: 'Low (2 Mbps)', bitrate: 2, description: 'Smaller files' },
    { value: 'medium', label: 'Medium (5 Mbps)', bitrate: 5, description: 'Balanced' },
    { value: 'high', label: 'High (10 Mbps)', bitrate: 10, description: 'Great quality', recommended: true },
    { value: 'ultra', label: 'Ultra (20 Mbps)', bitrate: 20, description: 'Maximum quality' }
  ];

  // Phase 2: Recording Presets
  const presets = [
    { 
      name: 'Quick Clip', 
      icon: '⚡', 
      resolution: '720p', 
      fps: 30, 
      duration: 15, 
      codec: 'vp8', 
      quality: 'medium',
      description: 'Fast, small files'
    },
    { 
      name: 'Social Media', 
      icon: '📱', 
      resolution: '1080p', 
      fps: 60, 
      duration: 30, 
      codec: 'vp9', 
      quality: 'high',
      description: '1080p60 for sharing'
    },
    { 
      name: 'High Quality', 
      icon: '🎬', 
      resolution: '1440p', 
      fps: 60, 
      duration: 0, 
      codec: 'vp9', 
      quality: 'ultra',
      description: '1440p60 production'
    },
    { 
      name: '4K Export', 
      icon: '💎', 
      resolution: '4k', 
      fps: 30, 
      duration: 0, 
      codec: 'vp9', 
      quality: 'ultra',
      description: '4K30 maximum quality'
    }
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    onResolutionChange(preset.resolution);
    onFPSChange(preset.fps);
    onDurationChange(preset.duration);
    onCodecChange(preset.codec as RecordingCodec);
    onQualityChange(preset.quality as RecordingQuality);
  };

  // Phase 2: Enhanced Performance Warning System
  const getPerformanceWarning = () => {
    const resData = resolutionOptions.find(r => r.value === recordingResolution);
    const fpsData = fpsOptions.find(f => f.value === recordingFPS);
    
    const resImpact = resData?.impact || 'low';
    const fpsImpact = fpsData?.impact || 'low';
    
    // Calculate combined impact
    if ((resImpact === 'extreme' || fpsImpact === 'extreme') || 
        (resImpact === 'high' && fpsImpact === 'high')) {
      return {
        level: 'critical',
        color: '#FF4444',
        icon: '🔥',
        message: 'EXTREME performance impact! May cause severe frame drops and system lag. Recommended for high-end systems only.',
        estimatedCPU: '40-60%'
      };
    } else if (resImpact === 'high' || fpsImpact === 'high') {
      return {
        level: 'high',
        color: '#FFA500',
        icon: '⚠️',
        message: 'High performance impact. May cause frame drops on lower-end systems.',
        estimatedCPU: '20-30%'
      };
    } else if (resImpact === 'medium' && fpsImpact === 'medium') {
      return {
        level: 'moderate',
        color: '#FFD700',
        icon: 'ℹ️',
        message: 'Moderate performance impact. Should work well on most systems.',
        estimatedCPU: '10-15%'
      };
    }
    return null;
  };

  const performanceWarning = getPerformanceWarning();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const downloadRecording = (item: RecordingLibraryItem, index: number) => {
    const a = document.createElement('a');
    a.href = item.url;
    const timestamp = new Date(item.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `ORBITAL_Recording_${timestamp}.${item.extension ?? 'webm'}`;
    a.click();
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
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Video size={14} />
        VIDEO RECORDING
      </div>

      {/* Phase 2: Quick Presets */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '9px',
          color: '#7a94aa',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          QUICK PRESETS
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px'
        }}>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(preset)}
              disabled={isRecording}
              style={{
                padding: '8px',
                background: 'linear-gradient(135deg, rgba(30,144,255,0.1) 0%, rgba(30,144,255,0.05) 100%)',
                border: '1px solid rgba(30,144,255,0.3)',
                borderRadius: '4px',
                color: '#1E90FF',
                fontSize: '9px',
                fontWeight: '700',
                cursor: isRecording ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isRecording ? 0.5 : 1,
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.2) 0%, rgba(30,144,255,0.1) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(30,144,255,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.1) 0%, rgba(30,144,255,0.05) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(30,144,255,0.3)';
                }
              }}
            >
              <div style={{ fontSize: '9px', fontWeight: '800', marginBottom: '2px' }}>{preset.name}</div>
              <div style={{ fontSize: '7px', color: '#7a94aa', fontWeight: '500' }}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Recording Controls */}
      <div style={{ marginBottom: '16px' }}>
        {/* Resolution Selector */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{
            fontSize: '9px',
            color: '#7a94aa',
            display: 'block',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Resolution
          </label>
          <select
            value={recordingResolution}
            onChange={(e) => {
              const resolution = e.target.value;
              onResolutionChange(resolution);
              if (resolution === '4k' && recordingFPS > 30) onFPSChange(30);
            }}
            disabled={isRecording}
            style={{
              width: '100%',
              padding: '8px',
              background: '#353a45',
              border: '1px solid #4a5563',
              borderRadius: '2px',
              color: '#1E90FF',
              fontSize: '11px',
              fontWeight: '600',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              opacity: isRecording ? 0.5 : 1
            }}
          >
            {resolutionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* FPS Selector */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{
            fontSize: '9px',
            color: '#7a94aa',
            display: 'block',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Frame Rate
          </label>
          <select
            value={recordingFPS}
            onChange={(e) => onFPSChange(parseInt(e.target.value, 10))}
            disabled={isRecording}
            style={{
              width: '100%',
              padding: '8px',
              background: '#353a45',
              border: '1px solid #4a5563',
              borderRadius: '2px',
              color: '#1E90FF',
              fontSize: '11px',
              fontWeight: '600',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              opacity: isRecording ? 0.5 : 1
            }}
          >
            {fpsOptions.map(opt => (
              <option key={opt.value} value={opt.value} disabled={recordingResolution === '4k' && opt.value > 30}>
                {opt.label}{recordingResolution === '4k' && opt.value > 30 ? ' (4K max 30)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Duration Selector */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            fontSize: '9px',
            color: '#7a94aa',
            display: 'block',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Duration
          </label>
          <select
            value={recordingDuration}
            onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
            disabled={isRecording}
            style={{
              width: '100%',
              padding: '8px',
              background: '#353a45',
              border: '1px solid #4a5563',
              borderRadius: '2px',
              color: '#1E90FF',
              fontSize: '11px',
              fontWeight: '600',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              opacity: isRecording ? 0.5 : 1
            }}
          >
            {durationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Phase 2: Enhanced Performance Warning */}
        {performanceWarning && (
          <div style={{
            padding: '10px',
            background: `linear-gradient(135deg, ${performanceWarning.color}15 0%, ${performanceWarning.color}08 100%)`,
            border: `1px solid ${performanceWarning.color}40`,
            borderRadius: '4px',
            fontSize: '9px',
            color: performanceWarning.color,
            marginBottom: '12px',
            lineHeight: '1.5'
          }}>
            <div style={{ 
              fontWeight: '800', 
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertTriangle size={12} />
              PERFORMANCE WARNING
            </div>
            <div style={{ fontWeight: '500', marginBottom: '6px' }}>
              {performanceWarning.message}
            </div>
            <div style={{ 
              fontSize: '8px', 
              opacity: 0.8,
              fontFamily: 'monospace'
            }}>
              Est. CPU Usage: {performanceWarning.estimatedCPU} | GPU: High
            </div>
          </div>
        )}

        {/* Phase 2: Advanced Options (Collapsible) */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '12px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: 'none',
              color: '#1E90FF',
              fontSize: '9px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            <span>ADVANCED OPTIONS</span>
            <span style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '12px' }}>
              {/* Codec Selection */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  fontSize: '9px',
                  color: '#7a94aa',
                  display: 'block',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Format / Codec
                </label>
                <select
                  value={recordingCodec}
                  onChange={(e) => onCodecChange(e.target.value as RecordingCodec)}
                  disabled={isRecording}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#353a45',
                    border: '1px solid #4a5563',
                    borderRadius: '2px',
                    color: '#1E90FF',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: isRecording ? 'not-allowed' : 'pointer',
                    opacity: isRecording ? 0.5 : 1
                  }}
                >
                  {codecOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.recommended ? '⭐' : ''}
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: '8px',
                  color: '#7a94aa',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  {codecOptions.find(c => c.value === recordingCodec)?.description}
                </div>
              </div>

              {/* Quality/Bitrate Selection */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  fontSize: '9px',
                  color: '#7a94aa',
                  display: 'block',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Quality / Bitrate
                </label>
                <select
                  value={recordingQuality}
                  onChange={(e) => onQualityChange(e.target.value as RecordingQuality)}
                  disabled={isRecording}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#353a45',
                    border: '1px solid #4a5563',
                    borderRadius: '2px',
                    color: '#1E90FF',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: isRecording ? 'not-allowed' : 'pointer',
                    opacity: isRecording ? 0.5 : 1
                  }}
                >
                  {qualityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.recommended ? '⭐' : ''}
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: '8px',
                  color: '#7a94aa',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  {qualityOptions.find(q => q.value === recordingQuality)?.description}
                </div>
              </div>

              {/* File Size Estimate */}
              <div style={{
                padding: '8px',
                background: 'rgba(30,144,255,0.05)',
                border: '1px solid rgba(30,144,255,0.2)',
                borderRadius: '2px',
                fontSize: '8px',
                color: '#94AFB4',
                marginTop: '8px'
              }}>
                <strong style={{ color: '#1E90FF' }}>Est. File Size:</strong> {
                  (() => {
                    const bitrate = qualityOptions.find(q => q.value === recordingQuality)?.bitrate || 10;
                    const seconds = recordingDuration || 30;
                    const mbSize = (bitrate * seconds) / 8;
                    return mbSize < 1000 ? `~${mbSize.toFixed(0)} MB` : `~${(mbSize / 1024).toFixed(1)} GB`;
                  })()
                } per {recordingDuration || 30}s
              </div>
            </div>
          )}
        </div>

        {/* Start/Stop Recording Buttons */}
        {!isRecording ? (
          <button
            onClick={() => onStartRecording({
              resolution: recordingResolution,
              fps: recordingFPS,
              duration: recordingDuration,
              codec: recordingCodec,
              quality: recordingQuality,
            })}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(255,68,68,0.2) 0%, rgba(255,20,20,0.1) 100%)',
              border: '1px solid rgba(255,68,68,0.5)',
              borderRadius: '4px',
              color: '#FF4444',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,68,68,0.3) 0%, rgba(255,20,20,0.2) 100%)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(255,68,68,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,68,68,0.2) 0%, rgba(255,20,20,0.1) 100%)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Video size={14} />
            START RECORDING
          </button>
        ) : (
          <div>
            <button
              onClick={onStopRecording}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, rgba(30,144,255,0.2) 0%, rgba(30,144,255,0.1) 100%)',
                border: '1px solid rgba(30,144,255,0.5)',
                borderRadius: '4px',
                color: '#1E90FF',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.3) 0%, rgba(30,144,255,0.2) 100%)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(30,144,255,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,144,255,0.2) 0%, rgba(30,144,255,0.1) 100%)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Square size={14} fill="currentColor" />
              STOP RECORDING
            </button>
            
            {/* Recording Status */}
            <div style={{
              padding: '8px',
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: '2px',
              textAlign: 'center',
              fontSize: '10px',
              color: '#FF4444',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span className="recording-pulse" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#FF4444',
                display: 'inline-block'
              }} />
              {recordingDuration > 0 ? (
                <>RECORDING: {formatTime(recordingTimeLeft)}</>
              ) : (
                <>RECORDING (LOOP)</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recording Library */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        paddingTop: '12px',
        marginTop: '12px'
      }}>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          style={{
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: '#1E90FF',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          <span>RECORDING LIBRARY ({recordingLibrary.length}/8)</span>
          <span style={{ transform: showLibrary ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </button>

        {showLibrary && (
          <div style={{ marginTop: '8px' }}>
            {recordingLibrary.length === 0 ? (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: '#7a94aa',
                fontSize: '9px',
                fontStyle: 'italic'
              }}>
                No recordings yet. Start recording to save videos!
              </div>
            ) : (
              <>
                {recordingLibrary.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      background: 'rgba(30,144,255,0.05)',
                      border: '1px solid rgba(30,144,255,0.2)',
                      borderRadius: '2px',
                      marginBottom: '6px'
                    }}
                  >
                    <div style={{
                      fontSize: '9px',
                      color: '#1E90FF',
                      fontWeight: '700',
                      marginBottom: '4px',
                      wordBreak: 'break-all'
                    }}>
                      Recording #{index + 1}
                    </div>
                    <div style={{
                      fontSize: '8px',
                      color: '#7a94aa',
                      marginBottom: '6px'
                    }}>
                      {formatTimestamp(item.timestamp)} • {formatTime(item.duration)}
                      {item.resolution ? ` • ${item.resolution}` : ''}
                      {item.fps ? ` @ ${item.fps} FPS` : ''}
                      {item.codec ? ` • ${item.codec.toUpperCase()}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => downloadRecording(item, index)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: '#353a45',
                          border: '1px solid #4a5563',
                          borderRadius: '2px',
                          color: '#1E90FF',
                          fontSize: '9px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#3f4651';
                          e.currentTarget.style.boxShadow = '0 0 8px rgba(30,144,255,0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#353a45';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Download size={10} />
                        DOWNLOAD
                      </button>
                      <button
                        onClick={() => onDeleteRecording(index)}
                        style={{
                          padding: '6px',
                          background: 'rgba(255,68,68,0.1)',
                          border: '1px solid rgba(255,68,68,0.3)',
                          borderRadius: '2px',
                          color: '#FF4444',
                          fontSize: '9px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,68,68,0.2)';
                          e.currentTarget.style.boxShadow = '0 0 8px rgba(255,68,68,0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,68,68,0.1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}

                {recordingLibrary.length > 0 && (
                  <button
                    onClick={onClearAllRecordings}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '4px',
                      background: 'rgba(255,68,68,0.1)',
                      border: '1px solid rgba(255,68,68,0.3)',
                      borderRadius: '2px',
                      color: '#FF4444',
                      fontSize: '9px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,68,68,0.2)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(255,68,68,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,68,68,0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Trash2 size={10} />
                    CLEAR ALL RECORDINGS
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        paddingTop: '12px',
        marginTop: '12px'
      }}>
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          style={{
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: '#1E90FF',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Keyboard size={12} />
            KEYBOARD SHORTCUTS
          </span>
          <span style={{ transform: showShortcuts ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </button>

        {showShortcuts && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: 'rgba(30,144,255,0.05)',
            border: '1px solid rgba(30,144,255,0.2)',
            borderRadius: '2px',
            fontSize: '9px',
            color: '#94AFB4',
            lineHeight: '1.8'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <kbd style={{
                background: '#353a45',
                padding: '2px 6px',
                borderRadius: '2px',
                fontWeight: '700',
                color: '#1E90FF',
                fontFamily: 'monospace'
              }}>R</kbd>
              <span style={{ marginLeft: '8px' }}>Start/Stop Recording</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <kbd style={{
                background: '#353a45',
                padding: '2px 6px',
                borderRadius: '2px',
                fontWeight: '700',
                color: '#1E90FF',
                fontFamily: 'monospace'
              }}>S</kbd>
              <span style={{ marginLeft: '8px' }}>Capture Screenshot (PNG)</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <kbd style={{
                background: '#353a45',
                padding: '2px 6px',
                borderRadius: '2px',
                fontWeight: '700',
                color: '#1E90FF',
                fontFamily: 'monospace'
              }}>F</kbd>
              <span style={{ marginLeft: '8px' }}>Toggle Fullscreen</span>
            </div>
            <div>
              <kbd style={{
                background: '#353a45',
                padding: '2px 6px',
                borderRadius: '2px',
                fontWeight: '700',
                color: '#1E90FF',
                fontFamily: 'monospace'
              }}>?</kbd>
              <span style={{ marginLeft: '8px' }}>Show All Shortcuts</span>
            </div>
            <div style={{
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(30,144,255,0.2)',
              fontSize: '8px',
              color: '#7a94aa',
              fontStyle: 'italic'
            }}>
              💡 Recordings capture canvas only (UI-free). Collapse the panel for clean recordings.
            </div>
          </div>
        )}
      </div>

      {/* Recording Pulse Animation */}
      <style dangerouslySetInnerHTML={{__html: `
        .recording-pulse {
          animation: recording-pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes recording-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
      `}} />
    </div>
  );
}