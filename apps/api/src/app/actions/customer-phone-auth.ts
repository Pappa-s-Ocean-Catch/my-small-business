"use server";

import { createServiceRoleClient } from "@my-small-business/supabase/server";
import { mergeExistingCustomerProfileIntoAuthUser } from "@/app/actions/customer-profile-linking";

function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("04") && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith("+614") && phone.replace(/\D/g, "").length === 11) {
    return `+${phone.replace(/\D/g, "")}`;
  }
  return phone.trim();
}

export async function completePhoneCustomerProfile(input: {
  userId: string;
  fullName: string;
  email?: string;
  phone: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!input.userId) {
      return { success: false, error: "Missing user id." };
    }

    const fullName = input.fullName.trim();
    if (!fullName) {
      return { success: false, error: "Name is required." };
    }

    const normalizedPhone = normalizeAuPhone(input.phone);
    const normalizedEmail = input.email?.trim().toLowerCase() || null;

    const supabase = await createServiceRoleClient();

    const mergeResult = await mergeExistingCustomerProfileIntoAuthUser({
      userId: input.userId,
      email: normalizedEmail,
      phone: normalizedPhone,
      fullName,
    });

    if (!mergeResult.success) {
      return {
        success: false,
        error: mergeResult.error || "Failed to link existing customer profile.",
      };
    }

    const profileUpdate: {
      full_name: string;
      phone: string;
      role_slug: "customer";
      email?: string | null;
    } = {
      full_name: fullName,
      phone: normalizedPhone,
      role_slug: "customer",
    };

    if (normalizedEmail) {
      profileUpdate.email = normalizedEmail;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", input.userId);

    if (profileError) {
      return {
        success: false,
        error: `Failed to save profile: ${profileError.message}. Please try again.`,
      };
    }

    if (normalizedEmail) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        input.userId,
        {
          email: normalizedEmail,
          user_metadata: {
            full_name: fullName,
            phone: normalizedPhone,
          },
        },
      );

      if (authError) {
        return {
          success: false,
          error: `Profile saved, but failed to update account email: ${authError.message}.`,
        };
      }
    } else {
      const { error: authMetaError } = await supabase.auth.admin.updateUserById(
        input.userId,
        {
          user_metadata: {
            full_name: fullName,
            phone: normalizedPhone,
          },
        },
      );

      if (authMetaError) {
        return {
          success: false,
          error: `Profile saved, but failed to update account metadata: ${authMetaError.message}.`,
        };
      }
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return {
      success: false,
      error: `Could not complete your profile: ${message}`,
    };
  }
}
