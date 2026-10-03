import { cancelTrackedTimeout, scheduleTrackedTimeout } from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { createFrameDriver } from './frameDriver';
import { notify } from '../utils/notify';
import { SHADER_REGISTRY } from '../src/shaders/ShaderRegistry';
import { InputRouter } from './InputRouter';
import { GamepadGestureEngine, type GamepadSnapshot, type GestureIntent } from './gamepadGestures';
import {
  GAMEPAD_CONFIG_IMPORTED_EVENT,
  GAMEPAD_FUNCTION_BY_ID,
  GAMEPAD_LIMITS,
  defaultGamepadBindings,
  describeControl,
  loadGamepadConfig,
  sameControl,
  saveGamepadConfig,
  type GamepadConfig,
  type GamepadControl,
  type GamepadFunctionId,
} from './gamepadConfig';
import { INPUT_FOCUS_EVENT, type InputActionId } from './types';

/**
 * ORBITAL — gamepad source (Sprint O5).
 *
 * Polls the Gamepad API once per rendered frame (frame input tap), only while a pad is
 * connected AND gamepad input is enabled (zero cost otherwise). Each poll becomes intents
 * via the pure gesture engine; intents go to the shared InputRouter, so a gamepad glide and
 * a MIDI turn land in exactly the same macro motor.
 *
 * Feedback: a focus ring on the knob being driven (visible while the pad is in use) and a
 * short toast naming the preset / shader / set you landed on.
 */

export const GAMEPAD_STATUS_EVENT = 'orbital:gamepad-status';
const LIVE_STATUS_MS = 66;
const LEARN_TIMEOUT_MS = 15000;
const LEARN_AXIS_THRESHOLD = 0.6;
const LEARN_AXIS_REST = 0.3;
const FOCUS_RING_IDLE_MS = 2500;
const ACTION_TOAST_DELAY_MS = 180;

export interface GamepadStatus {
  supported: boolean;
  enabled: boolean;
  connected: boolean;
  pad: { id: string; mapping: string; buttons: number; axes: number } | null;
  learning: GamepadFunctionId | null;
  learnExpiresAt: number | null;
  learnHint: string | null;
  config: GamepadConfig;
  live: { buttons: number[]; axes: number[] };
}

type PadLike = { id: string; index: number; connected: boolean; mapping: string; buttons: readonly { value: number; pressed: boolean }[]; axes: readonly number[] };

export class GamepadSource {
  private config: GamepadConfig = loadGamepadConfig();
  private engine = new GamepadGestureEngine(this.config);
  /** Polls on the visual frame clock: a tap can't fall between polls while frames render. */
  private readonly poller = createFrameDriver('gamepad-poll', () => this.tick());
  private activePadIndex: number | null = null;
  private pad: PadLike | null = null;
  private learning: GamepadFunctionId | null = null;
  private learnExpiresAt: number | null = null;
  private learnHint: string | null = null;
  private learnTimer: ReturnType<typeof setTimeout> | null = null;
  private learnBaseline: GamepadSnapshot | null = null;
  private live: { buttons: number[]; axes: number[] } = { buttons: [], axes: [] };
  private lastLiveEmit = 0;
  private liveDirty = false;
  private focusIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingToast: InputActionId | null = null;
  private cleanup: (() => void)[] = [];

  constructor(private readonly router: InputRouter) {}

