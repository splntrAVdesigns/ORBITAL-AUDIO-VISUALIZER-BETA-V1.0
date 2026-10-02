import { MacroMotor } from './MacroMotor';
import { runInputAction } from './actions';
import {
  INPUT_FOCUS_EVENT,
  INPUT_LEARN_BEGIN_EVENT,
  MACRO_SET_CHANGED_EVENT,
  type InputActionId,
  type InputSource,
  type InputTarget,
  type MacroId,
  type MacroSet,
} from './types';

/**
 * ORBITAL — Input router (Sprint O4).
 *
 * The one place controller sources hand their intent to. A source says WHAT it wants
 * ("knob 2 of the visible set, ramp up at 40/s"); the router resolves WHICH macro that is
 * and hands it to the MacroMotor, or runs an action.
 *
 * It also tracks:
 *  - the visible macro set (Classic = macros 1–4, Advanced = 5–8), announced by ControlPanel,
 *    so "knob N" always means the knob you can see;
 *  - the focused knob (last knob a controller touched; A/B buttons act on it);
 *  - Learn arbitration: only one source may be learning at a time.
 */
export class InputRouter {
  private macroSet: MacroSet = 'classic';
  private focusIndex: 0 | 1 | 2 | 3 = 0;
  private cleanup: (() => void)[] = [];

  constructor(readonly motor: MacroMotor) {}

  init(): void {
    const onSet = (event: Event) => {
      const next = (event as CustomEvent<{ macroSet?: MacroSet }>).detail?.macroSet;
      if (next === 'classic' || next === 'advanced') {
        this.macroSet = next;
        this.announceFocus();
      }
    };
    window.addEventListener(MACRO_SET_CHANGED_EVENT, onSet);
    this.cleanup.push(() => window.removeEventListener(MACRO_SET_CHANGED_EVENT, onSet));
  }

  dispose(): void {
    this.cleanup.splice(0).forEach((fn) => fn());
    this.motor.dispose();
  }

  get visibleMacroSet(): MacroSet { return this.macroSet; }
  get focusedMacro(): MacroId { return this.knobToMacro(this.focusIndex); }

  /** Resolve a target to the macro it drives right now. Touching a knob makes it focused. */
  resolve(target: InputTarget, touch = true): MacroId {
    if (target.kind === 'macro') return target.macroId;
    if (target.kind === 'focused') return this.focusedMacro;
    if (touch && target.index !== this.focusIndex) {
      this.focusIndex = target.index;
      this.announceFocus();
    }
    return this.knobToMacro(target.index);
  }

  /* ---- macro intents ---- */
  absolute(target: InputTarget, value: number): void { this.motor.setAbsolute(this.resolve(target), value); }
  step(target: InputTarget, delta: number): void { this.motor.step(this.resolve(target), delta); }
  rate(target: InputTarget, unitsPerSecond: number): void { this.motor.setRate(this.resolve(target, unitsPerSecond !== 0), unitsPerSecond); }
  reset(target: InputTarget, value = 0): void { this.motor.reset(this.resolve(target), value); }

  /* ---- actions ---- */
  action(action: InputActionId): boolean {
    if (action === 'focus.next' || action === 'focus.prev') {
      const delta = action === 'focus.next' ? 1 : 3;
      this.focusIndex = ((this.focusIndex + delta) % 4) as 0 | 1 | 2 | 3;
      this.announceFocus();
      return true;
    }
    return runInputAction(action);
  }

  /* ---- Learn arbitration ---- */
  /** A source calls this when it starts Learn; other sources cancel theirs. */
  static announceLearnBegin(source: InputSource): void {
    window.dispatchEvent(new CustomEvent(INPUT_LEARN_BEGIN_EVENT, { detail: { source } }));
  }

  /** Subscribe a source's cancel handler to other sources' Learn starts. */
  static onOtherSourceLearn(source: InputSource, cancel: () => void): () => void {
    const handler = (event: Event) => {
      const other = (event as CustomEvent<{ source?: InputSource }>).detail?.source;
      if (other && other !== source) cancel();
    };
    window.addEventListener(INPUT_LEARN_BEGIN_EVENT, handler);
    return () => window.removeEventListener(INPUT_LEARN_BEGIN_EVENT, handler);
  }

  /* ---- internals ---- */
  private knobToMacro(index: number): MacroId {
    return `macro${index + 1 + (this.macroSet === 'advanced' ? 4 : 0)}` as MacroId;
  }

  private announceFocus(): void {
    window.dispatchEvent(new CustomEvent(INPUT_FOCUS_EVENT, { detail: { macroId: this.focusedMacro } }));
  }
}
