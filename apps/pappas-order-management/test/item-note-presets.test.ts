import assert from 'node:assert/strict';
import test from 'node:test';
import { hasNotePreset, toggleNotePreset } from '../lib/note-presets';

test('adds a quick item-note preset as its own line without overwriting typed text', () => {
  assert.equal(toggleNotePreset('Well done', 'Cut in half'), 'Well done\nCut in half');
  assert.equal(hasNotePreset('Well done\nCut in half', 'Cut in half'), true);
});

test('removes only the selected quick item-note preset', () => {
  assert.equal(
    toggleNotePreset('Well done\nCut in half\nPack separately', 'Cut in half'),
    'Well done\nPack separately',
  );
});

test('does not duplicate a selected quick item-note preset', () => {
  assert.equal(toggleNotePreset('Cut in half', ' Cut in half '), '');
});
