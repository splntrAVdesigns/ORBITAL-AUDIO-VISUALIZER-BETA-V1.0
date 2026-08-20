export interface AudioAnalyserFrameArgs {
  analyser: AnalyserNode;
  energyAnalyser: AnalyserNode;
  freqArr: Uint8Array;
  rawSpikeFreqArr: Uint8Array;
  timeArr: Uint8Array;
  energyFreqArr: Uint8Array;
  energyTimeArr: Uint8Array;
  needsTimeDomain: boolean;
  needsEnergyTime?: boolean;
  now?: () => number;
}

export interface AudioAnalyserFrameResult {
  audioReadMs: number;
}

export function readAudioAnalyserFrame(args: AudioAnalyserFrameArgs): AudioAnalyserFrameResult {
  const now = args.now ?? (() => performance.now());
  const start = now();

  args.analyser.getByteFrequencyData(args.freqArr as Uint8Array<ArrayBuffer>);
  args.rawSpikeFreqArr.set(args.freqArr);

  if (args.needsTimeDomain) {
    args.analyser.getByteTimeDomainData(args.timeArr as Uint8Array<ArrayBuffer>);
  }

  args.energyAnalyser.getByteFrequencyData(args.energyFreqArr as Uint8Array<ArrayBuffer>);

  if (args.needsEnergyTime ?? true) {
    args.energyAnalyser.getByteTimeDomainData(args.energyTimeArr as Uint8Array<ArrayBuffer>);
  }

  return { audioReadMs: Math.max(0, now() - start) };
}