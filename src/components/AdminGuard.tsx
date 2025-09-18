"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      const supa = getSupabaseClient();
      const { data: userRes } = await supa.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) { setAllowed(false); return; }
      const { data: prof } = await supa.from("profiles").select("role_slug").eq("id", userId).maybeSingle();
      setAllowed(prof?.role_slug === "admin");
    };
    void run();
  }, []);

  if (allowed === null) {
    return <div className="p-6 text-sm text-gray-500">Checking permissions…</div>;
  }
  if (!allowed) {
    return <div className="p-6">You don&apos;t have access to this page.</div>;
  }
  return <>{children}</>;
}


