import { defaultCenterLogo, iconLogo, recoverBuiltInAssetImage } from '../config/assets';
import { getCenterGraphicMediaDimensions } from '../utils/centerGraphicEngine';
import { createAngleTween, type AngleTween } from '../utils/easing';
import { computeCenterMediaBaseScale, measureVisibleAlphaBounds, resolveCenterMediaScale, type CenterFitMode, type MediaFitState, type CenterMediaKind } from '../utils/centerMediaFitManager';
import {
  CENTER_MEDIA_MAX_FILE_BYTES,
  formatResourceBytes,
  validateCenterMediaAggregateResource,
  validateCenterMediaDimensions,
} from '../config/resourceLimits';

export type CenterImage = {
  url: string;
  element: HTMLImageElement | HTMLVideoElement;
  loaded: boolean;
  filename: string;
  type: 'image' | 'video';
  savedZoom?: number;
  fitState?: MediaFitState;
  mediaKind?: CenterMediaKind;
  preferredAutoScale?: number;
  sourceBytes?: number;
  decodedPixels?: number;
};

export type CenterTransitionType =
  | 'fade'
  | 'crossfade'
  | 'zoom'
  | 'instant'
  | 'flashZoom'
  | 'pushFade'
  | 'signalScan'
  | 'glitchCut';

type CenterGraphicControllerOptions = {
  params: any;
  defaultParams: any;
  debug?: boolean;
  querySelector?: (selector: string) => Element | null;
};

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const VALID_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
const VALID_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v'];
const SLOT_COUNT = 6;

const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const isVideoFile = (file: File) => file.type.startsWith('video/') || VALID_VIDEO_EXTENSIONS.includes(getExtension(file.name));
const isImageFile = (file: File) => file.type.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(getExtension(file.name));
const getVideoProbeMime = (file: File) => {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = getExtension(file.name);
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  return 'video/mp4';
};

