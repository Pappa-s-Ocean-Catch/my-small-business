"use client";

import { LoadingPage } from "@/components/Loading";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, businessStats } = useDashboardData();

  useEffect(() => {
    if (!loading && !user) {
      // No authenticated user, redirect to login
      router.push('/login?redirect=/admin');
    } else if (!loading && user && user.role_slug !== 'admin') {
      // User is not admin, redirect to appropriate page
      if (user.role_slug === 'staff') {
        router.push('/staff');
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingPage message="Loading dashboard..." />;
  }

  // If no user or not admin, we're redirecting, so don't render anything
  if (!user || user.role_slug !== 'admin') {
    return null;
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
            Here&apos;s your business overview
          </p>
        </div>

        <AdminDashboard businessStats={businessStats} />
      </div>
    </div>
  );
}
