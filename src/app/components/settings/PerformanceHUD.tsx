// ORBITAL Settings - Performance HUD
// Sleek minimalist CPU/Memory/FPS/Quality display

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { getStoredRenderDisplayMode, setStoredRenderDisplayMode, RENDER_SCALE_PROFILES, type RenderDisplayMode } from '../../utils/adaptiveRenderScale';
import { mainThreadUIRefreshBus } from '../../runtime/visualizer/pipeline/MainThreadUIRefreshBus';

interface PerformanceHUDProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function PerformanceHUD({ enabled, onToggle }: PerformanceHUDProps) {
  const [fps, setFps] = useState(60);
  const [cpu, setCpu] = useState(0);
  const [memory, setMemory] = useState(0);
  const [quality, setQuality] = useState(100);
  const [renderMode, setRenderMode] = useState<RenderDisplayMode>(() => getStoredRenderDisplayMode());

  useEffect(() => {
    if (!enabled) return;
    return mainThreadUIRefreshBus.subscribePerformanceHUD((snapshot) => {
      setFps(snapshot.fps);
      setCpu(snapshot.cpu);
      setMemory(snapshot.memoryMB);
      setQuality(snapshot.quality);
    });
  }, [enabled]);

  const getQualityColor = (quality: number) => {
    if (quality >= 90) return '#00FF88';
    if (quality >= 70) return '#FFD700';
    if (quality >= 50) return '#FFA500';
    return '#FF4444';
  };

  const getQualityLabel = (quality: number) => {
    if (quality >= 90) return 'EXCELLENT';
    if (quality >= 70) return 'GOOD';
    if (quality >= 50) return 'FAIR';
    return 'POOR';
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
        justifyContent: 'space-between'
      }}>
        <span>PERFORMANCE MONITOR</span>
      </div>

      {/* Toggle Switch */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        border: '1px solid rgba(30,144,255,0.15)'
      }}>
        <span style={{
          fontSize: '10px',
          color: '#94AFB4',
          fontWeight: '600'
        }}>
          ENABLE HUD OVERLAY
        </span>
        <button
          onClick={() => onToggle(!enabled)}
          style={{
            width: '44px',
            height: '22px',
            background: enabled 
              ? 'linear-gradient(135deg, #1E90FF 0%, #0066CC 100%)'
              : 'rgba(255,255,255,0.1)',
            border: enabled 
              ? '1px solid rgba(30,144,255,0.5)'
              : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '11px',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.3s'
          }}
        >
          <div style={{
            width: '16px',
            height: '16px',
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: enabled ? '24px' : '2px',
            transition: 'all 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </button>
      </div>


      {/* Render Scale Mode */}
      <div style={{
        marginBottom: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        border: '1px solid rgba(30,144,255,0.15)'
      }}>
        <div style={{
          fontSize: '10px',
          color: '#94AFB4',
          fontWeight: '700',
          marginBottom: '8px',
          letterSpacing: '0.5px'
        }}>
          DISPLAY / RENDER MODE
        </div>
        <select
          value={renderMode}
          onChange={(e) => {
            const next = e.target.value as RenderDisplayMode;
            setRenderMode(next);
            setStoredRenderDisplayMode(next);
          }}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.45)',
            color: '#E8F7FF',
            border: '1px solid rgba(4,217,255,0.35)',
            borderRadius: '5px',
            padding: '7px 8px',
            fontSize: '10px',
            outline: 'none'
          }}
        >
          {Object.values(RENDER_SCALE_PROFILES).map((profile) => (
            <option key={profile.mode} value={profile.mode}>{profile.label}</option>
          ))}
        </select>
        <div style={{ marginTop: '7px', fontSize: '8.5px', lineHeight: 1.35, color: 'rgba(148,175,180,0.65)' }}>
          Controls internal canvas DPR/backing resolution without changing the visual layout. Balanced is the default for laptop/LCD displays; Large Display and Ultra are sharper but heavier.
        </div>
      </div>

      {/* Performance Stats Preview */}
      {enabled && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(30,144,255,0.2)',
          borderRadius: '6px',
          padding: '12px',
          fontFamily: 'monospace'
        }}>
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <StatDisplay label="FPS:" value={fps} unit="fps" color="#1E90FF" />
            <StatDisplay label="CPU:" value={cpu} unit="%" color="#FFD700" />
            <StatDisplay label="RES:" value="1920×1080" unit="" color="#94AFB4" />
            <StatDisplay label="MEM:" value={memory} unit="MB" color="#FF69B4" />
          </div>

          {/* Quality Grade */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            border: `1px solid ${getQualityColor(quality)}40`
          }}>
            <span style={{
              fontSize: '9px',
              color: '#94AFB4',
              fontWeight: '600'
            }}>
              QUALITY:
            </span>
            <span style={{
              fontSize: '10px',
              color: getQualityColor(quality),
              fontWeight: '700',
              textShadow: `0 0 8px ${getQualityColor(quality)}80`
            }}>
              {quality}% • {getQualityLabel(quality)}
            </span>
          </div>
        </div>
      )}

      {/* Info Text */}
      <div style={{
        marginTop: '12px',
        fontSize: '9px',
        color: 'rgba(148,175,180,0.6)',
        lineHeight: '1.4'
      }}>
        Performance HUD displays real-time metrics in the top-right corner of the visualizer. Auto-optimizes settings for smoother FPS on lower-end hardware.
      </div>
    </div>
  );
}

// Stat Display Component
function StatDisplay({ 
  label, 
  value, 
  unit, 
  color 
}: { 
  label: string; 
  value: string | number; 
  unit: string; 
  color: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <span style={{
        fontSize: '9px',
        color: '#94AFB4',
        fontWeight: '600'
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '10px',
        color: color,
        fontWeight: '700'
      }}>
        {value}{unit}
      </span>
    </div>
  );
}