const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
function encodeText(value) {
    return Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
}
export function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}
export function encodeTextLine(line) {
    return Uint8Array.from([...encodeText(line), LF]);
}
function encodeAlign(align = "left") {
    const value = align === "center" ? 1 : align === "right" ? 2 : 0;
    return Uint8Array.from([ESC, 0x61, value]);
}
function encodeBold(enabled = false) {
    return Uint8Array.from([ESC, 0x45, enabled ? 1 : 0]);
}
function encodeUnderline(enabled = false) {
    return Uint8Array.from([ESC, 0x2d, enabled ? 1 : 0]);
}
function encodeInvert(enabled = false) {
    return Uint8Array.from([GS, 0x42, enabled ? 1 : 0]);
}
function encodeFont(font = "A") {
    return Uint8Array.from([ESC, 0x4d, font === "B" ? 1 : 0]);
}
function encodeSize(style) {
    const widthScale = Math.min(8, Math.max(1, style?.widthScale ?? 1));
    const heightScale = Math.min(8, Math.max(1, style?.heightScale ?? 1));
    const value = (((widthScale - 1) & 0x07) << 4) | ((heightScale - 1) & 0x07);
    return Uint8Array.from([GS, 0x21, value]);
}
export function buildStyleBytes(style) {
    return concatBytes([
        encodeAlign(style?.align),
        encodeFont(style?.font),
        encodeBold(style?.bold),
        encodeUnderline(style?.underline),
        encodeInvert(style?.invert),
        encodeSize(style),
    ]);
}
export function buildTextNode(text, style, newline = true) {
    return {
        type: "text",
        text,
        style,
        newline,
    };
}
export function buildFeedNode(lines = 1) {
    return {
        type: "feed",
        lines,
    };
}
export function buildCutNode(partial = false) {
    return {
        type: "cut",
        partial,
    };
}
export function buildRawNode(data) {
    return {
        type: "raw",
        data,
    };
}
export function buildImageNode(image) {
    return {
        type: "image",
        image,
    };
}
function encodeFeed(lines = 1) {
    const count = Math.max(1, Math.min(255, Math.trunc(lines)));
    return Uint8Array.from([ESC, 0x64, count]);
}
function encodeCut(partial = false) {
    return Uint8Array.from([GS, 0x56, partial ? 1 : 0]);
}
function encodeBitImage24(image) {
    const width = image.width;
    const height = image.height;
    const rgba = image.data;
    const parts = [Uint8Array.from([ESC, 0x33, 24]), encodeAlign(image.align)];
    for (let y = 0; y < height; y += 24) {
        const line = new Uint8Array(5 + (width * 3) + 1);
        line[0] = ESC;
        line[1] = 0x2a;
        line[2] = 33;
        line[3] = width & 0xff;
        line[4] = (width >> 8) & 0xff;
        let offset = 5;
        for (let x = 0; x < width; x += 1) {
            for (let stripe = 0; stripe < 3; stripe += 1) {
                let value = 0;
                for (let bit = 0; bit < 8; bit += 1) {
                    const sourceY = y + (stripe * 8) + bit;
                    if (sourceY >= height)
                        continue;
                    const pixelIndex = (sourceY * width + x) * 4;
                    const r = rgba[pixelIndex] ?? 0;
                    const g = rgba[pixelIndex + 1] ?? 0;
                    const b = rgba[pixelIndex + 2] ?? 0;
                    const a = rgba[pixelIndex + 3] ?? 0;
                    const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
                    const isBlack = a > 0 && luminance < 180;
                    if (isBlack)
                        value |= (1 << (7 - bit));
                }
                line[offset] = value;
                offset += 1;
            }
        }
        line[offset] = LF;
        parts.push(line);
    }
    parts.push(Uint8Array.from([ESC, 0x32]));
    return concatBytes(parts);
}
export function encodeImage(image) {
    if (image.algorithm && image.algorithm !== "bitImage24") {
        throw new Error(`Unsupported image algorithm: ${image.algorithm}`);
    }
    return encodeBitImage24(image);
}
export function encodeDocumentNode(node) {
    switch (node.type) {
        case "text":
            return concatBytes([
                buildStyleBytes(node.style),
                encodeText(node.text),
                node.newline === false ? new Uint8Array(0) : Uint8Array.from([LF]),
            ]);
        case "feed":
            return encodeFeed(node.lines);
        case "cut":
            return encodeCut(node.partial);
        case "image":
            return encodeImage(node.image);
        case "raw":
            return node.data;
        default:
            throw new Error(`Unsupported document node ${node.type ?? "unknown"}`);
    }
}
export function buildDocumentPrintJob(document) {
    const parts = [];
    if (document.initialize !== false) {
        parts.push(Uint8Array.from([ESC, 0x40]));
    }
    for (const node of document.nodes) {
        parts.push(encodeDocumentNode(node));
    }
    return concatBytes(parts);
}
export function buildTextPrintJob(lines, options) {
    const nodes = lines.map((line) => buildTextNode(line, options?.style, true));
    if (options?.cut !== false) {
        nodes.push(buildFeedNode(3));
        nodes.push(buildCutNode(false));
    }
    return buildDocumentPrintJob({
        initialize: options?.initialize,
        nodes,
    });
}
