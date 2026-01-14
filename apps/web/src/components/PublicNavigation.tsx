"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import Link from "next/link";
import { FaUtensils } from "react-icons/fa";
import {Icon} from "@/components/Icon";


export function PublicNavigation() {
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

  // Only show public navigation if user is not authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <nav className="hidden md:flex items-center gap-4">
      <Link
        href="/menu"
        className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <Icon icon={FaUtensils} className="w-4 h-4" />
        Menu
      </Link>
    </nav>
  );
}
