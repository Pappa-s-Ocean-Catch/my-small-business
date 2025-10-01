"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export async function ensureProfile(userId: string, email?: string) {
  const supa = await createServiceRoleClient();
  // If profile exists, do nothing (preserve current role)
  const { data: existing, error: readErr } = await supa
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (existing) return { ok: true };

  // Create profile with default 'staff' role - no automatic admin promotion
  const { error: insErr } = await supa
    .from("profiles")
    .insert({ id: userId, email: email ?? null, role_slug: 'staff' });
  if (insErr) return { ok: false, message: insErr.message };
  return { ok: true };
}


