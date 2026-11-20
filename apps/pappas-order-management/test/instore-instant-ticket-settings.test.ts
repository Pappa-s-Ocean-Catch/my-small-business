import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real settings loader/saver against isolated storage, never device settings.
function settingsModule(initial: Record<string, unknown>) {
  let stored = JSON.stringify(initial);
  const output = ts.transpileModule(readFileSync('lib/settings.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id.includes('async-storage')) return { getItem: async () => stored, setItem: async (_key: string, value: string) => { stored = value; } };
    if (id === './sounds') return { SOUND_OPTIONS: [{ id: 'so-proud-notification' }, { id: 'vopvoopvooop' }] };
    if (id === './escpos-printer') return { isSimulatorPrinterTarget: () => false, createSimulatorSavedPrinter: () => null };
    if (id.startsWith('@/lib/')) return require(`../lib/${id.slice(6)}`);
    if (id.startsWith('./')) return require(`../lib/${id.slice(2)}`);
    throw new Error(`Unexpected settings dependency ${id}`);
  }, module, module.exports);
  return { api: module.exports, stored: () => JSON.parse(stored) };
}
test('legacy instant ticket settings default to an all-day window', async () => {
  const { api } = settingsModule({ instoreInstantTicketEnabled: true, instoreInstantTicketPrinterTarget: 'tcp:192.168.1.20:9100' });
  const loaded = await api.loadAppSettings();
  assert.equal(loaded.instoreInstantTicketEnabled, true);
  assert.equal(loaded.instoreInstantTicketEnabledFromTime, null);
  assert.equal(loaded.instoreInstantTicketEnabledToTime, null);
});

test('instant ticket overnight hours survive the real settings save and reload', async () => {
  const { api, stored } = settingsModule({});
  const settings = await api.loadAppSettings();
  await api.saveAppSettings({ ...settings, instoreInstantTicketEnabled: true, instoreInstantTicketPrinterTarget: 'tcp:192.168.1.20:9100', instoreInstantTicketEnabledFromTime: ' 20:00 ', instoreInstantTicketEnabledToTime: '06:00' });
  assert.equal(stored().instoreInstantTicketEnabledFromTime, '20:00');
  assert.equal(stored().instoreInstantTicketEnabledToTime, '06:00');
  const loaded = await api.loadAppSettings();
  assert.equal(loaded.instoreInstantTicketEnabled, true);
  assert.equal(loaded.instoreInstantTicketPrinterTarget, 'tcp:192.168.1.20:9100');
  assert.equal(loaded.instoreInstantTicketEnabledFromTime, '20:00');
  assert.equal(loaded.instoreInstantTicketEnabledToTime, '06:00');
});
