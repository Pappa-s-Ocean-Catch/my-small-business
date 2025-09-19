"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function getAllUsers(userId: string) {
  try {
    // Use service role client for admin operations
    const supabase = await createServiceRoleClient();
    
    console.log("getAllUsers - Using service role client for user:", userId);
    
    if (!userId) {
      console.log("getAllUsers - No user ID provided");
      return { success: false, error: "User ID required" };
    }

    // Check if current user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", userId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    // Get all users with their profiles
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        role_slug,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (usersError) {
      return { success: false, error: usersError.message };
    }

    console.log("getAllUsers - Success, returning users:", users?.length);
    return { success: true, data: users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

export async function updateUserRole(userId: string, newRole: 'admin' | 'staff', currentUserId: string) {
  try {
    // Use service role client for admin operations
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: "Current user ID required" };
    }

    // Check if current user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", currentUserId)
      .single();

    console.log("updateUserRole - Admin check:", { 
      currentUserId, 
      profile, 
      profileError: profileError?.message,
      isAdmin: profile?.role_slug === 'admin'
    });

    if (profileError || !profile || profile.role_slug !== 'admin') {
      console.log("updateUserRole - Admin access denied:", { 
        profileError: profileError?.message, 
        profile, 
        expectedRole: 'admin' 
      });
      return { success: false, error: "Admin access required" };
    }

    // Prevent admin from changing their own role
    if (userId === currentUserId) {
      return { success: false, error: "Cannot change your own role" };
    }

    // If demoting an admin to staff, check if this would be the last admin
    if (newRole === 'staff') {
      const { data: adminCount, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("role_slug", "admin");

      console.log("updateUserRole - Admin count check:", { 
        adminCount: adminCount?.length, 
        countError: countError?.message 
      });

      if (countError) {
        return { success: false, error: "Failed to check admin count" };
      }

      // If there's only 1 admin and we're trying to demote them, prevent it
      if (adminCount && adminCount.length <= 1) {
        return { success: false, error: "Cannot demote the last admin user. System must have at least one admin." };
      }
    }

    // Update the user's role
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role_slug: newRole })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, message: `User role updated to ${newRole}` };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: "Failed to update user role" };
  }
}

export async function deleteUser(userId: string, currentUserId: string) {
  try {
    // Use service role client for admin operations
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: "Current user ID required" };
    }

    // Check if current user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", userId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    // Prevent admin from deleting themselves
    if (userId === currentUserId) {
      return { success: false, error: "Cannot delete your own account" };
    }

    // Check if the user being deleted is an admin
    const { data: userToDelete, error: userError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", userId)
      .single();

    if (userError) {
      return { success: false, error: "Failed to check user role" };
    }

    // If deleting an admin, check if this would be the last admin
    if (userToDelete?.role_slug === 'admin') {
      const { data: adminCount, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("role_slug", "admin");

      console.log("deleteUser - Admin count check:", { 
        adminCount: adminCount?.length, 
        countError: countError?.message 
      });

      if (countError) {
        return { success: false, error: "Failed to check admin count" };
      }

      // If there's only 1 admin and we're trying to delete them, prevent it
      if (adminCount && adminCount.length <= 1) {
        return { success: false, error: "Cannot delete the last admin user. System must have at least one admin." };
      }
    }

    // Delete the user's profile (this will cascade to other related data)
    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
