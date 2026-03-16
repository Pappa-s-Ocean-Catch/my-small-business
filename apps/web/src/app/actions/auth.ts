"use server";

import { createServiceRoleClient } from "@my-small-business/supabase/server";

export async function canSendMagicLink(email: string) {
  // Public customers should be able to sign in with a magic link.
  // Security for admin/staff is enforced via profiles.role_slug and invitations /
  // triggers in the database, so we don't need to gate magic-link sending here.
  //
  // Supabase's `handle_new_user` trigger and `ensureProfile` helper will:
  // - Default new signups without an invitation to role 'customer'
  // - Use invitation role_slug for staff/admin when an invitation exists
  // - Keep existing admin/staff roles intact
  //
  // Therefore, always allow sending a magic link for any email.
  const _ = email; // keep signature for future logging/metrics if needed
  return { allowed: true } as const;
}


