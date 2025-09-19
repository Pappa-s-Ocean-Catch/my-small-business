"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AdminNavigation() {
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_slug")
            .eq("id", user.id)
            .single();
          
          setUserRole(profile?.role_slug as 'admin' | 'staff' || null);
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        setUserRole(null);
      }
    };

    void checkUserRole();
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const getLinkClasses = (path: string) => {
    const baseClasses = "flex items-center h-full px-4 transition-colors";
    const activeClasses = "bg-blue-100 dark:bg-blue-900 border-b-2 border-blue-600 text-blue-700 dark:text-blue-300";
    const inactiveClasses = "hover:bg-gray-100 dark:hover:bg-neutral-900";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className="flex items-center h-full">
      {/* Home - visible to all authenticated users */}
      <Link className={getLinkClasses("/")} href="/" aria-label="Home">Home</Link>
      
      {/* Staff Management - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/staff")} href="/staff" aria-label="Staff">Staff</Link>
      )}
      
      {/* Calendar - visible to all authenticated users */}
      <Link className={getLinkClasses("/calendar")} href="/calendar" aria-label="Calendar">Calendar</Link>
      
      {/* Shop Management - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/shop")} href="/shop" aria-label="Shop">Shop</Link>
      )}
      
      {/* Reports - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/reports")} href="/reports" aria-label="Reports">Reports</Link>
      )}
      
      {/* User Management - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/users")} href="/users" aria-label="Users">Users</Link>
      )}
      
      {/* Settings - visible to all authenticated users */}
      <Link className={getLinkClasses("/settings")} href="/settings" aria-label="Settings">Settings</Link>
    </nav>
  );
}
