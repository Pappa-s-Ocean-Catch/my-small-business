import test from 'node:test';
import assert from 'node:assert/strict';
import { createEscPosRasterFixture } from '../lib/escpos-raster';

const opaque = (r: number, g: number, b: number) => [r, g, b, 255];

test('locks the black and white raster fixture at 80 mm', async () => {
  const rgba = Uint8Array.from([
    ...opaque(255, 255, 255), ...opaque(0, 0, 0),
    ...opaque(0, 0, 0), ...opaque(255, 255, 255),
  ]);

  const fixture = await createEscPosRasterFixture(rgba, 2, 2, 576);

  assert.deepEqual(fixture, {
    width: 8,
    height: 2,
    byteLength: 46,
    fnv1a32: 'db625121',
  });
});

test('locks transparent pixels as white in the alpha raster fixture', async () => {
  const rgba = Uint8Array.from([
    0, 0, 0, 0,
    0, 0, 0, 255,
  ]);

  const fixture = await createEscPosRasterFixture(rgba, 2, 1, 384);

  assert.deepEqual(fixture, {
    width: 8,
    height: 1,
    byteLength: 46,
    fnv1a32: '071d56e1',
  });
});

test('locks long receipt output after 58 mm resizing', async () => {
  const width = 400;
  const height = 49;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const black = (x + y) % 7 === 0;
      rgba.set(black ? opaque(0, 0, 0) : opaque(255, 255, 255), index);
    }
  }

  const fixture = await createEscPosRasterFixture(rgba, width, height, 384);

  assert.deepEqual(fixture, {
    width: 384,
    height: 47,
    byteLength: 2332,
    fnv1a32: '7023ea35',
  });
});
