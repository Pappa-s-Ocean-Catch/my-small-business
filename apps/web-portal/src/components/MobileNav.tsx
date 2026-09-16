"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from "next/link";
import {
  FaBars, FaTimes, FaChevronDown, FaHome, FaCalendarAlt,
  FaDollarSign, FaUsers, FaCog, FaStore, FaChartLine, FaFileAlt,
  FaUtensils, FaBox, FaTags, FaTag, FaWarehouse, FaShoppingBag,
  FaMoneyBillWave, FaChartPie, FaExclamationTriangle, FaBullhorn, FaGlobe, FaTicketAlt
} from "react-icons/fa";
import { Icon } from "@/components/Icon";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = () => setOpen(false);

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Menu Trigger Button */}
      <button
        aria-label="Open menu"
        className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm active:scale-95 transition-transform"
        onClick={() => setOpen(true)}
      >
        <Icon icon={FaBars} className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
      </button>

      {/* Full Screen Menu Overlay via Portal */}
      {mounted && createPortal(
        <div 
          className={`fixed inset-0 z-[100] bg-neutral-950 transition-all duration-300 ease-in-out flex flex-col ${
          open ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-6 py-5 bg-neutral-900 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Icon icon={FaStore} className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold tracking-tight text-xl">Admin Hub</span>
          </div>
          <button
            aria-label="Close menu"
            className="p-3 -mr-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-95 transition-all"
            onClick={closeMenu}
          >
            <Icon icon={FaTimes} className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-20">
          
          {/* Quick Actions Grid */}
          <div className="p-6">
            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Quick Access</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/" onClick={closeMenu} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400"><Icon icon={FaHome} className="w-5 h-5" /></div>
                <span className="text-sm font-semibold text-neutral-200">Dashboard</span>
              </Link>
              <Link href="/calendar" onClick={closeMenu} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2">
                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400"><Icon icon={FaCalendarAlt} className="w-5 h-5" /></div>
                <span className="text-sm font-semibold text-neutral-200">Work Shift</span>
              </Link>
              <Link href="/income-expense" onClick={closeMenu} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2">
                <div className="p-3 bg-yellow-500/10 rounded-full text-yellow-400"><Icon icon={FaDollarSign} className="w-5 h-5" /></div>
                <span className="text-sm font-semibold text-neutral-200">Income</span>
              </Link>
              <Link href="/orders" onClick={closeMenu} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2">
                <div className="p-3 bg-purple-500/10 rounded-full text-purple-400"><Icon icon={FaShoppingBag} className="w-5 h-5" /></div>
                <span className="text-sm font-semibold text-neutral-200">Orders</span>
              </Link>
            </div>
          </div>

          <div className="w-full h-[1px] bg-neutral-800/50"></div>

          {/* Navigation Accordions */}
          <div className="px-4 py-6 space-y-3">
            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-4 px-2">All Modules</h3>
            
            {/* Management Section */}
            <div className="rounded-2xl overflow-hidden border border-neutral-800/50 bg-neutral-900/50 transition-all">
              <button
                className="w-full flex items-center justify-between p-4 active:bg-neutral-800 transition-colors"
                onClick={() => setMgmtOpen(!mgmtOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Icon icon={FaUsers} className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-neutral-200 text-lg">Management</span>
                </div>
                <Icon icon={FaChevronDown} className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${mgmtOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid transition-all duration-300 ease-in-out ${mgmtOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    <Link href="/staff" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaUsers} className="w-4 h-4 text-blue-400" /> <span className="font-medium">Staff</span>
                    </Link>
                    <Link href="/sections" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaCog} className="w-4 h-4 text-neutral-400" /> <span className="font-medium">Sections</span>
                    </Link>
                    <Link href="/shop/menu-screens" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaUtensils} className="w-4 h-4 text-orange-400" /> <span className="font-medium">Menu Builder</span>
                    </Link>
                    <Link href="/planner" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaChartLine} className="w-4 h-4 text-purple-400" /> <span className="font-medium">AI Planner</span>
                    </Link>
                    <Link href="/holidays" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaCalendarAlt} className="w-4 h-4 text-emerald-400" /> <span className="font-medium">Public Holidays</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Shop Section */}
            <div className="rounded-2xl overflow-hidden border border-neutral-800/50 bg-neutral-900/50 transition-all">
              <button
                className="w-full flex items-center justify-between p-4 active:bg-neutral-800 transition-colors"
                onClick={() => setShopOpen(!shopOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Icon icon={FaStore} className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-neutral-200 text-lg">Shop</span>
                </div>
                <Icon icon={FaChevronDown} className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${shopOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid transition-all duration-300 ease-in-out ${shopOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    <Link href="/shop" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaStore} className="w-4 h-4 text-emerald-400" /> <span className="font-medium">Shop Overview</span>
                    </Link>
                    <Link href="/orders" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaShoppingBag} className="w-4 h-4 text-blue-400" /> <span className="font-medium">Orders</span>
                    </Link>
                    <Link href="/announcements" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaBullhorn} className="w-4 h-4 text-purple-400" /> <span className="font-medium">Announcements</span>
                    </Link>
                    <Link href="/shop/products" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaBox} className="w-4 h-4 text-blue-400" /> <span className="font-medium">Products</span>
                    </Link>
                    <Link href="/shop/categories" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaTags} className="w-4 h-4 text-purple-400" /> <span className="font-medium">Categories</span>
                    </Link>
                    <Link href="/shop/inventory" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaWarehouse} className="w-4 h-4 text-orange-400" /> <span className="font-medium">Inventory</span>
                    </Link>
                    <Link href="/shop/suppliers" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaShoppingBag} className="w-4 h-4 text-yellow-400" /> <span className="font-medium">Suppliers</span>
                    </Link>
                    <Link href="/shop/menu" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaUtensils} className="w-4 h-4 text-red-400" /> <span className="font-medium">Menu</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Section */}
            <div className="rounded-2xl overflow-hidden border border-neutral-800/50 bg-neutral-900/50 transition-all">
              <button
                className="w-full flex items-center justify-between p-4 active:bg-neutral-800 transition-colors"
                onClick={() => setReportsOpen(!reportsOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Icon icon={FaChartPie} className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-neutral-200 text-lg">Analysis & Reports</span>
                </div>
                <Icon icon={FaChevronDown} className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${reportsOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid transition-all duration-300 ease-in-out ${reportsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    <Link href="/analysis-report" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaChartPie} className="w-4 h-4 text-purple-400" /> <span className="font-medium">Analysis & Report</span>
                    </Link>
                    <Link href="/reports/shift-reports" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaFileAlt} className="w-4 h-4 text-blue-400" /> <span className="font-medium">Weekly Shift Report</span>
                    </Link>
                    <Link href="/analytics" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaChartLine} className="w-4 h-4 text-emerald-400" /> <span className="font-medium">Analytics</span>
                    </Link>
                    <Link href="/payment-report" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaMoneyBillWave} className="w-4 h-4 text-emerald-400" /> <span className="font-medium">Payment Report</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* System Section */}
            <div className="rounded-2xl overflow-hidden border border-neutral-800/50 bg-neutral-900/50 transition-all">
              <button
                className="w-full flex items-center justify-between p-4 active:bg-neutral-800 transition-colors"
                onClick={() => setSystemOpen(!systemOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-700 flex items-center justify-center text-neutral-300">
                    <Icon icon={FaCog} className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-neutral-200 text-lg">System</span>
                </div>
                <Icon icon={FaChevronDown} className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${systemOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid transition-all duration-300 ease-in-out ${systemOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    <Link href="/users" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaUsers} className="w-4 h-4 text-blue-400" /> <span className="font-medium">Users</span>
                    </Link>
                    <Link href="/automation" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaCog} className="w-4 h-4 text-orange-400" /> <span className="font-medium">Automation</span>
                    </Link>
                    <Link href="/webhooks" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaGlobe} className="w-4 h-4 text-emerald-400" /> <span className="font-medium">Webhooks</span>
                    </Link>
                    <Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-300">
                      <Icon icon={FaCog} className="w-4 h-4 text-neutral-400" /> <span className="font-medium">Settings</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
          
        </div>
      </div>,
      document.body
      )}
    </div>
  );
}
