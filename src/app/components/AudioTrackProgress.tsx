import { memo, useEffect, useRef } from 'react';
import { mainThreadUIRefreshBus } from '../runtime/visualizer/pipeline/MainThreadUIRefreshBus';

interface AudioTrackProgressProps {
  audioDuration: number;
}

export const AudioTrackProgress = memo(function AudioTrackProgress({
  audioDuration,
}: AudioTrackProgressProps) {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(audioDuration);

  durationRef.current = audioDuration;

  useEffect(() => mainThreadUIRefreshBus.subscribeAudioProgress((snapshot) => {
    const duration = Number.isFinite(durationRef.current) && durationRef.current > 0
      ? durationRef.current
      : snapshot.duration;
    const percent = duration > 0
      ? Math.max(0, Math.min(100, (snapshot.currentTime / duration) * 100))
      : snapshot.percent;

    if (fillRef.current) fillRef.current.style.width = `${percent}%`;
  }), []);

  return (
    <div style={{
      width: '100%',
      height: '3px',
      background: 'rgba(30,144,255,0.2)',
      borderRadius: '2px',
      overflow: 'hidden',
    }}>
      <div
        ref={fillRef}
        style={{
          width: '0%',
          height: '100%',
          background: 'linear-gradient(90deg, #1E90FF 0%, #8A2BE2 100%)',
          transition: 'width 0.125s linear',
        }}
      />
    </div>
  );
});
