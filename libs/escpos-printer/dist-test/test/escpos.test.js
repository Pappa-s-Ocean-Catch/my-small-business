import test from "node:test";
import assert from "node:assert/strict";
import { buildCutNode, buildDocumentPrintJob, buildFeedNode, buildImageNode, buildTextNode, buildTextPrintJob, } from "../src/escpos.js";
test("buildTextPrintJob prefixes initialize and appends cut", () => {
    const bytes = buildTextPrintJob(["TEST PRINT"], { cut: true, initialize: true });
    assert.equal(bytes[0], 0x1b);
    assert.equal(bytes[1], 0x40);
    assert.equal(bytes.at(-3), 0x1d);
    assert.equal(bytes.at(-2), 0x56);
    assert.equal(bytes.at(-1), 0x00);
});
test("buildTextPrintJob omits cut when disabled", () => {
    const bytes = buildTextPrintJob(["HELLO"], { cut: false });
    assert.notEqual(bytes.at(-3), 0x1d);
});
test("buildDocumentPrintJob encodes styled text, feed, and cut", () => {
    const bytes = buildDocumentPrintJob({
        nodes: [
            buildTextNode("CENTER", {
                align: "center",
                bold: true,
                widthScale: 2,
                heightScale: 2,
            }),
            buildFeedNode(2),
            buildCutNode(),
        ],
    });
    assert.ok(bytes.includes(0x61));
    assert.ok(bytes.includes(0x45));
    assert.ok(bytes.includes(0x21));
    assert.ok(bytes.includes(0x64));
    assert.ok(bytes.includes(0x56));
});
test("buildDocumentPrintJob encodes raster image node", () => {
    const rgba = new Uint8Array([
        0, 0, 0, 255,
        255, 255, 255, 255,
        255, 255, 255, 255,
        0, 0, 0, 255,
        0, 0, 0, 255,
        255, 255, 255, 255,
        255, 255, 255, 255,
        0, 0, 0, 255,
    ]);
    const bytes = buildDocumentPrintJob({
        nodes: [
            buildImageNode({
                kind: "raster",
                width: 2,
                height: 4,
                data: rgba,
            }),
        ],
    });
    assert.ok(bytes.length > 10);
    assert.ok(bytes.includes(0x2a));
});
