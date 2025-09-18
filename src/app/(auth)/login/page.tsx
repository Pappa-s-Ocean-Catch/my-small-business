"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { promoteIfNoAdmin } from "@/app/actions/admin";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await getSupabaseClient().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setMessage("Check your email for a magic link to sign in.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send magic link";
      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const becomeAdmin = async () => {
    try {
      setLoading(true);
      const { data } = await getSupabaseClient().auth.getUser();
      const user = data.user;
      if (!user) { setMessage("Sign in first."); return; }
      const res = await promoteIfNoAdmin(user.id, user.email ?? undefined);
      setMessage(res.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white/60 dark:bg-black/20 backdrop-blur p-6 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in with a magic link</p>
        <form onSubmit={handleSignIn} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-gray-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="h-11 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 outline-none focus:ring-2 ring-black/10 dark:ring-white/20"
            />
          </label>
          <button disabled={loading} className="h-11 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center gap-2 hover:opacity-90 transition">
            {loading && <Loader2 className="size-4 animate-spin" />} Send magic link
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
        <button onClick={becomeAdmin} className="mt-3 text-xs underline">Become admin (if none exists)</button>
        <div className="mt-6 text-xs text-gray-500">
          <Link href="/">Back to home</Link>
        </div>
      </div>
    </div>
  );
}


