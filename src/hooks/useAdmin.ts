"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Ensure profile exists
        const ensureResult = await ensureProfile(user.id, user.email);
        if (!ensureResult.ok) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Check if user is admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.role_slug === "admin");
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  return { isAdmin, loading };
}
