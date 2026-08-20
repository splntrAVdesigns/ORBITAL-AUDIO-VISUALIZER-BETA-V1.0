import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const defaults = read('src/app/config/defaultParams.ts');
const session = read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts');
const frameController = read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts');
const featureSession = read('src/app/runtime/visualizer/session/createVisualizerFeatureSession.ts');
const controls = read('src/app/runtime/visualizer/controls/registerVisualizerControlPlane.ts');
const productionControlSurface = `${session}\n${controls}\n${frameController}`;
const manifest = read('src/app/runtime/visualizer/kernel/VisualControlParityManifest.ts');

const expectedGroups = [
  'reactivity-hz','motion-blur','spike-fft','spike-shape','color-adapt','rotation-sync','dots','halo','halo-comet','core-particles','liquid-shaper','dark-strobe','core-textures','center-media'
];
const expectedParameters = [
  'reactivityHz','motionBlurEnabled','motionBlurPersistence','fftSize','tail','lineWidth','mirror','gamma','iridize','hueSpeed',
  'rotationSyncMode','rotationQuantize','rotation','dotsOn','dotsDensity','dotSize','dotGlow','halo','bloom','orbitalEnergy',
  'haloCometEnabled','haloCometSpeed','haloCometDirection','shapeOscillate','shapeDistortion','shapeBurstStrength',
  'astralShaper','astralShape','astralMorphAmount','astralAutoCycle','beatPulseType','darkStrobeDepth','darkStrobeDisplacement',
  'coreTexturesEnabled','coreTexturesShaderId','centerImageScale','centerImageOpacity'
];

const checks = [];
const check = (name, ok, detail='') => checks.push({ name, ok: Boolean(ok), detail });
for (const group of expectedGroups) check(`manifest includes ${group}`, manifest.includes(`id: '${group}'`));
for (const key of expectedParameters) {
  const owned = defaults.includes(`${key}:`) || productionControlSurface.includes(`.${key}`) || productionControlSurface.includes(`[\"${key}\"]`) || productionControlSurface.includes(`['${key}']`);
  check(`production runtime owns ${key}`, owned);
  check(`manifest references ${key}`, manifest.includes(`'${key}'`));
}
check('Spike FFT production binding exists', controls.includes('spikeFftExponentToWindowSize') && controls.includes('params.fftSize'));
check('Rotation production authority remains in the control plane', controls.includes('rotationSyncMode') && controls.includes('rotationQuantize'));
check('Core Textures production engine remains in feature/frame runtime', (featureSession + frameController).includes('CoreTexturesEngine') && frameController.includes('coreTexturesShaderId'));
check('Liquid Shaper production path remains in production runtime', productionControlSurface.includes('astralShaper') && productionControlSurface.includes('astralMorphAmount'));
check('Dark Strobe production path remains in frame controller', frameController.includes('darkStrobeRenderer?.render') && frameController.includes('darkStrobeDisplacement'));
check('Motion Blur production path remains in frame controller', frameController.includes('motionBlurEnabled') && frameController.includes('motionBlurPersistence'));

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (failed.length) {
  console.error(`Phase 4.8B control parity failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Phase 4.8B behavior manifest: ${checks.length}/${checks.length} checks passed.`);
