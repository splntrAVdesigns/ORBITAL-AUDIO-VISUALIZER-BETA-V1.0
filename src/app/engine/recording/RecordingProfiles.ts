import type { RecordingCodec, RecordingQuality, RecordingStartOptions } from './RecordingRuntimeController';

export interface RecordingDimensions {
  width: number;
  height: number;
}

export interface ResolvedRecordingStartOptions extends RecordingStartOptions, RecordingDimensions {
  mimeCandidates: readonly string[];
  videoBitsPerSecond: number;
}

export const RECORDING_RESOLUTIONS: Readonly<Record<string, RecordingDimensions>> = Object.freeze({
  '720p': Object.freeze({ width: 1280, height: 720 }),
  '1080p': Object.freeze({ width: 1920, height: 1080 }),
  '1440p': Object.freeze({ width: 2560, height: 1440 }),
  '4k': Object.freeze({ width: 3840, height: 2160 }),
});

export const RECORDING_QUALITY_BITRATES: Readonly<Record<RecordingQuality, number>> = Object.freeze({
  low: 2_000_000,
  medium: 5_000_000,
  high: 10_000_000,
  ultra: 20_000_000,
});

const CODEC_CANDIDATES: Readonly<Record<RecordingCodec, readonly string[]>> = Object.freeze({
  vp9: Object.freeze([
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]),
  vp8: Object.freeze([
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
  ]),
  h264: Object.freeze([
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]),
});

export function normalizeRecordingCodec(value: unknown): RecordingCodec {
  return value === 'vp8' || value === 'h264' ? value : 'vp9';
}

export function normalizeRecordingQuality(value: unknown): RecordingQuality {
  return value === 'low' || value === 'medium' || value === 'ultra' ? value : 'high';
}

export function resolveRecordingDimensions(resolution: unknown): RecordingDimensions & { resolution: string } {
  const key = typeof resolution === 'string' && RECORDING_RESOLUTIONS[resolution]
    ? resolution
    : '1080p';
  return { resolution: key, ...RECORDING_RESOLUTIONS[key] };
}

export function normalizeRecordingFps(resolution: string, requestedFps: unknown): number {
  const parsed = Number.isFinite(Number(requestedFps)) ? Math.round(Number(requestedFps)) : 30;
  const capped = Math.max(1, Math.min(60, parsed));
  return resolution === '4k' ? Math.min(30, capped) : capped;
}

export function resolveRecordingOptions(options: Partial<RecordingStartOptions>): ResolvedRecordingStartOptions {
  const dimensions = resolveRecordingDimensions(options.resolution);
  const codec = normalizeRecordingCodec(options.codec);
  const quality = normalizeRecordingQuality(options.quality);
  const defaultBitrate = RECORDING_QUALITY_BITRATES[quality];
  const requestedBitrate = Number(options.videoBitsPerSecond);
  const videoBitsPerSecond = Number.isFinite(requestedBitrate) && requestedBitrate > 0
    ? Math.max(500_000, Math.min(40_000_000, Math.round(requestedBitrate)))
    : defaultBitrate;

  return {
    resolution: dimensions.resolution,
    width: dimensions.width,
    height: dimensions.height,
    fps: normalizeRecordingFps(dimensions.resolution, options.fps),
    duration: Math.max(0, Math.round(Number(options.duration) || 0)),
    codec,
    quality,
    videoBitsPerSecond,
    mimeCandidates: CODEC_CANDIDATES[codec],
  };
}


export function trimRecordingLibraryToBudget<T extends { blob: { size: number } }>(
  items: T[],
  maxItems: number,
  maxBytes: number,
): T[] {
  const evicted: T[] = [];
  const totalBytes = () => items.reduce((total, item) => total + Math.max(0, item.blob.size || 0), 0);
  while (items.length > 1 && (items.length > maxItems || totalBytes() > maxBytes)) {
    const oldest = items.shift();
    if (oldest) evicted.push(oldest);
  }
  return evicted;
}

export function extensionForMimeType(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}
