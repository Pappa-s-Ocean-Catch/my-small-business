import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { DEFAULT_MARKETPLACE_SOUND_SETTINGS, getOrderSoundOptions } from '../lib/order-sound-settings';

function subscribe(overrides: Record<string, unknown> = {}) {
  const settings = { ...DEFAULT_MARKETPLACE_SOUND_SETTINGS, soundEnabled: false, soundId: 'so-proud-notification', soundRepeatCount: 3, printerEnabled: false, printerAutoPrint: false, ...overrides };
  const effects: (() => void)[] = [];
  const played: any[] = [];
  let event: (payload: any) => Promise<void> = async () => { throw new Error('No subscription'); };
  const channel = { on: (_name: string, _filter: unknown, listener: typeof event) => { event = listener; return channel; }, subscribe: () => ({}) };
  const noop = () => {};
  const state = new Proxy({ printJobs: [], activePrintJobIdsByPrinter: {}, autoPrintToast: { visible: false }, autoPrintSimulator: { visible: false } } as any, { get: (value, key) => key in value ? value[key] : noop });
  const output = ts.transpileModule(readFileSync('providers/PrinterAutomationProvider.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id === 'react') return { useCallback: (f: unknown) => f, useEffect: (f: () => void) => effects.push(f), useRef: (current: unknown) => ({ current }), useState: (v: unknown) => [v, noop] };
    if (id === 'react/jsx-runtime') return { jsx: noop, jsxs: noop };
    if (id.endsWith('useAppSettingsQuery')) return { useAppSettingsQuery: () => ({ data: settings }) };
    if (id.includes('react-query')) return { useQueryClient: () => ({ invalidateQueries: async () => {} }) };
    if (id.endsWith('/supabase')) return { supabase: { channel: () => channel, removeChannel: noop } };
    if (id.endsWith('/settings')) return { DEFAULT_APP_SETTINGS: settings };
    if (id.endsWith('/order-sound-settings')) return { getOrderSoundOptions };
    if (id.endsWith('/sounds')) return { playNewOrderSound: async (options: unknown) => { played.push(options); } };
    if (id.endsWith('/printerAutomationStore')) return { usePrinterAutomationStore: (selector: (v: unknown) => unknown) => selector(state) };
    if (id.endsWith('/marketplace-print-scheduling')) return { getPrintDelayMs: () => 0, getOrderAnnouncementDelayMs: () => null };
    if (id.endsWith('/instoreCustomerReceiptPrintContext')) return { InstoreCustomerReceiptPrintContext: { Provider: 'Provider' } };
    if (id.endsWith('/orders')) return { getOrder: () => { throw new Error('Must not fetch or print live orders'); } };
    return {};
  }, module, module.exports);
  module.exports.PrinterAutomationProvider({ children: null });
  const realtime = effects.find(effect => effect.toString().includes('printer-automation-orders'));
  assert.ok(realtime);
  realtime();
  return { played, send: (id: string, partner: string, eventType = 'INSERT') => event({ eventType, old: { order_status: 'pending' }, new: { id, order_status: 'confirmed', order_channel: 'third_party', payment_method: 'store', customer_name: 'Customer', delivery_partner_name: partner, payment_method_detail: partner } }) };
}
test('realtime marketplace arrivals sound with online sound and auto-print disabled, once per order', async () => {
  const realtime = subscribe({ marketplaceUberSoundId: 'vopvoopvooop', marketplaceDoorDashSoundRepeatCount: 5 });
  await realtime.send('uber', 'Uber Eats');
  await realtime.send('uber', 'Uber Eats', 'UPDATE');
  await realtime.send('dd', 'DoorDash');
  assert.deepEqual(realtime.played, [{ soundId: 'vopvoopvooop', repeatCount: 3, delayMs: 1000 }, { soundId: 'so-proud-notification', repeatCount: 5, delayMs: 1000 }]);
});
test('realtime respects each provider switch independently', async () => {
  const realtime = subscribe({ marketplaceUberSoundEnabled: false });
  await realtime.send('uber', 'Uber Eats');
  await realtime.send('dd', 'DoorDash');
  assert.equal(realtime.played.length, 1);
});
