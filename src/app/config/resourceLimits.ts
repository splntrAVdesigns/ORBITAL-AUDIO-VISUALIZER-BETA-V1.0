const MEBIBYTE = 1024 * 1024;

export const AUDIO_FILE_MAX_BYTES = 160 * MEBIBYTE;
export const AUDIO_TRACK_MAX_DURATION_SECONDS = 3 * 60 * 60;
export const AUDIO_PLAYLIST_MAX_TRACKS = 100;
export const AUDIO_PLAYLIST_MAX_BYTES = 1024 * MEBIBYTE;
export const BPM_ANALYSIS_MAX_FILE_BYTES = 80 * MEBIBYTE;
export const BPM_ANALYSIS_MAX_DURATION_SECONDS = 10 * 60;
export const BPM_ANALYSIS_MAX_DECODED_BYTES = 256 * MEBIBYTE;
export const BPM_ANALYSIS_ESTIMATED_CHANNELS = 2;

export const SETTINGS_IMPORT_MAX_BYTES = 1 * MEBIBYTE;
export const SETTINGS_CUSTOM_PRESET_MAX_COUNT = 64;
export const SETTINGS_CUSTOM_PRESET_MAX_BYTES = 2 * MEBIBYTE;

export const CENTER_MEDIA_MAX_FILE_BYTES = 50 * MEBIBYTE;
export const CENTER_MEDIA_MAX_TOTAL_BYTES = 150 * MEBIBYTE;
export const CENTER_MEDIA_MAX_DIMENSION = 8192;
export const CENTER_MEDIA_MAX_PIXELS = 40_000_000;
export const CENTER_MEDIA_MAX_TOTAL_PIXELS = 60_000_000;
export const CENTER_VIDEO_MAX_DURATION_SECONDS = 30 * 60;

export interface AudioPlaylistResourceUsage {
  readonly trackCount: number;
  readonly totalBytes: number;
}

export interface ResourceValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function formatResourceBytes(bytes: number): string {
  return `${Math.ceil(bytes / MEBIBYTE)} MB`;
}

export function validateAudioTrackResource(
  file: File,
  durationSeconds: number,
  playlist: AudioPlaylistResourceUsage,
): ResourceValidationResult {
  if (file.size <= 0) return { valid: false, reason: `${file.name} is empty.` };
  if (file.size > AUDIO_FILE_MAX_BYTES) {
    return { valid: false, reason: `${file.name} exceeds the ${formatResourceBytes(AUDIO_FILE_MAX_BYTES)} audio limit.` };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { valid: false, reason: `${file.name} does not expose valid audio metadata.` };
  }
  if (durationSeconds > AUDIO_TRACK_MAX_DURATION_SECONDS) {
    return { valid: false, reason: `${file.name} exceeds the 3-hour track limit.` };
  }
  if (playlist.trackCount + 1 > AUDIO_PLAYLIST_MAX_TRACKS) {
    return { valid: false, reason: `The playlist is limited to ${AUDIO_PLAYLIST_MAX_TRACKS} tracks.` };
  }
  if (playlist.totalBytes + file.size > AUDIO_PLAYLIST_MAX_BYTES) {
    return { valid: false, reason: `The playlist exceeds its ${formatResourceBytes(AUDIO_PLAYLIST_MAX_BYTES)} memory budget.` };
  }
  return { valid: true };
}

export function validateSettingsImportResource(file: File): ResourceValidationResult {
  if (file.size <= 0) return { valid: false, reason: 'The settings file is empty.' };
  if (file.size > SETTINGS_IMPORT_MAX_BYTES) {
    return { valid: false, reason: `Settings files are limited to ${formatResourceBytes(SETTINGS_IMPORT_MAX_BYTES)}.` };
  }
  if (file.type && file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
    return { valid: false, reason: 'Only JSON settings files are supported.' };
  }
  return { valid: true };
}

export function estimateDecodedAudioBytes(
  durationSeconds: number,
  sampleRate: number,
  channelCount = BPM_ANALYSIS_ESTIMATED_CHANNELS,
): number {
  if (
    !Number.isFinite(durationSeconds)
    || !Number.isFinite(sampleRate)
    || !Number.isFinite(channelCount)
    || durationSeconds <= 0
    || sampleRate <= 0
    || channelCount <= 0
  ) return Number.POSITIVE_INFINITY;
  return Math.ceil(durationSeconds * sampleRate * channelCount * Float32Array.BYTES_PER_ELEMENT);
}

