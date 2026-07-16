import {
  buildCutNode,
  buildDocumentPrintJob,
  buildFeedNode,
  buildImageNode,
  buildRawNode,
  buildTextNode,
} from "./escpos.js";
import type {
  EscPosDocument,
  EscPosDocumentNode,
  EscPosOpenSessionRequest,
  EscPosPrintSession,
  EscPosRasterImage,
  EscPosTextStyle,
} from "./types.js";

export function createEscPosPrintSession(
  request: EscPosOpenSessionRequest,
  commit: (document: EscPosDocument) => Promise<void>
): EscPosPrintSession {
  let nodes: EscPosDocumentNode[] = [];
  const initialize = request.initialize !== false;

  const session: EscPosPrintSession = {
    addText(text: string, style?: EscPosTextStyle, options?: { newline?: boolean }) {
      nodes.push(buildTextNode(text, style, options?.newline !== false));
      return session;
    },

    addLine(text: string, style?: EscPosTextStyle) {
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

    addImage(image: EscPosRasterImage) {
      nodes.push(buildImageNode(image));
      return session;
    },

    addRaw(data: Uint8Array) {
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
