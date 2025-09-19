"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { FaCalendarAlt, FaUsers, FaBox, FaExclamationTriangle, FaDollarSign, FaChartLine, FaClock, FaUser, FaShoppingCart } from "react-icons/fa";
import Link from "next/link";
import { format, startOfWeek, endOfWeek, isToday, isFuture } from "date-fns";

type User = {
  id: string;
  email: string;
  role_slug: 'admin' | 'staff';
};

type Shift = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  staff_id: string;
  staff: {
    name: string;
    email: string;
  };
};


type BusinessStats = {
  totalStaff: number;
  totalShifts: number;
  lowStockProducts: number;
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  weeklyCost: number;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffShifts, setStaffShifts] = useState<Shift[]>([]);
  const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_slug")
            .eq("id", authUser.id)
            .single();
          
          const userData = {
            id: authUser.id,
            email: authUser.email || '',
            role_slug: profile?.role_slug as 'admin' | 'staff' || 'staff'
          };
          
          setUser(userData);

          if (profile?.role_slug === 'staff') {
            // Fetch staff's shifts for this week
            const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
            const endOfThisWeek = endOfWeek(new Date(), { weekStartsOn: 1 });
            
            const { data: shifts } = await supabase
              .from("shifts")
              .select(`
                id,
                date,
                start_time,
                end_time,
                staff_id,
                staff:staff_id (
                  name,
                  email
                )
              `)
              .eq("staff_id", authUser.id)
              .gte("date", startOfThisWeek.toISOString().split('T')[0])
              .lte("date", endOfThisWeek.toISOString().split('T')[0])
              .order("date", { ascending: true })
              .order("start_time", { ascending: true });
            
            // Transform the data to match our Shift type
            const transformedShifts = (shifts || []).map(shift => ({
              ...shift,
              staff: Array.isArray(shift.staff) ? shift.staff[0] : shift.staff
            }));
            
            setStaffShifts(transformedShifts);
          } else if (profile?.role_slug === 'admin') {
            // Fetch business statistics
            const [staffResult, shiftsResult, productsResult, categoriesResult, suppliersResult] = await Promise.all([
              supabase.from("staff").select("id", { count: "exact" }),
              supabase.from("shifts").select("id", { count: "exact" }),
              supabase.from("products").select("id, quantity_in_stock, reorder_level", { count: "exact" }),
              supabase.from("categories").select("id", { count: "exact" }),
              supabase.from("suppliers").select("id", { count: "exact" })
            ]);

            const lowStockProducts = productsResult.data?.filter(p => p.quantity_in_stock <= p.reorder_level).length || 0;
            
            // Calculate weekly cost (simplified - you might want to enhance this)
            const { data: weeklyShifts } = await supabase
              .from("shifts")
              .select(`
                start_time,
                end_time,
                staff:staff_id (
                  pay_rate
                )
              `)
              .gte("date", startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split('T')[0])
              .lte("date", endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split('T')[0]);

            let weeklyCost = 0;
            if (weeklyShifts) {
              weeklyShifts.forEach(shift => {
                const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff;
                if (staff?.pay_rate) {
                  const start = new Date(`2000-01-01T${shift.start_time}`);
                  const end = new Date(`2000-01-01T${shift.end_time}`);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  weeklyCost += hours * staff.pay_rate;
                }
              });
            }

            setBusinessStats({
              totalStaff: staffResult.count || 0,
              totalShifts: shiftsResult.count || 0,
              lowStockProducts,
              totalProducts: productsResult.count || 0,
              totalCategories: categoriesResult.count || 0,
              totalSuppliers: suppliersResult.count || 0,
              weeklyCost
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchUserAndData();
  }, []);

  if (loading) {
  return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to OperateFlow</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to access your dashboard</p>
          <Link 
            href="/login" 
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.email.split('@')[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {user.role_slug === 'admin' ? 'Here&apos;s your business overview' : 'Here are your upcoming shifts'}
          </p>
        </div>

        {user.role_slug === 'staff' ? (
          /* Staff Dashboard */
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week&apos;s Shifts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{staffShifts.length}</p>
                  </div>
                  <FaCalendarAlt className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Shifts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {staffShifts.filter(shift => isFuture(new Date(shift.date))).length}
                    </p>
                  </div>
                  <FaClock className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today&apos;s Shifts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {staffShifts.filter(shift => isToday(new Date(shift.date))).length}
                    </p>
                  </div>
                  <FaUser className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Upcoming Shifts */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
              <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Shifts This Week</h2>
              </div>
              <div className="p-6">
                {staffShifts.length === 0 ? (
                  <div className="text-center py-8">
                    <FaCalendarAlt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No shifts scheduled</h3>
                    <p className="text-gray-600 dark:text-gray-400">You don&apos;t have any shifts scheduled for this week.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {staffShifts.map((shift) => (
                      <div 
                        key={shift.id} 
                        className={`p-4 rounded-lg border ${
                          isToday(new Date(shift.date)) 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                            : 'bg-gray-50 dark:bg-neutral-700 border-gray-200 dark:border-neutral-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {format(new Date(shift.date), 'EEEE, MMMM d')}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {shift.start_time} - {shift.end_time}
                            </p>
                          </div>
                          {isToday(new Date(shift.date)) && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Admin Dashboard */
          <div className="space-y-6">
            {/* Business Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Staff</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{businessStats?.totalStaff || 0}</p>
                  </div>
                  <FaUsers className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{businessStats?.totalProducts || 0}</p>
                  </div>
                  <FaBox className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock Alert</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{businessStats?.lowStockProducts || 0}</p>
                  </div>
                  <FaExclamationTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Weekly Cost</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${businessStats?.weeklyCost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <FaDollarSign className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Link 
                href="/calendar" 
                className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <FaCalendarAlt className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Schedule</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage shifts</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/staff" 
                className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <FaUsers className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Staff</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage team</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/shop" 
                className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <FaShoppingCart className="w-8 h-8 text-purple-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Shop</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Inventory & products</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/reports" 
                className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <FaChartLine className="w-8 h-8 text-orange-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Reports</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Financial reports</p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Alerts */}
            {businessStats && businessStats.lowStockProducts > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <FaExclamationTriangle className="w-8 h-8 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-200">Low Stock Alert</h3>
                    <p className="text-red-700 dark:text-red-300">
                      {businessStats.lowStockProducts} product{businessStats.lowStockProducts !== 1 ? 's' : ''} need{businessStats.lowStockProducts === 1 ? 's' : ''} restocking.
                    </p>
                    <Link 
                      href="/shop/notifications" 
                      className="inline-flex items-center mt-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
