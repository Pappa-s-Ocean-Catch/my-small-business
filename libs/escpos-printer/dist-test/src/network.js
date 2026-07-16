import net from "node:net";
import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_DISCOVERY_TIMEOUT_MS, DEFAULT_ESCPOS_PORT } from "./constants.js";
function nowMs() {
    return Date.now();
}
export function createNodeTcpConnector() {
    return {
        async write(host, port, data, timeoutMs) {
            await new Promise((resolve, reject) => {
                const socket = net.createConnection({ host, port, family: 4 });
                let done = false;
                const finish = (error) => {
                    if (done)
                        return;
                    done = true;
                    socket.destroy();
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                };
                socket.setTimeout(timeoutMs || DEFAULT_CONNECT_TIMEOUT_MS);
                socket.once("connect", () => {
                    socket.write(Buffer.from(data), (error) => {
                        if (error) {
                            finish(error);
                            return;
                        }
                        socket.end();
                        finish();
                    });
                });
                socket.once("timeout", () => finish(new Error("TCP write timed out")));
                socket.once("error", (error) => finish(error));
            });
        },
        async probe(host, port, timeoutMs) {
            const startedAt = nowMs();
            return await new Promise((resolve) => {
                const socket = net.createConnection({ host, port, family: 4 });
                let done = false;
                const finish = (reachable, error) => {
                    if (done)
                        return;
                    done = true;
                    socket.destroy();
                    resolve({
                        host,
                        port,
                        reachable,
                        latencyMs: nowMs() - startedAt,
                        error,
                    });
                };
                socket.setTimeout(timeoutMs || DEFAULT_DISCOVERY_TIMEOUT_MS);
                socket.once("connect", () => finish(true));
                socket.once("timeout", () => finish(false, "Connection timed out"));
                socket.once("error", (error) => finish(false, error.message));
            });
        },
    };
}
export function normalizePort(port) {
    return port ?? DEFAULT_ESCPOS_PORT;
}