  init(): void {
    if (!this.supported) { this.emit(); return; }
    const on = (name: string, fn: EventListener) => { window.addEventListener(name, fn); this.cleanup.push(() => window.removeEventListener(name, fn)); };
    on('gamepadconnected', ((e: GamepadEvent) => { this.activePadIndex ??= e.gamepad.index; this.refreshPolling(); this.emit(); }) as EventListener);
    on('gamepaddisconnected', ((e: GamepadEvent) => {
      if (e.gamepad.index === this.activePadIndex) { this.activePadIndex = null; this.applyIntents(this.engine.releaseAll()); }
      this.refreshPolling(); this.emit();
    }) as EventListener);
    on('orbital:gamepad-toggle', ((e: CustomEvent) => this.setEnabled(Boolean(e.detail?.enabled))) as EventListener);
    on('orbital:gamepad-learn', ((e: CustomEvent) => this.toggleLearn(e.detail?.fn ?? null)) as EventListener);
    on('orbital:gamepad-cancel-learn', (() => this.cancelLearn()) as EventListener);
    on('orbital:gamepad-clear', ((e: CustomEvent) => this.clear(e.detail?.fn)) as EventListener);
    on('orbital:gamepad-set', ((e: CustomEvent) => this.updateSettings(e.detail ?? {})) as EventListener);
    on('orbital:gamepad-restore-defaults', (() => this.restoreDefaults()) as EventListener);
    on(GAMEPAD_CONFIG_IMPORTED_EVENT, (() => this.reloadConfig()) as EventListener);
    on(INPUT_FOCUS_EVENT, ((e: CustomEvent) => this.paintFocus(e.detail?.macroId)) as EventListener);
    this.cleanup.push(InputRouter.onOtherSourceLearn('gamepad', () => { if (this.learning) this.cancelLearn(); }));
    // A pad connected before this page loaded is visible once any button was pressed.
    this.refreshPolling();
    this.emit();
  }

  dispose(): void {
    this.applyIntents(this.engine.releaseAll());
    this.poller.stop();
    cancelTrackedTimeout(this.learnTimer); this.learnTimer = null;
    cancelTrackedTimeout(this.focusIdleTimer); this.focusIdleTimer = null;
    cancelTrackedTimeout(this.toastTimer); this.toastTimer = null;
    document.body.classList.remove('controller-active');
    this.cleanup.splice(0).forEach((fn) => fn());
  }

