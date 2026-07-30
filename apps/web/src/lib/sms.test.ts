import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { sendSmsMessage } from './sms.ts';

test('rejects a provider-declined SMS even when the HTTP request succeeds', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.SMS_API_KEY;
  const originalSender = process.env.SMS_SENDER_ID;

  process.env.SMS_API_KEY = 'user:password';
  process.env.SMS_SENDER_ID = 'Pappas';
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'complete',
    results: [{
      to: '61400000000',
      status: 'error',
      error: 'Recipient is unsubscribed',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    await assert.rejects(
      () => sendSmsMessage({ phone: '0400 000 000', message: 'Test message' }),
      /Recipient is unsubscribed/
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.SMS_API_KEY;
    else process.env.SMS_API_KEY = originalApiKey;
    if (originalSender === undefined) delete process.env.SMS_SENDER_ID;
    else process.env.SMS_SENDER_ID = originalSender;
  }
});
