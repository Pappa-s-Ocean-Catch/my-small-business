"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth(redirectTo: string = '/login') {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);

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
      () =>  {
        setTimeout(async() => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setIsAuthenticated(true);
            setUser(user);
          } else {
            setIsAuthenticated(false);
            setUser(null);
            router.push(redirectTo);
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, redirectTo]);

  return { isAuthenticated, user, loading: isAuthenticated === null };
}
