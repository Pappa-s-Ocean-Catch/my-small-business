"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

type InviteCreateInput = {
  email: string;
  role_slug: 'admin' | 'staff';
  createdBy: string; // profiles.id of admin
};

export async function createInvitation({ email, role_slug, createdBy }: InviteCreateInput) {
  const supabase = await createServiceRoleClient();
  const { data: adminProfile, error: adminErr } = await supabase
    .from('profiles')
    .select('id, role_slug')
    .eq('id', createdBy)
    .single();

  if (adminErr || !adminProfile || adminProfile.role_slug !== 'admin') {
    return { success: false, error: 'Admin access required' } as const;
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({ email, role_slug, created_by: createdBy })
    .select('id, email, role_slug, token, status')
    .single();

  if (error) return { success: false, error: error.message } as const;
  return { success: true, data } as const;
}

export async function acceptInvitationByEmail(email: string, profileId: string) {
  const supabase = await createServiceRoleClient();
  // verify pending invitation exists for this email
  const { data: invite } = await supabase
    .from('invitations')
    .select('id, role_slug, status')
    .eq('email', email)
    .eq('status', 'pending')
    .single();

  if (!invite) {
    return { success: false, error: 'No invitation found for this email' } as const;
  }

  // set profile role
  const { error: roleErr } = await supabase
    .from('profiles')
    .update({ role_slug: invite.role_slug })
    .eq('id', profileId);
  if (roleErr) return { success: false, error: roleErr.message } as const;

  // mark invitation accepted
  await supabase
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  // link staff by email
  await supabase.rpc('link_staff_profile', { p_profile_id: profileId });

  return { success: true } as const;
}


