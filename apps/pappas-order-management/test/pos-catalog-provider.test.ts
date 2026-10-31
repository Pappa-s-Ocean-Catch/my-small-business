import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('catalogue provider starts immediately without timers, realtime subscriptions or reconnect reloads', () => {
  const requests: string[] = [];
  let effect: () => void = () => {};
  let resets = 0;
  const catalog = { refresh: async (reason: string) => { requests.push(reason); }, reset: () => { resets++; } };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('providers/PosCatalogProvider.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', 'setTimeout', 'setInterval', code)((name: string) => {
    if (name === 'react') return { useEffect: (fn: typeof effect) => { effect = fn; } };
    if (name === 'react/jsx-runtime') return { jsx: () => null };
    if (name.endsWith('/pos-catalog-coordinator')) return { createPosCatalogCoordinator: () => catalog };
    if (name.endsWith('/pos-catalog-loader')) return {};
    throw new Error(`Unexpected catalogue dependency ${name}; startup must not subscribe to live updates`);
  }, module, module.exports, () => { throw new Error('No delayed reload'); }, () => { throw new Error('No periodic reload'); });
  module.exports.PosCatalogProvider({ authenticated: true, children: null });
  effect();
  assert.deepEqual(requests, ['startup']);
  module.exports.PosCatalogProvider({ authenticated: false, children: null });
  effect();
  assert.equal(resets, 1, 'Signing out ends the private catalogue session');
});
