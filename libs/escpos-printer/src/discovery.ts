import { DEFAULT_DISCOVERY_CONCURRENCY, DEFAULT_DISCOVERY_TIMEOUT_MS } from "./constants.js";
import { EscPosValidationError } from "./errors.js";
import { normalizePort } from "./network.js";
import type { EscPosDiscoveredPrinter, EscPosDiscoveryRequest, TcpConnector } from "./types.js";

export function buildIpv4Hosts(subnet: string, start: number, end: number): string[] {
  const trimmed = subnet.trim();
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    throw new EscPosValidationError(`Invalid IPv4 subnet "${subnet}". Expected format like 192.168.0`);
  }
  if (start < 0 || end > 255 || start > end) {
    throw new EscPosValidationError(`Invalid host range ${start}-${end}. Expected 0-255 with start <= end.`);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => `${trimmed}.${start + index}`);
}

export async function discoverByIpScan(
  request: EscPosDiscoveryRequest,
  connector: TcpConnector
): Promise<EscPosDiscoveredPrinter[]> {
  const hostRange = request.hostRange ?? { start: 1, end: 254 };
  const hosts = buildIpv4Hosts(request.subnet, hostRange.start, hostRange.end);
  const port = normalizePort(request.port);
  const timeoutMs = request.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  const concurrency = Math.max(1, request.concurrency ?? DEFAULT_DISCOVERY_CONCURRENCY);
  const results: EscPosDiscoveredPrinter[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, hosts.length) }, async () => {
    while (cursor < hosts.length) {
      const currentIndex = cursor;
      cursor += 1;
      const host = hosts[currentIndex];
      const probe = await connector.probe(host, port, timeoutMs);
      if (probe.reachable) {
        results.push(probe as EscPosDiscoveredPrinter);
      }
    }
  });

  await Promise.all(workers);
  return results.sort((left, right) => left.host.localeCompare(right.host));
}
