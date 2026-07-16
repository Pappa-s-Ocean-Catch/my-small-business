import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_DISCOVERY_TIMEOUT_MS } from "./constants.js";
import { discoverByIpScan } from "./discovery.js";
import { EscPosValidationError } from "./errors.js";
import { buildDocumentPrintJob, buildTextPrintJob } from "./escpos.js";
import { createNodeTcpConnector, normalizePort } from "./network.js";
import { createEscPosPrintSession } from "./session.js";
function assertHost(host) {
    if (!host.trim()) {
        throw new EscPosValidationError("Printer host is required.");
    }
}
export function createEscPosPrinterClient(options) {
    const connector = options?.connector ?? createNodeTcpConnector();
    return {
        async probe(request) {
            assertHost(request.host);
            return await connector.probe(request.host.trim(), normalizePort(request.port), request.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS);
        },
        async discoverNetworkPrinters(request) {
            return await discoverByIpScan(request, connector);
        },
        async printBytes(request) {
            assertHost(request.host);
            await connector.write(request.host.trim(), normalizePort(request.port), request.data, request.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
        },
        async printText(request) {
            assertHost(request.host);
            const data = buildTextPrintJob(request.lines, {
                cut: request.cut,
                initialize: request.initialize,
                style: request.style,
            });
            await connector.write(request.host.trim(), normalizePort(request.port), data, request.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
        },
        async printDocument(request) {
            assertHost(request.host);
            const data = buildDocumentPrintJob(request.document);
            await connector.write(request.host.trim(), normalizePort(request.port), data, request.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
        },
        openSession(request) {
            assertHost(request.host);
            return createEscPosPrintSession(request, async (document) => {
                const data = buildDocumentPrintJob(document);
                await connector.write(request.host.trim(), normalizePort(request.port), data, request.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
            });
        },
    };
}