export function validateBpmAnalysisResource(
  fileBytes: number,
  durationSeconds: number,
  sampleRate: number,
  channelCount = BPM_ANALYSIS_ESTIMATED_CHANNELS,
): ResourceValidationResult {
  if (!Number.isFinite(fileBytes) || fileBytes <= 0 || fileBytes > BPM_ANALYSIS_MAX_FILE_BYTES) {
    return { valid: false, reason: `BPM analysis is limited to ${formatResourceBytes(BPM_ANALYSIS_MAX_FILE_BYTES)} source files.` };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > BPM_ANALYSIS_MAX_DURATION_SECONDS) {
    return { valid: false, reason: 'Automatic BPM analysis is limited to 10-minute audio files.' };
  }
  const decodedBytes = estimateDecodedAudioBytes(durationSeconds, sampleRate, channelCount);
  if (decodedBytes > BPM_ANALYSIS_MAX_DECODED_BYTES) {
    return { valid: false, reason: `Decoded BPM analysis is limited to ${formatResourceBytes(BPM_ANALYSIS_MAX_DECODED_BYTES)}.` };
  }
  return { valid: true };
}

export function validateDecodedBpmAudioResource(
  frameLength: number,
  channelCount: number,
): ResourceValidationResult {
  const decodedBytes = Math.ceil(frameLength * channelCount * Float32Array.BYTES_PER_ELEMENT);
  if (!Number.isSafeInteger(decodedBytes) || decodedBytes <= 0 || decodedBytes > BPM_ANALYSIS_MAX_DECODED_BYTES) {
    return { valid: false, reason: `Decoded BPM analysis is limited to ${formatResourceBytes(BPM_ANALYSIS_MAX_DECODED_BYTES)}.` };
  }
  return { valid: true };
}

export function validateCustomPresetResource(value: unknown): ResourceValidationResult {
  if (!Array.isArray(value)) return { valid: false, reason: 'Custom presets must be an array.' };
  if (value.length > SETTINGS_CUSTOM_PRESET_MAX_COUNT) {
    return { valid: false, reason: `A settings file may contain at most ${SETTINGS_CUSTOM_PRESET_MAX_COUNT} custom presets.` };
  }
  let serialized = '';
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { valid: false, reason: 'Custom presets could not be serialized safely.' };
  }
  if (new Blob([serialized]).size > SETTINGS_CUSTOM_PRESET_MAX_BYTES) {
    return { valid: false, reason: `Custom presets exceed the ${formatResourceBytes(SETTINGS_CUSTOM_PRESET_MAX_BYTES)} storage budget.` };
  }
  const structurallyValid = value.every((preset) => (
    preset !== null
    && typeof preset === 'object'
    && !Array.isArray(preset)
    && typeof (preset as { name?: unknown }).name === 'string'
    && (preset as { name: string }).name.length > 0
    && (preset as { name: string }).name.length <= 80
  ));
  return structurallyValid
    ? { valid: true }
    : { valid: false, reason: 'One or more custom presets have an invalid structure.' };
}

export function validateCenterMediaDimensions(
  width: number,
  height: number,
  durationSeconds = 0,
): ResourceValidationResult {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, reason: 'The selected media has invalid dimensions.' };
  }
  if (width > CENTER_MEDIA_MAX_DIMENSION || height > CENTER_MEDIA_MAX_DIMENSION || width * height > CENTER_MEDIA_MAX_PIXELS) {
    return {
      valid: false,
      reason: `Center media is limited to ${CENTER_MEDIA_MAX_DIMENSION}px per side and ${CENTER_MEDIA_MAX_PIXELS / 1_000_000} megapixels.`,
    };
  }
  if (durationSeconds > CENTER_VIDEO_MAX_DURATION_SECONDS) {
    return { valid: false, reason: 'Center videos are limited to 30 minutes.' };
  }
  return { valid: true };
}

export function validateCenterMediaAggregateResource(
  retainedBytes: number,
  incomingBytes: number,
  retainedPixels = 0,
  incomingPixels = 0,
): ResourceValidationResult {
  const totalBytes = retainedBytes + incomingBytes;
  if (
    !Number.isFinite(retainedBytes)
    || !Number.isFinite(incomingBytes)
    || retainedBytes < 0
    || incomingBytes < 0
    || totalBytes > CENTER_MEDIA_MAX_TOTAL_BYTES
  ) {
    return { valid: false, reason: `Center media is limited to ${formatResourceBytes(CENTER_MEDIA_MAX_TOTAL_BYTES)} across all slots.` };
  }
  const totalPixels = retainedPixels + incomingPixels;
  if (
    !Number.isFinite(retainedPixels)
    || !Number.isFinite(incomingPixels)
    || retainedPixels < 0
    || incomingPixels < 0
    || totalPixels > CENTER_MEDIA_MAX_TOTAL_PIXELS
  ) {
    return { valid: false, reason: `Center media is limited to ${CENTER_MEDIA_MAX_TOTAL_PIXELS / 1_000_000} decoded megapixels across all slots.` };
  }
  return { valid: true };
}
