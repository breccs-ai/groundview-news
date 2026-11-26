// Loads the app's own TypeScript modules into Node so pure logic can be tested
// without a build. Resolves the "@/..." alias, transpiles with the project's
// TypeScript, and caches modules. Modules that need Next.js internals
// (next/headers etc.) can be stubbed through the `stubs` argument.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');

function createLoader(stubs = {}) {
  const cache = new Map();

  function resolveFile(spec) {
    const base = path.join(ROOT, spec.slice(2));
    for (const ext of ['.ts', '.tsx', '/index.ts', '.js']) {
      if (fs.existsSync(base + ext)) return base + ext;
    }
    throw new Error('cannot resolve ' + spec);
  }

  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const src = fs.readFileSync(file, 'utf8');
    const js = ts.transpileModule(src, {
      compilerOptions: { module: 'commonjs', target: 'es2019', jsx: 'react-jsx', esModuleInterop: true },
    }).outputText;
    const mod = { exports: {} };
    cache.set(file, mod);
    const req = (id) => {
      if (id in stubs) return stubs[id];
      if (id.startsWith('@/')) return load(resolveFile(id));
      return require(id);
    };
    new Function('module', 'exports', 'require', js)(mod, mod.exports, req);
    return mod.exports;
  }

  return (spec) => load(spec.startsWith('@/') ? resolveFile(spec) : path.resolve(ROOT, spec));
}

module.exports = { createLoader, ROOT };
