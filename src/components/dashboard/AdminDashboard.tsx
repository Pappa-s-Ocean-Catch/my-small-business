"use client";

import { FaCalendarAlt, FaUsers, FaBox, FaExclamationTriangle, FaDollarSign, FaChartLine, FaShoppingCart } from "react-icons/fa";
import Link from "next/link";
import { BusinessStats } from "@/types/dashboard";

interface AdminDashboardProps {
  businessStats: BusinessStats | null;
}

export function AdminDashboard({ businessStats }: AdminDashboardProps) {
  return (
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
          href="/analytics" 
          className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <FaChartLine className="w-8 h-8 text-orange-600 group-hover:scale-110 transition-transform" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Analytics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Business insights</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/reports" 
          className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <FaChartLine className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" />
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
  );
}
