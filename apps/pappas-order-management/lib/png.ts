import { inflate } from 'pako';

type DecodedPng = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanlines(data: Uint8Array, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const stride = width * bytesPerPixel;
  const output = new Uint8Array(height * stride);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = data[sourceOffset];
    sourceOffset += 1;

    for (let column = 0; column < stride; column += 1) {
      const raw = data[sourceOffset++];
      const left = column >= bytesPerPixel ? output[targetOffset + column - bytesPerPixel] : 0;
      const up = row > 0 ? output[targetOffset + column - stride] : 0;
      const upLeft = row > 0 && column >= bytesPerPixel ? output[targetOffset + column - stride - bytesPerPixel] : 0;

      switch (filterType) {
        case 0:
          output[targetOffset + column] = raw;
          break;
        case 1:
          output[targetOffset + column] = (raw + left) & 0xff;
          break;
        case 2:
          output[targetOffset + column] = (raw + up) & 0xff;
          break;
        case 3:
          output[targetOffset + column] = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          output[targetOffset + column] = (raw + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
    }

    targetOffset += stride;
  }

  return output;
}

function expandToRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  colorType: number
): Uint8Array {
  const pixelCount = width * height;
  const rgba = new Uint8Array(pixelCount * 4);

  if (colorType === 6) {
    return pixels;
  }

  if (colorType === 2) {
    for (let source = 0, target = 0; target < rgba.length; source += 3, target += 4) {
      rgba[target] = pixels[source];
      rgba[target + 1] = pixels[source + 1];
      rgba[target + 2] = pixels[source + 2];
      rgba[target + 3] = 255;
    }
    return rgba;
  }

  if (colorType === 0) {
    for (let source = 0, target = 0; target < rgba.length; source += 1, target += 4) {
      const value = pixels[source];
      rgba[target] = value;
      rgba[target + 1] = value;
      rgba[target + 2] = value;
      rgba[target + 3] = 255;
    }
    return rgba;
  }

  if (colorType === 4) {
    for (let source = 0, target = 0; target < rgba.length; source += 2, target += 4) {
      const value = pixels[source];
      rgba[target] = value;
      rgba[target + 1] = value;
      rgba[target + 2] = value;
      rgba[target + 3] = pixels[source + 1];
    }
    return rgba;
  }

  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

export async function decodePngRgba(pngBytes: Uint8Array): Promise<DecodedPng> {
  if (pngBytes.length < PNG_SIGNATURE.length) {
    throw new Error('PNG data is too short.');
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (pngBytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error('Invalid PNG signature.');
    }
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatParts: Uint8Array[] = [];

  while (offset + 8 <= pngBytes.length) {
    const length = readUint32(pngBytes, offset);
    offset += 4;
    const type = chunkType(pngBytes, offset);
    offset += 4;

    if (offset + length + 4 > pngBytes.length) {
      throw new Error(`PNG chunk ${type} exceeds input length.`);
    }

    const data = pngBytes.slice(offset, offset + length);
    offset += length;
    offset += 4; // skip CRC

    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlaceMethod = data[12];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) {
    throw new Error('PNG is missing IHDR metadata.');
  }
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }
  if (interlaceMethod !== 0) {
    throw new Error('Interlaced PNG is not supported.');
  }

  const bytesPerPixel =
    colorType === 6 ? 4 :
    colorType === 2 ? 3 :
    colorType === 0 ? 1 :
    colorType === 4 ? 2 :
    0;

  if (!bytesPerPixel) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const totalIdatLength = idatParts.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(totalIdatLength);
  let compressedOffset = 0;
  for (const part of idatParts) {
    compressed.set(part, compressedOffset);
    compressedOffset += part.length;
  }

  const inflated = inflate(compressed);
  const pixels = unfilterScanlines(inflated, width, height, bytesPerPixel);
  const rgba = expandToRgba(pixels, width, height, colorType);

  return { width, height, rgba };
}
