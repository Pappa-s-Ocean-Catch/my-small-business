import net from "node:net";
import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_DISCOVERY_TIMEOUT_MS, DEFAULT_ESCPOS_PORT } from "./constants.js";
import type { EscPosProbeResult, TcpConnector } from "./types.js";

function nowMs(): number {
  return Date.now();
}

export function createNodeTcpConnector(): TcpConnector {
  return {
    async write(host: string, port: number, data: Uint8Array, timeoutMs: number): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port, family: 4 });
        let done = false;
        const finish = (error?: Error) => {
          if (done) return;
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

    async probe(host: string, port: number, timeoutMs: number): Promise<EscPosProbeResult> {
      const startedAt = nowMs();
      return await new Promise<EscPosProbeResult>((resolve) => {
        const socket = net.createConnection({ host, port, family: 4 });
        let done = false;
        const finish = (reachable: boolean, error?: string) => {
          if (done) return;
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

export function normalizePort(port?: number): number {
  return port ?? DEFAULT_ESCPOS_PORT;
}
