"use client";

import Link from "next/link";
import { AdminGuard } from "@/components/AdminGuard";

export default function AnalysisReportLandingPage() {
  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis & Report</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Access weekly reports, analytics, and wages report.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/reports" className="block rounded-xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Weekly Reports</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Download and view weekly performance.</p>
          </Link>

          <Link href="/analytics" className="block rounded-xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Analysis</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Explore business analytics and KPIs.</p>
          </Link>

          <Link href="/wages-report" className="block rounded-xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Wages Report</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">View and export wages (coming soon).</p>
          </Link>
        </div>
      </div>
    </AdminGuard>
  );
}


