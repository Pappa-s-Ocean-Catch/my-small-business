"use server";

import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordReset } from "@/emails/PasswordReset";
import { createServiceRoleClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string) {
  try {
    // Use service role client to check if user exists in auth.users
    const supabase = await createServiceRoleClient();
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching users:", authError);
      return {
        success: false,
        error: "Failed to verify user account"
      };
    }

    // Check if user exists in auth.users
    const user = users?.find(u => u.email === email);
    if (!user) {
      return {
        success: false,
        error: "No account found with this email address"
      };
    }

    // Use Supabase's built-in reset (this will send its own email)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?type=recovery`,
    });

    if (resetError) {
      console.error("Password reset error:", resetError);
      return {
        success: false,
        error: resetError.message
      };
    }

    return {
      success: true,
      message: "Password reset email sent successfully"
    };

  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: "An unexpected error occurred"
    };
  }
}

