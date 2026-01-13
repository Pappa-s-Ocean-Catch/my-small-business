'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaUtensils, FaHome, FaUser, FaSignOutAlt, FaHistory, FaLock, FaGift } from 'react-icons/fa';
import { getSupabaseClient } from '@my-small-business/supabase/client';

export function OrderHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
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
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setEmail(null);
    setIsDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="bg-white dark:bg-neutral-800 shadow-sm sticky top-0 z-30 border-b border-gray-200 dark:border-neutral-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Site Name */}
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-gradient-to-tr from-rose-500/40 to-orange-500/40 rounded-xl" />
              <div className="relative grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 to-orange-500 text-white">
                <FaUtensils className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                Pappa&apos;s Ocean Catch
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Fresh Fish & Chips
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <FaHome className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link
              href="/menu"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <FaUtensils className="w-4 h-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>

            {/* User Menu */}
            {email ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                  aria-label="User menu"
                >
                  {getUserInitials(email)}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={email}>
                        {email}
                      </p>
                    </div>
                    
                    <Link
                      href="/order/history"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FaHistory className="w-4 h-4" />
                      Order History
                    </Link>
                    
                    <Link
                      href="/rewards"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FaGift className="w-4 h-4" />
                      Reward Points
                    </Link>
                    
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FaUser className="w-4 h-4" />
                      Profile
                    </Link>
                    
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FaLock className="w-4 h-4" />
                      Change Password
                    </Link>
                    
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
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors border border-gray-300 dark:border-neutral-600"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
