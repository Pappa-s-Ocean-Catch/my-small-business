"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export function useAuth(redirectTo: string = '/login') {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        setIsAuthenticated(true);
        setUser(authUser);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        router.push(redirectTo);
      }
    };

    checkAuth();

    // Listen for auth changes
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUser(session.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        router.push(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, redirectTo]);

  return { isAuthenticated, user, loading: isAuthenticated === null };
}
