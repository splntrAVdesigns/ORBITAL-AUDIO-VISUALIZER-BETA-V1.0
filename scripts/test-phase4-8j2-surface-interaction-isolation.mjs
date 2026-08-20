import fs from 'node:fs';

const macro = fs.readFileSync('src/app/components/MacroKnob.tsx', 'utf8');
const panel = fs.readFileSync('src/app/components/ControlPanel.tsx', 'utf8');
const ui = fs.readFileSync('src/app/runtime/uiInteractionRuntime.ts', 'utf8');
const css = fs.readFileSync('src/styles/globals.css', 'utf8');

const checks = [
  ['macro pointer move bypasses React synthetic handler', !macro.includes('onPointerMove={') && macro.includes("addEventListener('pointermove'")],
  ['macro runtime stays release-authoritative', macro.includes('onCommit(committed)')],
  ['interaction bookkeeping certification-only', ui.includes('const INTERACTION_STATE_ENABLED = FIELD_CERTIFICATION_ENABLED;')],
  ['panel shell is #333333', css.includes('--orbital-panel-shell: #333333;')],
  ['tabs use unified #191919 surface', css.includes('--orbital-control-surface: #191919;')],
  ['audio display surface matches #191919', css.includes('--orbital-display-surface: #191919;')],
  ['audio region explicitly #262626', panel.includes("audio-live-region\" style={{ background: '#262626'")],
  ['presets separator removed', !panel.includes('Separator line to indicate end of non-scrollable area')],
  ['panel decorative shadow removed', css.includes('#panel {\n  box-shadow: none;')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed++;
}
console.log(`Phase 4.8J.2 ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
