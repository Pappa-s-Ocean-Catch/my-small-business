"use server";

import { Resend } from "resend";
import { PasswordReset } from "@/emails/PasswordReset";
import { createServiceRoleClient } from "@my-small-business/supabase/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { withRedirectTo } from "@/lib/password-auth";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function getResetRedirectUrl(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/reset-password`;
}

export async function sendPasswordResetEmail(email: string) {
  try {
    if (!resend || !process.env.EMAIL_FROM) {
      throw new Error("Password reset email is not configured");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createServiceRoleClient();
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: getResetRedirectUrl() },
    });

    const generatedActionLink = data?.properties?.action_link;
    if (linkError || !generatedActionLink) {
      console.error("Password reset link generation failed:", linkError);
      return {
        success: false,
        error: linkError?.message || "No account found with this email address",
      };
    }

    // Supabase can return its configured site URL here. Mirror the working
    // custom magic-link flow and ensure the email always returns to the page
    // that establishes the recovery session.
    const resetUrl = withRedirectTo(generatedActionLink, getResetRedirectUrl());

    const brandSettings = await getBrandSettings();
    const businessName = brandSettings?.business_name || "Pappas Ocean Catch";
    const logoUrl = brandSettings?.logo_url || undefined;
    const { error: sendError } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [normalizedEmail],
      subject: `Reset your ${businessName} password`,
      react: PasswordReset({ resetUrl, userEmail: normalizedEmail, businessName, logoUrl }),
    });

    if (sendError) {
      console.error("Password reset email delivery failed:", sendError);
      return { success: false, error: "Unable to send password reset email. Please try again." };
    }

    return { success: true, message: "Password reset email sent successfully" };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
