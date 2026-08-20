export {};

declare global {
  interface Window {
    mediaEl: HTMLAudioElement | null;
    AC?: AudioContext;

    playlist: string[];
    playlistIndex: number;

    monitorEnabled: boolean;
    autoAdvance: boolean;
    shuffleEnabled: boolean;

    setPlaylist?: (playlist: string[]) => void;
    setAudioTab?: (tab: string) => void;
    setCurrentTrackIndex?: (index: number) => void;
    setCurrentTime?: (time: number) => void;
    setAudioDuration?: (duration: number) => void;
    setIsAudioPlaying?: (playing: boolean) => void;
    setIsMicActive?: (active: boolean) => void;
    setMonitorEnabled?: (enabled: boolean) => void;

    loadFile?: (file: File) => Promise<void>;
    unloadAudioFile?: () => Promise<void>;
    updateMetadataDisplay?: (title: string, artist: string, album: string) => void;

    RadialAnalyzer?: {
      connectAudioNode: (node: any) => void;
      setPalette: (name: string) => void;
    };

    webkitAudioContext?: typeof AudioContext;
  }
}