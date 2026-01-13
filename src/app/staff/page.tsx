"use client";

import { LoadingPage } from "@/components/Loading";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FaUser, FaTrash, FaEdit, FaSync, FaPlus } from "react-icons/fa";

type ShopStaff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_available: boolean;
  role_slug: string | null;
  description: string | null;
  created_at: string;
};

export default function StaffPage() {
  const router = useRouter();
  const { user, loading, staffShifts } = useDashboardData();
  const [shopStaff, setShopStaff] = useState<ShopStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ staff: ShopStaff | null; isOpen: boolean }>({ staff: null, isOpen: false });

  const fetchShopStaff = async () => {
    try {
      setLoadingStaff(true);
      setError(null);
      
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("staff")
        .select("*")
        .order("name", { ascending: true });
      
      if (fetchError) {
        setError(fetchError.message || "Failed to fetch staff");
        return;
      }
      
      setShopStaff(data || []);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error fetching staff:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleDeleteStaff = async (staff: ShopStaff) => {
    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("staff")
        .delete()
        .eq("id", staff.id);
      
      if (deleteError) {
        setError(deleteError.message || "Failed to delete staff member");
        return;
      }
      
      setShopStaff(prevStaff => prevStaff.filter(s => s.id !== staff.id));
      setDeleteConfirm({ staff: null, isOpen: false });
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error deleting staff:", err);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      // No authenticated user, redirect to login
      router.push('/login?redirect=/staff');
      return;
    }
    
    if (!loading && user) {
      // If admin, fetch shop staff for management
      if (user.role_slug === 'admin') {
        void fetchShopStaff();
      }
      // If staff member, they'll see their shifts (handled below)
      // If customer or other role, redirect
      else if (user.role_slug !== 'staff') {
        if (user.role_slug === 'customer') {
          router.push('/order');
        } else {
          router.push('/');
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingPage message="Loading..." />;
  }

  if (!user) {
    return null; // Redirecting
  }

  // Admin view: Staff management interface
  if (user.role_slug === 'admin') {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-3 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Manage shop staff members, roles, and availability
                  </p>
                </div>
                <button
                  onClick={fetchShopStaff}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaSync className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-red-600 dark:text-red-400">
                    <FaUser className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Staff Table */}
            {loadingStaff ? (
              <LoadingPage message="Loading staff..." />
            ) : (
              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-neutral-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider max-w-xs">
                          Staff Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                      {shopStaff.map((staff) => (
                        <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                          <td className="px-6 py-4 max-w-xs">
                            <div className="flex items-start">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-neutral-600 flex items-center justify-center">
                                  <FaUser className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </div>
                              </div>
                              <div className="ml-4 min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {staff.name}
                                </div>
                                {staff.description && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 break-words mt-1">
                                    {staff.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {staff.email || '-'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {staff.phone || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {staff.role_slug || 'member'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              staff.is_available 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {staff.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  // TODO: Implement edit functionality
                                  setError("Edit functionality coming soon");
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                              >
                                <FaEdit className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ staff, isOpen: true })}
                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs"
                              >
                                <FaTrash className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {shopStaff.length === 0 && !loadingStaff && (
              <div className="text-center py-12">
                <FaUser className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No staff members found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  There are no staff members in the system yet.
                </p>
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
              isOpen={deleteConfirm.isOpen}
              onClose={() => {
                setDeleteConfirm({ staff: null, isOpen: false });
                setError(null);
              }}
              onConfirm={() => {
                if (deleteConfirm.staff) {
                  void handleDeleteStaff(deleteConfirm.staff);
                }
              }}
              title="Delete Staff Member"
              message={`Are you sure you want to delete ${deleteConfirm.staff?.name}? This action cannot be undone.`}
              confirmText="Delete Staff"
              cancelText="Cancel"
              variant="danger"
              error={error}
            />
          </div>
        </div>
      </AdminGuard>
    );
  }

  // Staff member view: Show their shifts
  if (user.role_slug === 'staff') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user.email.split('@')[0]}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Here are your upcoming shifts
            </p>
          </div>

          <UserDashboard shifts={staffShifts} />
        </div>
      </div>
    );
  }

  // Should not reach here, but just in case
  return null;
}
