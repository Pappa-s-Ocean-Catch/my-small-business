"use client";

import { useState } from 'react';
import { AdminNavigation } from "@/components/AdminNavigation";
import { HeaderAuth } from "@/components/HeaderAuth";
import { FaBars, FaTimes } from "react-icons/fa";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-label="Open menu"
        className="p-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900"
        onClick={() => setOpen(true)}
      >
        <FaBars className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-80 max-w-[80%] bg-white/95 dark:bg-neutral-950/95 border-l p-4 flex flex-col gap-4 shadow-2xl rounded-l-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900" onClick={() => setOpen(false)}>
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex flex-col divide-y divide-gray-200 dark:divide-neutral-800">
              <div className="py-2">
                <AdminNavigation orientation="vertical" />
              </div>
              <div className="py-2">
                <HeaderAuth />
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}


