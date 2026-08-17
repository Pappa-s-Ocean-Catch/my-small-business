import type { EscPosDocument, EscPosTextStyle } from './instore-instant-ticket';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function pushTextStyle(bytes: number[], style: EscPosTextStyle | undefined) {
  const align = style?.align === 'center' ? 1 : style?.align === 'right' ? 2 : 0;
  const font = style?.font === 'B' ? 1 : 0;
  const width = (style?.widthScale ?? 1) - 1;
  const height = (style?.heightScale ?? 1) - 1;

  bytes.push(
    ESC, 0x61, align,
    ESC, 0x45, style?.bold ? 1 : 0,
    ESC, 0x47, style?.doubleStrike ? 1 : 0,
    ESC, 0x2d, style?.underline ? 1 : 0,
    GS, 0x42, style?.invert ? 1 : 0,
    ESC, 0x4d, font,
    GS, 0x21, (width << 4) | height,
  );
}

/** Encodes the shared text-document shape without any raster or image commands. */
export function buildDocumentPrintJob(document: EscPosDocument): Uint8Array {
  const bytes: number[] = document.initialize === false ? [] : [ESC, 0x40];
  if (document.paperWidth) {
    const dots = document.paperWidth === '58mm' ? 384 : 576;
    bytes.push(GS, 0x57, dots & 0xff, dots >> 8);
  }

  for (const node of document.nodes) {
    if (node.type === 'text') {
      pushTextStyle(bytes, node.style);
      bytes.push(...encodeText(node.text));
      if (node.newline !== false) bytes.push(LF);
      continue;
    }

    if (node.type === 'feed') {
      bytes.push(ESC, 0x64, Math.max(0, Math.min(255, node.lines ?? 1)));
      continue;
    }

    bytes.push(GS, 0x56, node.partial ? 1 : 0);
  }

  return Uint8Array.from(bytes);
}
