import crypto from 'node:crypto';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('PHASE_4_3_CORE_PARTICLES_CANVAS2D_FALLBACK_FREEZE.json', 'utf8'));
const source = fs.readFileSync(manifest.source, 'utf8').replace(/\r\n/g, '\n');
const begin = source.indexOf(manifest.beginMarker);
const end = source.indexOf(manifest.endMarker, begin);
if (begin < 0 || end <= begin) {
  console.error('Core Particle Canvas2D fallback freeze verification failed: boundary markers are missing.');
  process.exit(1);
}
const block = source.slice(begin, end).replace(/\n*$/, '\n');
const digest = crypto.createHash('sha256').update(block).digest('hex');
const lineCount = block.split('\n').length;
const errors = [];
if (digest !== manifest.sha256) errors.push(`expected ${manifest.sha256}; found ${digest}`);
if (lineCount !== manifest.lineCountIncludingFinalBlank) {
  errors.push(`expected ${manifest.lineCountIncludingFinalBlank} lines; found ${lineCount}`);
}
if (errors.length) {
  console.error(`Core Particle Canvas2D fallback freeze verification failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Core Particle Canvas2D fallback verified: ${lineCount} lines, ${digest.slice(0, 12)}…`);
