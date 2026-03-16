"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { LoadingSpinner } from "@/components/Loading";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { FaUser, FaEnvelope, FaShieldAlt } from "react-icons/fa";
import { Icon } from "@/components/Icon";
import { OrderHeader } from "@/components/OrderHeader";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role_slug: string;
  created_at: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please log in to view your profile");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role_slug, created_at")
        .eq("id", user.id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setProfile(profileData as Profile);
      setEditingName(profileData.full_name || "");
      setEditingPhone(profileData.phone || "");
      
      // Check if user has a password set
      const { data: { session } } = await supabase.auth.getSession();
      setHasPassword(session?.user?.app_metadata?.provider === 'email');
      
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setProfileSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingName.trim() || null,
          phone: editingPhone.trim() || null,
        })
        .eq("id", profile.id);
      if (error) {
        throw new Error(error.message);
      }
      const updated: Profile = {
        ...profile,
        full_name: editingName.trim() || null,
        phone: editingPhone.trim() || null,
      };
      setProfile(updated);
      toast.success("Profile updated.");
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      setPasswordLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      if (hasPassword) {
        // User has existing password, verify current password first
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: profile?.email || "",
          password: currentPassword,
        });

        if (signInError) {
          toast.error("Current password is incorrect");
          setPasswordLoading(false);
          return;
        }
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(hasPassword ? "Password updated successfully!" : "Password set successfully!");
      
      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHasPassword(true);
      
    } catch (error) {
      console.error("Password change error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <OrderHeader />
        <div className="min-h-[80vh] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <OrderHeader />
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Profile Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Unable to load your profile information.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <OrderHeader />
      <div className="min-h-[80vh] p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            My Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Profile Information */}
        <div className="rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Icon icon={FaUser} className="text-2xl text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Profile Information
            </h2>
          </div>
          
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="Your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editingPhone}
                onChange={(e) => setEditingPhone(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="+61 4XX XXX XXX"
              />
              {!profile.phone && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Add a phone number so the shop can contact you about your orders.
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <span className="text-gray-900 dark:text-white">
                  {profile.email}
                </span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Member Since
              </label>
              <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <span className="text-gray-900 dark:text-white">
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {profileSaving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        {/* Password Management */}
        <div className="rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Icon icon={FaShieldAlt} className="text-2xl text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Password Management
            </h2>
          </div>
          
          {hasPassword === null ? (
            <div className="text-center py-8">
              <LoadingSpinner size="sm" />
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Checking password status...
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {hasPassword ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter your current password"
                      className="w-full p-3 pr-10 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showCurrentPassword ? <Icon icon={FaEyeSlash} /> : <Icon icon={FaEye} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon={FaEnvelope} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Magic Link User
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You&apos;re currently using magic link authentication. Set a password below to enable password login.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {hasPassword ? "New Password" : "Set Password"}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder={hasPassword ? "Enter new password" : "Enter your new password"}
                    className="w-full p-3 pr-10 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? <Icon icon={FaEyeSlash} /> : <Icon icon={FaEye} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm your password"
                    className="w-full p-3 pr-10 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <Icon icon={FaEyeSlash} /> : <Icon icon={FaEye} />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full p-3 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordLoading && <LoadingSpinner size="sm" />}
                {hasPassword ? "Update Password" : "Set Password"}
              </button>
            </form>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
