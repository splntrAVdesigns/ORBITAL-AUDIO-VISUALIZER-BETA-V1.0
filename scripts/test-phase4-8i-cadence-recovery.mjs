import fs from 'node:fs';
const read = p => fs.readFileSync(p,'utf8');
const scheduler = read('src/app/runtime/visualizer/RuntimeFrameScheduler.ts');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const motion = read('src/app/runtime/visualizer/motion/ProductionMotionStateRuntime.ts');
const preset = read('src/app/utils/presetActions.ts');
const knob = read('src/app/components/MacroKnob.tsx');
const cert = read('src/app/runtime/visualizer/diagnostics/ProductionPerformanceCertification.ts');
const audio = read('src/app/runtime/audio/VisualAudioRuntime.ts');
const checks = [
  ['next RAF pre-armed before frame work', scheduler.indexOf('this.schedule();') < scheduler.indexOf('this.options.onFrame(timing)')],
  ['scheduler still has single RAF authority', (scheduler.match(/requestAnimationFrame\(/g)||[]).length === 1],
  ['reactivity cadence remains audio-only', audio.includes('Visual rendering remains display-rate') && audio.includes('reactivityHz === 30 ? 30 : 60')],
  ['motion runtime owns macro2 commit tween', motion.includes('startMacro2RotationCommit') && motion.includes('updateMacro2RotationCommit')],
  ['session advances macro2 tween from visual clock', session.includes('motionState.updateMacro2RotationCommit(t, params)')],
  ['preset action publishes macro2 target', preset.includes('ctx.startMacro2RotationCommit(macro2RotationTarget)')],
  ['macro2 live phase cannot mutate runtime', preset.includes("macroName === 'macro2' && options.interactionPhase === 'live'")],
  ['macro2 knob keeps drag local', knob.includes('deferRuntimeUpdates') && knob.includes('data-macro-id={id}')],
  ['certification can identify macro2 pointer drag', cert.includes('[data-macro-id="macro2"]') && cert.includes("addEventListener('pointerdown'" )],
  ['canvas wheel listener remains passive', session.includes('eventRegistry.listen(canvas, "wheel", eventHandlers.windowWheel, { passive: true })')],
];
let failed=0;
for (const [name,pass] of checks) { console.log(`${pass?'PASS':'FAIL'} ${name}`); if(!pass) failed++; }
console.log(`Phase 4.8I cadence/action gate: ${checks.length-failed}/${checks.length} PASS`);
if(failed) process.exit(1);
