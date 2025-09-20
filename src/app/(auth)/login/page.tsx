"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/Loading";
import { canSendMagicLink } from "@/app/actions/auth";
import { sendMagicLinkInvite } from "@/app/actions/email";
import { sendPasswordResetEmail } from "@/app/actions/password-reset";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'magic' | 'password'>('magic');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    // Handle forgot password case
    if (showForgotPassword) {
      await handleForgotPassword(e);
      return;
    }
    
    try {
      const supabase = getSupabaseClient();
      
      if (authMode === 'magic') {
        // Magic link authentication
        const check = await canSendMagicLink(email);
        if (!check.allowed) {
          throw new Error(check.reason);
        }

        const result = await sendMagicLinkInvite(email);
        if (!result.success) throw new Error(result.error || 'Failed to send magic link');
        setMessage("Magic link sent from OperateFlow. Please check your inbox.");
      } else {
        // Password authentication
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Please check your email and click the confirmation link');
          } else {
            throw new Error(error.message);
          }
        }
        
        // Successful login - redirect to dashboard
        setMessage("Login successful! Redirecting...");
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 
        (authMode === 'magic' ? 'Failed to send magic link' : 'Login failed');
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    try {
      const result = await sendPasswordResetEmail(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send password reset email');
      }
      
      setMessage("Password reset email sent from OperateFlow! Please check your inbox.");
      setShowForgotPassword(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">
          {authMode === 'magic' ? 'Sign in with a magic link' : 'Sign in with your password'}
        </p>
        
        {/* Authentication Mode Toggle */}
        <div className="mt-4 flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setAuthMode('magic')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
              authMode === 'magic'
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Magic Link
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('password')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
              authMode === 'password'
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Password
          </button>
        </div>

        <form onSubmit={handleSignIn} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-gray-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="h-11 rounded-lg px-3 bg-white dark:bg-neutral-800 outline-none focus:ring-2 ring-black/10 dark:ring-white/20 shadow-sm"
            />
          </label>
          
          {authMode === 'password' && (
            <label className="grid gap-2">
              <span className="text-sm text-gray-600">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
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
          )}
          
          {authMode === 'password' && !showForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Forgot password?
              </button>
            </div>
          )}
          
          <button 
            disabled={loading} 
            className="h-11 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading && <LoadingSpinner size="sm" />} 
            {showForgotPassword ? 'Send reset email' : (authMode === 'magic' ? 'Send magic link' : 'Sign in')}
          </button>
        </form>
        
        {showForgotPassword && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              Enter your email address and we&apos;ll send you a password reset link.
            </p>
            <button
              onClick={() => setShowForgotPassword(false)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              ← Back to sign in
            </button>
          </div>
        )}
        
        {message && (
          <p className={`mt-4 text-sm ${
            message.includes('successful') || message.includes('sent') 
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


