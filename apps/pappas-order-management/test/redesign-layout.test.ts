import assert from 'node:assert/strict';
import test from 'node:test';
import { getPosWorkspaceLayout, getWindowSizeClass } from '../lib/redesign';

test('uses window width instead of orientation for responsive size classes', () => {
  for (const width of [320, 375, 430, 599]) assert.equal(getWindowSizeClass(width), 'compact');
  for (const width of [600, 699, 768, 820, 1024, 1099]) assert.equal(getWindowSizeClass(width), 'medium');
  for (const width of [1100, 1366]) assert.equal(getWindowSizeClass(width), 'expanded');
});

test('only keeps the cart beside a menu with enough room to operate', () => {
  for (const width of [320, 375, 430, 600, 640]) assert.equal(getPosWorkspaceLayout(width).split, false);
  for (const width of [768, 820, 1024, 1100, 1366]) {
    const layout = getPosWorkspaceLayout(width);
    assert.equal(layout.split, true);
    assert.ok(layout.menuWidth >= 300);
  }
  assert.equal(getPosWorkspaceLayout(1024).cartWidth, 288);
  assert.equal(getPosWorkspaceLayout(1366).cartWidth, 352);
});

test('large accessibility text reduces columns and switches to single pane', () => {
  const regular = getPosWorkspaceLayout(768);
  const enlarged = getPosWorkspaceLayout(768, 2);
  assert.equal(regular.split, true);
  assert.equal(enlarged.split, false);
  assert.equal(getPosWorkspaceLayout(320, 2).groupColumns, 1);
  assert.equal(getPosWorkspaceLayout(320, 2).productColumns, 1);
});


test('uses the latest rail, cart and content geometry consistently across device sizes', () => {
  const large = getPosWorkspaceLayout(1366);
  assert.equal(large.railWidth, 72);
  assert.equal(large.gutter, 16);
  assert.equal(large.menuWidth, 894);
  const tablet = getPosWorkspaceLayout(1024);
  assert.equal(tablet.railWidth, 64);
  assert.equal(tablet.gutter, 12);
  assert.equal(tablet.menuWidth, 636);
  assert.equal(getPosWorkspaceLayout(390).menuWidth, 366);
});
