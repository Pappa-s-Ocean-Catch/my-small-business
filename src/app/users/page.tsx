"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FaUser, FaUserShield, FaUserCog, FaTrash, FaEdit, FaSync } from "react-icons/fa";
import { getAllUsers, updateUserRole, deleteUser } from "@/app/actions/user-management";

type User = {
  id: string;
  email: string;
  role_slug: 'admin' | 'staff';
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ user: User | null; isOpen: boolean }>({ user: null, isOpen: false });
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ user: User | null; newRole: 'admin' | 'staff' | null; isOpen: boolean }>({ user: null, newRole: null, isOpen: false });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check client-side authentication first
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log("Client-side auth check:", { 
        hasUser: !!user, 
        userId: user?.id, 
        userEmail: user?.email,
        error: userError?.message 
      });
      
      if (user?.id) {
        setCurrentUserId(user.id);
      }
      
      const result = await getAllUsers(user?.id || "");
      console.log("getAllUsers result:", result);
      
      if (result.success && result.data) {
        setUsers(result.data);
        setError(null); // Explicitly clear error on success
      } else {
        setError(result.error || "Failed to fetch users");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleRoleChange = async (user: User, newRole: 'admin' | 'staff') => {
    console.log("handleRoleChange called:", { user: user.email, newRole, currentUserId });
    try {
      if (!currentUserId) {
        setError("Current user ID not available");
        return;
      }
      const result = await updateUserRole(user.id, newRole, currentUserId);
      console.log("updateUserRole result:", result);
      
      if (result.success) {
        // Update the user in the local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === user.id ? { ...u, role_slug: newRole } : u
          )
        );
        setRoleChangeConfirm({ user: null, newRole: null, isOpen: false });
      } else {
        setError(result.error || "Failed to update user role");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error updating user role:", err);
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      if (!currentUserId) {
        setError("Current user ID not available");
        return;
      }
      const result = await deleteUser(user.id, currentUserId);
      
      if (result.success) {
        // Remove the user from the local state
        setUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
        setDeleteConfirm({ user: null, isOpen: false });
      } else {
        setError(result.error || "Failed to delete user");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error deleting user:", err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <FaUserShield className="w-4 h-4 text-red-500" />;
      case 'staff':
        return <FaUserCog className="w-4 h-4 text-blue-500" />;
      default:
        return <FaUser className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'staff':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
              </div>
            </div>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage user roles and permissions
                </p>
              </div>
              <button
                onClick={fetchUsers}
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

          {/* Users Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-neutral-600 flex items-center justify-center">
                              <FaUser className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.email}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role_slug)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role_slug)}`}>
                            {user.role_slug.charAt(0).toUpperCase() + user.role_slug.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {/* Role Change Buttons */}
                          {user.role_slug === 'admin' ? (
                            <button
                              onClick={() => setRoleChangeConfirm({ user, newRole: 'staff', isOpen: true })}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                            >
                              <FaEdit className="w-3 h-3" />
                              Make Staff
                            </button>
                          ) : (
                            <button
                              onClick={() => setRoleChangeConfirm({ user, newRole: 'admin', isOpen: true })}
                              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs"
                            >
                              <FaUserShield className="w-3 h-3" />
                              Make Admin
                            </button>
                          )}
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirm({ user, isOpen: true })}
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

          {/* Empty State */}
          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <FaUser className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                There are no users in the system yet.
              </p>
            </div>
          )}
        </div>

        {/* Role Change Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={roleChangeConfirm.isOpen}
          onClose={() => {
            setRoleChangeConfirm({ user: null, newRole: null, isOpen: false });
            setError(null); // Clear error when closing modal
          }}
          onConfirm={() => {
            console.log("Role change confirmation clicked:", { 
              user: roleChangeConfirm.user?.email, 
              newRole: roleChangeConfirm.newRole 
            });
            if (roleChangeConfirm.user && roleChangeConfirm.newRole) {
              void handleRoleChange(roleChangeConfirm.user, roleChangeConfirm.newRole);
            }
          }}
          title="Change User Role"
          message={`Are you sure you want to change ${roleChangeConfirm.user?.email}'s role to ${roleChangeConfirm.newRole}?`}
          confirmText="Change Role"
          cancelText="Cancel"
          variant="warning"
          error={error}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => {
            setDeleteConfirm({ user: null, isOpen: false });
            setError(null); // Clear error when closing modal
          }}
          onConfirm={() => {
            if (deleteConfirm.user) {
              void handleDeleteUser(deleteConfirm.user);
            }
          }}
          title="Delete User"
          message={`Are you sure you want to delete ${deleteConfirm.user?.email}? This action cannot be undone.`}
          confirmText="Delete User"
          cancelText="Cancel"
          variant="danger"
          error={error}
        />
      </div>
    </AdminGuard>
  );
}
