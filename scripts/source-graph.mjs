import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;

export const SOURCE_GRAPH_ENTRYPOINTS = Object.freeze([
  'src/main.tsx',
  'src/app/runtime/visualizer/runtime-typecheck-entry.ts',
  'src/app/runtime/mainThread/WindowBridgeManifest.ts',
]);

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const trackedExtensions = new Set(['.ts', '.tsx']);

export function toProjectPath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export function walkTrackedSource(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkTrackedSource(fullPath));
    else if (trackedExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function parseModule(file) {
  return parse(fs.readFileSync(file, 'utf8'), {
    sourceType: 'module',
    sourceFilename: file,
    plugins: [
      'typescript',
      'jsx',
      'dynamicImport',
      'importMeta',
      'classProperties',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  });
}

function resolveRelativeImport(importer, rawSpecifier) {
  const specifier = rawSpecifier.split(/[?#]/, 1)[0];
  if (!specifier.startsWith('.')) return null;

  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [base];
  for (const extension of sourceExtensions) candidates.push(`${base}${extension}`);
  for (const extension of sourceExtensions) candidates.push(path.join(base, `index${extension}`));

  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function collectSpecifiers(file) {
  const specifiers = [];
  const ast = parseModule(file);

  traverse(ast, {
    ImportDeclaration(importPath) {
      specifiers.push(importPath.node.source.value);
    },
    ExportNamedDeclaration(exportPath) {
      if (exportPath.node.source) specifiers.push(exportPath.node.source.value);
    },
    ExportAllDeclaration(exportPath) {
      specifiers.push(exportPath.node.source.value);
    },
    CallExpression(callPath) {
      if (callPath.node.callee.type !== 'Import') return;
      const [argument] = callPath.node.arguments;
      if (argument?.type === 'StringLiteral') specifiers.push(argument.value);
    },
    ImportExpression(importPath) {
      if (importPath.node.source.type === 'StringLiteral') specifiers.push(importPath.node.source.value);
    },
    NewExpression(newPath) {
      if (newPath.node.callee.type !== 'Identifier' || newPath.node.callee.name !== 'URL') return;
      const [argument] = newPath.node.arguments;
      if (argument?.type === 'StringLiteral') specifiers.push(argument.value);
    },
  });

  return specifiers;
}

export function buildSourceGraph({
  root = process.cwd(),
  entrypoints = SOURCE_GRAPH_ENTRYPOINTS,
} = {}) {
  const absoluteEntrypoints = entrypoints.map(file => path.resolve(root, file));
  const errors = [];
  const reachable = new Set();
  const pending = [...absoluteEntrypoints];

  for (const entrypoint of absoluteEntrypoints) {
    if (!fs.existsSync(entrypoint)) errors.push(`Missing source-graph entrypoint: ${toProjectPath(root, entrypoint)}`);
  }

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || reachable.has(file) || !fs.existsSync(file)) continue;
    reachable.add(file);

    let specifiers;
    try {
      specifiers = collectSpecifiers(file);
    } catch (error) {
      errors.push(`Unable to parse ${toProjectPath(root, file)}: ${error.message}`);
      continue;
    }

    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveRelativeImport(file, specifier);
      if (!resolved) {
        const extension = path.extname(specifier.split(/[?#]/, 1)[0]);
        if (!extension || sourceExtensions.includes(extension)) {
          errors.push(`Unresolved relative import in ${toProjectPath(root, file)}: ${specifier}`);
        }
        continue;
      }
      if (trackedExtensions.has(path.extname(resolved)) && !reachable.has(resolved)) pending.push(resolved);
    }
  }

  return { entrypoints: absoluteEntrypoints, errors, reachable };
}