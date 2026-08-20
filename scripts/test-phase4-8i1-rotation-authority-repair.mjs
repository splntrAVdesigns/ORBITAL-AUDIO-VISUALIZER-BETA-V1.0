import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const macro = read('src/app/components/MacroKnob.tsx');
const preset = read('src/app/utils/presetActions.ts');
const defaults = read('src/app/config/defaultParams.ts');
const settings = read('src/app/components/AnimationSettings.tsx');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts') + '\n' + read('src/app/runtime/visualizer/controls/registerVisualizerControlPlane.ts');
const authority = read('src/app/utils/rotationAuthority.ts');
const interaction = read('src/app/runtime/uiInteractionRuntime.ts');

const checks = [
  ['Macro knob owns no private RAF', !macro.includes('requestAnimationFrame(flushPreview)') && !macro.includes('previewRafRef')],
  ['Macro 2 stable DOM ids present', macro.includes('id={`${id}-fill`}') && macro.includes('id={`${id}-value`}')],
  ['Macro 2 zero restores home ease', preset.includes("ctx.startRotationHomeEase(ctx.getAngle(), 0.65)")],
  ['Macro 2 reset hard-zeroes visual state', preset.includes("macro2Fill.style.setProperty('--knob-angle', '0deg')") && preset.includes("macro2Value.textContent = '0'")],
  ['Default rotation division is 2/1', defaults.includes("rotationQuantize: '2/1'") && settings.includes('defaultValue="2/1"')],
  ['Rotation authority fallback division is 2/1', (authority.match(/rotationQuantize \|\| '2\/1'/g) || []).length >= 2],
  ['Session fallback division is 2/1', session.includes("params.rotationQuantize || '2/1'")],
  ['BPM mode disables manual rotation slider', session.includes("const speedEnabled = el.value === 'free' || el.value === 'quantized';")],
  ['Production interaction runtime has no pointermove listener', !interaction.includes("addEventListener('pointermove'")],
  ['Macro 2 transition duration increased', read('src/app/runtime/visualizer/motion/ProductionMotionStateRuntime.ts').includes('durationMs = 360')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) pass++;
}
console.log(`Phase 4.8I.1 authority/isolation gate: ${pass}/${checks.length} PASS`);
if (pass !== checks.length) process.exit(1);
