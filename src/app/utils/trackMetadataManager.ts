/**
 * Track Metadata Manager
 * Extracted from App.tsx to reduce file size
 * Handles track metadata, BPM detection, and audio file information
 */

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  bpm: number | null;
  sampleRate: number;
  bitrate: number | null;
  format: string;
}

/**
 * Extract metadata from audio file
 */
export async function extractMetadata(file: File): Promise<Partial<TrackMetadata>> {
  const metadata: Partial<TrackMetadata> = {
    title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
    format: file.type || 'unknown'
  };
  
  // Try to parse ID3 tags if available (basic implementation)
  // For full ID3 support, would need a library like jsmediatags
  
  return metadata;
}

/**
 * Estimate BPM from audio data
 * Simple beat detection algorithm
 */
export function estimateBPM(
  freqData: Uint8Array[],
  sampleRate: number,
  fftSize: number
): number | null {
  if (freqData.length < 100) {
    return null; // Need at least a few seconds of data
  }
  
  // Calculate energy for each frame
  const energies: number[] = [];
  for (const frame of freqData) {
    let sum = 0;
    // Focus on bass frequencies (20-200 Hz)
    const bassEnd = Math.floor((200 / (sampleRate / 2)) * frame.length);
    for (let i = 0; i < bassEnd; i++) {
      sum += frame[i];
    }
    energies.push(sum / bassEnd);
  }
  
  // Find peaks in energy
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      // Peak detected
      const avgEnergy = energies.reduce((a, b) => a + b) / energies.length;
      if (energies[i] > avgEnergy * 1.3) {
        peaks.push(i);
      }
    }
  }
  
  if (peaks.length < 4) {
    return null; // Not enough peaks
  }
  
  // Calculate average time between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
  
  // Convert frame interval to BPM
  // Assuming ~30 frames per second (typical FFT analysis rate)
  const framesPerSecond = 30;
  const secondsPerBeat = avgInterval / framesPerSecond;
  const bpm = 60 / secondsPerBeat;
  
  // Validate BPM range (60-180 typical for music)
  if (bpm < 40 || bpm > 200) {
    return null;
  }
  
  return Math.round(bpm);
}

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

/**
 * Format sample rate
 */
export function formatSampleRate(hz: number): string {
  if (hz >= 1000) {
    return (hz / 1000).toFixed(1) + ' kHz';
  }
  return hz + ' Hz';
}

/**
 * Format bitrate
 */
export function formatBitrate(bps: number): string {
  if (bps >= 1000) {
    return (bps / 1000).toFixed(0) + ' kbps';
  }
  return bps + ' bps';
}

/**
 * Detect audio format from file extension
 */
export function detectAudioFormat(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const formats: Record<string, string> = {
    'mp3': 'MP3',
    'wav': 'WAV',
    'flac': 'FLAC',
    'ogg': 'Ogg Vorbis',
    'opus': 'Opus',
    'm4a': 'M4A/AAC',
    'aac': 'AAC',
    'wma': 'WMA',
    'aiff': 'AIFF',
    'ape': 'APE',
    'alac': 'ALAC'
  };
  
  return formats[ext || ''] || 'Unknown';
}

/**
 * Parse artist and title from filename
 * Common formats: "Artist - Title.mp3" or "01 Title.mp3"
 */
export function parseFilename(filename: string): { artist: string; title: string } {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Try "Artist - Title" format
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim()
    };
  }
  
  // Try "01. Title" format (remove track number)
  const withoutTrackNum = nameWithoutExt.replace(/^\d+\.?\s*/, '');
  
  return {
    artist: 'Unknown Artist',
    title: withoutTrackNum || nameWithoutExt
  };
}

/**
 * Create metadata display string
 */
export function createMetadataDisplay(metadata: Partial<TrackMetadata>): string {
  const parts: string[] = [];
  
  if (metadata.title) {
    parts.push(metadata.title);
  }
  
  if (metadata.artist && metadata.artist !== 'Unknown Artist') {
    parts.push(metadata.artist);
  }
  
  if (metadata.duration) {
    parts.push(formatDuration(metadata.duration));
  }
  
  if (metadata.bpm) {
    parts.push(`${metadata.bpm} BPM`);
  }
  
  return parts.join(' • ');
}

/**
 * Generate unique track ID
 */
export function generateTrackId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate audio file
 */
export function isValidAudioFile(file: File): boolean {
  const validExtensions = ['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'aac', 'wma', 'aiff', 'ape', 'alac'];
  const validMimeTypes = ['audio/', 'video/mp4']; // video/mp4 for m4a files
  
  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && validExtensions.includes(ext)) {
    return true;
  }
  
  // Check MIME type
  if (validMimeTypes.some(type => file.type.startsWith(type))) {
    return true;
  }
  
  return false;
}

/**
 * Sort tracks by different criteria
 */
export type SortCriteria = 'name' | 'artist' | 'duration' | 'dateAdded';

export function sortTracks(
  tracks: Array<{ name: string; artist?: string; duration?: number; timestamp?: number }>,
  criteria: SortCriteria,
  ascending: boolean = true
): typeof tracks {
  const sorted = [...tracks];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (criteria) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'artist':
        comparison = (a.artist || '').localeCompare(b.artist || '');
        break;
      case 'duration':
        comparison = (a.duration || 0) - (b.duration || 0);
        break;
      case 'dateAdded':
        comparison = (a.timestamp || 0) - (b.timestamp || 0);
        break;
    }
    
    return ascending ? comparison : -comparison;
  });
  
  return sorted;
}

/**
 * Create shuffle order for playlist
 */
export function createShuffleOrder(length: number, currentIndex: number = -1): number[] {
  const order = Array.from({ length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  
  // If currently playing a track, move it to the front
  if (currentIndex >= 0) {
    const currentPos = order.indexOf(currentIndex);
    if (currentPos > 0) {
      [order[0], order[currentPos]] = [order[currentPos], order[0]];
    }
  }
  
  return order;
}
