import fs from 'node:fs/promises';
import path from 'node:path';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;
const FF = 0x0c;
const TAB = 0x09;

const SVG_LINE_HEIGHT = 24;
const SVG_TEXT_BASELINE = 18;
const PAPER_WIDTHS = {
  '58mm': 384,
  '80mm': 576,
};

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function decodeTextByte(byte) {
  if (byte >= 0x20 && byte <= 0x7e) return String.fromCharCode(byte);
  if (byte >= 0xa0) return String.fromCharCode(byte);
  return '';
}

function cloneStyle(style) {
  return {
    align: style.align,
    bold: style.bold,
    widthScale: style.widthScale,
    heightScale: style.heightScale,
    font: style.font,
  };
}

function concatUint8Arrays(left, right) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left, 0);
  merged.set(right, left.length);
  return merged;
}

export class EscPosSimulatorSession {
  constructor({ outputDir, connectionId, paperWidth = '80mm' }) {
    this.outputDir = outputDir;
    this.connectionId = connectionId;
    this.paperWidth = paperWidth;
    this.svgWidth = PAPER_WIDTHS[paperWidth] || PAPER_WIDTHS['80mm'];
    this.jobSequence = 0;
    this.pending = [];
    this.partial = new Uint8Array(0);
    this.currentLine = '';
    this.currentStyle = this.defaultStyle();
    this.lineStyle = cloneStyle(this.currentStyle);
    this.unsupportedCommands = [];
    this.totalBytes = 0;
  }

  defaultStyle() {
    return {
      align: 'left',
      bold: false,
      widthScale: 1,
      heightScale: 1,
      font: 'A',
    };
  }

  resetFormatting() {
    this.currentStyle = this.defaultStyle();
    this.lineStyle = cloneStyle(this.currentStyle);
  }

  ensureLineStyle() {
    if (!this.currentLine.length) {
      this.lineStyle = cloneStyle(this.currentStyle);
    }
  }

  appendText(value) {
    if (!value) return;
    this.ensureLineStyle();
    this.currentLine += value;
  }

  flushLine(force = false) {
    if (!this.currentLine.length && !force) return;
    this.pending.push({
      type: 'text',
      text: this.currentLine,
      style: cloneStyle(this.lineStyle),
    });
    this.currentLine = '';
    this.lineStyle = cloneStyle(this.currentStyle);
  }

  feed(lines = 1) {
    const count = Math.max(1, lines);
    for (let index = 0; index < count; index += 1) {
      this.flushLine(index === 0);
      if (index < count - 1) {
        this.pending.push({ type: 'blank' });
      }
    }
  }

  setAlignment(value) {
    this.currentStyle.align = value;
  }

  setBold(enabled) {
    this.currentStyle.bold = enabled;
  }

  setFont(font) {
    this.currentStyle.font = font;
  }

  setSize(rawValue) {
    const widthScale = ((rawValue >> 4) & 0x07) + 1;
    const heightScale = (rawValue & 0x07) + 1;
    this.currentStyle.widthScale = widthScale;
    this.currentStyle.heightScale = heightScale;
  }

  addRasterImage(widthBytes, height, bytes) {
    this.flushLine();
    this.pending.push({
      type: 'image',
      mode: 'raster',
      width: widthBytes * 8,
      height,
      bytes: Uint8Array.from(bytes),
    });
  }

  addBitImage(width, height, bytes) {
    this.flushLine();
    this.pending.push({
      type: 'image',
      mode: 'bit-image',
      width,
      height,
      bytes: Uint8Array.from(bytes),
    });
  }

  recordUnsupported(command, bytes) {
    this.unsupportedCommands.push({
      command,
      bytes: bytesToHex(bytes),
    });
  }

