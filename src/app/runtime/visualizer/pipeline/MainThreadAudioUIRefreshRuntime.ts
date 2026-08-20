import type { ColorPalette } from '../../../data/colorPalettes';
import { renderVuMeter, type VuGradientCache } from '../../../renderers/canvasLayerRenderer';
import { renderMiniSpectrumTrace } from '../../../utils/miniSpectrumTrace';
import { UIRefreshScheduler } from './UIRefreshScheduler';

export interface MainThreadAudioUIRefreshRuntimeOptions {
  energyAnalyser: AnalyserNode;
  energyFreqArr: Uint8Array<ArrayBuffer>;
  energyTimeArr: Uint8Array<ArrayBuffer>;
  getPalette: () => ColorPalette;
  getParams: () => Record<string, any>;
  getSampleRate: () => number;
}

/**
 * Main-thread UI-only analyser refresh. It deliberately owns no RAF and is
 * ticked by the host scheduler even when visual rendering belongs to the worker.
 */
export class MainThreadAudioUIRefreshRuntime {
  private readonly scheduler = new UIRefreshScheduler();
  private vuCanvas: HTMLCanvasElement | null = null;
  private spectrumCanvas: HTMLCanvasElement | null = null;
  private readonly vuGradientCache: VuGradientCache = { grad: null, clip: null, width: 0, cacheKey: '' };
  private readonly vuOptions: any = {
    canvas: null,
    energyTimeArr: null,
    palette: null,
    params: null,
    timeMs: 0,
    gradientCache: this.vuGradientCache,
  };

  constructor(private readonly options: MainThreadAudioUIRefreshRuntimeOptions) {}

  tick(now: number): void {
    const refreshVu = this.scheduler.shouldRun('vu', now);
    const refreshSpectrum = this.scheduler.shouldRun('spectrum', now);
    if (!refreshVu && !refreshSpectrum) return;

    // UI refresh is intentionally independent from the visual pipeline, so read
    // the energy analyser here when worker mode suppresses main-thread drawing.
    this.options.energyAnalyser.getByteFrequencyData(this.options.energyFreqArr);
    this.options.energyAnalyser.getByteTimeDomainData(this.options.energyTimeArr);

    if (!this.vuCanvas || !this.vuCanvas.isConnected) {
      this.vuCanvas = document.getElementById('vuMeter') as HTMLCanvasElement | null;
    }
    if (!this.spectrumCanvas || !this.spectrumCanvas.isConnected) {
      this.spectrumCanvas = document.getElementById('miniSpectrum') as HTMLCanvasElement | null;
    }

    const palette = this.options.getPalette();
    const params = this.options.getParams();
    if (refreshVu && this.vuCanvas) {
      Object.assign(this.vuOptions, {
        canvas: this.vuCanvas,
        energyTimeArr: this.options.energyTimeArr,
        palette,
        params,
        timeMs: now,
      });
      renderVuMeter(this.vuOptions);
    }

    if (refreshSpectrum && this.spectrumCanvas) {
      const ctx = this.spectrumCanvas.getContext('2d');
      if (ctx) {
        renderMiniSpectrumTrace(ctx, this.options.energyFreqArr, {
          sampleRate: this.options.getSampleRate(),
          palette,
          minHz: 20,
          maxHz: 20000,
          points: 72,
          showFill: true,
        });
      }
    }
  }

  reset(): void {
    this.scheduler.reset();
    this.vuCanvas = null;
    this.spectrumCanvas = null;
    this.vuGradientCache.grad = null;
    this.vuGradientCache.clip = null;
    this.vuGradientCache.width = 0;
    this.vuGradientCache.cacheKey = '';
  }
}
