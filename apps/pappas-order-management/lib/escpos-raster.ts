import { decodePngRgba } from './png';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type RasterImageSource =
  | { kind: 'png-base64'; base64: string }
  | { kind: 'png-bytes'; bytes: Uint8Array }
  | { kind: 'raw-argb'; width: number; height: number; argb: Uint8Array };

export type RasterPhasesMs = { decode: number; resize: number; raster: number; total: number };
export type PreparedEscPosImage = { bytes: Uint8Array; width: number; height: number; sourceWidth: number; sourceHeight: number; sourceByteLength: number; phasesMs: RasterPhasesMs };
export type PayloadComparison = { equal: boolean; firstMismatchIndex: number | null; referenceLength: number; candidateLength: number };
export type EscPosRasterFixture = { width: number; height: number; byteLength: number; fnv1a32: string };

function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4) - padding);
  let outputIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = (chars.indexOf(clean[i] || 'A') << 18) | (chars.indexOf(clean[i + 1] || 'A') << 12) | ((clean[i + 2] === '=' ? 0 : chars.indexOf(clean[i + 2] || 'A')) << 6) | (clean[i + 3] === '=' ? 0 : chars.indexOf(clean[i + 3] || 'A'));
    if (outputIndex < output.length) output[outputIndex++] = (chunk >> 16) & 0xff;
    if (outputIndex < output.length && clean[i + 2] !== '=') output[outputIndex++] = (chunk >> 8) & 0xff;
    if (outputIndex < output.length && clean[i + 3] !== '=') output[outputIndex++] = chunk & 0xff;
  }
  return output;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function argbToRgba(argb: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(argb.length);
  for (let i = 0; i < argb.length; i += 4) { rgba[i] = argb[i + 1]; rgba[i + 1] = argb[i + 2]; rgba[i + 2] = argb[i + 3]; rgba[i + 3] = argb[i]; }
  return rgba;
}

function rgbaToArgb(rgba: Uint8Array): Uint8Array {
  const argb = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) { argb[i] = rgba[i + 3]; argb[i + 1] = rgba[i]; argb[i + 2] = rgba[i + 1]; argb[i + 3] = rgba[i + 2]; }
  return argb;
}

function fnv1a32(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getEscPosPayloadFingerprint(bytes: Uint8Array): string {
  return fnv1a32(bytes);
}

function resizeRgbaToWidth(width: number, height: number, rgba: Uint8Array, maxWidth: number) {
  const normalizedMaxWidth = Math.max(8, maxWidth) - (Math.max(8, maxWidth) % 8);
  if (width <= normalizedMaxWidth && width % 8 === 0) return { width, height, rgba };
  const scale = Math.min(1, normalizedMaxWidth / width);
  const nextWidth = Math.max(8, Math.floor(width * scale)) - (Math.max(8, Math.floor(width * scale)) % 8);
  const nextHeight = Math.max(1, Math.floor(height * scale));
  const output = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) for (let x = 0; x < nextWidth; x += 1) {
    const source = ((Math.min(height - 1, Math.floor(y / scale)) * width) + Math.min(width - 1, Math.floor(x / scale))) * 4;
    const target = (y * nextWidth + x) * 4;
    output[target] = rgba[source];
    output[target + 1] = rgba[source + 1];
    output[target + 2] = rgba[source + 2];
    output[target + 3] = rgba[source + 3];
  }
  return { width: nextWidth, height: nextHeight, rgba: output };
}

function rgbaToEscPosBitImage(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.from([ESC, 0x33, 24])];
  for (let y = 0; y < height; y += 24) {
    const line = new Uint8Array(5 + (width * 3) + 1); line.set([ESC, 0x2a, 33, width & 0xff, (width >> 8) & 0xff]);
    let offset = 5;
    for (let x = 0; x < width; x += 1) for (let stripe = 0; stripe < 3; stripe += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) { const sourceY = y + (stripe * 8) + bit; if (sourceY < height) { const index = (sourceY * width + x) * 4; const luminance = (rgba[index] * 0.299) + (rgba[index + 1] * 0.587) + (rgba[index + 2] * 0.114); if (rgba[index + 3] > 0 && luminance < 180) value |= 1 << (7 - bit); } }
      line[offset++] = value;
    }
    line[offset] = LF; parts.push(line);
  }
  parts.push(Uint8Array.from([ESC, 0x32]));
  return concatBytes(parts);
}

export async function prepareEscPosImage(source: RasterImageSource, maxWidth: number): Promise<PreparedEscPosImage> {
  const started = Date.now();
  let width: number; let height: number; let rgba: Uint8Array; let sourceByteLength: number;
  if (source.kind === 'raw-argb') {
    const expectedLength = source.width * source.height * 4;
    if (source.argb.length !== expectedLength) throw new Error(`Raw ARGB capture expected ${expectedLength} bytes but received ${source.argb.length}.`);
    width = source.width; height = source.height; rgba = argbToRgba(source.argb); sourceByteLength = source.argb.length;
  } else { const bytes = source.kind === 'png-base64' ? decodeBase64(source.base64) : source.bytes; const decoded = await decodePngRgba(bytes); width = decoded.width; height = decoded.height; rgba = decoded.rgba; sourceByteLength = bytes.length; }
  const decodedAt = Date.now(); const normalized = resizeRgbaToWidth(width, height, rgba, maxWidth); const resizedAt = Date.now();
  const raster = rgbaToEscPosBitImage(normalized.width, normalized.height, normalized.rgba);
  const bytes = concatBytes([Uint8Array.from([ESC, 0x40, ESC, 0x61, 0x01]), raster, Uint8Array.from([LF, LF, LF, GS, 0x56, 0x00])]);
  const completedAt = Date.now();
  return { bytes, width: normalized.width, height: normalized.height, sourceWidth: width, sourceHeight: height, sourceByteLength, phasesMs: { decode: decodedAt - started, resize: resizedAt - decodedAt, raster: completedAt - resizedAt, total: completedAt - started } };
}

export async function createEscPosRasterFixture(rgba: Uint8Array, width: number, height: number, maxWidth: number): Promise<EscPosRasterFixture> {
  if (rgba.length !== width * height * 4) throw new Error(`RGBA fixture expected ${width * height * 4} bytes but received ${rgba.length}.`);
  const prepared = await prepareEscPosImage({ kind: 'raw-argb', width, height, argb: rgbaToArgb(rgba) }, maxWidth);
  return { width: prepared.width, height: prepared.height, byteLength: prepared.bytes.length, fnv1a32: fnv1a32(prepared.bytes) };
}

export function compareEscPosPayloads(reference: Uint8Array, candidate: Uint8Array): PayloadComparison {
  const limit = Math.min(reference.length, candidate.length);
  for (let index = 0; index < limit; index += 1) if (reference[index] !== candidate[index]) return { equal: false, firstMismatchIndex: index, referenceLength: reference.length, candidateLength: candidate.length };
  return { equal: reference.length === candidate.length, firstMismatchIndex: reference.length === candidate.length ? null : limit, referenceLength: reference.length, candidateLength: candidate.length };
}
