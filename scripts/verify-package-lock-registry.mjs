import { readFile } from 'node:fs/promises';

const ALLOWED_REGISTRY_HOST = 'registry.npmjs.org';

const lockfile = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
);

const disallowedSources = [];

for (const [packagePath, entry] of Object.entries(lockfile.packages ?? {})) {
  if (!entry || typeof entry !== 'object' || typeof entry.resolved !== 'string') {
    continue;
  }

  let host;

  try {
    host = new URL(entry.resolved).hostname;
  } catch {
    disallowedSources.push(`${packagePath || '<root>'}: invalid resolved URL`);
    continue;
  }

  if (host !== ALLOWED_REGISTRY_HOST) {
    disallowedSources.push(`${packagePath || '<root>'}: ${host}`);
  }
}

if (disallowedSources.length > 0) {
  console.error('Package lock verification failed. Non-public registry sources found:');
  for (const source of disallowedSources) {
    console.error(`- ${source}`);
  }
  process.exit(1);
}

console.log(`Package lock verified: all resolved packages use ${ALLOWED_REGISTRY_HOST}.`);