export class CenterGraphicController {
  readonly images: (CenterImage | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
  readonly rotationHomeTween: AngleTween = createAngleTween();

  activeIndex = 0;
  autoRotationAngle = 0;
  hidden = false;
  autoCycleEnabled = false;
  autoCycleSpeed = 4000;
  transitionType: CenterTransitionType = 'fade';
  transitionProgress = 1.0;
  transitionFrom = -1;

  private autoCycleTimer: ReturnType<typeof setInterval> | null = null;
  private imageCacheRegistry = new Map<string, HTMLImageElement | HTMLVideoElement>();
  private cleanupFns: Array<() => void> = [];

  constructor(private options: CenterGraphicControllerOptions) {}

  get activeImage(): CenterImage | null {
    return this.images[this.activeIndex] ?? null;
  }

  get isHidden(): boolean {
    return this.hidden;
  }

  setHidden(value: boolean): void {
    this.hidden = value;
    this.syncVideoPlayback();
  }

  setAutoRotationAngle(value: number): void {
    this.autoRotationAngle = value;
  }

  persistActiveZoom(scale = this.options.params.centerImageScale): void {
    const active = this.activeImage;
    if (active) {
      active.savedZoom = scale;
      if (active.fitState) active.fitState.userScaleOffset = Math.max(0.35, Math.min(2, scale / Math.max(0.01, active.fitState.baseScale)));
    }
  }

  setScale(scale: number, persistToActive = false): void {
    const { params, defaultParams } = this.options;
    const safeScale = Math.max(0.02, Math.min(1.2, Number.isFinite(scale) ? scale : defaultParams.centerImageScale));
    params.centerImageScale = safeScale;
    if (persistToActive) this.persistActiveZoom(safeScale);

    const scaleSlider = document.getElementById('centerImageScale') as HTMLInputElement | null;
    if (scaleSlider) {
      scaleSlider.value = String(Math.round(safeScale * 125));
      const valueDisplay = scaleSlider.parentElement?.querySelector('.slider-value');
      if (valueDisplay) valueDisplay.textContent = String(Math.round(safeScale * 125));
    }
  }

  autoFitSlot(index: number, outgoingIndex = this.activeIndex, force = false): void {
    const incoming = this.images[index];
    if (!incoming) return;
    const dims = getCenterGraphicMediaDimensions(incoming.element);
    if (!dims) return;
    const mode: CenterFitMode = incoming.fitState?.fitMode ?? 'auto';
    const baseScale = computeCenterMediaBaseScale(dims.width, dims.height, mode, incoming.fitState?.visibleBounds, incoming.mediaKind ?? incoming.fitState?.mediaKind ?? 'unknown', incoming.preferredAutoScale ?? incoming.fitState?.preferredAutoScale);
    const priorOffset = force ? 1 : (incoming.fitState?.userScaleOffset ?? 1);
    incoming.fitState = { ...incoming.fitState, fitMode: mode, baseScale, userScaleOffset: priorOffset, aspectRatio: dims.width / Math.max(1, dims.height), mediaKind: incoming.mediaKind, preferredAutoScale: incoming.preferredAutoScale };
    const resolved = resolveCenterMediaScale(incoming.fitState);
    incoming.savedZoom = resolved;
    this.setScale(resolved, false);
  }

  setActiveFitMode(mode: CenterFitMode): void {
    const active = this.activeImage;
    if (!active) return;
    const dims = getCenterGraphicMediaDimensions(active.element);
    if (!dims) return;
    active.fitState = { ...active.fitState, fitMode: mode, baseScale: computeCenterMediaBaseScale(dims.width, dims.height, mode, active.fitState?.visibleBounds, active.mediaKind ?? active.fitState?.mediaKind ?? 'unknown', active.preferredAutoScale ?? active.fitState?.preferredAutoScale), userScaleOffset: 1, aspectRatio: dims.width / Math.max(1, dims.height), mediaKind: active.mediaKind, preferredAutoScale: active.preferredAutoScale };
    this.setScale(resolveCenterMediaScale(active.fitState), false);
  }

  syncVideoPlayback(): void {
    for (let i = 0; i < this.images.length; i++) {
      const img = this.images[i];
      if (!img || !(img.element instanceof HTMLVideoElement)) continue;
      const video = img.element;
      if (i === this.activeIndex && img.loaded && !this.hidden) {
        if (video.paused) video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    }
  }

  replayTransitionPreview(type: CenterTransitionType): void {
    this.transitionType = type;
    this.transitionFrom = this.activeIndex;
    this.transitionProgress = type === 'instant' ? 1.0 : 0.0;
    this.syncVideoPlayback();
  }

  switchToImage(index: number, transition: CenterTransitionType = 'fade'): void {
    if (index < 0 || index >= this.images.length || !this.images[index]) return;

    this.transitionFrom = this.activeIndex;
    const previousIndex = this.activeIndex;
    this.activeIndex = index;
    this.transitionType = transition;
    this.autoFitSlot(index, previousIndex, false);
    this.transitionProgress = transition === 'instant' ? 1.0 : 0.0;
    this.syncVideoPlayback();
    this.updatePreviewBoxes();

    const newImg = this.images[index];
    if (this.options.debug && newImg) {
      console.log(`🔄 Center graphic scale set to ${this.options.params.centerImageScale.toFixed(3)}x for ${newImg.filename}`);
    }
  }

  resetTransition(): void {
    this.transitionProgress = 1.0;
    this.transitionFrom = -1;
  }

  toggleAutoCycle(): void {
    this.autoCycleEnabled = !this.autoCycleEnabled;
    if (this.autoCycleEnabled) {
      this.autoCycleTimer = setInterval(() => {
        let nextIndex = (this.activeIndex + 1) % SLOT_COUNT;
        let attempts = 0;
        while (!this.images[nextIndex] && attempts < SLOT_COUNT) {
          nextIndex = (nextIndex + 1) % SLOT_COUNT;
          attempts++;
        }
        if (this.images[nextIndex]) this.switchToImage(nextIndex, this.transitionType);
      }, this.autoCycleSpeed);
    } else {
      this.stopAutoCycle();
    }
  }

  setAutoCycleSpeed(value: number): void {
    this.autoCycleSpeed = value;
    if (this.autoCycleEnabled) {
      this.stopAutoCycle();
      this.autoCycleEnabled = false;
      this.toggleAutoCycle();
    }
  }

  stopAutoCycle(): void {
    if (this.autoCycleTimer) {
      clearInterval(this.autoCycleTimer);
      this.autoCycleTimer = null;
    }
  }

  loadDefaultLogos(): void {
    const { defaultParams } = this.options;
    const orbitalImg = new Image();
    orbitalImg.onload = () => {
      const decodedPixels = (orbitalImg.naturalWidth || orbitalImg.width) * (orbitalImg.naturalHeight || orbitalImg.height);
      this.images[0] = {
        url: defaultCenterLogo,
        element: orbitalImg,
        loaded: true,
        filename: 'orbital-logo.png',
        type: 'image',
        mediaKind: 'logo',
        preferredAutoScale: defaultParams.centerImageScale,
        sourceBytes: 0,
        decodedPixels,
        savedZoom: defaultParams.centerImageScale,
        fitState: { fitMode: 'auto', baseScale: defaultParams.centerImageScale, userScaleOffset: 1, aspectRatio: (orbitalImg.naturalWidth || orbitalImg.width) / Math.max(1, orbitalImg.naturalHeight || orbitalImg.height), mediaKind: 'logo', preferredAutoScale: defaultParams.centerImageScale },
      };
      this.activeIndex = 0;
      this.setScale(defaultParams.centerImageScale, false);
      this.updatePreviewBoxes();
    };
    orbitalImg.onerror = () => recoverBuiltInAssetImage(orbitalImg, 'defaultCenterLogo');
    orbitalImg.src = defaultCenterLogo;

    const iconImg = new Image();
    iconImg.onload = () => {
      const decodedPixels = (iconImg.naturalWidth || iconImg.width) * (iconImg.naturalHeight || iconImg.height);
      this.images[1] = {
        url: iconLogo,
        element: iconImg,
        loaded: true,
        filename: 'icon-logo.png',
        type: 'image',
        mediaKind: 'logo',
        preferredAutoScale: 78 / 125,
        sourceBytes: 0,
        decodedPixels,
        savedZoom: 78 / 125,
        fitState: { fitMode: 'auto', baseScale: 78 / 125, userScaleOffset: 1, aspectRatio: 1, mediaKind: 'logo', preferredAutoScale: 78 / 125 },
      };
      this.updatePreviewBoxes();
    };
    iconImg.onerror = () => recoverBuiltInAssetImage(iconImg, 'iconLogo');
    iconImg.src = iconLogo;
  }

  updatePreviewBoxes(): void {
    const $ = this.options.querySelector ?? ((selector: string) => document.querySelector(selector));
    for (let i = 0; i < SLOT_COUNT; i++) {
      const box = $(`#imagePreview${i}`) as HTMLElement | null;
      const deleteBtn = $(`#deleteImage${i}`) as HTMLElement | null;
      if (!box) continue;

      const image = this.images[i];
      const isActive = i === this.activeIndex;
      if (isActive) {
        box.style.border = '2px solid var(--neonBlue)';
        box.style.boxShadow = '0 0 12px rgba(30,144,255,0.6), inset 0 0 8px rgba(30,144,255,0.3)';
      } else {
        box.style.border = '1px solid rgba(30,144,255,0.3)';
        box.style.boxShadow = 'none';
      }

      if (image && image.loaded) {
        box.style.backgroundImage = `url(${image.url})`;
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
        box.innerHTML = '';
        if (deleteBtn) deleteBtn.style.display = 'flex';
      } else if (image && !image.loaded) {
        box.style.backgroundImage = 'none';
        box.innerHTML = '<div style="color: var(--neonBlue); font-size: 10px;">Loading...</div>';
        if (deleteBtn) deleteBtn.style.display = 'none';
      } else {
        box.style.backgroundImage = 'none';
        box.innerHTML = '<div style="color: rgba(30,144,255,0.5); font-size: 24px; font-weight: 300;">+</div>';
        if (deleteBtn) deleteBtn.style.display = 'none';
      }
    }
  }

  bindControls(): void {
    const $ = this.options.querySelector ?? ((selector: string) => document.querySelector(selector));
    const centerImageInput = $('#centerImageInput') as HTMLInputElement | null;
    const clearImageBtn = $('#clearCenterImage') as HTMLElement | null;
    const hideImageBtn = $('#hideImage') as HTMLElement | null;

    if (centerImageInput) {
      centerImageInput.setAttribute('multiple', 'true');
      const onChange = (e: Event) => this.handleFiles((e.target as HTMLInputElement).files, centerImageInput);
      centerImageInput.addEventListener('change', onChange);
      this.cleanupFns.push(() => centerImageInput.removeEventListener('change', onChange));
    }

    if (clearImageBtn) {
      const onClick = () => this.clearAll(centerImageInput);
      clearImageBtn.addEventListener('click', onClick);
      this.cleanupFns.push(() => clearImageBtn.removeEventListener('click', onClick));
    }

    if (hideImageBtn) {
      const onClick = () => {
        this.hidden = !this.hidden;
        hideImageBtn.textContent = this.hidden ? 'Show Image' : 'Hide Image';
        this.syncVideoPlayback();
      };
      hideImageBtn.addEventListener('click', onClick);
      this.cleanupFns.push(() => hideImageBtn.removeEventListener('click', onClick));
    }

    const keydown = (e: KeyboardEvent) => this.handleKeyboardNavigation(e);
    window.addEventListener('keydown', keydown);
    this.cleanupFns.push(() => window.removeEventListener('keydown', keydown));
  }

  bindDeferredControls(): void {
    const $ = this.options.querySelector ?? ((selector: string) => document.querySelector(selector));
    const transitionSelect = $('#transitionType') as HTMLSelectElement | null;
    if (transitionSelect) {
      const onChange = (e: Event) => this.replayTransitionPreview((e.target as HTMLSelectElement).value as CenterTransitionType);
      transitionSelect.addEventListener('change', onChange);
      this.cleanupFns.push(() => transitionSelect.removeEventListener('change', onChange));
    }

    const autoCycleCheckbox = $('#autoCycle') as HTMLInputElement | null;
    if (autoCycleCheckbox) {
      const onChange = () => this.toggleAutoCycle();
      autoCycleCheckbox.addEventListener('change', onChange);
      this.cleanupFns.push(() => autoCycleCheckbox.removeEventListener('change', onChange));
    }

    const cycleSpeedSelect = $('#cycleSpeed') as HTMLSelectElement | null;
    if (cycleSpeedSelect) {
      cycleSpeedSelect.value = '4000';
      const onChange = (e: Event) => this.setAutoCycleSpeed(parseInt((e.target as HTMLSelectElement).value));
      cycleSpeedSelect.addEventListener('change', onChange);
      this.cleanupFns.push(() => cycleSpeedSelect.removeEventListener('change', onChange));
    }

    for (let i = 0; i < SLOT_COUNT; i++) {
      const box = $(`#imagePreview${i}`) as HTMLElement | null;
      if (box) {
        const onClick = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const img = this.images[i];
          if (img && img.loaded) this.switchToImage(i, this.transitionType);
          else if (!img) (document.getElementById('centerImageInput') as HTMLInputElement | null)?.click();
        };
        box.addEventListener('click', onClick);
        this.cleanupFns.push(() => box.removeEventListener('click', onClick));
      }

      const deleteBtn = $(`#deleteImage${i}`) as HTMLElement | null;
      if (deleteBtn) {
        const onClick = (e: MouseEvent) => {
          e.stopPropagation();
          this.deleteSlot(i);
        };
        deleteBtn.addEventListener('click', onClick);
        this.cleanupFns.push(() => deleteBtn.removeEventListener('click', onClick));
      }
    }
  }

  cleanupStaleCache(): void {
    const activeUrls = new Set(this.images.filter(Boolean).map((img) => img!.url));
    for (const [url] of this.imageCacheRegistry.entries()) {
      if (!activeUrls.has(url)) this.imageCacheRegistry.delete(url);
    }
  }

  dispose(): void {
    this.stopAutoCycle();
    for (const cleanup of this.cleanupFns.splice(0)) cleanup();
    for (let i = 0; i < this.images.length; i++) this.releaseSlot(i);
    this.imageCacheRegistry.clear();
  }

  private handleFiles(files: FileList | null, input: HTMLInputElement): void {
    if (!files || files.length === 0) return;
    let startIndex = 0;
    for (let i = 0; i < this.images.length; i++) {
      if (this.images[i] === null) {
        startIndex = i;
        break;
      }
    }
    const acceptedFiles = Array.from(files).slice(0, SLOT_COUNT - startIndex);
    for (const file of acceptedFiles) {
      const isValidImage = VALID_IMAGE_TYPES.includes(file.type) || isImageFile(file);
      const isValidVideo = VALID_VIDEO_TYPES.includes(file.type) || isVideoFile(file);
      if (!isValidImage && !isValidVideo) {
        alert(`❌ Invalid file type: ${file.name}\n\nAccepted formats:\nImages: JPG, PNG, GIF, WebP\nVideos: MP4, WebM, MOV`);
        input.value = '';
        return;
      }
      if (file.size <= 0 || file.size > CENTER_MEDIA_MAX_FILE_BYTES) {
        alert(`❌ File rejected: ${file.name}\n\nFile size: ${(file.size / 1024 / 1024).toFixed(1)}MB\nMaximum allowed: ${formatResourceBytes(CENTER_MEDIA_MAX_FILE_BYTES)}`);
        input.value = '';
        return;
      }
    }

    const replacedIndexes = new Set(acceptedFiles.map((_, index) => startIndex + index));
    const retainedBytes = this.images.reduce((total, slot, index) => (
      replacedIndexes.has(index) ? total : total + (slot?.sourceBytes ?? 0)
    ), 0);
    const incomingBytes = acceptedFiles.reduce((total, file) => total + file.size, 0);
    const aggregateValidation = validateCenterMediaAggregateResource(retainedBytes, incomingBytes);
    if (!aggregateValidation.valid) {
      alert(`❌ Center media rejected\n\n${aggregateValidation.reason}`);
      input.value = '';
      return;
    }

    for (let i = 0; i < acceptedFiles.length; i++) {
      this.loadFileIntoSlot(acceptedFiles[i], startIndex + i, startIndex);
    }

    this.switchToImage(startIndex, 'instant');
    this.updatePreviewBoxes();
    input.value = '';
  }

  private loadFileIntoSlot(file: File, targetIndex: number, startIndex: number): void {
    this.releaseSlot(targetIndex);
    const url = URL.createObjectURL(file);
    if (isVideoFile(file)) this.loadVideo(file, url, targetIndex, startIndex);
    else this.loadImage(file, url, targetIndex, startIndex);
  }

  private loadVideo(file: File, url: string, index: number, startIndex: number): void {
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    let errorShown = false;
    const probeMime = getVideoProbeMime(file);
    const support = video.canPlayType(probeMime);
    if (support === '' && !['video/quicktime', 'video/x-m4v'].includes(probeMime)) {
      URL.revokeObjectURL(url);
      alert(`⚠️ This browser cannot decode ${file.name}.\n\nTry MP4 with H.264/AAC or WebM with VP8/VP9.`);
      return;
    }

    video.addEventListener('error', () => {
      if (errorShown) return;
      errorShown = true;
      const videoError = video.error;
      let errorMsg = `⚠️ Video codec not supported: ${file.name}\n\n`;
      if (videoError) {
        const messages: Record<number, string> = {
          1: 'Video loading was aborted',
          2: 'Network error occurred while loading video',
          3: 'Error decoding video - codec may not be supported',
          4: 'Video format/codec not supported by browser',
        };
        errorMsg += messages[videoError.code] || 'Unknown error occurred';
        if (videoError.code === 4 || videoError.code === 3) {
          errorMsg += '\n\n💡 QUICK FIX:\n• Your video likely uses H.265/HEVC codec (not supported)\n• Convert to H.264 codec using HandBrake or CloudConvert\n\n✅ SUPPORTED FORMATS:\n• MP4 with H.264 video + AAC audio\n• WebM with VP8/VP9 video';
        }
      } else {
        errorMsg += 'Unknown error - video failed to load';
      }
      alert(errorMsg);
      this.deleteSlot(index);
    });

    video.addEventListener('loadedmetadata', () => {
      const slot = this.images[index];
      if (video.videoWidth > 0 && video.videoHeight > 0 && slot) {
        const validation = validateCenterMediaDimensions(video.videoWidth, video.videoHeight, video.duration);
        if (!validation.valid) {
          alert(`❌ ${file.name}: ${validation.reason}`);
          this.deleteSlot(index);
          return;
        }
        const decodedPixels = video.videoWidth * video.videoHeight;
        const retainedPixels = this.images.reduce((total, item, slotIndex) => (
          slotIndex === index ? total : total + (item?.decodedPixels ?? 0)
        ), 0);
        const aggregateValidation = validateCenterMediaAggregateResource(0, 0, retainedPixels, decodedPixels);
        if (!aggregateValidation.valid) {
          alert(`❌ ${file.name}: ${aggregateValidation.reason}`);
          this.deleteSlot(index);
          return;
        }
        slot.loaded = true;
        slot.decodedPixels = decodedPixels;
        slot.fitState = {
          fitMode: 'auto',
          baseScale: computeCenterMediaBaseScale(video.videoWidth, video.videoHeight, 'auto', undefined, 'video'),
          userScaleOffset: 1,
          aspectRatio: video.videoWidth / Math.max(1, video.videoHeight),
          mediaKind: 'video',
        };
        slot.savedZoom = resolveCenterMediaScale(slot.fitState);
        if (index === this.activeIndex) this.setScale(slot.savedZoom, false);
        this.updatePreviewBoxes();
      }
    }, { once: true });

    video.addEventListener('canplay', () => {
      if (index === this.activeIndex && !this.hidden) video.play().catch((e) => console.warn('Video autoplay failed:', e));
    }, { once: true });

    this.images[index] = { url, element: video, loaded: false, filename: file.name, type: 'video', mediaKind: 'video', sourceBytes: file.size, decodedPixels: 0, fitState: { fitMode: 'auto', baseScale: 1, userScaleOffset: 1, aspectRatio: 1, mediaKind: 'video' } };
    this.imageCacheRegistry.set(url, video);
    video.src = url;
  }

  private loadImage(file: File, url: string, index: number, startIndex: number): void {
    const img = new Image();
    this.images[index] = { url, element: img, loaded: false, filename: file.name, type: 'image', mediaKind: 'unknown', sourceBytes: file.size, decodedPixels: 0 };
    this.imageCacheRegistry.set(url, img);

    img.onerror = () => {
      alert(`❌ Could not load image: ${file.name}`);
      this.deleteSlot(index);
    };
    img.onload = () => {
      const slot = this.images[index];
      if (img.width > 0 && img.height > 0 && slot) {
        const validation = validateCenterMediaDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height);
        if (!validation.valid) {
          alert(`❌ ${file.name}: ${validation.reason}`);
          this.deleteSlot(index);
          return;
        }
        const decodedPixels = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
        const retainedPixels = this.images.reduce((total, item, slotIndex) => (
          slotIndex === index ? total : total + (item?.decodedPixels ?? 0)
        ), 0);
        const aggregateValidation = validateCenterMediaAggregateResource(0, 0, retainedPixels, decodedPixels);
        if (!aggregateValidation.valid) {
          alert(`❌ ${file.name}: ${aggregateValidation.reason}`);
          this.deleteSlot(index);
          return;
        }
        slot.loaded = true;
        slot.decodedPixels = decodedPixels;
        void measureVisibleAlphaBounds(img).then((visibleBounds) => {
          if (!this.images[index]) return;
          const fullArea = Math.max(1, (img.naturalWidth || img.width) * (img.naturalHeight || img.height));
          const visibleArea = visibleBounds ? visibleBounds.width * visibleBounds.height : fullArea;
          const ext = getExtension(file.name);
          const hasMeaningfulTransparency = Boolean(visibleBounds && visibleArea / fullArea < 0.94 && ['png', 'webp'].includes(ext));
          slot.mediaKind = hasMeaningfulTransparency ? 'logo' : 'photo';
          slot.fitState = {
            fitMode: 'auto',
            baseScale: computeCenterMediaBaseScale(img.naturalWidth || img.width, img.naturalHeight || img.height, 'auto', visibleBounds, slot.mediaKind),
            userScaleOffset: 1,
            aspectRatio: (img.naturalWidth || img.width) / Math.max(1, img.naturalHeight || img.height),
            visibleBounds,
            mediaKind: slot.mediaKind,
          };
          slot.savedZoom = resolveCenterMediaScale(slot.fitState);
          if (index === this.activeIndex) this.setScale(slot.savedZoom, false);
          this.updatePreviewBoxes();
        });
      }
    };
    img.src = url;
  }

