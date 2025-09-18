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

  // If no admin exists yet, make this user admin (mirrors DB trigger for legacy accounts)
  const { data: admins, error: adminErr } = await supa
    .from("profiles")
    .select("id")
    .eq("role_slug", "admin")
    .limit(1);
  if (adminErr) return { ok: false, message: adminErr.message };
  const role = admins && admins.length > 0 ? "staff" : "admin";

  const { error: insErr } = await supa
    .from("profiles")
    .insert({ id: userId, email: email ?? null, role_slug: role });
  if (insErr) return { ok: false, message: insErr.message };
  return { ok: true };
}


