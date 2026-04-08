import { NextResponse } from "next/server";

type SupabaseSmsHookPayload = {
  phone?: string;
  message?: string;
  otp?: string;
  user?: { phone?: string | null };
  sms?: { phone?: string; message?: string; otp?: string };
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    return digits;
  }
  if (digits.startsWith("04") && digits.length === 10) {
    return `61${digits.slice(1)}`;
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SupabaseSmsHookPayload;
    const phone =
      payload.phone ?? payload.sms?.phone ?? payload.user?.phone ?? "";
    const otp = payload.otp ?? payload.sms?.otp;
    const configuredTemplate =
      process.env.SMS_OTP_TEMPLATE ??
      "Your verification code for Pappas Ocean Catch is {code}. It expires in 5 minutes.";
    const messageFromProvider = payload.message ?? payload.sms?.message ?? "";
    const message = otp
      ? configuredTemplate.replace("{code}", otp)
      : messageFromProvider;

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Missing phone or message in hook payload." },
        { status: 400 },
      );
    }

    const smsApiKey = process.env.SMS_API_KEY;
    const sender =
      process.env.SMS_SENDER_ID ??
      process.env.SMS_SENDER ??
      process.env.MOBILE_MESSAGE_SENDER;

    if (!smsApiKey) {
      return NextResponse.json(
        {
          error:
            "Missing SMS_API_KEY. Set it to the Mobile Message user:password value.",
        },
        { status: 500 },
      );
    }

    if (!sender) {
      return NextResponse.json(
        {
          error:
            "Missing SMS sender id. Set SMS_SENDER_ID (or SMS_SENDER / MOBILE_MESSAGE_SENDER).",
        },
        { status: 500 },
      );
    }

    const authHeader = `Basic ${Buffer.from(smsApiKey).toString("base64")}`;

    const mobileMessageRes = await fetch("https://api.mobilemessage.com.au/v1/messages", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            to: normalizePhone(phone),
            message,
            sender,
            custom_ref: "supabase-phone-auth",
          },
        ],
      }),
    });

    const mobileMessageJson = (await mobileMessageRes.json()) as {
      error?: string;
      results?: Array<{ status?: string; to?: string }>;
    };

    if (!mobileMessageRes.ok) {
      return NextResponse.json(
        {
          error:
            mobileMessageJson.error ??
            "Failed to send SMS via Mobile Message API.",
        },
        { status: mobileMessageRes.status },
      );
    }

    return NextResponse.json({
      success: true,
      provider: "mobilemessage",
      result: mobileMessageJson.results?.[0]?.status ?? "queued",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: `SMS hook failed: ${message}` },
      { status: 500 },
    );
  }
}
