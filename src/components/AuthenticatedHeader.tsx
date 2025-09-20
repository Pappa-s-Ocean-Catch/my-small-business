"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminNavigation } from "@/components/AdminNavigation";
import { HeaderAuth } from "@/components/HeaderAuth";
import { MobileNav } from "@/components/MobileNav";

export function AuthenticatedHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    // Listen for auth changes
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return null;
  }

  // Only show navigation if user is authenticated
  if (!isAuthenticated) {
    return <HeaderAuth />;
  }

  return (
    <>
      <nav className="hidden md:flex items-center h-16 text-sm">
        <AdminNavigation />
      </nav>
      <HeaderAuth />
      <MobileNav />
    </>
  );
}
