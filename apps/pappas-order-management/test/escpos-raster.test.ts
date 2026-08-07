import test from 'node:test';
import assert from 'node:assert/strict';
import { deflate } from 'pako';
import { compareEscPosPayloads, prepareEscPosImage } from '../lib/escpos-raster';

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function pngRgba(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const rows = new Uint8Array(height * ((width * 4) + 1));
  for (let y = 0; y < height; y += 1) rows.set(rgba.slice(y * width * 4, (y + 1) * width * 4), y * ((width * 4) + 1) + 1);
  const chunk = (type: string, data: Uint8Array) => Uint8Array.from([...u32(data.length), ...type.split('').map((char) => char.charCodeAt(0)), ...data, 0, 0, 0, 0]);
  return Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', Uint8Array.from([...u32(width), ...u32(height), 8, 6, 0, 0, 0])), ...chunk('IDAT', deflate(rows)), ...chunk('IEND', new Uint8Array())]);
}

test('prepares equivalent PNG RGBA and ARGB sources as identical ESC/POS payloads', async () => {
  const rgba = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255]);
  const fromPng = await prepareEscPosImage({ kind: 'png-base64', base64: encodeBase64(pngRgba(2, 1, rgba)) }, 8);
  const fromRaw = await prepareEscPosImage({ kind: 'raw-argb', width: 2, height: 1, argb: Uint8Array.from([255, 255, 255, 255, 255, 0, 0, 0]) }, 8);

  assert.deepEqual(fromRaw.bytes, fromPng.bytes);
  assert.equal(compareEscPosPayloads(fromPng.bytes, fromRaw.bytes).equal, true);
});

test('rejects raw pixel data that does not match its dimensions', async () => {
  await assert.rejects(() => prepareEscPosImage({ kind: 'raw-argb', width: 2, height: 1, argb: Uint8Array.of(255) }, 8), /expected 8 bytes/i);
});
