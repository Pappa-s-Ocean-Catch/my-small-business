"use server";

import { createServiceRoleClient } from "@my-small-business/supabase/server";

export async function ensureProfile(userId: string, email?: string) {
  const supa = await createServiceRoleClient();
  // If profile exists, do nothing (preserve current role)
  const { data: existing, error: readErr } = await supa
    .from("profiles")
    .select("id, role_slug")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (existing) return { ok: true };

  // Determine role to assign - check invitations first, then check if first user
  let roleToAssign: string = 'customer';
  
  if (email) {
    // Check if there's a pending invitation for this email
    const { data: invitation } = await supa
      .from("invitations")
      .select("role_slug")
      .ilike("email", email)
      .eq("status", "pending")
      .maybeSingle();
    
    if (invitation) {
      roleToAssign = invitation.role_slug;
    } else {
      // Check if any admins exist - if not, make this user admin (first user)
      const { data: admins } = await supa
        .from("profiles")
        .select("id")
        .eq("role_slug", "admin")
        .limit(1);
      
      if (!admins || admins.length === 0) {
        roleToAssign = 'admin';
      } else {
        // Default to 'customer' for new signups without invitation
        roleToAssign = 'customer';
      }
    }
  } else {
    // No email provided - check if any admins exist
    const { data: admins } = await supa
      .from("profiles")
      .select("id")
      .eq("role_slug", "admin")
      .limit(1);
    
    if (!admins || admins.length === 0) {
      roleToAssign = 'admin';
    } else {
      roleToAssign = 'customer';
    }
  }

  // Create profile with determined role
  const { error: insErr } = await supa
    .from("profiles")
    .insert({ id: userId, email: email ?? null, role_slug: roleToAssign });
  if (insErr) return { ok: false, message: insErr.message };
  return { ok: true };
}


