"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export async function canSendMagicLink(email: string) {
  const supabase = await createServiceRoleClient();

  // 1) Existing user in profiles can always sign in
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    return { allowed: true } as const;
  }

  // 2) Otherwise, require a pending invitation
  const { data: invite, error: inviteErr } = await supabase
    .from('invitations')
    .select('id')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (invite) {
    return { allowed: true } as const;
  }

  return { allowed: false, reason: 'No invitation found for this email. Please contact your admin.' } as const;
}


