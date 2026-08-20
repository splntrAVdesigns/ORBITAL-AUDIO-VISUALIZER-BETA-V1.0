import fs from 'node:fs';
const macro = fs.readFileSync('src/app/components/MacroKnob.tsx','utf8');
const css = fs.readFileSync('src/styles/globals.css','utf8');
const checks = [
  ['macro has no useState interaction state', !/useState/.test(macro)],
  ['macro no setIsDragging', !/setIsDragging/.test(macro)],
  ['macro no localValue React state', !/setLocalValue|\[localValue/.test(macro)],
  ['macro no global body cursor mutation', !/document\.body\.style\.cursor/.test(macro)],
  ['native drag class remains', /classList\.add\('dragging'\)/.test(macro)],
  ['parameter rail has no permanent compositor promotion', !/\.parameter-scroll-region\s*\{[^}]*?(?:translate3d|will-change:\s*transform)/s.test(css)],
  ['stage promotion is transition-scoped only', !/(?:^|\n)#stage\s*\{[^}]*?(?:translate3d|will-change:\s*transform)/s.test(css) && /body\.orbital-stage-transition #stage\s*\{[^}]*will-change:\s*transform/s.test(css)],
  ['render canvases have no permanent compositor hints', !/#(?:canvas|glCanvas)\s*\{[^}]*will-change/s.test(css)],
  ['panel shell 333333', /--orbital-panel-shell:\s*#333333/.test(css)],
  ['section surface 191919', /--orbital-control-surface:\s*#191919/.test(css)],
  ['audio displays 191919', /audio-live-region[\s\S]*#191919/.test(css)],
  ['audio analyzer borders removed', /#miniSpectrum[\s\S]*border:\s*0\s*!important/.test(css)],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if (failed) process.exit(1);
console.log(`Phase 4.8J.3 ${checks.length}/${checks.length} PASS`);
