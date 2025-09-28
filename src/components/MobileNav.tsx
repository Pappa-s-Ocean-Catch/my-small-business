"use client";

import { useEffect, useState } from 'react';
import Link from "next/link";
import { 
  FaBars, 
  FaTimes, 
  FaChevronDown, 
  FaHome, 
  FaCalendarAlt, 
  FaDollarSign,
  FaUsers,
  FaCog,
  FaStore,
  FaChartLine,
  FaFileAlt,
  FaUtensils,
  FaBox,
  FaTags,
  FaWarehouse,
  FaShoppingBag,
  FaMoneyBillWave,
  FaChartPie,
  FaExclamationTriangle
} from "react-icons/fa";

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

  return (
    <div className="md:hidden">
      {/* Menu Trigger Button */}
      <button
        aria-label="Open menu"
        className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
        onClick={() => setOpen(true)}
      >
        <FaBars className="w-5 h-5" />
      </button>

      {/* Mobile Menu Overlay */}
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMenu}
          />
          
          {/* Menu Panel - Slides in from left */}
          <div className="absolute top-0 left-0 h-full w-[90vw] bg-neutral-900/95 backdrop-blur-md shadow-2xl transform transition-transform duration-300 ease-out">
            <div className="h-full flex flex-col bg-neutral-900">
              {/* Header */}
              <div className="bg-blue-600 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <FaStore className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-semibold text-lg">Business Hub</span>
                </div>
                <button 
                  aria-label="Close menu" 
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  onClick={closeMenu}
                >
                  <FaTimes className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="p-3 bg-neutral-800">
                <h3 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-4 gap-2 bg-neutral-800/30">
                  <Link 
                    href="/" 
                    onClick={closeMenu} 
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-1"
                  >
                    <FaHome className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-white">Dashboard</span>
                  </Link>
                  <Link 
                    href="/calendar" 
                    onClick={closeMenu} 
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-1"
                  >
                    <FaCalendarAlt className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-medium text-white">Work Shift</span>
                  </Link>
                  <Link 
                    href="/income-expense" 
                    onClick={closeMenu} 
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-1"
                  >
                    <FaDollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-medium text-white">Income</span>
                  </Link>
                  <Link 
                    href="/cash-flow" 
                    onClick={closeMenu} 
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-1"
                  >
                    <FaChartLine className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-white">Cash Flow</span>
                  </Link>
                </div>
              </div>

              {/* Main Menu Sections */}
              <div className="flex-1 px-4 py-2 bg-neutral-800">
                {!mounted ? (
                  <div className="text-sm text-gray-400 text-center py-8">Loading menu...</div>
                ) : (
                  <div className="space-y-2 bg-neutral-800">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 bg-neutral-800 px-2 py-1 rounded">Main Menu</div>
                    {/* Management Section */}
                    <div className="border-b border-neutral-700 pb-2 bg-neutral-800">
                      <button 
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setMgmtOpen(!mgmtOpen);
                          if (!mgmtOpen) {
                            setShopOpen(false);
                            setReportsOpen(false);
                            setSystemOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FaUsers className="w-5 h-5 text-blue-400" />
                          <span className="font-semibold text-white">Management</span>
                        </div>
                        <FaChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${mgmtOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {mgmtOpen && (
                        <div className="ml-8 mt-2 space-y-1">
                          <Link href="/staff" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaUsers className="w-4 h-4 mr-2 text-blue-400" />
                            Staff
                          </Link>
                          <Link href="/sections" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaCog className="w-4 h-4 mr-2 text-gray-400" />
                            Sections
                          </Link>
                          <Link href="/shop/menu-screens" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaUtensils className="w-4 h-4 mr-2 text-orange-400" />
                            Menu Builder
                          </Link>
                          <Link href="/planner" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaChartLine className="w-4 h-4 mr-2 text-purple-400" />
                            AI Planner
                          </Link>
                          <Link href="/holidays" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaCalendarAlt className="w-4 h-4 mr-2 text-green-400" />
                            Public Holidays
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Shop Section */}
                    <div className="border-b border-neutral-700 pb-2 bg-neutral-800">
                      <button 
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setShopOpen(!shopOpen);
                          if (!shopOpen) {
                            setMgmtOpen(false);
                            setReportsOpen(false);
                            setSystemOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FaStore className="w-5 h-5 text-green-400" />
                          <span className="font-semibold text-white">Shop</span>
                        </div>
                        <FaChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${shopOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {shopOpen && (
                        <div className="ml-8 mt-2 space-y-1">
                          <Link href="/shop" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaStore className="w-4 h-4 mr-2 text-green-400" />
                            Shop Overview
                          </Link>
                          <Link href="/shop/products" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaBox className="w-4 h-4 mr-2 text-blue-400" />
                            Products
                          </Link>
                          <Link href="/shop/categories" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaTags className="w-4 h-4 mr-2 text-purple-400" />
                            Categories
                          </Link>
                          <Link href="/shop/inventory" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaWarehouse className="w-4 h-4 mr-2 text-orange-400" />
                            Inventory
                          </Link>
                          <Link href="/shop/suppliers" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaShoppingBag className="w-4 h-4 mr-2 text-yellow-400" />
                            Suppliers
                          </Link>
                          <Link href="/shop/menu" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaUtensils className="w-4 h-4 mr-2 text-red-400" />
                            Menu
                          </Link>
                          <Link href="/shop/combo" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaUtensils className="w-4 h-4 mr-2 text-emerald-400" />
                            Combo
                          </Link>
                          <Link href="/income-expense" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaDollarSign className="w-4 h-4 mr-2 text-yellow-400" />
                            Income & Expenses
                          </Link>
                          <Link href="/cash-flow" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaChartLine className="w-4 h-4 mr-2 text-purple-400" />
                            Cash Flow Analysis
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Analysis & Reports Section */}
                    <div className="border-b border-neutral-700 pb-2 bg-neutral-800">
                      <button 
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setReportsOpen(!reportsOpen);
                          if (!reportsOpen) {
                            setMgmtOpen(false);
                            setShopOpen(false);
                            setSystemOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FaChartPie className="w-5 h-5 text-purple-400" />
                          <span className="font-semibold text-white">Analysis & Reports</span>
                        </div>
                        <FaChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {reportsOpen && (
                        <div className="ml-8 mt-2 space-y-1">
                          <Link href="/analysis-report" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaChartPie className="w-4 h-4 mr-2 text-purple-400" />
                            Analysis & Report
                          </Link>
                          <Link href="/reports/shift-reports" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaFileAlt className="w-4 h-4 mr-2 text-blue-400" />
                            Weekly Shift Report
                          </Link>
                          <Link href="/analytics" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaChartLine className="w-4 h-4 mr-2 text-green-400" />
                            Analytics
                          </Link>
                          <Link href="/wages-report" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaMoneyBillWave className="w-4 h-4 mr-2 text-yellow-400" />
                            Wages Report
                          </Link>
                          <Link href="/payment-report" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaMoneyBillWave className="w-4 h-4 mr-2 text-green-400" />
                            Payment Report
                          </Link>
                          <Link href="/paid-payments" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaMoneyBillWave className="w-4 h-4 mr-2 text-blue-400" />
                            Paid Payments
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* System Section */}
                    <div className="pb-2 bg-neutral-800">
                      <button 
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setSystemOpen(!systemOpen);
                          if (!systemOpen) {
                            setMgmtOpen(false);
                            setShopOpen(false);
                            setReportsOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FaCog className="w-5 h-5 text-gray-400" />
                          <span className="font-semibold text-white">System</span>
                        </div>
                        <FaChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${systemOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {systemOpen && (
                        <div className="ml-8 mt-2 space-y-1">
                          <Link href="/users" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaUsers className="w-4 h-4 mr-2 text-blue-400" />
                            Users
                          </Link>
                          <Link href="/automation" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaCog className="w-4 h-4 mr-2 text-orange-400" />
                            Automation
                          </Link>
                          <Link href="/settings" onClick={closeMenu} className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <FaCog className="w-4 h-4 mr-2 text-gray-400" />
                            Settings
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Status/Issues */}
              <div className="border-t border-neutral-700 p-4 bg-neutral-800/50">
                <div className="flex items-center gap-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <FaExclamationTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">1 Issue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


