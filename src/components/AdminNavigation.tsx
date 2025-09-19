"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AdminNavigation({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [isMgmtOpen, setIsMgmtOpen] = useState<boolean>(false);
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
    const baseClasses = orientation === 'vertical'
      ? "block w-full px-4 py-3 transition-colors"
      : "flex items-center h-full px-4 transition-colors";
    const activeClasses = "bg-blue-100 dark:bg-blue-900 border-b-2 border-blue-600 text-blue-700 dark:text-blue-300";
    const inactiveClasses = "hover:bg-gray-100 dark:hover:bg-neutral-900";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className={orientation === 'vertical' ? "flex flex-col items-stretch h-auto bg-white dark:bg-neutral-950 rounded-lg shadow divide-y divide-gray-200 dark:divide-neutral-800" : "flex items-center h-full"}>
      {/* Home - visible to all authenticated users */}
      <Link className={getLinkClasses("/")} href="/" aria-label="Home">Home</Link>
      
      {/* Management group - Admin only */}
      {userRole === 'admin' && (
        orientation === 'vertical' ? (
          <div className="w-full">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Management</div>
            <div className="pl-2">
              <Link className={getLinkClasses("/staff")} href="/staff" aria-label="Staff">Staff</Link>
              <Link className={getLinkClasses("/shop")} href="/shop" aria-label="Shop">Shop</Link>
              <Link className={getLinkClasses("/users")} href="/users" aria-label="Users">Users</Link>
            </div>
          </div>
        ) : (
          <div className="relative h-full">
            <button
              type="button"
              className="flex items-center h-full px-4 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-900"
              onClick={() => setIsMgmtOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isMgmtOpen}
            >
              Management
            </button>
            {isMgmtOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg border bg-white dark:bg-neutral-950 shadow-lg z-50">
                <div className="py-1">
                  <Link className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-900" href="/staff">Staff</Link>
                  <Link className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-900" href="/shop">Shop</Link>
                  <Link className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-900" href="/users">Users</Link>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Calendar - visible to authenticated users only */}
      {userRole !== null && (
        <Link className={getLinkClasses("/calendar")} href="/calendar" aria-label="Calendar">Calendar</Link>
      )}
      
      {/* Analysis & Report - Admin only (group) */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/analysis-report")} href="/analysis-report" aria-label="Analysis & Report">Analysis & Report</Link>
      )}
      
      {/* Automation - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/automation")} href="/automation" aria-label="Automation">Automation</Link>
      )}
      
      {/* Settings - Admin only */}
      {userRole === 'admin' && (
        <Link className={getLinkClasses("/settings")} href="/settings" aria-label="Settings">Settings</Link>
      )}
    </nav>
  );
}