  async processChunk(chunk) {
    this.totalBytes += chunk.length;
    const data = this.partial.length
      ? concatUint8Arrays(this.partial, chunk)
      : chunk;
    let index = 0;

    while (index < data.length) {
      const byte = data[index];

      if (byte === ESC) {
        if (index + 1 >= data.length) break;
        const command = data[index + 1];

        if (command === 0x40) {
          this.flushLine();
          this.resetFormatting();
          index += 2;
          continue;
        }

        if (command === 0x61 && index + 2 < data.length) {
          const alignValue = data[index + 2];
          this.setAlignment(alignValue === 1 ? 'center' : alignValue === 2 ? 'right' : 'left');
          index += 3;
          continue;
        }

        if (command === 0x45 && index + 2 < data.length) {
          this.setBold(data[index + 2] !== 0);
          index += 3;
          continue;
        }

        if (command === 0x4d && index + 2 < data.length) {
          this.setFont(data[index + 2] === 1 ? 'B' : 'A');
          index += 3;
          continue;
        }

        if (command === 0x64 && index + 2 < data.length) {
          this.feed(data[index + 2]);
          index += 3;
          continue;
        }

        if (command === 0x2a && index + 4 < data.length) {
          const mode = data[index + 2];
          const nL = data[index + 3];
          const nH = data[index + 4];
          const width = nL + (nH << 8);
          const stripeHeight = mode === 32 || mode === 33 ? 24 : 8;
          const imageDataLength = width * Math.ceil(stripeHeight / 8);
          const start = index + 5;
          const end = start + imageDataLength;
          if (end > data.length) break;
          const imageBytes = data.slice(start, end);
          this.addBitImage(width, stripeHeight, imageBytes);
          index = end;
          if (index < data.length && data[index] === LF) {
            index += 1;
          }
          continue;
        }

        if (command === 0x33 && index + 2 < data.length) {
          index += 3;
          continue;
        }

        if (command === 0x32) {
          index += 2;
          continue;
        }

        this.recordUnsupported(`ESC ${String.fromCharCode(command)}`, data.slice(index, Math.min(index + 4, data.length)));
        index += 2;
        continue;
      }

      if (byte === GS) {
        if (index + 1 >= data.length) break;
        const command = data[index + 1];

        if (command === 0x21 && index + 2 < data.length) {
          this.setSize(data[index + 2]);
          index += 3;
          continue;
        }

        if (command === 0x56) {
          const consumed = index + 3 <= data.length ? 3 : 2;
          index += consumed;
          await this.finalizeJob('cut');
          continue;
        }

        if (command === 0x76 && index + 7 < data.length && data[index + 2] === 0x30) {
          const m = data[index + 3];
          const xL = data[index + 4];
          const xH = data[index + 5];
          const yL = data[index + 6];
          const yH = data[index + 7];
          const widthBytes = xL + (xH << 8);
          const height = yL + (yH << 8);
          const imageDataLength = widthBytes * height;
          const start = index + 8;
          const end = start + imageDataLength;
          if (end > data.length) break;
          const imageBytes = data.slice(start, end);
          this.addRasterImage(widthBytes, height, imageBytes);
          index = end;
          void m;
          continue;
        }

        this.recordUnsupported(`GS ${String.fromCharCode(command)}`, data.slice(index, Math.min(index + 8, data.length)));
        index += 2;
        continue;
      }

      if (byte === LF) {
        this.feed(1);
        index += 1;
        continue;
      }

      if (byte === FF) {
        this.feed(1);
        index += 1;
        continue;
      }

      if (byte === CR) {
        index += 1;
        continue;
      }

      if (byte === TAB) {
        this.appendText('    ');
        index += 1;
        continue;
      }

      const decoded = decodeTextByte(byte);
      if (decoded) {
        this.appendText(decoded);
      } else if (byte !== 0x00) {
        this.recordUnsupported(`BYTE_${byte.toString(16).padStart(2, '0')}`, Uint8Array.of(byte));
      }
      index += 1;
    }

    this.partial = index < data.length ? data.slice(index) : new Uint8Array(0);
  }

  async finalizePendingOnDisconnect() {
    if (this.partial.length) {
      this.recordUnsupported('PARTIAL_TRAILING_BYTES', this.partial);
      this.partial = new Uint8Array(0);
    }
    if (this.currentLine.length || this.pending.length) {
      await this.finalizeJob('socket-close');
    }
  }

  async finalizeJob(reason) {
    this.flushLine();
    if (!this.pending.length) return;

    this.jobSequence += 1;
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const baseName = `${stamp}-conn${this.connectionId}-job${String(this.jobSequence).padStart(3, '0')}`;
    const svgPath = path.join(this.outputDir, `${baseName}.svg`);
    const metaPath = path.join(this.outputDir, `${baseName}.json`);

    const svg = this.renderSvg();
    const meta = {
      connectionId: this.connectionId,
      jobSequence: this.jobSequence,
      finalizedBy: reason,
      createdAt: new Date().toISOString(),
      totalBytes: this.totalBytes,
      unsupportedCommands: this.unsupportedCommands,
      entries: this.pending.map((entry) => (
        entry.type === 'image'
          ? { type: 'image', mode: entry.mode, width: entry.width, height: entry.height, bytesLength: entry.bytes.length }
          : entry
      )),
      paperWidth: this.paperWidth,
      svgWidth: this.svgWidth,
    };

    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.writeFile(svgPath, svg, 'utf8');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    this.pending = [];
    this.currentLine = '';
    this.unsupportedCommands = [];
  }

