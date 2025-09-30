"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/Loading";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated (Supabase handles token verification automatically)
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setMessage("Invalid or expired reset link. Please request a new password reset.");
        setIsTokenValid(false);
      } else {
        setIsTokenValid(true);
      }
    };
    
    checkAuth();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage("Password updated successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isTokenValid === false 
            ? "This reset link is invalid or has expired" 
            : "Enter your new password below"
          }
        </p>
        
        {isTokenValid === false ? (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200 mb-3">
              This password reset link is invalid or has expired. Please request a new password reset.
            </p>
            <a 
              href="/login" 
              className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              ← Back to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-gray-600">New Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter new password"
                  className="h-11 w-full rounded-lg px-3 pr-10 bg-white dark:bg-neutral-800 outline-none focus:ring-2 ring-black/10 dark:ring-white/20 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </label>
            
            <label className="grid gap-2">
              <span className="text-sm text-gray-600">Confirm Password</span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  className="h-11 w-full rounded-lg px-3 pr-10 bg-white dark:bg-neutral-800 outline-none focus:ring-2 ring-black/10 dark:ring-white/20 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </label>
            
            <button 
              disabled={loading} 
              className="h-11 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            >
              {loading && <LoadingSpinner size="sm" />} 
              Update Password
            </button>
          </form>
        )}
        
        {message && (
          <p className={`mt-4 text-sm ${
            message.includes('successfully') 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
