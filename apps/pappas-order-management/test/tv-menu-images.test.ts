import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadTVMenuImage, getImageDownloadName, downloadAndShareMenuImage } from '../lib/tv-menu-images';

const image = { uri: 'file:///cache/menu.png', name: 'menu.png', mimeType: 'image/png' };

test('uploads native file bytes before saving the public image URL', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
  const events: string[] = [];
  await uploadTVMenuImage(image, 3, {
    read: async (file) => { assert.equal(file.uri, image.uri); return bytes; },
    upload: async (path, body, contentType) => {
      assert.equal(body, bytes);
      assert.equal(contentType, 'image/png');
      assert.match(path, /^menus\/.+\.png$/);
      events.push('upload');
      return 'https://storage.example/menu.png';
    },
    save: async (row) => {
      assert.deepEqual(row, { name: 'menu.png', url: 'https://storage.example/menu.png', is_active: true, sort_order: 3 });
      events.push('save');
    },
    remove: async () => { events.push('remove'); },
  });
  assert.deepEqual(events, ['upload', 'save']);
});

test('reports unreadable local files without starting a storage upload', async () => {
  await assert.rejects(uploadTVMenuImage(image, 0, {
    read: async () => { throw new Error('Permission denied'); },
    upload: async () => { assert.fail('must not upload'); },
    save: async () => { assert.fail('must not save'); },
    remove: async () => { assert.fail('must not remove'); },
  }), /read.*Permission denied/i);
});

test('rejects empty images before storage upload', async () => {
  await assert.rejects(uploadTVMenuImage(image, 0, {
    read: async () => new ArrayBuffer(0),
    upload: async () => { assert.fail('must not upload'); },
    save: async () => { assert.fail('must not save'); },
    remove: async () => { assert.fail('must not remove'); },
  }), /empty/i);
});

test('reports storage failures without creating a database row', async () => {
  await assert.rejects(uploadTVMenuImage(image, 0, {
    read: async () => new ArrayBuffer(4),
    upload: async () => { throw new Error('Network request failed'); },
    save: async () => { assert.fail('must not save'); },
    remove: async () => { assert.fail('must not remove'); },
  }), /upload.*Network request failed/i);
});

test('removes an orphaned upload when saving its database row fails', async () => {
  let uploadedPath = '';
  let removedPath = '';
  await assert.rejects(uploadTVMenuImage(image, 0, {
    read: async () => new ArrayBuffer(4),
    upload: async (path) => { uploadedPath = path; return 'https://storage.example/menu.png'; },
    save: async () => { throw new Error('Database unavailable'); },
    remove: async (path) => { removedPath = path; },
  }), /save.*Database unavailable/i);
  assert.equal(removedPath, uploadedPath);
  assert.ok(removedPath);
});

test('uses safe download filenames and retains image extensions', () => {
  assert.equal(getImageDownloadName('../../Menu: today.png', 'https://example.com/abc.png'), 'Menu_ today.png');
  assert.equal(getImageDownloadName('Menu', 'https://example.com/abc.jpeg?token=1'), 'Menu.jpeg');
});


test('retains a shared download so the recipient can still read its file', async () => {
  const files = new Set<string>();
  await downloadAndShareMenuImage('file:///cache/menu.png', {
    download: async (uri) => { files.add(uri); },
    share: async (uri) => { assert.ok(files.has(uri)); },
    remove: async (uri) => { files.delete(uri); },
  });
  assert.ok(files.has('file:///cache/menu.png'));
});

test('removes partial or failed downloads and reports the original error', async () => {
  for (const failAt of ['download', 'share']) {
    const files = new Set<string>();
    await assert.rejects(downloadAndShareMenuImage('file:///cache/menu.png', {
      download: async (uri) => { files.add(uri); if (failAt === 'download') throw new Error('Download failed'); },
      share: async () => { throw new Error('Sharing failed'); },
      remove: async (uri) => { files.delete(uri); },
    }), failAt === 'download' ? /Download failed/ : /Sharing failed/);
    assert.equal(files.size, 0);
  }
});
