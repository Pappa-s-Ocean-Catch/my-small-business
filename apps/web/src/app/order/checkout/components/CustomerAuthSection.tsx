import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { FaUser } from "react-icons/fa";
import { LoadingSpinner } from "@/components/Loading";

interface CustomerAuthSectionProps {
  isAuthenticated: boolean;
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
}

export function CustomerAuthSection({
  isAuthenticated,
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
}: CustomerAuthSectionProps) {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

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

      {/* Auth Mode Toggle */}
      <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
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