  renderSvg() {
    let y = 20;
    const nodes = [];

    for (const entry of this.pending) {
      if (entry.type === 'blank') {
        y += SVG_LINE_HEIGHT;
        continue;
      }

      if (entry.type === 'text') {
        const fontSize = 14 * entry.style.heightScale;
        const x = entry.style.align === 'center' ? this.svgWidth / 2 : entry.style.align === 'right' ? this.svgWidth - 20 : 20;
        const anchor = entry.style.align === 'center' ? 'middle' : entry.style.align === 'right' ? 'end' : 'start';
        const weight = entry.style.bold ? '700' : '400';
        const family = entry.style.font === 'B' ? 'monospace' : 'Courier New, monospace';
        nodes.push(
          `<text x="${x}" y="${y + SVG_TEXT_BASELINE}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="0">${escapeXml(entry.text || ' ')}</text>`
        );
        y += Math.max(SVG_LINE_HEIGHT, fontSize + 6);
        continue;
      }

      if (entry.type === 'image') {
        const imageSvg = entry.mode === 'bit-image'
          ? this.renderBitImage(entry.bytes, entry.width, entry.height, y)
          : this.renderRasterImage(entry.bytes, entry.width, entry.height, y);
        for (const node of imageSvg.nodes) {
          nodes.push(node);
        }
        y = imageSvg.nextY;
      }
    }

    const height = Math.max(y + 20, 120);
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.svgWidth}" height="${height}" viewBox="0 0 ${this.svgWidth} ${height}">`,
      `<rect width="100%" height="100%" fill="#ffffff"/>`,
      ...nodes,
      `</svg>`,
    ].join('\n');
  }

  renderRasterImage(bytes, width, height, startY) {
    const maxRenderableWidth = Math.max(1, this.svgWidth - 40);
    const pixelSize = width > maxRenderableWidth ? (maxRenderableWidth / width) : 1;
    const renderedWidth = width * pixelSize;
    const renderedHeight = height * pixelSize;
    const offsetX = Math.max(20, Math.floor((this.svgWidth - renderedWidth) / 2));
    const nodes = [];

    for (let row = 0; row < height; row += 1) {
      for (let byteIndex = 0; byteIndex < width / 8; byteIndex += 1) {
        const value = bytes[row * (width / 8) + byteIndex];
        for (let bit = 0; bit < 8; bit += 1) {
          const isBlack = ((value >> (7 - bit)) & 1) === 1;
          if (!isBlack) continue;
          const x = offsetX + (byteIndex * 8 + bit) * pixelSize;
          const y = startY + row * pixelSize;
          nodes.push(`<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="#000000"/>`);
        }
      }
    }

    return {
      nodes,
      nextY: startY + renderedHeight + 20,
    };
  }

  renderBitImage(bytes, width, height, startY) {
    const maxRenderableWidth = Math.max(1, this.svgWidth - 40);
    const pixelSize = width > maxRenderableWidth ? (maxRenderableWidth / width) : 1;
    const renderedWidth = width * pixelSize;
    const renderedHeight = height * pixelSize;
    const offsetX = Math.max(20, Math.floor((this.svgWidth - renderedWidth) / 2));
    const nodes = [];

    for (let x = 0; x < width; x += 1) {
      for (let stripe = 0; stripe < Math.ceil(height / 8); stripe += 1) {
        const value = bytes[(x * Math.ceil(height / 8)) + stripe] ?? 0;
        for (let bit = 0; bit < 8; bit += 1) {
          if (((value >> (7 - bit)) & 1) !== 1) continue;
          const renderX = offsetX + (x * pixelSize);
          const renderY = startY + ((stripe * 8) + bit) * pixelSize;
          if (renderY >= startY + renderedHeight) continue;
          nodes.push(`<rect x="${renderX}" y="${renderY}" width="${pixelSize}" height="${pixelSize}" fill="#000000"/>`);
        }
      }
    }

    return {
      nodes,
      nextY: startY + renderedHeight,
    };
  }
}
