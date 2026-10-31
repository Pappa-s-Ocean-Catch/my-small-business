import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppDialogStore } from '../lib/app-dialog';

test('dialogs queue and a choice runs once without a confirmation step', async () => {
  const store = createAppDialogStore();
  const calls: string[] = [];
  store.alert('Payment', 'Choose method', [{ text: 'Cash', onPress: () => { calls.push('cash'); } }, { text: 'Card', onPress: () => { calls.push('card'); } }]);
  store.alert('Next');
  const first = store.getSnapshot().dialog!;
  assert.equal(first.buttons.at(-1)?.style, 'cancel');
  await store.choose(first.id, 1);
  await store.choose(first.id, 1);
  assert.deepEqual(calls, ['card']);
  assert.equal(store.getSnapshot().dialog?.title, 'Next');
});
test('cancel and noncancelable informational dialogs retain their semantics', async () => {
  const store = createAppDialogStore();
  const calls: string[] = [];
  store.alert('Delete?', '', [{ text: 'Keep', style: 'cancel', onPress: () => { calls.push('cancel'); } }, { text: 'Delete', style: 'destructive', onPress: () => { calls.push('delete'); } }]);
  assert.equal(store.dismiss(), true);
  assert.deepEqual(calls, ['cancel']);
  store.alert('Error');
  assert.equal(store.dismiss(), false);
  assert.equal(store.getSnapshot().dialog?.buttons[0].text, 'OK');
  await store.choose(store.getSnapshot().dialog!.id, 0);
  assert.equal(store.getSnapshot().dialog, null);
});
test('alerts target the deepest active modal and return to its parent after closing', () => {
  const store = createAppDialogStore();
  const child = store.registerHost(2);
  const root = store.registerHost(0);
  const parent = store.registerHost(1);
  store.alert('Nested error');
  assert.equal(store.getSnapshot().hostId, child);
  store.unregisterHost(child);
  assert.equal(store.getSnapshot().hostId, parent);
  store.unregisterHost(parent);
  assert.equal(store.getSnapshot().hostId, root);
});
test('callback failures become custom error dialogs without blocking later messages', async () => {
  const store = createAppDialogStore();
  store.alert('Action', '', [{ text: 'Run', onPress: async () => { throw new Error('Offline'); } }]);
  await store.choose(store.getSnapshot().dialog!.id, 0);
  assert.equal(store.getSnapshot().dialog?.title, 'Action failed');
  assert.equal(store.getSnapshot().dialog?.message, 'Offline');
});
test('dismissible messages invoke dismissal callbacks and explicit destructive actions remain guarded by Cancel', () => {
  const store = createAppDialogStore();
  let dismissed = 0;
  store.alert('Notice', '', undefined, { cancelable: true, onDismiss: () => { dismissed++; } });
  assert.equal(store.dismiss(), true);
  assert.equal(dismissed, 1);
  store.alert('Remove?', '', [{ text: 'Remove', style: 'destructive' }]);
  assert.equal(store.getSnapshot().dialog?.buttons.length, 2);
});

test('opening and closing ordinary modals does not notify dialog subscribers while idle', () => {
  const store = createAppDialogStore();
  let notifications = 0;
  store.subscribe(() => { notifications++; });
  const root = store.registerHost(0);
  const picker = store.registerHost(101);
  store.unregisterHost(picker);
  assert.equal(notifications, 0);
  store.alert('Error');
  assert.equal(notifications, 1);
  assert.equal(store.getSnapshot().hostId, root);
});
