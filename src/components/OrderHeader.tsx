'use client';

import Link from 'next/link';
import { FaUtensils, FaHome } from 'react-icons/fa';

export function OrderHeader() {
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
          </nav>
        </div>
      </div>
    </header>
  );
}
