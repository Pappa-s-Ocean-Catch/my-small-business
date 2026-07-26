import http from 'node:http';

const port = Number(process.env.HTTP_PROXY_PORT || 3001);
const target = process.env.HTTPS_PROXY_TARGET || 'https://localhost:3000';

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function filterHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([key, value]) => {
      if (!value) return false;
      return !hopByHopHeaders.has(key.toLowerCase());
    })
  );
}

const server = http.createServer(async (req, res) => {
  try {
    const body = await readRequestBody(req);
    const upstreamUrl = new URL(req.url || '/', target);
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: filterHeaders(req.headers),
      body,
      signal: controller.signal,
    });

    res.writeHead(
      upstream.status,
      Object.fromEntries(upstream.headers.entries())
    );

    if (!upstream.body) {
      res.end();
      return;
    }

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }

    const message = error instanceof Error ? error.message : 'Proxy request failed';
    res.end(JSON.stringify({ success: false, error: message }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`HTTP proxy listening on http://0.0.0.0:${port} -> ${target}`);
});
