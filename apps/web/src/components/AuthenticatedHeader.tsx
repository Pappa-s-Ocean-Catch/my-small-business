"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { AdminNavigation } from "@/components/AdminNavigation";
import { HeaderAuth } from "@/components/HeaderAuth";
import { MobileNav } from "@/components/MobileNav";

export function AuthenticatedHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "staff" | "customer" | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthenticated(false);
        setUserRole(null);
        return;
      }

      setIsAuthenticated(true);

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .single();
        if (profile?.role_slug === "admin" || profile?.role_slug === "staff") {
          setUserRole(profile.role_slug);
        } else {
          setUserRole("customer");
        }
      } catch (err) {
        console.error("[Header] Failed to load user role:", err);
        setUserRole(null);
      }
    };

    checkAuth();

    // Listen for auth changes
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const hasUser = !!session?.user;
      setIsAuthenticated(hasUser);

      if (hasUser && session?.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_slug")
            .eq("id", session.user.id)
            .single();
          if (profile?.role_slug === "admin" || profile?.role_slug === "staff") {
            setUserRole(profile.role_slug);
          } else {
            setUserRole("customer");
          }
        } catch (err) {
          console.error("[Header] Failed to refresh user role:", err);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
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
      {userRole === "admin" || userRole === "staff" ? (
        <nav className="hidden md:flex items-center h-16 text-sm">
          <AdminNavigation />
        </nav>
      ) : null}
      <HeaderAuth />
      {userRole === "admin" || userRole === "staff" ? <MobileNav /> : null}
    </>
  );
}
