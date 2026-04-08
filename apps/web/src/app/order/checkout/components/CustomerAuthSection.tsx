import React, { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { FaSignOutAlt, FaUser } from "react-icons/fa";
import { LoadingSpinner } from "@/components/Loading";

interface CustomerAuthSectionProps {
  /** When false, mobile OTP login UI is hidden (deploy webhook before enabling). */
  phoneLoginEnabled: boolean;
  isAuthenticated: boolean;
  requiresProfileCompletion: boolean;
  profileFullName: string;
  setProfileFullName: (val: string) => void;
  profileEmail: string;
  setProfileEmail: (val: string) => void;
  handleCompletePhoneProfile: () => Promise<void>;
  loginPhone: string;
  setLoginPhone: (val: string) => void;
  otpCode: string;
  setOtpCode: (val: string) => void;
  otpSent: boolean;
  otpResendCountdown: number;
  handleSendPhoneOtp: () => Promise<void>;
  handleVerifyPhoneOtp: () => Promise<void>;
  loginEmail: string;
  setLoginEmail: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  handleCustomerLogin: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  setError: (val: string | null) => void;
  signupFullName: string;
  setSignupFullName: (val: string) => void;
  signupEmail: string;
  setSignupEmail: (val: string) => void;
  signupPhone: string;
  setSignupPhone: (val: string) => void;
  signupPassword: string;
  setSignupPassword: (val: string) => void;
  signupConfirmPassword: string;
  setSignupConfirmPassword: (val: string) => void;
  handleCustomerSignup: (e: React.FormEvent) => Promise<void>;
  handleSignOutPhoneSession: () => Promise<void>;
  /** Incremented after phone change forces re-auth; switches tab to Mobile Login. */
  phoneReauthNonce: number;
}

export function CustomerAuthSection({
  phoneLoginEnabled,
  isAuthenticated,
  requiresProfileCompletion,
  profileFullName,
  setProfileFullName,
  profileEmail,
  setProfileEmail,
  handleCompletePhoneProfile,
  loginPhone,
  setLoginPhone,
  otpCode,
  setOtpCode,
  otpSent,
  otpResendCountdown,
  handleSendPhoneOtp,
  handleVerifyPhoneOtp,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  handleCustomerLogin,
  isSubmitting,
  error,
  setError,
  signupFullName,
  setSignupFullName,
  signupEmail,
  setSignupEmail,
  signupPhone,
  setSignupPhone,
  signupPassword,
  setSignupPassword,
  signupConfirmPassword,
  setSignupConfirmPassword,
  handleCustomerSignup,
  handleSignOutPhoneSession,
  phoneReauthNonce,
}: CustomerAuthSectionProps) {
  const [authMode, setAuthMode] = useState<"mobile" | "login" | "signup">(() =>
    phoneLoginEnabled ? "mobile" : "login",
  );

  useEffect(() => {
    if (!phoneLoginEnabled && authMode === "mobile") {
      setAuthMode("login");
    }
  }, [phoneLoginEnabled, authMode]);

  useEffect(() => {
    if (phoneLoginEnabled && phoneReauthNonce > 0) {
      setAuthMode("mobile");
    }
  }, [phoneReauthNonce, phoneLoginEnabled]);

  if (isAuthenticated) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon
          icon={FaUser}
          className="w-6 h-6 text-blue-600"
        />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Account Details
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Please sign in or create an account to proceed with your order.
      </p>

      {/* Auth Mode Toggle — hidden during phone profile completion */}
      {!requiresProfileCompletion && (
      <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
        {phoneLoginEnabled && (
          <button
            type="button"
            onClick={() => {
              setAuthMode("mobile");
              setError(null);
            }}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
              authMode === "mobile"
                ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Mobile Login
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setAuthMode("login");
            setError(null);
          }}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
            authMode === "login"
              ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("signup");
            setError(null);
          }}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
            authMode === "signup"
              ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Create Account
        </button>
      </div>
      )}

      {phoneLoginEnabled &&
        authMode === "mobile" &&
        !requiresProfileCompletion && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="+61 4XX XXX XXX"
            />
          </div>

          {!otpSent ? (
            <button
              type="button"
              onClick={handleSendPhoneOtp}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <LoadingSpinner size="sm" />}
              Send Code
            </button>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyPhoneOtp}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <LoadingSpinner size="sm" />}
                Verify & Continue
              </button>
              {otpResendCountdown > 0 ? (
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Didn&apos;t get a code? You can request a new one in{" "}
                  {otpResendCountdown}s.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={isSubmitting}
                  className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-800 dark:text-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  Resend Code
                </button>
              )}
            </>
          )}
        </div>
      )}

      {phoneLoginEnabled && requiresProfileCompletion && (
        <div className="mt-4 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Complete your profile
            </h3>
            <button
              type="button"
              onClick={() => void handleSignOutPhoneSession()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200 underline-offset-2 hover:underline disabled:opacity-50 shrink-0"
            >
              <Icon icon={FaSignOutAlt} className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
          <p className="text-xs text-amber-800/90 dark:text-amber-100/80">
            Signed in with your mobile number. Sign out to use a different number
            or sign in with email instead.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={profileFullName}
              onChange={(e) => setProfileFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
          <button
            type="button"
            onClick={handleCompletePhoneProfile}
            disabled={isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoadingSpinner size="sm" />}
            Save & Continue
          </button>
        </div>
      )}

      {/* Login Form */}
      {authMode === "login" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="button"
            onClick={handleCustomerLogin}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoadingSpinner size="sm" />}
            Sign In
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 animate-in fade-in mt-2">
          <div className="font-semibold mb-1">Login failed</div>
          <div>{error}</div>
          <div className="mt-2">
            <span className="block mb-1">
              If you had an account on our previous website, it will not work
              here. Please create a new account to continue.
            </span>
            <span className="block">
              If you forgot your password, you can{" "}
              <button
                type="button"
                className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                onClick={() => {
                  window.open("/login", "_blank");
                }}
              >
                reset your password
              </button>
              .
            </span>
          </div>
        </div>
      )}

      {/* Signup Form */}
      {authMode === "signup" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={signupFullName}
              onChange={(e) => setSignupFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="+61 4XX XXX XXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={signupConfirmPassword}
              onChange={(e) => setSignupConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              placeholder="Confirm your password"
            />
          </div>
          <button
            type="button"
            onClick={handleCustomerSignup}
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoadingSpinner size="sm" />}
            Create Account
          </button>
        </div>
      )}
    </div>
  );
}
