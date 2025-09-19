"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ensureProfile } from "@/app/actions/profile";
import { Loading } from "@/components/Loading";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supa = getSupabaseClient();
        const { data: userRes, error: userErr } = await supa.auth.getUser();
        if (userErr) {
          console.error("[AdminGuard] getUser error", userErr);
        }
        const userId = userRes.user?.id;
        console.debug("[AdminGuard] user", { userId, email: userRes.user?.email });
        if (!userId) { setAllowed(false); return; }
        // Ensure a profile row exists for this user
        const ensured = await ensureProfile(userId, userRes.user?.email ?? undefined);
        console.debug("[AdminGuard] ensureProfile result", ensured);
        const { data: prof, error } = await supa
          .from("profiles")
          .select("role_slug")
          .eq("id", userId)
          .maybeSingle();
        if (error) {
          console.error("[AdminGuard] profiles select error", error);
          setAllowed(false);
          return;
        }
        console.debug("[AdminGuard] profile row", prof);
        setAllowed(prof?.role_slug === "admin");
      } catch {
        console.error("[AdminGuard] unexpected error");
        setAllowed(false);
      }
    };
    void run();
  }, []);

  if (allowed === null) {
    return <Loading message="Checking permissions..." size="sm" />;
  }
  if (!allowed) {
    return (
      <div className="p-6">
        <div className="rounded-xl border p-6 max-w-md bg-white/60 dark:bg-black/20">
          <div className="font-medium">Access restricted</div>
          <p className="text-sm text-gray-600 mt-1">Sign in as an admin to view this page.</p>
          <div className="mt-3"><Link href="/login" className="text-sm underline">Go to login</Link></div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}


