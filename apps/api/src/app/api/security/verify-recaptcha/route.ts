import { NextResponse } from "next/server";

type VerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export async function POST(request: Request) {
  try {
    const { token, action } = (await request.json()) as {
      token?: string;
      action?: string;
    };

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing reCAPTCHA token." },
        { status: 400 },
      );
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Missing RECAPTCHA_SECRET_KEY." },
        { status: 500 },
      );
    }

    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      },
    );

    const verifyJson = (await verifyRes.json()) as VerifyResponse;
    if (!verifyJson.success) {
      return NextResponse.json(
        {
          success: false,
          error: "reCAPTCHA verification failed.",
          details: verifyJson["error-codes"] ?? [],
        },
        { status: 400 },
      );
    }

    const minScoreRaw = process.env.RECAPTCHA_MIN_SCORE ?? "0.5";
    const minScore = Number(minScoreRaw);
    if (
      typeof verifyJson.score === "number" &&
      Number.isFinite(minScore) &&
      verifyJson.score < minScore
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "reCAPTCHA score too low. Please try again.",
          details: { score: verifyJson.score, minScore },
        },
        { status: 400 },
      );
    }

    if (action && verifyJson.action && verifyJson.action !== action) {
      return NextResponse.json(
        {
          success: false,
          error: "reCAPTCHA action mismatch.",
          details: { expected: action, actual: verifyJson.action },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected verification error.",
      },
      { status: 500 },
    );
  }
}
