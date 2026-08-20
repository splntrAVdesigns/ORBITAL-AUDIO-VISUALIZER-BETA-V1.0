import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const macro = read('src/app/components/MacroKnob.tsx');
const css = read('src/styles/globals.css');
const interaction = read('src/app/runtime/uiInteractionRuntime.ts');
const ui = read('src/app/runtime/visualizer/ui/ProductionUISideEffectRuntime.ts');
const checks = [
  ['macro immutable dash preview', macro.includes('strokeDashoffset') && macro.includes('pathLength={100}')],
  ['no pointer path d rewrite', !macro.includes("fillPath.setAttribute('d'")],
  ['no pointer active class toggle', !macro.includes("svgContainerRef.current?.classList.toggle('active'")],
  ['no content visibility auto', !css.includes('content-visibility: auto')],
  ['wrapper duplicate border removed', css.includes('.macro-knob-circle.macro-knob-svg-container') && css.includes('border: 0;')],
  ['interaction diagnostic only', interaction.includes('DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED')],
  ['deferred macro dash sync', ui.includes('path.style.strokeDashoffset = String(val - 100)')],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([,ok]) => !ok)) process.exit(1);
console.log(`Phase 4.8J ${checks.length}/${checks.length} PASS`);
