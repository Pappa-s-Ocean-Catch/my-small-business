import test from "node:test";
import assert from "node:assert/strict";
import { createEscPosPrintSession } from "../src/session.js";
test("session accumulates fluent nodes into a document", () => {
    let committed = null;
    const session = createEscPosPrintSession({ host: "192.168.0.208" }, async (document) => {
        committed = document;
    });
    session
        .addLine("Header", { bold: true, align: "center" })
        .addFeed(2)
        .addCut();
    const document = session.toDocument();
    assert.equal(document.nodes.length, 3);
    assert.equal(document.nodes[0]?.type, "text");
    assert.equal(document.nodes[1]?.type, "feed");
    assert.equal(document.nodes[2]?.type, "cut");
    void committed;
});
test("session close commits and resets buffer", async () => {
    let commitCount = 0;
    const session = createEscPosPrintSession({ host: "192.168.0.208" }, async () => {
        commitCount += 1;
    });
    session.addLine("One");
    await session.close();
    assert.equal(commitCount, 1);
    assert.equal(session.toDocument().nodes.length, 0);
});
