"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { FaFileAlt, FaChartLine, FaDollarSign, FaUsers, FaCalendarAlt, FaShoppingCart } from "react-icons/fa";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Access all your business reports and analytics
            </p>
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Shift Reports */}
            <Link 
              href="/reports/shift-reports" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FaUsers className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Shift Reports
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Staff schedules, hours, and payment reports
                  </p>
                </div>
              </div>
            </Link>

            {/* Cash Flow Analysis */}
            <Link 
              href="/cash-flow" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FaChartLine className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    Cash Flow Analysis
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Income vs expenses with visual charts and trends
                  </p>
                </div>
              </div>
            </Link>

            {/* Income & Expenses */}
            <Link 
              href="/income-expense" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FaDollarSign className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Income & Expenses
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Track and manage financial transactions
                  </p>
                </div>
              </div>
            </Link>

            {/* Wages Report */}
            <Link 
              href="/wages-report" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <FaFileAlt className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Wages Report
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Detailed staff wages and payment breakdowns
                  </p>
                </div>
              </div>
            </Link>

            {/* Payment Report */}
            <Link 
              href="/payment-report" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <FaCalendarAlt className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Payment Report
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Generate and manage staff payment reports
                  </p>
                </div>
              </div>
            </Link>

            {/* Paid Payments */}
            <Link 
              href="/paid-payments" 
              className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <FaShoppingCart className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    Paid Payments
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    View and manage completed staff payments
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Stats Section */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Quick Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                href="/analytics" 
                className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <FaChartLine className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    Analytics
                  </span>
                </div>
              </Link>

              <Link 
                href="/reports" 
                className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <FaFileAlt className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900 dark:text-white group-hover:text-green-600 transition-colors">
                    All Reports
                  </span>
                </div>
              </Link>

              <Link 
                href="/cash-flow" 
                className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <FaDollarSign className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                    Cash Flow
                  </span>
                </div>
              </Link>

              <Link 
                href="/income-expense" 
                className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <FaShoppingCart className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">
                    Transactions
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
