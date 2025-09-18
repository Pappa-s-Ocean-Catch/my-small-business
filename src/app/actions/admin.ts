"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

export async function promoteIfNoAdmin(userId: string, email?: string) {
  const supa = await createServiceRoleClient();

  const { data: admins, error: adminsErr } = await supa
    .from("profiles")
    .select("id")
    .eq("role_slug", "admin")
    .limit(1);
  if (adminsErr) return { ok: false, message: adminsErr.message };
  if (admins && admins.length > 0) return { ok: false, message: "An admin already exists." };

  // Ensure profile exists
  const { error: upsertErr } = await supa.from("profiles").upsert({ id: userId, email: email ?? null, role_slug: "admin" });
  if (upsertErr) return { ok: false, message: upsertErr.message };
  return { ok: true, message: "You are now the admin." };
}


