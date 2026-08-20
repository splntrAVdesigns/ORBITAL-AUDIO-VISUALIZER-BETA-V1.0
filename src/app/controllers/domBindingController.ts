export type BindingFn = (el: any) => void;

export interface DomBindingController {
  bind: (selector: string, fn: BindingFn) => void;
  bindThrottled: (selector: string, fn: BindingFn) => void;
  setupSliderValueDisplays: () => void;
  cleanup: () => void;
}

export function createDomBindingController(rootDocument: Document = document): DomBindingController {
  const boundEventHandlers = new Map<string, (e: any) => void>();

  const bind = (selector: string, fn: BindingFn) => {
    const el = rootDocument.querySelector(selector);
    if (!el) return;

    const oldHandler = boundEventHandlers.get(selector);
    if (oldHandler) {
      el.removeEventListener('input', oldHandler);
      el.removeEventListener('change', oldHandler);
    }

    const newHandler = (e: any) => fn(e.target);
    boundEventHandlers.set(selector, newHandler);
    el.addEventListener('input', newHandler);
    el.addEventListener('change', newHandler);
  };

  const bindThrottled = (selector: string, fn: BindingFn) => {
    const el = rootDocument.querySelector(selector);
    if (!el) return;

    const oldHandler = boundEventHandlers.get(selector);
    if (oldHandler) {
      el.removeEventListener('input', oldHandler);
    }

    // Keep high-priority visual controls live. This controller centralizes listener
    // ownership without reintroducing delayed RAF/idle batching.
    const newHandler = (e: any) => fn(e.target);
    boundEventHandlers.set(selector, newHandler);
    el.addEventListener('input', newHandler);
  };

  const setupSliderValueDisplays = () => {
    const sliders = rootDocument.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;

    sliders.forEach((slider) => {
      if (slider.parentElement?.querySelector('.slider-value')) return;
      if (slider.id === 'centerImageKenBurnsSpeed') return;
      if (slider.id === 'shaderOpacity' || slider.id === 'shaderAudioIntensity' || slider.id.startsWith('shaderCtrl')) return;
      if (slider.closest('#shaderSpecificControls') || slider.id === 'shaderOpacity' || slider.id === 'shaderAudioIntensity') return;

      const valueDisplay = rootDocument.createElement('span');
      valueDisplay.className = 'slider-value';
      valueDisplay.style.cssText = `
        margin-left: 8px;
        color: #1E90FF;
        font-size: 10px;
        font-weight: 600;
        min-width: 45px;
        display: inline-block;
        text-align: right;
      `;

      const formatValue = (val: string) => {
        const num = parseFloat(val);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);

        if (min === 0 && max === 1) return `${Math.round(num * 100)}%`;
        if (max <= 10 && slider.step === '0.01') return num.toFixed(2);
        if (Number.isInteger(min) && Number.isInteger(max) && (!slider.step || slider.step === '1')) return Math.round(num).toString();
        return num.toFixed(2);
      };

      valueDisplay.textContent = formatValue(slider.value);

      if (slider.nextSibling) {
        slider.parentNode?.insertBefore(valueDisplay, slider.nextSibling);
      } else {
        slider.parentNode?.appendChild(valueDisplay);
      }

      slider.addEventListener('input', () => {
        valueDisplay.textContent = formatValue(slider.value);
      });
    });
  };

  const cleanup = () => {
    boundEventHandlers.forEach((handler, selector) => {
      const el = rootDocument.querySelector(selector);
      if (el) {
        el.removeEventListener('input', handler);
        el.removeEventListener('change', handler);
      }
    });
    boundEventHandlers.clear();
  };

  return { bind, bindThrottled, setupSliderValueDisplays, cleanup };
}