import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

test('application alerts and native modal windows use the shared custom-dialog infrastructure', () => {
  const paths: string[] = [];
  const collect = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) collect(path); else if (/\.(tsx|ts)$/.test(path)) paths.push(path); } };
  for (const dir of ['app', 'components', 'hooks', 'lib', 'providers']) collect(dir);
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /window\.(confirm|alert)\s*\(/, path);
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const node of tree.statements) {
      if (!ts.isImportDeclaration(node) || (node.moduleSpecifier as ts.StringLiteral).text !== 'react-native' || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) continue;
      for (const specifier of node.importClause.namedBindings.elements) {
        const name = (specifier.propertyName || specifier.name).text;
        assert.notEqual(name, 'Alert', `System alerts must not reappear in ${path}`);
        if (path !== join('components', 'ui', 'AppModal.tsx')) assert.notEqual(name, 'Modal', `Native windows must host custom alerts in ${path}`);
      }
    }
  }
});
