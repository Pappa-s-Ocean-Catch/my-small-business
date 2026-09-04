import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { probeHttpHost, probeHttpsHost } from './scan-local-http.mjs';

function respondingRequest(statusCode, statusMessage, capture) {
  return (url, options, callback) => {
    capture.url = url;
    capture.options = options;

    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = () => {};

    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.statusMessage = statusMessage;
      response.resume = () => {};
      callback(response);
      response.emit('end');
    });

    return request;
  };
}

test('probeHttpHost reports an HTTP response even when it is unauthorized', async () => {
  const capture = {};

  const result = await probeHttpHost('192.168.0.42', {
    requestImpl: respondingRequest(401, 'Unauthorized', capture),
    timeoutMs: 50,
  });

  assert.deepEqual(result, {
    host: '192.168.0.42',
    protocol: 'http',
    status: 401,
    statusText: 'Unauthorized',
  });
  assert.equal(capture.url, 'http://192.168.0.42/');
});

test('probeHttpsHost reports an HTTPS basic-auth response with a self-signed certificate allowed', async () => {
  const capture = {};

  const result = await probeHttpsHost('192.168.0.100', {
    requestImpl: respondingRequest(401, 'Unauthorized', capture),
    timeoutMs: 50,
  });

  assert.deepEqual(result, {
    host: '192.168.0.100',
    protocol: 'https',
    status: 401,
    statusText: 'Unauthorized',
  });
  assert.equal(capture.url, 'https://192.168.0.100/');
  assert.equal(capture.options.rejectUnauthorized, false);
});

test('probeHttpHost treats connection failures as no HTTP server', async () => {
  const result = await probeHttpHost('192.168.0.43', {
    requestImpl: () => {
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.destroy = () => {};
      queueMicrotask(() => request.emit('error', new Error('connection refused')));
      return request;
    },
    timeoutMs: 50,
  });

  assert.equal(result, null);
});

test('probeHttpHost resolves when a request times out without emitting an error', async () => {
  const result = await Promise.race([
    probeHttpHost('192.168.0.44', {
      requestImpl: () => {
        const request = new EventEmitter();
        request.setTimeout = (_timeoutMs, callback) => queueMicrotask(callback);
        request.destroy = () => {};
        return request;
      },
      timeoutMs: 50,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('probe did not finish')), 25)),
  ]);

  assert.equal(result, null);
});
