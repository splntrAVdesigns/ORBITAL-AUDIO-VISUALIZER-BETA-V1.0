// ORBITAL - Performance HUD Overlay
// Displays on-canvas performance metrics when enabled

import { useEffect, useState } from 'react';
import { mainThreadUIRefreshBus } from '../runtime/visualizer/pipeline/MainThreadUIRefreshBus';

interface PerformanceHUDOverlayProps {
  enabled: boolean;
}

export function PerformanceHUDOverlay({ enabled }: PerformanceHUDOverlayProps) {
  const [fps, setFps] = useState(60);
  const [cpu, setCpu] = useState(0);
  const [memory, setMemory] = useState(0);
  const [resolution, setResolution] = useState('1920×1080');
  const [quality, setQuality] = useState(100);
  const [renderCosts, setRenderCosts] = useState<{ frame?: number; audioRead?: number; canvas2D?: number; rotation?: number; dots?: number; halo?: number; comet?: number; orbital?: number; shockwave?: number; webgl?: number; uiFlush?: number; canvas2DSpikeBaselineActive?: boolean; engineOwnedGLActive?: boolean; frameInterval?: number; avgFrameInterval?: number; worstFrameInterval?: number; jitter?: number; droppedFrames?: number; longFrames?: number; rafDrift?: number; renderMode?: string; effectiveDpr?: number; deviceDpr?: number; renderPixels?: number; inputToFrameDelay?:number; longestFrameGap?:number; missedRaf?:number; longTasks?:number; scrollStalls?:number; interactionState?:string; panelRenders?:number; } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    (window as any).__ORBITAL_RENDER_COST_DEBUG__ = true;
    const unsubscribe = mainThreadUIRefreshBus.subscribePerformanceHUD((snapshot) => {
      setFps(snapshot.fps);
      setCpu(snapshot.cpu);
      setMemory(snapshot.memoryMB);
      setResolution(snapshot.resolution);
      setQuality(snapshot.quality);
      setRenderCosts(snapshot.renderCosts as any);
    });

    return () => {
      unsubscribe();
      (window as any).__ORBITAL_RENDER_COST_DEBUG__ = false;
    };
  }, [enabled]);

  if (!enabled) return null;

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
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '236px',
      maxWidth: 'calc(100vw - 20px)',
      maxHeight: 'calc(100vh - 20px)',
      overflowY: 'auto',
      boxSizing: 'border-box',
      background: 'rgba(4,8,14,0.94)',
      border: '1px solid rgba(30,144,255,0.3)',
      borderRadius: '6px',
      padding: '8px',
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#94AFB4',
      zIndex: 1000,
      boxShadow: '0 3px 12px rgba(0,0,0,0.36)'
    }}>
      {/* Header */}
      <div style={{
        fontSize: '10px',
        fontWeight: '700',
        color: '#1E90FF',
        marginBottom: '6px',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          background: '#00FF88',
          borderRadius: '50%',
          animation: 'pulse 2s ease-in-out infinite'
        }} />
        PERFORMANCE
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <StatRow label="FPS:" value={fps} unit="fps" color="#1E90FF" />
        <StatRow label="CPU:" value={cpu} unit="%" color="#FFD700" />
        <StatRow label="RES:" value={resolution} unit="" color="#94AFB4" />
        <StatRow label="MEM:" value={memory} unit="MB" color="#FF69B4" />
      </div>

      {renderCosts && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(30,144,255,0.2)' }}>
          <div id="renderCostDebug" style={{ display: 'grid', gap: '2px', fontSize: '8px', lineHeight: 1.25, color: '#7a94aa', marginBottom: '5px' }}>
            <FrameSummaryRow
              leftLabel="FRAME"
              leftValue={`${(renderCosts.frame ?? 0).toFixed(1)}ms`}
              rightLabel="AUDIO"
              rightValue={`${(renderCosts.audioRead ?? 0).toFixed(2)}ms`}
            />
            <FrameSummaryRow
              leftLabel="CANVAS"
              leftValue={`${(renderCosts.canvas2D ?? 0).toFixed(1)}ms`}
              rightLabel="WEBGL"
              rightValue={`${(renderCosts.webgl ?? 0).toFixed(1)}ms`}
            />
          </div>
          <StatRow label="AUDIO:" value={(renderCosts.audioRead ?? 0).toFixed(2)} unit="ms" color="#1E90FF" />
          <StatRow label="CANVAS:" value={(renderCosts.canvas2D ?? 0).toFixed(1)} unit="ms" color="#FFD700" />
          <StatRow label="ROT:" value={(renderCosts.rotation ?? 0).toFixed(2)} unit="ms" color="#B066FF" />
          <StatRow label="DOTS:" value={(renderCosts.dots ?? 0).toFixed(2)} unit="ms" color="#04d9ff" />
          <StatRow label="HALO:" value={(renderCosts.halo ?? 0).toFixed(2)} unit="ms" color="#1E90FF" />
          <StatRow label="COMET:" value={(renderCosts.comet ?? 0).toFixed(2)} unit="ms" color="#04d9ff" />
          <StatRow label="ORBITAL:" value={(renderCosts.orbital ?? 0).toFixed(2)} unit="ms" color="#B066FF" />
          <StatRow label="SHOCKWAVE:" value={(renderCosts.shockwave ?? 0).toFixed(2)} unit="ms" color="#FF69B4" />
          <StatRow label="WEBGL:" value={(renderCosts.webgl ?? 0).toFixed(1)} unit="ms" color="#00FF88" />
          <StatRow label="UI:" value={(renderCosts.uiFlush ?? 0).toFixed(2)} unit="ms" color="#FF69B4" />
          <StatRow label="JITTER:" value={(renderCosts.jitter ?? 0).toFixed(1)} unit="ms" color="#FFD700" />
          <StatRow label="WORST:" value={(renderCosts.worstFrameInterval ?? 0).toFixed(1)} unit="ms" color="#FFA500" />
          <StatRow label="DROPS:" value={renderCosts.droppedFrames ?? 0} unit="" color="#FF6F61" />
          <StatRow label="INPUT LAG:" value={(renderCosts.inputToFrameDelay ?? 0).toFixed(1)} unit="ms" color="#FFD700" />
          <StatRow label="MAX GAP:" value={(renderCosts.longestFrameGap ?? 0).toFixed(1)} unit="ms" color="#FFA500" />
          <StatRow label="MISSED RAF:" value={renderCosts.missedRaf ?? 0} unit="" color="#FF6F61" />
          <StatRow label="LONG TASKS:" value={renderCosts.longTasks ?? 0} unit="" color="#FF69B4" />
          <StatRow label="SCROLL STALLS:" value={renderCosts.scrollStalls ?? 0} unit="" color="#B066FF" />
          <StatRow label="INTERACT:" value={String(renderCosts.interactionState || 'idle').toUpperCase()} unit="" color="#04d9ff" />
          <StatRow label="PANEL RENDERS:" value={renderCosts.panelRenders ?? 0} unit="" color="#94AFB4" />
          <StatRow label="MODE:" value={String(renderCosts.renderMode || 'balanced').toUpperCase()} unit="" color="#04d9ff" />
          <StatRow label="DPR:" value={(renderCosts.effectiveDpr ?? 0).toFixed(2)} unit={` / ${(renderCosts.deviceDpr ?? 0).toFixed(1)}`} color="#B066FF" />
          <StatRow label="C2D SPIKE:" value={renderCosts.canvas2DSpikeBaselineActive ? 'ON' : 'OFF'} unit="" color={renderCosts.canvas2DSpikeBaselineActive ? '#FFA500' : '#00FF88'} />
        </div>
      )}

      {/* Quality Grade */}
      <div style={{
        marginTop: '6px',
        padding: '5px 6px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${getQualityColor(quality)}40`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '9px', color: '#7a94aa' }}>
          QUALITY:
        </span>
        <span style={{
          fontSize: '10px',
          color: getQualityColor(quality),
          fontWeight: '700',
          textShadow: `0 0 6px ${getQualityColor(quality)}80`
        }}>
          {quality}% • {getQualityLabel(quality)}
        </span>
      </div>

      {/* Pulse animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}} />
    </div>
  );
}

function FrameSummaryRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      columnGap: '8px',
      minWidth: 0,
    }}>
      <span>{leftLabel} <strong style={{ color: '#94AFB4' }}>{leftValue}</strong></span>
      <span>{rightLabel} <strong style={{ color: '#94AFB4' }}>{rightValue}</strong></span>
    </div>
  );
}

// Stat Row Component
function StatRow({ 
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
      justifyContent: 'space-between',
      fontSize: '9px',
      lineHeight: 1.25,
    }}>
      <span style={{ color: '#7a94aa' }}>
        {label}
      </span>
      <span style={{
        color: color,
        fontWeight: '700'
      }}>
        {value}{unit}
      </span>
    </div>
  );
}
