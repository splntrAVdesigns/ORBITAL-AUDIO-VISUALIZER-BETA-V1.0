import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  bpmClockRuntime,
  type BpmClockFrame,
  type BpmClockMode,
} from '../runtime/bpm/BpmClockRuntime';
import { mainThreadUIRefreshBus } from '../runtime/visualizer/pipeline/MainThreadUIRefreshBus';

const DOTS = [0, 1, 2, 3] as const;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function TapTempoControlComponent() {
  const [frame, setFrame] = useState<BpmClockFrame>(() => bpmClockRuntime.frame(nowMs()));
  const [mode, setMode] = useState<BpmClockMode>(() => bpmClockRuntime.state.mode);
  const suppressClickRef = useRef(false);

  const tapAt = useCallback((timestamp: number) => {
    bpmClockRuntime.tap(timestamp);
    setFrame(bpmClockRuntime.frame(timestamp));
  }, []);

  const tap = useCallback(() => tapAt(nowMs()), [tapAt]);

  const toggleMode = useCallback(() => {
    const current = bpmClockRuntime.state.mode;
    if (current === 'auto') bpmClockRuntime.activateManual(nowMs());
    else bpmClockRuntime.activateAuto(nowMs());
  }, []);

  useEffect(() => {
    const unsubscribeState = bpmClockRuntime.subscribe((state) => {
      setMode(state.mode);
      setFrame(bpmClockRuntime.frame(nowMs()));
    });
    const unsubscribeFrame = mainThreadUIRefreshBus.subscribeBpmClock((snapshot) => {
      setFrame((previous) => {
        if (
          previous.beatIndex === snapshot.beatIndex
          && previous.tapCount === snapshot.tapCount
          && previous.bpm === snapshot.bpm
          && previous.mode === snapshot.mode
        ) return previous;
        return snapshot;
      });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== 't') return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable
        || target?.closest('input, textarea, select, [contenteditable="true"]')
      ) return;
      event.preventDefault();
      tap();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubscribeState();
      unsubscribeFrame();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [tap]);

  const tapProgressIndex = frame.tapSequenceActive && frame.tapCount > 0 && frame.tapCount < 4
    ? frame.tapCount - 1
    : null;
  const activeBeatIndex = tapProgressIndex ?? frame.beatIndex;
  const feedback = frame.tapSequenceActive && frame.tapCount > 0 && frame.tapCount < 4
    ? `Tap ${frame.tapCount}/4`
    : `${Math.round(frame.bpm)} BPM · ${mode === 'auto' ? 'Auto' : 'Manual'}`;

  return (
    <div className="tap-tempo-control" aria-label="Tap tempo and four-beat indicator">
      <button
        id="tapTempo"
        className="tap-tempo-button"
        type="button"
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.preventDefault();
          suppressClickRef.current = true;
          tapAt(event.timeStamp);
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }
          tap();
        }}
        title="Tap four times to set BPM. Keyboard shortcut: T"
        aria-label="Tap tempo"
      >
        TAP
      </button>

      <button
        id="bpmMode"
        className={`bpm-mode-button ${mode === 'manual' ? 'manual' : 'auto'}`}
        type="button"
        onClick={toggleMode}
        title={mode === 'auto' ? `Automatic BPM mode: ${bpmClockRuntime.state.autoStatus}` : (bpmClockRuntime.state.autoStatus === 'ready' ? 'Manual BPM mode. Click to return to detected BPM.' : 'Manual BPM mode. Automatic BPM is not ready yet.')}
        aria-label={`BPM mode: ${mode}`}
        aria-pressed={mode === 'manual'}
      >
        {mode === 'auto' ? 'AUTO' : 'MAN'}
      </button>

      <div
        className="beat-indicator"
        role="status"
        aria-label={`${feedback}. Beat ${activeBeatIndex + 1} of 4.`}
        title={feedback}
      >
        {DOTS.map((index) => {
          const active = index === activeBeatIndex;
          const downbeat = index === 0;
          return (
            <span
              key={index}
              className={`beat-indicator-dot${active ? ' active' : ''}${downbeat ? ' downbeat' : ''}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}

export const TapTempoControl = memo(TapTempoControlComponent);
