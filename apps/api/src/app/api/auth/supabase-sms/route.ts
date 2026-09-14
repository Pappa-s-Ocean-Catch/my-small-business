import { NextResponse } from "next/server";
import { sendSmsMessage } from '@/lib/sms';

type SupabaseSmsHookPayload = {
  phone?: string;
  message?: string;
  otp?: string;
  user?: { phone?: string | null };
  sms?: { phone?: string; message?: string; otp?: string };
};

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

    const smsResult = await sendSmsMessage({
      phone,
      message,
      customRef: 'supabase-phone-auth',
    });

    return NextResponse.json({
      success: true,
      provider: smsResult.provider,
      result: smsResult.result,
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
