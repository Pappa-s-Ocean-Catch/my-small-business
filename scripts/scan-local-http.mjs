#!/usr/bin/env node

import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const SUBNET_PREFIX = '192.168.0';
const DEFAULT_TIMEOUT_MS = 1_200;
const DEFAULT_CONCURRENCY = 20;

function probeHost(host, protocol, {
  requestImpl = protocol === 'https' ? https.get : http.get,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const request = requestImpl(`${protocol}://${host}/`, {
      rejectUnauthorized: protocol === 'https' ? false : undefined,
    }, (response) => {
      response.resume();
      response.once('end', () => finish({
        host,
        protocol,
        status: response.statusCode,
        statusText: response.statusMessage,
      }));
      response.once('error', () => finish(null));
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(null);
    });
    request.once('error', () => finish(null));
  });
}

/** Returns metadata when a host replies over HTTP, including 401 Basic-auth responses. */
export function probeHttpHost(host, options) {
  return probeHost(host, 'http', options);
}

/** Returns metadata when a host replies over HTTPS, accepting local self-signed certificates. */
export function probeHttpsHost(host, options) {
  return probeHost(host, 'https', options);
}

export async function scanHttpSubnet({
  prefix = SUBNET_PREFIX,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onResult = () => {},
} = {}) {
  const targets = Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`)
    .flatMap((host) => [
      { host, protocol: 'http' },
      { host, protocol: 'https' },
    ]);
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < targets.length) {
      const { host, protocol } = targets[nextIndex++];
      const probe = protocol === 'https' ? probeHttpsHost : probeHttpHost;
      const result = await probe(host, { timeoutMs });
      if (result) {
        results.push(result);
        onResult(result);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return results.sort((a, b) =>
    Number(a.host.split('.').at(-1)) - Number(b.host.split('.').at(-1)) ||
    a.protocol.localeCompare(b.protocol),
  );
}

async function main() {
  console.log(`Scanning ${SUBNET_PREFIX}.1-254 over HTTP (80) and HTTPS (443)...`);

  const servers = await scanHttpSubnet({
    onResult: ({ host, protocol, status, statusText }) => {
      console.log(`${protocol}://${host}\t${status} ${statusText}`.trimEnd());
    },
  });

  console.log(`Found ${servers.length} HTTP server${servers.length === 1 ? '' : 's'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
