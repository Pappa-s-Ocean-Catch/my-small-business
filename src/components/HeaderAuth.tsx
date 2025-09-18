"use client";

import { useEffect, useState, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FaUser, FaSignOutAlt, FaBell } from "react-icons/fa";

export function HeaderAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supa = getSupabaseClient();
    void supa.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supa.auth.onAuthStateChange(
      () =>  {
        setTimeout(async() => {
          const { data } = await supa.auth.getUser();
          setEmail(data.user?.email ?? null);
      }, 0)});
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getUserInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleLogout = async () => {
    await getSupabaseClient().auth.signOut();
    window.location.href = "/";
  };

  if (!email) {
    return <Link className="rounded-lg border px-3 py-1" href="/login" aria-label="Login">Login</Link>;
  }

  const initials = getUserInitials(email);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        aria-label="User menu"
      >
        {initials}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={email}>{email}</p>
          </div>
          
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
            onClick={() => setIsDropdownOpen(false)}
          >
            <FaUser className="w-4 h-4" />
            Profile
          </Link>
          
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
            onClick={() => setIsDropdownOpen(false)}
          >
            <FaBell className="w-4 h-4" />
            Notifications
            <span className="ml-auto text-xs text-gray-500">Soon</span>
          </button>
          
          <div className="border-t border-gray-200 dark:border-neutral-700 my-1"></div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <FaSignOutAlt className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}


