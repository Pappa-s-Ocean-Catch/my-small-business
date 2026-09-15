"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { FaShieldAlt } from "react-icons/fa";
import { LoadingSpinner } from "./Loading";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .single();
        
        if (profile?.role_slug === "admin" || profile?.role_slug === "staff") {
          setIsBlocked(true);
        }
      }
    };
    checkRole();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-neutral-950 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 text-center border border-gray-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100 dark:border-red-500/20">
            <Icon icon={FaShieldAlt} className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 font-serif">Restricted Area</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Admin and staff accounts cannot browse the public web portal. Please sign out or use a customer account to place orders.
          </p>
          <button 
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full h-14 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
          >
            {isSigningOut ? <LoadingSpinner size="sm" className="text-white" /> : null}
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
