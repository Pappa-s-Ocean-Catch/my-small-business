"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/Loading";
import { canSendMagicLink } from "@/app/actions/auth";
import { sendMagicLinkInvite } from "@/app/actions/email";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Only allow if email exists in profiles OR has a pending invitation
      const supabase = getSupabaseClient();
      const check = await canSendMagicLink(email);
      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Generate a magic link server-side and send via Resend (custom template)
      const result = await sendMagicLinkInvite(email);
      if (!result.success) throw new Error(result.error || 'Failed to send magic link');
      setMessage("Magic link sent from OperateFlow. Please check your inbox.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send magic link";
      setMessage(message);
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
            {loading && <LoadingSpinner size="sm" />} Send magic link
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
        <div className="mt-6 text-xs text-gray-500">
          <Link href="/">Back to home</Link>
        </div>
      </div>
    </div>
  );
}


