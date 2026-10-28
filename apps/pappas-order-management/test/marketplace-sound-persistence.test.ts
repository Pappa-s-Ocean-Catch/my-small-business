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
test('legacy device settings receive independent marketplace defaults without changing online preferences', async () => {
  const { api } = settingsModule({ soundEnabled: false, soundId: 'vopvoopvooop', soundRepeatCount: 1 });
  const loaded = await api.loadAppSettings();
  assert.equal(loaded.soundEnabled, false);
  assert.equal(loaded.soundId, 'vopvoopvooop');
  assert.equal(loaded.marketplaceUberSoundEnabled, true);
  assert.equal(loaded.marketplaceDoorDashSoundEnabled, true);
  assert.equal(loaded.marketplaceUberSoundId, 'so-proud-notification');
});
test('independent provider preferences survive save and reload', async () => {
  const { api, stored } = settingsModule({});
  const settings = await api.loadAppSettings();
  await api.saveAppSettings({ ...settings, soundEnabled: false, marketplaceUberSoundEnabled: false, marketplaceUberSoundId: 'vopvoopvooop', marketplaceUberSoundRepeatCount: 2, marketplaceDoorDashSoundEnabled: true, marketplaceDoorDashSoundRepeatCount: 5 });
  assert.equal(stored().marketplaceUberSoundId, 'vopvoopvooop');
  const reloaded = await api.loadAppSettings();
  assert.equal(reloaded.soundEnabled, false);
  assert.equal(reloaded.marketplaceUberSoundEnabled, false);
  assert.equal(reloaded.marketplaceUberSoundId, 'vopvoopvooop');
  assert.equal(reloaded.marketplaceUberSoundRepeatCount, 2);
  assert.equal(reloaded.marketplaceDoorDashSoundEnabled, true);
  assert.equal(reloaded.marketplaceDoorDashSoundRepeatCount, 5);
});
