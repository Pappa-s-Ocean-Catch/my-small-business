"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

export function HeaderAuth() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supa = getSupabaseClient();
    void supa.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supa.auth.onAuthStateChange(
      () =>  {
        setTimeout(async() => {
          const { data } = await supa.auth.getUser();
          setEmail(data.user?.email ?? null);
      }, 0)});
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  if (!email) {
    return <Link className="rounded-lg border px-3 py-1" href="/login" aria-label="Login">Login</Link>;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600 hidden sm:inline">{email}</span>
      <button
        className="rounded-lg border px-3 py-1"
        onClick={async () => { await getSupabaseClient().auth.signOut(); window.location.href = "/"; }}
      >Logout</button>
    </div>
  );
}


