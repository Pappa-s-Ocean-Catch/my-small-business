"use client";

import { useEffect, useState } from 'react';
import { AdminNavigation } from "@/components/AdminNavigation";
import Link from "next/link";
import { FaBars, FaTimes, FaChevronDown, FaHome, FaCalendarAlt, FaDollarSign } from "react-icons/fa";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Debug mount
    console.log('[MobileNav] mounted');
  }, []);

  return (
    <div className="md:hidden">
      <button
        aria-label="Open menu"
        className="p-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900"
        onClick={() => { console.log('[MobileNav] open click'); setOpen(true); }}
      >
        <FaBars className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/40 z-0"
            onClick={() => { console.log('[MobileNav] backdrop click -> close'); setOpen(false); }}
          />
          <div className="absolute top-0 right-0 h-full w-80 max-w-[85%] bg-white dark:bg-neutral-950 border-l p-4 flex flex-col gap-4 shadow-2xl rounded-l-2xl z-10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900" onClick={() => { console.log('[MobileNav] close button'); setOpen(false); }}>
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable content area */}
            <div className="flex-1 bg-white dark:bg-neutral-950 p-2">
            {/* Guard to avoid any hydration mismatch causing empty content */}
            {!mounted ? (
              <div className="text-sm text-gray-500">Loading menu…</div>
            ) : (
            <>
            {/* Quick links */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/" onClick={() => setOpen(false)} className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900 inline-flex items-center gap-2">
                <FaHome className="w-3.5 h-3.5" />
                <span className="text-sm">Dashboard</span>
              </Link>
              <Link href="/calendar" onClick={() => setOpen(false)} className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900 inline-flex items-center gap-2">
                <FaCalendarAlt className="w-3.5 h-3.5" />
                <span className="text-sm">Work shift</span>
              </Link>
              <Link href="/income-expense" onClick={() => setOpen(false)} className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900 inline-flex items-center gap-2">
                <FaDollarSign className="w-3.5 h-3.5" />
                <span className="text-sm">Income/Expense</span>
              </Link>
            </div>

            {/* Collapsible groups */}
            <div className="divide-y divide-gray-200 dark:divide-neutral-800">
              {/* Management */}
              <div className="py-2">
                <button className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900" onClick={() => { const next = !mgmtOpen; console.log('[MobileNav] toggle mgmt', next); setMgmtOpen(next); if (next) { setShopOpen(false); setReportsOpen(false); setSystemOpen(false); } }}>
                  <span className="text-sm font-medium">Management</span>
                  <FaChevronDown className={`w-3 h-3 transition-transform ${mgmtOpen ? 'rotate-180' : ''}`} />
                </button>
                {mgmtOpen && (
                  <div className="mt-1 pl-2 grid gap-1">
                    <Link href="/staff" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Staff</Link>
                    <Link href="/sections" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Sections</Link>
                    <Link href="/shop/menu-screens" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Menu Builder</Link>
                    <Link href="/planner" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">AI Planner</Link>
                    <Link href="/holidays" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Public Holidays</Link>
                  </div>
                )}
              </div>

              {/* Shop */}
              <div className="py-2">
                <button className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900" onClick={() => { const next = !shopOpen; console.log('[MobileNav] toggle shop', next); setShopOpen(next); if (next) { setMgmtOpen(false); setReportsOpen(false); setSystemOpen(false); } }}>
                  <span className="text-sm font-medium">Shop</span>
                  <FaChevronDown className={`w-3 h-3 transition-transform ${shopOpen ? 'rotate-180' : ''}`} />
                </button>
                {shopOpen && (
                  <div className="mt-1 pl-2 grid gap-1">
                    <Link href="/shop" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Shop Overview</Link>
                    <Link href="/shop/products" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Products</Link>
                    <Link href="/shop/categories" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Categories</Link>
                    <Link href="/shop/inventory" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Inventory</Link>
                    <Link href="/shop/suppliers" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Suppliers</Link>
                    <Link href="/shop/menu" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Menu</Link>
                    <Link href="/shop/combo" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Combo</Link>
                  </div>
                )}
              </div>

              {/* Reports */}
              <div className="py-2">
                <button className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900" onClick={() => { const next = !reportsOpen; console.log('[MobileNav] toggle reports', next); setReportsOpen(next); if (next) { setMgmtOpen(false); setShopOpen(false); setSystemOpen(false); } }}>
                  <span className="text-sm font-medium">Analysis & Report</span>
                  <FaChevronDown className={`w-3 h-3 transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
                </button>
                {reportsOpen && (
                  <div className="mt-1 pl-2 grid gap-1">
                    <Link href="/analysis-report" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Analysis & Report</Link>
                    <Link href="/reports" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Weekly shift report</Link>
                    <Link href="/analytics" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Analysis</Link>
                    <Link href="/wages-report" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Wages Report</Link>
                    <Link href="/payment-report" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Payment Report</Link>
                    <Link href="/income-expense" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Income & Expenses</Link>
                  </div>
                )}
              </div>

              {/* System */}
              <div className="py-2">
                <button className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900" onClick={() => { const next = !systemOpen; console.log('[MobileNav] toggle system', next); setSystemOpen(next); if (next) { setMgmtOpen(false); setShopOpen(false); setReportsOpen(false); } }}>
                  <span className="text-sm font-medium">System</span>
                  <FaChevronDown className={`w-3 h-3 transition-transform ${systemOpen ? 'rotate-180' : ''}`} />
                </button>
                {systemOpen && (
                  <div className="mt-1 pl-2 grid gap-1">
                    <Link href="/users" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Users</Link>
                    <Link href="/automation" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Automation</Link>
                    <Link href="/settings" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-neutral-900">Settings</Link>
                  </div>
                )}
              </div>
            </div>

            </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


