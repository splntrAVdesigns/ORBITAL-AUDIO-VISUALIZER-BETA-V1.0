import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

export async function importBundledTypescript(relativePath, context) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-unit-'));
  const outputPath = path.join(temporaryDirectory, `${path.basename(relativePath, '.ts')}.mjs`);
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

  const result = await build({
    entryPoints: [path.join(root, relativePath)],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    plugins: [{
      name: 'orbital-unit-virtual-worker',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^virtual:orbital-live-worker$/ }, () => ({ path: 'orbital-unit-worker', namespace: 'orbital-unit' }));
        buildApi.onLoad({ filter: /.*/, namespace: 'orbital-unit' }, () => ({ contents: 'export default "self.postMessage({protocolVersion:3,type:\"live-bootstrap-ready\"})";', loader: 'js' }));
      },
    }],
  });
  fs.writeFileSync(outputPath, result.outputFiles[0].contents);
  return import(`${pathToFileURL(outputPath).href}?test=${Date.now()}-${Math.random()}`);
}