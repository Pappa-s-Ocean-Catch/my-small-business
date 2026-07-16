import test from "node:test";
import assert from "node:assert/strict";
import { createEscPosPrinterClient } from "../src/client.js";
import type { TcpConnector } from "../src/types.js";

test("client printText forwards encoded bytes to connector", async () => {
  let wrote = false;
  const connector: TcpConnector = {
    async write(host, port, data): Promise<void> {
      wrote = true;
      assert.equal(host, "192.168.0.208");
      assert.equal(port, 9100);
      assert.ok(data.length > 0);
    },
    async probe(host, port): Promise<any> {
      return { host, port, reachable: true, latencyMs: 1 };
    },
  };

  const client = createEscPosPrinterClient({ connector });
  await client.printText({
    host: "192.168.0.208",
    lines: ["OK"],
  });

  assert.equal(wrote, true);
});

test("client printDocument forwards document bytes to connector", async () => {
  let wrote = false;
  const connector: TcpConnector = {
    async write(host, port, data): Promise<void> {
      wrote = true;
      assert.equal(host, "192.168.0.208");
      assert.equal(port, 9100);
      assert.ok(data.length > 0);
    },
    async probe(host, port): Promise<any> {
      return { host, port, reachable: true, latencyMs: 1 };
    },
  };

  const client = createEscPosPrinterClient({ connector });
  await client.printDocument({
    host: "192.168.0.208",
    document: {
      nodes: [
        { type: "text", text: "Kitchen", style: { bold: true } },
        { type: "feed", lines: 1 },
        { type: "cut" },
      ],
    },
  });

  assert.equal(wrote, true);
});

test("client openSession prints buffered fluent commands", async () => {
  let wrote = false;
  const connector: TcpConnector = {
    async write(host, port, data): Promise<void> {
      wrote = true;
      assert.equal(host, "192.168.0.208");
      assert.equal(port, 9100);
      assert.ok(data.length > 0);
    },
    async probe(host, port): Promise<any> {
      return { host, port, reachable: true, latencyMs: 1 };
    },
  };

  const client = createEscPosPrinterClient({ connector });
  const session = client.openSession({
    host: "192.168.0.208",
    port: 9100,
  });

  session
    .addLine("Kitchen", { bold: true })
    .addFeed(1)
    .addCut();

  await session.close();
  assert.equal(wrote, true);
});
