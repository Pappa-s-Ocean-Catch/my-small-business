import { buildCutNode, buildDocumentPrintJob, buildFeedNode, buildImageNode, buildRawNode, buildTextNode, } from "./escpos.js";
export function createEscPosPrintSession(request, commit) {
    let nodes = [];
    const initialize = request.initialize !== false;
    const session = {
        addText(text, style, options) {
            nodes.push(buildTextNode(text, style, options?.newline !== false));
            return session;
        },
        addLine(text, style) {
            nodes.push(buildTextNode(text, style, true));
            return session;
        },
        addFeed(lines = 1) {
            nodes.push(buildFeedNode(lines));
            return session;
        },
        addCut(partial = false) {
            nodes.push(buildCutNode(partial));
            return session;
        },
        addImage(image) {
            nodes.push(buildImageNode(image));
            return session;
        },
        addRaw(data) {
            nodes.push(buildRawNode(data));
            return session;
        },
        reset() {
            nodes = [];
            return session;
        },
        toDocument() {
            return {
                initialize,
                nodes: [...nodes],
            };
        },
        toBytes() {
            return buildDocumentPrintJob(session.toDocument());
        },
        async print() {
            await commit(session.toDocument());
        },
        async close() {
            await commit(session.toDocument());
            nodes = [];
        },
    };
    return session;
}
