"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export async function canSendMagicLink(email: string) {
  console.log('🔍 Checking magic link permission for:', email);
  
  const supabase = await createServiceRoleClient();

  // 1) Check if user exists in auth.users (this covers legacy accounts)
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (!authError && users) {
    const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log('✅ Found existing user in auth.users:', { id: existingUser.id, email: existingUser.email });
      // Ensure profile exists for this user without overwriting existing role
      // Use insert with onConflict 'id' and ignore updates so existing rows keep their role_slug
      await supabase
        .from('profiles')
        .upsert({ id: existingUser.id, email: existingUser.email }, { onConflict: 'id', ignoreDuplicates: true });
      console.log('✅ Profile ensured for legacy user (no role overwrite)');
      return { allowed: true } as const;
    }
  } else {
    console.log('⚠️ Auth users check failed:', authError);
  }

  // 2) Check existing user in profiles table
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    console.log('✅ Found existing profile:', existingProfile);
    return { allowed: true } as const;
  }

  // 3) Check for pending invitation
  const { data: invite, error: inviteErr } = await supabase
    .from('invitations')
    .select('id')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (invite) {
    console.log('✅ Found pending invitation:', invite);
    return { allowed: true } as const;
  }

  console.log('❌ No permission found for email:', email);
  return { allowed: false, reason: 'No invitation found for this email. Please contact your admin.' } as const;
}


