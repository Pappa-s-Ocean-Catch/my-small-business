import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { getDailyReportNowMarker } from '../lib/report-current-time';

const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function render(reportDate?: string, availableWidth = 600) {
  const source = ts.createSourceFile('report.tsx', readFileSync('app/(drawer)/report.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = source.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === 'ComparisonChart')!;
  const code = ts.transpileModule(`const render = ${component.getText(source)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let stateIndex = 0;
  const buckets = Array.from({ length: 23 }, (_, index) => ({ label: String(index), total: 100 }));
  const env = { useState: () => [stateIndex++ === 0 ? availableWidth : new Date('2026-11-01T05:15:00Z'), () => {}], useEffect: () => {}, useWindowDimensions: () => ({ fontScale: 1 }), getDailyReportNowMarker, REPORT_START_HOUR: 10, REPORT_END_HOUR: 21, styles: {}, t: { color: { navy: '#10243f', success: '#12805c' } }, View: 'View', Text: 'Text', LineChart: 'Chart', Svg: 'Svg', Line: 'Line', buildChartData: (rows: any[]) => rows.map(row => ({ value: row.total, label: row.label })), money: (value: number) => String(value) };
  const jsx = (type: string, props: any) => ({ type, props });
  const componentRender = new Function('require', ...Object.keys(env), `const exports = {}; ${code}; return render;`)(() => ({ jsx, jsxs: jsx }), ...Object.values(env));
  return nodes(componentRender({ current: buckets, compare: buckets, chartKey: 'test', reportDate }));
}
test('daily current-time marker follows fractional plot spacing without blocking chart touches', () => {
  for (const width of [300, 600]) {
    const all = render('2026-11-01', width);
    const chart = all.find(n => n.type === 'Chart')!;
    const line = all.find(n => n.type === 'Line')!;
    assert.equal(line.props.x1, chart.props.yAxisLabelWidth + 1 + chart.props.initialSpacing + 12.5 * chart.props.spacing);
    assert.equal(line.props.x1, line.props.x2);
    assert.equal(line.props.strokeDasharray, '5 4');
    assert.equal(all.find(n => n.type === 'Svg')?.props.pointerEvents, 'none');
    assert.equal(chart.props.data.length, 23);
    assert.equal(chart.props.data2.length, 23);
    assert.equal(chart.props.pointerConfig.activatePointersOnLongPress, true);
  }
});
test('historical and non-daily charts do not display a current-time line', () => {
  for (const date of [undefined, '2026-10-31']) {
    assert.equal(render(date).some(n => n.type === 'Line'), false);
  }
});
