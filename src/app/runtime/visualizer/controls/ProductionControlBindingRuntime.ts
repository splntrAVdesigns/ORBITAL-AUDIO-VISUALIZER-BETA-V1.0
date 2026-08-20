export interface ProductionControlBindingRuntimeOptions {
  document: Document;
  createDomBindingController: (document: Document) => any;
  onDispose: (cleanup: () => void) => void;
}

/**
 * Phase 4.8H.4
 * Owns the DOM binding controller lifecycle. Individual control policies remain
 * explicit in createVisualizerRuntimeSession until their feature runtimes own
 * the corresponding parameters, but listener registration/cleanup is no longer
 * a loose session concern.
 */
export function createProductionControlBindingRuntime(options: ProductionControlBindingRuntimeOptions) {
  const controller = options.createDomBindingController(options.document);
  options.onDispose(() => controller.cleanup());

  return {
    bind: controller.bind,
    bindThrottled: controller.bindThrottled,
    setupSliderValueDisplays: controller.setupSliderValueDisplays,
    dispose: () => controller.cleanup(),
  };
}
