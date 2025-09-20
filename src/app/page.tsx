"use client";

import { LoadingPage } from "@/components/Loading";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { user, loading, staffShifts, businessStats } = useDashboardData();

  useEffect(() => {
    if (!loading && !user) {
      // No authenticated user, redirect to login
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingPage message="Loading dashboard..." />;
  }

  // If no user, we're redirecting, so don't render anything
  if (!user) {
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
            {user.role_slug === 'admin' ? "Here's your business overview" : 'Here are your upcoming shifts'}
          </p>
        </div>

        {user.role_slug === 'staff' ? (
          <UserDashboard shifts={staffShifts} />
        ) : (
          <AdminDashboard businessStats={businessStats} />
        )}
      </div>
    </div>
  );
}
