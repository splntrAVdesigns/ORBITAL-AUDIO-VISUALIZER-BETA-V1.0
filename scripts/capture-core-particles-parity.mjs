import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'docs/core-particles-parity');
fs.mkdirSync(outputDirectory, { recursive: true });

const hash = seed => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const particle = index => ({
  angle: hash(index * 7919.234) * Math.PI * 2,
  radius: Math.pow(hash(index * 13579.246), 0.68),
  phase: hash(index * 77391.251) * Math.PI * 2,
  depth: 0.25 + hash(index * 1357.999) * 0.75,
  hue: 200 + (hash(index * 45678.333) * 2 - 1) * 40,
});

const color = (hue, alpha) => `hsla(${hue.toFixed(1)}, 100%, 58%, ${alpha.toFixed(3)})`;
const point = (shape, x, y, radius, fill) => {
  if (shape === 'tri') {
    return `<polygon points="${x},${y - radius} ${x - radius * 0.90},${y + radius * 0.72} ${x + radius * 0.90},${y + radius * 0.72}" fill="${fill}"/>`;
  }
  if (shape === 'dia') {
    return `<polygon points="${x},${y - radius} ${x - radius},${y} ${x},${y + radius} ${x + radius},${y}" fill="${fill}"/>`;
  }
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
};

const field = ({ x, y, width, height, shape, energy, transient, time }) => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const spread = 0.62;
  const fieldScale = 0.115 + (0.315 - 0.115) * Math.pow(spread, 0.78);
  const fieldRadius = Math.min(width, height) * fieldScale;
  let body = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="#04070b"/>`;
  for (let index = 0; index < 212; index += 1) {
    const seed = particle(index);
    const phasePulse = Math.max(0, Math.sin(time * 2.15 + seed.phase));
    const radius = fieldRadius * (0.10 + Math.pow(seed.radius, 0.88) * 0.82) *
      (1 + energy * (0.16 + seed.radius * 0.28) + transient * (0.24 + phasePulse * 0.22));
    const swirl = energy * 0.22 * Math.sin(time * 1.9 + seed.phase * 1.3);
    const px = centerX + Math.cos(seed.angle) * radius - Math.sin(seed.angle) * fieldRadius * swirl;
    const py = centerY + Math.sin(seed.angle) * radius + Math.cos(seed.angle) * fieldRadius * swirl;
    const resolvedShape = shape === 'all'
      ? (hash(seed.angle * 17.23 + seed.phase * 3.1) < 0.50 ? 'dot' : hash(index * 41.7) < 0.5 ? 'tri' : 'dia')
      : shape;
    const size = 1.4 + seed.depth * 1.1 + energy * 1.3 + phasePulse * transient * 0.8;
    const alpha = 0.30 + energy * 0.34 + transient * phasePulse * 0.24;
    body += point(resolvedShape, px.toFixed(2), py.toFixed(2), size.toFixed(2), color(seed.hue + energy * 18, alpha));
  }
  return body;
};

const svgShell = (width, height, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#020407"/>
  <g style="filter: drop-shadow(0 0 3px rgba(30,144,255,.48))">${body}</g>
</svg>
`;

const shapeModes = ['dot', 'tri', 'dia', 'all'];
const shapeBody = shapeModes.map((shape, index) =>
  field({ x: index * 400 + 8, y: 8, width: 384, height: 384, shape, energy: 0.58, transient: 0.32, time: 1.25 }),
).join('');
const responseBody = [
  { energy: 0.18, transient: 0.02, time: 0.25 },
  { energy: 0.62, transient: 0.12, time: 1.25 },
  { energy: 0.74, transient: 0.88, time: 2.25 },
].map((frame, index) =>
  field({ x: index * 400 + 8, y: 8, width: 384, height: 384, shape: 'all', ...frame }),
).join('');

const captures = {
  'core-particles-shape-parity.svg': svgShell(1600, 400, shapeBody),
  'core-particles-audio-response.svg': svgShell(1200, 400, responseBody),
};

const captureHashes = {};
for (const [name, contents] of Object.entries(captures)) {
  const destination = path.join(outputDirectory, name);
  fs.writeFileSync(destination, contents);
  captureHashes[name] = crypto.createHash('sha256').update(contents).digest('hex');
}

const manifest = {
  schemaVersion: 2,
  deterministicSeedContract: 'orbital-core-particles-v2-expanded-field',
  particleCapacity: 850,
  referenceParticlesPerPanel: 212,
  shapeModes,
  captures: captureHashes,
  performanceContract: {
    simulationDrawCallsPerFrame: 1,
    renderDrawCallsPerFrame: 1,
    cpuParticleLoopsPerFrame: 0,
    recurringSchedulers: 0,
    runtimeMetric: 'window.__ORBITAL_CORE_PARTICLES_GPU__',
    acceptance: {
      averageSubmitMsMaximum: 1.5,
      maximumSubmitMsDuringStressMaximum: 4,
    },
  },
};
fs.writeFileSync(
  path.join(outputDirectory, 'core-particles-parity-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Core Particle parity captures written: ${Object.keys(captures).join(', ')}`);