  private clearAll(input?: HTMLInputElement | null): void {
    for (let i = 0; i < this.images.length; i++) this.releaseSlot(i);
    this.activeIndex = 0;
    this.hidden = false;
    if (input) input.value = '';
    this.loadDefaultLogos();
    this.stopAutoCycle();
    this.autoCycleEnabled = false;
  }

  private deleteSlot(index: number): void {
    this.releaseSlot(index);
    if (index === this.activeIndex) {
      let nextIndex = 0;
      for (let j = 0; j < this.images.length; j++) {
        if (this.images[j]) {
          nextIndex = j;
          break;
        }
      }
      this.activeIndex = nextIndex;
    }
    this.updatePreviewBoxes();
  }

  private releaseSlot(index: number): void {
    const slot = this.images[index];
    if (!slot) return;
    if (slot.url.startsWith('blob:')) URL.revokeObjectURL(slot.url);
    this.imageCacheRegistry.delete(slot.url);
    if (slot.element instanceof HTMLVideoElement) {
      slot.element.pause();
      slot.element.src = '';
      try { slot.element.load(); } catch { /* noop */ }
    }
    this.images[index] = null;
  }

  private handleKeyboardNavigation(e: KeyboardEvent): void {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    if (/^[1-6]$/.test(e.key)) {
      const index = Number(e.key) - 1;
      if (this.images[index]) {
        e.preventDefault();
        this.switchToImage(index, this.transitionType);
      }
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      let nextIndex = this.activeIndex;
      let attempts = 0;
      do {
        nextIndex = (nextIndex + direction + SLOT_COUNT) % SLOT_COUNT;
        attempts++;
      } while (!this.images[nextIndex] && attempts < SLOT_COUNT);
      if (this.images[nextIndex]) this.switchToImage(nextIndex, this.transitionType);
    }
  }
}
