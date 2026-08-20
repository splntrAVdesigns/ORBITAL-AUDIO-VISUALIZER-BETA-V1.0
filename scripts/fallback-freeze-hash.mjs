import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FALLBACK_SOURCE_NORMALIZATION = 'lf-with-single-final-newline-v1';
const sourceExtensions = new Set(['.ts', '.tsx']);

export function normalizeFrozenSource(value) {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/\n*$/, '\n');
}

function collect(root, target) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...collect(root, path.relative(root, child)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(child);
  }
  return files;
}

export function computeFallbackFreeze({ root = process.cwd(), includes }) {
  const files = [...new Set(includes.flatMap(target => collect(root, target)))].sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    hash.update(relative);
    hash.update('\0');
    hash.update(normalizeFrozenSource(fs.readFileSync(file, 'utf8')));
    hash.update('\0');
  }
  return { digest: hash.digest('hex'), files };
}