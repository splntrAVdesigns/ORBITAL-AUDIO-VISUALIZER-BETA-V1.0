import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { buildSourceGraph } from './source-graph.mjs';

const traverse = traverseModule.default ?? traverseModule;
const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const builtinPackages = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);
const implicitTooling = new Set([
  'typescript',
  'tailwindcss',
  '@types/node',
  '@types/react',
  '@types/react-dom',
]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function collectStylesheetPackages(directory) {
  const packages = new Set();
  if (!fs.existsSync(directory)) return packages;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const dependency of collectStylesheetPackages(fullPath)) packages.add(dependency);
      continue;
    }
    if (path.extname(entry.name) !== '.css') continue;
    const stylesheet = fs.readFileSync(fullPath, 'utf8');
    for (const match of stylesheet.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      const dependency = packageName(match[1]);
      if (dependency) packages.add(dependency);
    }
  }
  return packages;
}

function packageName(specifier) {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('@/') ||
    specifier.startsWith('figma:') ||
    specifier.startsWith('node:') ||
    builtinPackages.has(specifier)
  ) return null;

  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

function collectImports(files) {
  const packages = new Set();
  const errors = [];

  for (const file of files) {
    let ast;
    try {
      ast = parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'module',
        sourceFilename: file,
        plugins: ['typescript', 'jsx', 'dynamicImport', 'importMeta'],
      });
    } catch (error) {
      errors.push(`Unable to parse ${path.relative(root, file)}: ${error.message}`);
      continue;
    }

    const add = specifier => {
      const dependency = packageName(specifier);
      if (dependency) packages.add(dependency);
    };

    traverse(ast, {
      ImportDeclaration(importPath) { add(importPath.node.source.value); },
      ExportNamedDeclaration(exportPath) { if (exportPath.node.source) add(exportPath.node.source.value); },
      ExportAllDeclaration(exportPath) { add(exportPath.node.source.value); },
      CallExpression(callPath) {
        if (callPath.node.callee.type !== 'Import') return;
        const [argument] = callPath.node.arguments;
        if (argument?.type === 'StringLiteral') add(argument.value);
      },
      ImportExpression(importPath) {
        if (importPath.node.source.type === 'StringLiteral') add(importPath.node.source.value);
      },
    });
  }

  return { packages, errors };
}

const sourceGraph = buildSourceGraph({ root });
const runtime = collectImports([...sourceGraph.reachable]);
runtime.errors.push(...sourceGraph.errors);
for (const dependency of collectStylesheetPackages(path.join(root, 'src'))) runtime.packages.add(dependency);
const tooling = collectImports([
  ...walk(path.join(root, 'scripts')),
  path.join(root, 'vite.config.ts'),
].filter(file => fs.existsSync(file)));

const declaredRuntime = new Set(Object.keys(packageJson.dependencies ?? {}));
const declaredDevelopment = new Set(Object.keys(packageJson.devDependencies ?? {}));
const declaredAll = new Set([...declaredRuntime, ...declaredDevelopment]);
const errors = [...runtime.errors, ...tooling.errors];

for (const dependency of runtime.packages) {
  if (!declaredAll.has(dependency)) errors.push(`Undeclared runtime dependency: ${dependency}`);
}
for (const dependency of tooling.packages) {
  if (!declaredAll.has(dependency)) errors.push(`Undeclared tooling dependency: ${dependency}`);
}
for (const dependency of declaredRuntime) {
  if (!runtime.packages.has(dependency)) errors.push(`Unused runtime dependency: ${dependency}`);
}
for (const dependency of declaredDevelopment) {
  if (!tooling.packages.has(dependency) && !runtime.packages.has(dependency) && !implicitTooling.has(dependency)) {
    errors.push(`Unused development dependency: ${dependency}`);
  }
}

if (errors.length > 0) {
  console.error(errors.sort().join('\n'));
  process.exit(1);
}

console.log(
  `Dependency graph verified from ${sourceGraph.reachable.size} reachable modules: ` +
  `${runtime.packages.size} runtime and ${tooling.packages.size} tooling packages are declared and used.`,
);
