function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    return digits;
  }
  if (digits.startsWith('04') && digits.length === 10) {
    return `61${digits.slice(1)}`;
  }
  return digits;
}

export async function sendSmsMessage(params: {
  phone: string;
  message: string;
  customRef?: string;
}) {
  const smsApiKey = process.env.SMS_API_KEY;
  const sender =
    process.env.SMS_SENDER_ID ??
    process.env.SMS_SENDER ??
    process.env.MOBILE_MESSAGE_SENDER;

  if (!smsApiKey) {
    throw new Error('Missing SMS_API_KEY. Set it to the Mobile Message user:password value.');
  }

  if (!sender) {
    throw new Error('Missing SMS sender id. Set SMS_SENDER_ID (or SMS_SENDER / MOBILE_MESSAGE_SENDER).');
  }

  const authHeader = `Basic ${Buffer.from(smsApiKey).toString('base64')}`;

  const mobileMessageRes = await fetch('https://api.mobilemessage.com.au/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          to: normalizePhone(params.phone),
          message: params.message,
          sender,
          custom_ref: params.customRef || 'general-sms',
        },
      ],
    }),
  });

  const mobileMessageJson = (await mobileMessageRes.json()) as {
    error?: string;
    results?: Array<{ status?: string; to?: string }>;
  };

  if (!mobileMessageRes.ok) {
    throw new Error(mobileMessageJson.error || 'Failed to send SMS via Mobile Message API.');
  }

  return {
    provider: 'mobilemessage',
    result: mobileMessageJson.results?.[0]?.status ?? 'queued',
  };
}
