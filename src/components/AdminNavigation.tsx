"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { FaUsers, FaStore, FaUserShield, FaChartPie, FaFileAlt, FaMoneyBillWave, FaPalette, FaCog, FaRobot, FaBox, FaTags, FaWarehouse, FaUtensils, FaCalendarAlt, FaDollarSign, FaChartLine, FaGlobe, FaShoppingCart, FaGoogle } from "react-icons/fa";

export function AdminNavigation({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [isMgmtOpen, setIsMgmtOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isSystemOpen, setIsSystemOpen] = useState<boolean>(false);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [mgmtOffset, setMgmtOffset] = useState<number>(0);
  const [reportOffset, setReportOffset] = useState<number>(0);
  const [systemOffset, setSystemOffset] = useState<number>(0);
  const [shopOffset, setShopOffset] = useState<number>(0);
  const mgmtRef = useRef<HTMLDivElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const systemRef = useRef<HTMLDivElement | null>(null);
  const shopRef = useRef<HTMLDivElement | null>(null);
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

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (isMgmtOpen && mgmtRef.current && !mgmtRef.current.contains(target)) {
        setIsMgmtOpen(false);
      }
      if (isReportOpen && reportRef.current && !reportRef.current.contains(target)) {
        setIsReportOpen(false);
      }
      if (isSystemOpen && systemRef.current && !systemRef.current.contains(target)) {
        setIsSystemOpen(false);
      }
      if (isShopOpen && shopRef.current && !shopRef.current.contains(target)) {
        setIsShopOpen(false);
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMgmtOpen, isReportOpen, isSystemOpen, isShopOpen]);

  // Smart positioning for mega menus - center when possible, fallback to right alignment
  useEffect(() => {
    function computeSmartOffsets() {
      const megaMenuWidth = 640; // Standard mega menu width
      const shopMenuWidth = 800; // Shop menu is wider
      const margin = 16; // Safety margin
      
      if (isMgmtOpen && mgmtRef.current) {
        const rect = mgmtRef.current.getBoundingClientRect();
        const menuCenter = rect.left + rect.width / 2;
        const idealLeft = menuCenter - megaMenuWidth / 2;
        
        // Check if we have enough space on both sides for centering
        if (idealLeft >= margin && idealLeft + megaMenuWidth <= window.innerWidth - margin) {
          setMgmtOffset(idealLeft - rect.left);
        } else {
          // Fallback to right alignment - ensure menu doesn't go off screen
          const maxOffset = window.innerWidth - rect.right - megaMenuWidth - margin;
          setMgmtOffset(Math.max(0, maxOffset));
        }
      }
      
      if (isReportOpen && reportRef.current) {
        const rect = reportRef.current.getBoundingClientRect();
        const menuCenter = rect.left + rect.width / 2;
        const idealLeft = menuCenter - megaMenuWidth / 2;
        
        // Check if we have enough space on both sides for centering
        if (idealLeft >= margin && idealLeft + megaMenuWidth <= window.innerWidth - margin) {
          setReportOffset(idealLeft - rect.left);
        } else {
          // Fallback to right alignment - ensure menu doesn't go off screen
          const maxOffset = window.innerWidth - rect.right - megaMenuWidth - margin;
          setReportOffset(Math.max(0, maxOffset));
        }
      }
      
      if (isSystemOpen && systemRef.current) {
        const rect = systemRef.current.getBoundingClientRect();
        const menuCenter = rect.left + rect.width / 2;
        const idealLeft = menuCenter - megaMenuWidth / 2;
        
        // Check if we have enough space on both sides for centering
        if (idealLeft >= margin && idealLeft + megaMenuWidth <= window.innerWidth - margin) {
          setSystemOffset(idealLeft - rect.left);
        } else {
          // Fallback to right alignment - ensure menu doesn't go off screen
          const maxOffset = window.innerWidth - rect.right - megaMenuWidth - margin;
          setSystemOffset(Math.max(0, maxOffset));
        }
      }
      
      if (isShopOpen && shopRef.current) {
        const rect = shopRef.current.getBoundingClientRect();
        const menuCenter = rect.left + rect.width / 2;
        const idealLeft = menuCenter - shopMenuWidth / 2;
        
        // Check if we have enough space on both sides for centering
        if (idealLeft >= margin && idealLeft + shopMenuWidth <= window.innerWidth - margin) {
          setShopOffset(idealLeft - rect.left);
        } else {
          // Fallback to right alignment - ensure menu doesn't go off screen
          const maxOffset = window.innerWidth - rect.right - shopMenuWidth - margin;
          setShopOffset(Math.max(0, maxOffset));
        }
      }
    }
    
    computeSmartOffsets();
    window.addEventListener('resize', computeSmartOffsets);
    return () => window.removeEventListener('resize', computeSmartOffsets);
  }, [isMgmtOpen, isReportOpen, isSystemOpen, isShopOpen]);

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
      {/* Home/Dashboard - visible to all authenticated users */}
      <Link className={getLinkClasses("/")} href="/" aria-label="Dashboard">Dashboard</Link>
      
      {/* Work shift (Calendar) - visible to authenticated users only, second item */}
      <Link className={getLinkClasses("/calendar")} href="/calendar" aria-label="Work shift">Work shift</Link>

      {/* Management group - Admin only */}
      {userRole === 'admin' && (
        orientation === 'vertical' ? (
          <div className="w-full">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Management</div>
            <div className="pl-2">
              <Link className={getLinkClasses("/staff")} href="/staff" aria-label="Staff">Staff</Link>
              <Link className={getLinkClasses("/sections")} href="/sections" aria-label="Sections">Sections</Link>
              <Link className={getLinkClasses("/shop/menu-screens")} href="/shop/menu-screens" aria-label="Menu Builder">Menu Builder</Link>
              <Link className={getLinkClasses("/planner")} href="/planner" aria-label="AI Planner">AI Planner</Link>
              <Link className={getLinkClasses("/holidays")} href="/holidays" aria-label="Public Holidays">Public Holidays</Link>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full"
            ref={mgmtRef}
            onMouseEnter={() => setIsMgmtOpen(true)}
            onMouseLeave={() => setIsMgmtOpen(false)}
          >
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
            <div className="absolute top-full mt-0.5 w-screen max-w-[640px] sm:w-[640px] rounded-xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur shadow-lg z-50 p-3 overflow-hidden"
                 style={{ left: mgmtOffset === 0 ? 'auto' : mgmtOffset, right: mgmtOffset === 0 ? '0' : 'auto' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Link href="/staff" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                        <FaUsers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Staff</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Manage team members, roles, availability</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/sections" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-orange-600 dark:text-orange-400">
                        <FaPalette className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Sections</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Shop areas like Fry, Cashier, Grill</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/shop/menu-screens" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-red-600 dark:text-red-400">
                        <FaUtensils className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Menu Builder</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Design public in-store menu screens</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/planner" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-purple-600 dark:text-purple-400">
                        <FaRobot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">AI Planner</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Generate optimal shift assignments with AI</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/holidays" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-green-600 dark:text-green-400">
                        <FaCalendarAlt className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Public Holidays</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Manage holidays and staff rate adjustments</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Shop group - Admin only (mega) */}
      {userRole === 'admin' && (
        orientation === 'vertical' ? (
          <div className="w-full">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Shop</div>
            <div className="pl-2">
              <Link className={getLinkClasses("/shop")} href="/shop" aria-label="Shop Overview">Shop Overview</Link>
              <div className="pl-2 mt-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Inventory</div>
                <div className="pl-2 space-y-1">
                  <Link className={getLinkClasses("/shop/products")} href="/shop/products" aria-label="Products">Products</Link>
                  <Link className={getLinkClasses("/shop/categories")} href="/shop/categories" aria-label="Categories">Categories</Link>
                  <Link className={getLinkClasses("/shop/inventory")} href="/shop/inventory" aria-label="Inventory">Inventory</Link>
                  <Link className={getLinkClasses("/shop/suppliers")} href="/shop/suppliers" aria-label="Suppliers">Suppliers</Link>
                </div>
              </div>
              <div className="pl-2 mt-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Menu</div>
                <div className="pl-2 space-y-1">
                  <Link className={getLinkClasses("/shop/menu")} href="/shop/menu" aria-label="Menu">Menu</Link>
                  <Link className={getLinkClasses("/shop/combo")} href="/shop/combo" aria-label="Combo">Combo</Link>
                  <Link className={getLinkClasses("/shop/google-business-sync")} href="/shop/google-business-sync" aria-label="Google Business Sync">Google Business Sync</Link>
                </div>
              </div>
              <div className="pl-2 mt-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Finance</div>
                <div className="pl-2 space-y-1">
                  <Link className={getLinkClasses("/income-expense")} href="/income-expense" aria-label="Income & Expenses">Income & Expenses</Link>
                  <Link className={getLinkClasses("/cash-flow")} href="/cash-flow" aria-label="Cash Flow Analysis">Cash Flow Analysis</Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full"
            ref={shopRef}
            onMouseEnter={() => setIsShopOpen(true)}
            onMouseLeave={() => setIsShopOpen(false)}
          >
            <button
              type="button"
              className="flex items-center h-full px-4 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-900"
              onClick={() => setIsShopOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isShopOpen}
            >
              Shop
            </button>
            {isShopOpen && (
            <div className="absolute top-full mt-0.5 w-screen max-w-[800px] sm:w-[800px] rounded-xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur shadow-lg z-50 p-3 overflow-hidden"
                 style={{ left: shopOffset === 0 ? 'auto' : shopOffset, right: shopOffset === 0 ? '0' : 'auto' }}>
                <div className="flex">
                  {/* Left Panel - Main Shop Link */}
                  <div className="w-1/4 pr-3">
                    <div className="border-r border-gray-200 dark:border-neutral-700 pr-3">
                      <Link href="/shop" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                            <FaStore className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">Shop Overview</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Main shop dashboard and settings</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Middle Panel - Inventory Section */}
                  <div className="w-1/4 px-3">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Inventory</h3>
                      <div className="space-y-2">
                        <Link href="/shop/products" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                              <FaBox className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Products</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Manage product catalog</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/shop/categories" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-purple-600 dark:text-purple-400">
                              <FaTags className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Categories</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Organize product categories</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/shop/inventory" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-orange-600 dark:text-orange-400">
                              <FaWarehouse className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Inventory</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Track stock levels and movements</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/shop/suppliers" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-green-600 dark:text-green-400">
                              <FaStore className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Suppliers</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Manage supplier relationships</div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel - Menu Section */}
                  <div className="w-1/4 px-3">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Menu</h3>
                      <div className="space-y-2">
                        <Link href="/shop/menu" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-red-600 dark:text-red-400">
                              <FaUtensils className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Menu</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Configure sale products and menu</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/shop/combo" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                              <FaUtensils className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Combo</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">AI combo builder for bundles</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/shop/google-business-sync" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                              <FaGoogle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Google Business Sync</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Sync menu to Google Business Profile</div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Far Right Panel - Finance Section */}
                  <div className="w-1/4 pl-3">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Finance</h3>
                      <div className="space-y-2">
                        <Link href="/income-expense" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-orange-600 dark:text-orange-400">
                              <FaDollarSign className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Income & Expenses</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Track daily sales and business expenses</div>
                            </div>
                          </div>
                        </Link>
                        <Link href="/cash-flow" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                              <FaChartLine className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">Cash Flow Analysis</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Financial insights and trends</div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* removed old Calendar position - now labeled Work shift above */}
      
      {/* Analysis & Report - Admin only (mega) */}
      {userRole === 'admin' && (
        orientation === 'vertical' ? (
          <div className="w-full">
            <Link className={getLinkClasses("/analysis-report")} href="/analysis-report" aria-label="Analysis & Report">Analysis & Report</Link>
            <div className="pl-2">
              <Link className={getLinkClasses("/orders")} href="/orders" aria-label="Orders">Orders</Link>
              <Link className={getLinkClasses("/reports/shift-reports")} href="/reports/shift-reports" aria-label="Weekly shift report">Weekly shift report</Link>
              <Link className={getLinkClasses("/analytics")} href="/analytics" aria-label="Analysis">Analysis</Link>
              <Link className={getLinkClasses("/wages-report")} href="/wages-report" aria-label="Wages Report">Wages Report</Link>
              <Link className={getLinkClasses("/payment-report")} href="/payment-report" aria-label="Payment Report">Payment Report</Link>
              <Link className={getLinkClasses("/paid-payments")} href="/paid-payments" aria-label="Paid Payments">Paid Payments</Link>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full"
            ref={reportRef}
            onMouseEnter={() => setIsReportOpen(true)}
            onMouseLeave={() => setIsReportOpen(false)}
          >
            <button
              type="button"
              className="flex items-center h-full px-4 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-900"
              onClick={() => setIsReportOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isReportOpen}
            >
              Analysis & Report
            </button>
            {isReportOpen && (
            <div className="absolute top-full mt-0.5 w-screen max-w-[640px] sm:w-[640px] rounded-xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur shadow-lg z-50 p-3 overflow-hidden"
                 style={{ left: reportOffset === 0 ? 'auto' : reportOffset, right: reportOffset === 0 ? '0' : 'auto' }}>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Link href="/orders" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                        <FaShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Orders</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">TryPosHub order management and tracking</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/reports/shift-reports" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                        <FaFileAlt className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Weekly shift allocation report</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Exportable weekly performance and wages</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/analytics" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                        <FaChartPie className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Analysis</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Dashboards and business insights</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/wages-report" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-purple-600 dark:text-purple-400">
                        <FaMoneyBillWave className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Wages Report</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Weekly wages by staff with exports</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/payment-report" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-green-600 dark:text-green-400">
                        <FaMoneyBillWave className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Payment Report</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Payment methods breakdown by staff</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/paid-payments" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                        <FaMoneyBillWave className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Paid Payments</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">View sealed payment records</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* System group - Admin only (mega) */}
      {userRole === 'admin' && (
        orientation === 'vertical' ? (
          <div className="w-full">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">System</div>
            <div className="pl-2">
              <Link className={getLinkClasses("/users")} href="/users" aria-label="Users">Users</Link>
              <Link className={getLinkClasses("/automation")} href="/automation" aria-label="Automation">Automation</Link>
              <Link className={getLinkClasses("/webhooks")} href="/webhooks" aria-label="Webhooks">Webhooks</Link>
              <Link className={getLinkClasses("/settings")} href="/settings" aria-label="Settings">Settings</Link>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full"
            ref={systemRef}
            onMouseEnter={() => setIsSystemOpen(true)}
            onMouseLeave={() => setIsSystemOpen(false)}
          >
            <button
              type="button"
              className="flex items-center h-full px-4 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-900"
              onClick={() => setIsSystemOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isSystemOpen}
            >
              System
            </button>
            {isSystemOpen && (
            <div className="absolute top-full mt-0.5 w-screen max-w-[640px] sm:w-[640px] rounded-xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur shadow-lg z-50 p-3 overflow-hidden"
                 style={{ left: systemOffset === 0 ? 'auto' : systemOffset, right: systemOffset === 0 ? '0' : 'auto' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Link href="/users" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-purple-600 dark:text-purple-400">
                        <FaUserShield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Users</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Admin user roles and access control</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/automation" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-orange-600 dark:text-orange-400">
                        <FaRobot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Automation</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Automated notifications and reminders</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/webhooks" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-green-600 dark:text-green-400">
                        <FaGlobe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Webhooks</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">External system integrations</div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/settings" className="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-gray-600 dark:text-gray-400">
                        <FaCog className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Settings</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">System configuration and preferences</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </nav>
  );
}