  private get supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
  }

  /* ---- polling ---- */

  private pads(): PadLike[] {
    try { return Array.from(navigator.getGamepads() || []).filter((p): p is Gamepad => !!p && p.connected) as unknown as PadLike[]; } catch { return []; }
  }

  private refreshPolling(): void {
    const shouldPoll = this.config.enabled && this.pads().length > 0;
    if (shouldPoll && !this.poller.running) {
      this.poller.start();
    } else if (!shouldPoll && this.poller.running) {
      this.poller.stop();
      this.pad = null;
    }
  }

  private tick(): void {
    const pads = this.pads();
    if (!pads.length) { this.refreshPolling(); this.emit(); return; }
    let pad = pads.find((p) => p.index === this.activePadIndex);
    if (!pad) {
      // Follow whichever pad is being used.
      pad = pads.find((p) => p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.5)) ?? pads[0];
      this.activePadIndex = pad.index;
    }
    const firstSight = this.pad?.id !== pad.id;
    this.pad = pad;
    const snap: GamepadSnapshot = { buttons: pad.buttons.map((b) => b.value), axes: Array.from(pad.axes) };
    this.trackLive(snap);
    if (firstSight) this.emit();

    const now = performance.now();
    if (this.learning) { this.tickLearn(snap); return; }
    this.applyIntents(this.engine.update(now, snap));
    if (this.liveDirty && now - this.lastLiveEmit >= LIVE_STATUS_MS) this.emit();
  }

  private trackLive(snap: GamepadSnapshot): void {
    const round = (v: number) => Math.round(v * 20) / 20;
    const buttons = snap.buttons.map(round);
    const axes = snap.axes.map(round);
    if (buttons.join() !== this.live.buttons.join() || axes.join() !== this.live.axes.join()) {
      this.live = { buttons, axes };
      this.liveDirty = true;
    }
  }

  /* ---- intents ---- */

  private applyIntents(intents: GestureIntent[]): void {
    if (!intents.length) return;
    for (const intent of intents) {
      switch (intent.type) {
        case 'step': this.router.step(intent.target, intent.delta); break;
        case 'rate': this.router.rate(intent.target, intent.rate); break;
        case 'reset': this.router.reset(intent.target, intent.value); break;
        case 'action':
          if (this.router.action(intent.action)) this.queueToast(intent.action);
          break;
      }
    }
    this.markActive();
  }

  /* ---- focus ring ---- */

  private markActive(): void {
    document.body.classList.add('controller-active');
    this.paintFocus(this.router.focusedMacro);
    cancelTrackedTimeout(this.focusIdleTimer);
    this.focusIdleTimer = scheduleTrackedTimeout('gamepad-focus-idle', () => {
      this.focusIdleTimer = null;
      document.body.classList.remove('controller-active');
    }, FOCUS_RING_IDLE_MS);
  }

  private paintFocus(macroId: string | undefined): void {
    if (!macroId) return;
    document.querySelectorAll('.macro-knob.controller-focus').forEach((el) => {
      if ((el as HTMLElement).dataset.macroId !== macroId) el.classList.remove('controller-focus');
    });
    document.querySelector(`.macro-knob[data-macro-id="${macroId}"]`)?.classList.add('controller-focus');
  }

  /* ---- toasts ---- */

  private queueToast(action: InputActionId): void {
    if (action === 'focus.next' || action === 'focus.prev') return;
    this.pendingToast = action;
    cancelTrackedTimeout(this.toastTimer);
    // Wait for coalesced preset loads / React to settle, and collapse skims into one toast.
    this.toastTimer = scheduleTrackedTimeout('gamepad-action-toast', () => {
      this.toastTimer = null;
      const done = this.pendingToast; this.pendingToast = null;
      if (done) notify(this.describeOutcome(done), { tone: 'info', durationMs: 1400 });
    }, ACTION_TOAST_DELAY_MS);
  }

  private describeOutcome(action: InputActionId): string {
    const params = (window as any).params || {};
    switch (action) {
      case 'preset.next': case 'preset.prev': {
        const select = document.getElementById('presetSelect') as HTMLSelectElement | null;
        return `Preset · ${select?.selectedOptions[0]?.textContent?.trim() || '—'}`;
      }
      case 'textures.next': case 'textures.prev': {
        const shader = SHADER_REGISTRY.find((s: any) => s.id === params.coreTexturesShaderId) as any;
        return `Core Texture · ${shader?.name || params.coreTexturesShaderId || '—'}`;
      }
      case 'textures.toggle': return `Core Textures ${params.coreTexturesEnabled ? 'on' : 'off'}`;
      case 'randomize': return 'Randomized';
      case 'macroSet.toggle': return `${this.router.visibleMacroSet === 'classic' ? 'Classic' : 'Advanced'} macros`;
      default: return '';
    }
  }

  /* ---- Learn ---- */

  private toggleLearn(fn: GamepadFunctionId | null): void {
    if (!fn || !GAMEPAD_FUNCTION_BY_ID[fn]) return;
    if (this.learning === fn) { this.cancelLearn(); return; }
    this.cancelLearn(false);
    this.applyIntents(this.engine.releaseAll());
    this.learning = fn;
    this.learnHint = null;
    this.learnBaseline = this.pad ? { buttons: this.pad.buttons.map((b) => b.value), axes: Array.from(this.pad.axes) } : null;
    this.learnExpiresAt = Date.now() + LEARN_TIMEOUT_MS;
    this.learnTimer = scheduleTrackedTimeout('gamepad-learn-timeout', () => this.cancelLearn(), LEARN_TIMEOUT_MS);
    InputRouter.announceLearnBegin('gamepad');
    this.emit();
  }

  private cancelLearn(emit = true): void {
    cancelTrackedTimeout(this.learnTimer); this.learnTimer = null;
    this.learning = null; this.learnExpiresAt = null; this.learnBaseline = null; this.learnHint = null;
    if (emit) this.emit();
  }

  private tickLearn(snap: GamepadSnapshot): void {
    const fn = this.learning!;
    const meta = GAMEPAD_FUNCTION_BY_ID[fn];
    const base = this.learnBaseline ?? { buttons: snap.buttons.map(() => 0), axes: snap.axes.map(() => 0) };
    this.learnBaseline = base;
    // Buttons: a fresh press (was released when Learn started).
    const pressed = snap.buttons.findIndex((v, i) => v >= 0.5 && (base.buttons[i] ?? 0) < 0.5);
    // Axes: a deliberate push from rest. The direction pushed becomes "increase".
    const moved = snap.axes.findIndex((v, i) => Math.abs(v) >= LEARN_AXIS_THRESHOLD && Math.abs(base.axes[i] ?? 0) < LEARN_AXIS_REST);
    if (pressed >= 0 && meta.accepts === 'button') return this.assign(fn, { kind: 'button', index: pressed });
    if (moved >= 0 && meta.accepts === 'axis') return this.assign(fn, { kind: 'axis', index: moved, invert: snap.axes[moved] < 0 });
    const hint = pressed >= 0 && meta.accepts === 'axis' ? 'Knobs need a stick — push a stick in the direction that should increase.'
      : moved >= 0 && meta.accepts === 'button' ? 'This function needs a button — press a button.' : null;
    if (hint && hint !== this.learnHint) { this.learnHint = hint; this.emit(); }
    if (this.liveDirty && performance.now() - this.lastLiveEmit >= LIVE_STATUS_MS) this.emit();
  }

  private assign(fn: GamepadFunctionId, control: GamepadControl): void {
    const bindings = { ...this.config.bindings };
    for (const key of Object.keys(bindings) as GamepadFunctionId[]) if (sameControl(bindings[key], control)) delete bindings[key];
    bindings[fn] = control;
    this.commitConfig({ ...this.config, bindings });
    this.engine.suppressUntilReleased(control); // the press that learned it must not also fire it
    notify(`${GAMEPAD_FUNCTION_BY_ID[fn].label} → ${describeControl(control, this.pad?.mapping === 'standard')}`, { tone: 'success', durationMs: 1600 });
    this.cancelLearn();
  }

  /* ---- settings ---- */

  private setEnabled(enabled: boolean): void {
    if (!enabled) this.applyIntents(this.engine.releaseAll());
    this.commitConfig({ ...this.config, enabled });
    if (!enabled) document.body.classList.remove('controller-active');
  }

  private clear(fn: GamepadFunctionId | undefined): void {
    if (!fn) return;
    if (this.learning === fn) this.cancelLearn(false);
    const bindings = { ...this.config.bindings };
    delete bindings[fn];
    this.commitConfig({ ...this.config, bindings });
  }

  private updateSettings(detail: { step?: number; speed?: number; deadzone?: number; invert?: { fn: GamepadFunctionId; value: boolean } }): void {
    const next = { ...this.config, bindings: { ...this.config.bindings } };
    const clamp = (v: number | undefined, lim: { min: number; max: number }, cur: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(lim.min, Math.min(lim.max, v)) : cur;
    next.step = clamp(detail.step, GAMEPAD_LIMITS.step, next.step);
    next.speed = clamp(detail.speed, GAMEPAD_LIMITS.speed, next.speed);
    next.deadzone = clamp(detail.deadzone, GAMEPAD_LIMITS.deadzone, next.deadzone);
    if (detail.invert) {
      const control = next.bindings[detail.invert.fn];
      if (control?.kind === 'axis') next.bindings[detail.invert.fn] = { ...control, invert: detail.invert.value };
    }
    this.commitConfig(next);
  }

  private restoreDefaults(): void {
    this.cancelLearn(false);
    this.commitConfig({ ...this.config, bindings: defaultGamepadBindings() });
  }

  private reloadConfig(): void {
    this.applyIntents(this.engine.releaseAll());
    this.config = loadGamepadConfig();
    this.engine.setConfig(this.config);
    this.refreshPolling();
    this.emit();
  }

  private commitConfig(config: GamepadConfig): void {
    this.config = config;
    this.engine.setConfig(config);
    saveGamepadConfig(config);
    this.refreshPolling();
    this.emit();
  }

  /* ---- status ---- */

  private emit(): void {
    this.lastLiveEmit = performance.now();
    this.liveDirty = false;
    const pad = this.pad && this.poller.running
      ? { id: this.pad.id, mapping: this.pad.mapping, buttons: this.pad.buttons.length, axes: this.pad.axes.length }
      : null;
    const status: GamepadStatus = {
      supported: this.supported,
      enabled: this.config.enabled,
      connected: this.pads().length > 0,
      pad,
      learning: this.learning,
      learnExpiresAt: this.learnExpiresAt,
      learnHint: this.learnHint,
      config: this.config,
      live: this.live,
    };
    window.dispatchEvent(new CustomEvent(GAMEPAD_STATUS_EVENT, { detail: status }));
  }
}
