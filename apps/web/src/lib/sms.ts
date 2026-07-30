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

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 2)}${'*'.repeat(Math.max(phone.length - 6, 0))}${phone.slice(-4)}` : '****';
}

type MobileMessageResult = {
  status?: string;
  to?: string;
  error?: string;
  message_id?: string;
  custom_ref?: string;
  cost?: number;
  encoding?: string;
};

type MobileMessageResponse = {
  status?: string;
  error?: string;
  results?: MobileMessageResult[];
};

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
  const normalizedPhone = normalizePhone(params.phone);
  const customRef = params.customRef || 'general-sms';

  console.info('[sms] provider request', {
    customRef,
    to: maskPhone(normalizedPhone),
    sender,
    messageLength: params.message.length,
  });

  const mobileMessageRes = await fetch('https://api.mobilemessage.com.au/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          to: normalizedPhone,
          message: params.message,
          sender,
          custom_ref: customRef,
        },
      ],
    }),
  });

  let mobileMessageJson: MobileMessageResponse;
  try {
    mobileMessageJson = (await mobileMessageRes.json()) as MobileMessageResponse;
  } catch {
    throw new Error(`Mobile Message API returned HTTP ${mobileMessageRes.status} with a non-JSON response.`);
  }

  const result = mobileMessageJson.results?.[0];
  console.info('[sms] provider response', {
    customRef,
    httpStatus: mobileMessageRes.status,
    responseStatus: mobileMessageJson.status,
    resultStatus: result?.status,
    messageId: result?.message_id,
    to: maskPhone(result?.to || normalizedPhone),
    error: result?.error || mobileMessageJson.error,
    encoding: result?.encoding,
    cost: result?.cost,
  });

  if (!mobileMessageRes.ok) {
    throw new Error(mobileMessageJson.error || 'Failed to send SMS via Mobile Message API.');
  }

  if (!result || result.status !== 'success') {
    throw new Error(result?.error || mobileMessageJson.error || 'Mobile Message did not accept the SMS.');
  }

  return {
    provider: 'mobilemessage',
    result: result.status,
    messageId: result.message_id,
    customRef,
  };
}
