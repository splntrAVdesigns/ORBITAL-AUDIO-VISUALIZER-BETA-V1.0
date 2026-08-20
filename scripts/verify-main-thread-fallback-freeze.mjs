import fs from 'node:fs';
import path from 'node:path';
import {
  computeFallbackFreeze,
  FALLBACK_SOURCE_NORMALIZATION,
} from './fallback-freeze-hash.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'SPRINT_22NC69_MAIN_THREAD_FALLBACK_FREEZE.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { digest, files } = computeFallbackFreeze({ root, includes: manifest.includes });
const errors = [];
if (manifest.contentNormalization !== FALLBACK_SOURCE_NORMALIZATION) {
  errors.push(
    `Expected content normalization ${FALLBACK_SOURCE_NORMALIZATION}; ` +
    `found ${manifest.contentNormalization ?? 'none'}`,
  );
}
if (files.length !== manifest.fileCount) errors.push(`Expected ${manifest.fileCount} fallback files; found ${files.length}`);
if (digest !== manifest.aggregateSha256) errors.push(`Expected fallback digest ${manifest.aggregateSha256}; found ${digest}`);

if (errors.length > 0) {
  console.error('Main-thread fallback freeze verification failed:\n- ' + errors.join('\n- '));
  console.error('Update the freeze manifest only after an intentional worker-parity review.');
  process.exit(1);
}

console.log(
  `Main-thread fallback freeze verified: ${files.length} files, ${digest.slice(0, 12)}…, ` +
  `${FALLBACK_SOURCE_NORMALIZATION}.`,
);