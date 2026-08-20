import { memo } from 'react';
import { useAudioMetadataSnapshot } from '../runtime/controlPanelRuntimeStore';
import { formatPresetNameForHud } from '../runtime/presetHudLabel';

const labelStyle = { color: 'var(--neonBlue)', fontWeight: '800' } as const;
const valueStyle = { color: '#d0e1f0' } as const;

function AudioMetadataStripComponent() {
  const metadata = useAudioMetadataSnapshot();
  return (
    <div className="audio-metadata-strip">
      <div><span style={labelStyle}>REC TIME:</span><span style={valueStyle}>{metadata.recTime}</span></div>
      <div><span style={labelStyle}>BPM:</span><span style={valueStyle}>{metadata.bpm}</span></div>
      <div><span style={labelStyle}>BAND:</span><span style={valueStyle}>{metadata.band}</span></div>
      <div><span style={labelStyle}>TRACK:</span><span className="audio-metadata-track">{metadata.track}</span></div>
      <div><span style={labelStyle}>SR:</span><span style={valueStyle}>{metadata.sr}</span></div>
      <div><span style={labelStyle}>DETECT:</span><span style={valueStyle}>{metadata.detect}</span></div>
      <div><span style={labelStyle}>TIME:</span><span style={valueStyle}>{metadata.timeLeft}</span></div>
      <div><span style={labelStyle}>FFT:</span><span style={valueStyle}>{metadata.fft}</span></div>
      <div>
        <span style={labelStyle}>MODE:</span>
        <span className="audio-metadata-mode" title={metadata.mode}>
          {formatPresetNameForHud(metadata.mode)}
        </span>
      </div>
    </div>
  );
}

export const AudioMetadataStrip = memo(AudioMetadataStripComponent);
