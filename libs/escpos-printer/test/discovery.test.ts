import test from "node:test";
import assert from "node:assert/strict";
import { buildIpv4Hosts, discoverByIpScan } from "../src/discovery.js";
import type { TcpConnector } from "../src/types.js";

test("buildIpv4Hosts expands host range", () => {
  assert.deepEqual(buildIpv4Hosts("192.168.0", 1, 3), [
    "192.168.0.1",
    "192.168.0.2",
    "192.168.0.3",
  ]);
});

test("discoverByIpScan returns only reachable printers", async () => {
  const connector: TcpConnector = {
    async write(): Promise<void> {
      throw new Error("not used");
    },
    async probe(host, port): Promise<any> {
      return {
        host,
        port,
        reachable: host.endsWith(".10") || host.endsWith(".20"),
        latencyMs: 15,
        error: host.endsWith(".10") || host.endsWith(".20") ? undefined : "refused",
      };
    },
  };

  const printers = await discoverByIpScan({
    subnet: "192.168.0",
    hostRange: { start: 10, end: 20 },
    concurrency: 4,
  }, connector);

  assert.deepEqual(printers.map((printer) => printer.host), [
    "192.168.0.10",
    "192.168.0.20",
  ]);
});
