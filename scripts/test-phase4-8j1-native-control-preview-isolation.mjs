import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const macro = read('src/app/components/MacroKnob.tsx');
const panel = read('src/app/components/ControlPanel.tsx');
const css = read('src/styles/globals.css');
const color = read('src/app/components/ColorBPMSection.tsx');
const motion = read('src/app/components/AnimationSettings.tsx');
const liquid = read('src/app/components/AstralShaperSettings.tsx');
const textures = read('src/app/components/CoreTexturesSettings.tsx');
const center = read('src/app/components/CenterGraphicSettings.tsx');
const ui = read('src/app/runtime/visualizer/ui/ProductionUISideEffectRuntime.ts');
const presets = read('src/app/utils/presetActions.ts');
const checks = [
  ['macro fill direction repaired', macro.includes('String(rounded - 100)') && macro.includes('strokeDashoffset={value - 100}')],
  ['deferred macro sync direction repaired', ui.includes('String(val - 100)') && ui.includes('String(value - 100)')],
  ['preset/reset macro sync direction repaired', presets.includes('String(macroValue - 100)') && presets.includes("strokeDashoffset = '-100'")],
  ['macro preview remains zero RAF', !macro.includes('requestAnimationFrame') && !macro.includes("setAttribute('d'")],
  ['audio region isolated', panel.includes('audio-live-region') && css.includes('.audio-live-region {')],
  ['audio remains collapsible', panel.includes('setAudioSectionCollapsed(!audioSectionCollapsed)') && panel.includes('collapsible-wrapper ${audioSectionCollapsed')],
  ['macro workspace fixed outside audio region', panel.includes('control-workspace-fixed persistent-macros-presets')],
  ['parameter list is sole native scroll owner', panel.includes('panel-scrollable parameter-scroll-region') && css.includes('.parameter-scroll-region {') && css.includes('contain: layout paint style;')],
  ['audio meter thinned', panel.includes('height="12" className="audio-level-meter"')],
  ['blue feature sections use solid background', color.includes("background: '#1a1d23'") && motion.includes("background: '#1a1d23'")],
  ['liquid retains purple border on solid background', liquid.includes("background: '#1a1d23'") && liquid.includes("rgba(138,43,226,0.3)")],
  ['textures retain magenta border on solid background', textures.includes("background: '#1a1d23'") && textures.includes("rgba(255,20,147,0.3)")],
  ['center retains blue border on solid background', center.includes("background: '#1a1d23'") && center.includes("rgba(30,144,255,0.3)")],
  ['header/footer use the unframed panel shell', !panel.includes("linear-gradient(135deg, rgba(30,144,255,0.15)") && /\.panel-brand-header,[\s\S]*\.panel-footer\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*border:\s*0\s*!important;/.test(css)],
  ['brand icon and settings gear use the revised hierarchy', panel.includes("height: '26px'") && panel.includes('className="panel-settings-icon"') && css.includes('.panel-settings-button:active .panel-settings-icon')],
  ['interaction-time macro blur disabled', css.includes('.macro-knob-svg-container.dragging.active') && css.includes('filter: none !important;')],
  ['visual stage hard containment retained', css.includes('#stage {') && css.includes('contain: strict;')],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([,ok]) => !ok)) process.exit(1);
console.log(`Phase 4.8J.1 ${checks.length}/${checks.length} PASS`);