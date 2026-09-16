"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { LoadingSpinner } from "@/components/Loading";
import { canSendMagicLink } from "@/app/actions/auth";
import { sendMagicLinkInvite } from "@/app/actions/email";
import { sendPasswordResetEmail } from "@/app/actions/password-reset";
import { normalizeAuPhone, buildFallbackOrderEmail, isPlaceholderCustomerEmail, mapPhoneAuthError } from "@/lib/phone-auth";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import posthog from "posthog-js";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'magic' | 'password' | 'phone'>('magic');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const phoneLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === "true";

  useEffect(() => {
    if (!recaptchaSiteKey) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-recaptcha-v3="true"]',
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-recaptcha-v3", "true");
    document.head.appendChild(script);
  }, [recaptchaSiteKey]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpResendCountdown > 0) {
      timer = setTimeout(() => setOtpResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpResendCountdown]);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user role and redirect accordingly
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .single();

        const redirectPath = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;

        if (redirectPath) {
          window.location.href = redirectPath;
        } else {
          window.location.href = '/';
        }
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

        const redirectPath = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect') ?? undefined
          : undefined;
        const result = await sendMagicLinkInvite(email, redirectPath);
        if (!result.success) throw new Error(result.error || 'Failed to send magic link');
        posthog.capture('magic_link_sent', { email });
        setMessage("Magic link sent from Pappas Ocean Catch. Please check your inbox.");
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

        // Successful login - redirect based on role
        setMessage("Login successful! Redirecting...");

        // Get user role
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          await supabase.auth.updateUser({ data: { has_password: true } });
          posthog.identify(authUser.id, { email: authUser.email });
          posthog.capture('user_logged_in', { auth_method: 'password', email: authUser.email });
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_slug")
            .eq("id", authUser.id)
            .single();

          const redirectPath = typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('redirect')
            : null;

          setTimeout(() => {
            if (redirectPath) {
              window.location.href = redirectPath;
            } else {
              window.location.href = '/';
            }
          }, 1000);
        } else {
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
        (authMode === 'magic' ? 'Failed to send magic link' : 'Login failed');
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const getRecaptchaV3Token = async (): Promise<string> => {
    if (!recaptchaSiteKey) return "";
    if (typeof window === "undefined" || !window.grecaptcha) {
      throw new Error("reCAPTCHA is still loading. Please try again in a moment.");
    }
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha?.ready(async () => {
        try {
          const token = await window.grecaptcha?.execute(recaptchaSiteKey, {
            action: "phone_otp_send",
          });
          if (!token) reject(new Error("Failed to generate reCAPTCHA token."));
          else resolve(token);
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  const handleSendPhoneOtp = async () => {
    setMessage(null);
    if (otpSent && otpResendCountdown > 0) {
      setMessage(`Please wait ${otpResendCountdown} seconds before requesting a new code.`);
      return;
    }
    setLoading(true);
    try {
      if (recaptchaSiteKey) {
        const recaptchaToken = await getRecaptchaV3Token();
        const verificationResponse = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + "/api/security/verify-recaptcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: recaptchaToken, action: "phone_otp_send" }),
        });
        const verificationResult = await verificationResponse.json();
        if (!verificationResponse.ok || !verificationResult.success) {
          throw new Error(verificationResult.error || "reCAPTCHA verification failed.");
        }
      }

      const normalizedPhone = normalizeAuPhone(loginPhone);
      if (!normalizedPhone.startsWith("+614")) {
        throw new Error("Please enter a valid Australian mobile number (e.g. +61 4XX XXX XXX).");
      }

      const supabase = getSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true, data: { phone: normalizedPhone } },
      });

      if (otpError) throw new Error(mapPhoneAuthError(otpError.message));

      setLoginPhone(normalizedPhone);
      setOtpSent(true);
      setOtpResendCountdown(30);
      setMessage("Verification code sent via SMS!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const normalizedPhone = normalizeAuPhone(loginPhone);
      if (!otpCode || otpCode.length < 6) throw new Error("Please enter the 6-digit verification code.");

      const supabase = getSupabaseClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode,
        type: "sms",
      });

      if (verifyError) throw new Error(mapPhoneAuthError(verifyError.message));
      if (!data.user) throw new Error("Verification succeeded but no user session was found.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role_slug")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Phone verified, but profile could not be loaded.");
      }

      const profilePhone = profile.phone || normalizedPhone;
      const finalEmail = profile.email || buildFallbackOrderEmail(profilePhone);

      posthog.identify(profile.id, {
        email: isPlaceholderCustomerEmail(profile.email) ? undefined : profile.email,
        name: profile.full_name,
        phone: normalizeAuPhone(profilePhone),
      });
      posthog.capture("user_logged_in", { auth_method: "phone" });

      setMessage("Login successful! Redirecting...");
      const redirectPath = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('redirect')
        : null;
      setTimeout(() => {
        if (redirectPath) window.location.href = redirectPath;
        else window.location.href = '/';
      }, 1000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Invalid code. Try again.");
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

      setMessage("Password reset email sent from Pappas Ocean Catch! Please check your inbox.");
      setShowForgotPassword(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex md:grid md:grid-cols-2">
      {/* Left Form Side */}
      <div className="w-full flex flex-col justify-center p-6 sm:p-12">
        <div className="w-full max-w-md mx-auto rounded-3xl bg-white dark:bg-neutral-900 p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-none dark:border dark:border-neutral-800">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-serif">Welcome back</h1>
          <p className="text-base text-gray-500 mt-2">
            {authMode === 'magic' ? 'Sign in with your email' : authMode === 'phone' ? 'Sign in with mobile OTP' : 'Sign in with your password'}
          </p>

          
          {/* Authentication Mode Toggle */}
          <div className="mt-8 flex bg-gray-100 dark:bg-neutral-800 rounded-xl p-1.5 overflow-hidden">
            <button
              type="button"
              onClick={() => setAuthMode('magic')}
              className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all ${authMode === 'magic'
                ? 'bg-white dark:bg-neutral-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Email Link
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all ${authMode === 'password'
                ? 'bg-white dark:bg-neutral-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Password
            </button>
            {phoneLoginEnabled && (
              <button
                type="button"
                onClick={() => setAuthMode('phone')}
                className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all ${authMode === 'phone'
                  ? 'bg-white dark:bg-neutral-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                Mobile OTP
              </button>
            )}
          </div>


          <form onSubmit={handleSignIn} className="mt-8 grid gap-5">
            {authMode === 'phone' && (
              <div className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</span>
                  <input
                    type="tel"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    required
                    placeholder="+61 4XX XXX XXX"
                    className="h-12 rounded-xl px-4 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 outline-none focus:ring-2 ring-cyan-600/20 focus:border-cyan-600 dark:focus:border-cyan-400 transition-all text-base"
                  />
                </label>
                
                {otpSent && (
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Code</span>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      placeholder="6-digit code"
                      maxLength={6}
                      className="h-12 rounded-xl px-4 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 outline-none focus:ring-2 ring-cyan-600/20 focus:border-cyan-600 dark:focus:border-cyan-400 transition-all text-base tracking-widest text-center font-mono"
                    />
                  </label>
                )}
                
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={loading || !loginPhone}
                    className="mt-2 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-amber-500/25"
                  >
                    {loading && <LoadingSpinner size="sm" className="text-white" />}
                    Send Code
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleVerifyPhoneOtp}
                      disabled={loading || otpCode.length < 6}
                      className="mt-2 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-green-500/25"
                    >
                      {loading && <LoadingSpinner size="sm" className="text-white" />}
                      Verify & Sign In
                    </button>
                    {otpResendCountdown > 0 ? (
                      <p className="text-center text-sm text-gray-500 mt-2">
                        Resend code in {otpResendCountdown}s
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={loading}
                        className="text-center text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 mt-2"
                      >
                        Resend Code
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {authMode !== 'phone' && (
            <label className="grid gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="h-12 rounded-xl px-4 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 outline-none focus:ring-2 ring-cyan-600/20 focus:border-cyan-600 dark:focus:border-cyan-400 transition-all text-base"
              />
            </label>
            )}

            {authMode === 'password' && !showForgotPassword && (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl px-4 pr-12 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 outline-none focus:ring-2 ring-cyan-600/20 focus:border-cyan-600 dark:focus:border-cyan-400 transition-all text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-600 transition-colors"
                  >
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {authMode === 'password' && !showForgotPassword && (
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setPassword(''); // Clear password when switching to forgot password mode
                  }}
                  className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {authMode !== 'phone' && (
            <button
              disabled={loading}
              className="mt-2 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-amber-500/25"
            >
              {loading && <LoadingSpinner size="sm" className="text-white" />}
              {showForgotPassword ? 'Send reset email' : (authMode === 'magic' ? 'Login with email' : 'Sign in')}
            </button>
            )}
          </form>

          {showForgotPassword && (
            <div className="mt-6 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-100 dark:border-cyan-800">
              <p className="text-sm text-cyan-800 dark:text-cyan-200 mb-3">
                Enter your email address and we&apos;ll send you a password reset link.
              </p>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {message && (
            <p className={`mt-6 text-sm font-medium p-4 rounded-xl ${message.includes('successful') || message.includes('sent')
              ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
              }`}>
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Right Image Side (Hidden on Mobile) */}
      <div className="hidden md:block relative w-full h-full min-h-[80vh] rounded-l-3xl overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/60 to-black/20 z-10" />
        {/* We use a placeholder image for now, you can replace it with actual food imagery */}
        <img
          src="/login_bg.png"
          alt="Fresh fish and chips"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute bottom-16 left-16 right-16 z-20">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-amber-500/90 backdrop-blur-sm border border-amber-400/50">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Pappa's Rewards</span>
          </div>
          <h2 className="text-5xl font-bold text-white mb-6 font-serif leading-tight drop-shadow-lg">
            Fresh from the sea,<br />golden to perfection.
          </h2>
          <p className="text-xl text-white/90 drop-shadow-md font-medium max-w-lg">
            Sign in to track your orders, earn delicious rewards, and speed through checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
