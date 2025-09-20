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
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-lg bg-white dark:bg-neutral-900 p-8 shadow-lg">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Restricted</div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Sign in as an admin to view this page.</p>
            <Link 
              href="/login" 
              className="inline-flex items-center px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}


