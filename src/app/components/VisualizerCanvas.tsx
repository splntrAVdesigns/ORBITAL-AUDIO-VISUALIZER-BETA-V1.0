import type { RefObject } from 'react';
import { PerformanceHUDOverlay } from './PerformanceHUDOverlay';

interface VisualizerCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  glCanvasRef: RefObject<HTMLCanvasElement>;
  performanceHUDEnabled: boolean;
}

export function VisualizerCanvas({
  canvasRef,
  glCanvasRef,
  performanceHUDEnabled
}: VisualizerCanvasProps) {
  return (
    <main
      id="stage"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        isolation: 'isolate',
        contain: 'layout paint size',
        background: 'transparent'
      }}
    >
      <canvas
        ref={canvasRef}
        id="canvas"
        data-orbital-render-surface="canvas2d-main-thread"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />

      <canvas
        ref={glCanvasRef}
        id="glCanvas"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          zIndex: 2,
          pointerEvents: 'none',
          // Shared WebGL layer: spike bloom is handled in shader, not via canvas CSS filter.
          filter: 'none'
        }}
      />

      <PerformanceHUDOverlay enabled={performanceHUDEnabled} />
    </main>
  );
}