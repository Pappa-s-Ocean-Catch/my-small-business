"use server";

import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordReset } from "@/emails/PasswordReset";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string) {
  try {
    // Check if user exists in profiles table
    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .single();

    if (!profile) {
      return {
        success: false,
        error: "No account found with this email address"
      };
    }

    // Generate password reset link using Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    });

    if (error) {
      console.error("Password reset error:", error);
      return {
        success: false,
        error: error.message
      };
    }

    // Generate the reset URL (Supabase will handle the actual reset flow)
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`;

    // Render the email template
    const emailHtml = render(PasswordReset({ 
      resetUrl, 
      userEmail: email 
    }));

    // Send the email using Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "OperateFlow <noreply@operateflow.com>",
      to: [email],
      subject: "Reset Your OperateFlow Password",
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email sending error:", emailError);
      return {
        success: false,
        error: "Failed to send password reset email"
      };
    }

    return {
      success: true,
      messageId: emailData?.id
    };

  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: "An unexpected error occurred"
    };
  }
}
