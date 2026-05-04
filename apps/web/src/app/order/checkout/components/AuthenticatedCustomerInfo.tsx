import React, { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { FaCheckCircle, FaUser, FaInfoCircle } from "react-icons/fa";

interface AuthenticatedCustomerInfoProps {
  isAuthenticated: boolean;
  currentUser: { email: string; phone?: string; full_name?: string } | null;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  phoneLoginEnabled: boolean;
  /** No real email on profile — user signed in with phone. */
  isPhonePrimaryAccount: boolean;
  /** Phone-primary + mobile login: sign out and return to OTP flow. */
  onRequestPhoneNumberChange: () => void | Promise<void>;
  authActionPending: boolean;
}

function isValidPhone(phone: string) {
  const cleaned = phone.replace(/\s+/g, "");
  return (
    /^\+614\d{8}$/.test(cleaned) ||
    /^04\d{8}$/.test(cleaned) ||
    /^\+61 4\d{2} \d{3} \d{3}$/.test(phone) ||
    /^04\d{2} \d{3} \d{3}$/.test(phone)
  );
}

function formatDisplayPhone(phone: string | undefined): string {
  if (!phone?.trim()) {
    return "";
  }
  return phone.trim();
}

export function AuthenticatedCustomerInfo({
  isAuthenticated,
  currentUser,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  phoneLoginEnabled,
  isPhonePrimaryAccount,
  onRequestPhoneNumberChange,
  authActionPending,
}: AuthenticatedCustomerInfoProps) {
   const [editing, setEditing] = useState(false);
  const [showPhoneInfo, setShowPhoneInfo] = useState(false);
  const phoneBaselineRef = useRef<string>("");
  const nameBaselineRef = useRef<string>("");
  const valid = isValidPhone(customerPhone);
  const hasName = Boolean(customerName.trim());

  const displayNumber =
    formatDisplayPhone(customerPhone) ||
    formatDisplayPhone(currentUser?.phone);
  const phoneOk = isValidPhone(displayNumber);

  const changePhoneViaSignOut =
    isPhonePrimaryAccount && phoneLoginEnabled;

  if (isAuthenticated === undefined || isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white mr-2"></span>
        <span className="text-gray-700 dark:text-gray-200">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const signInLine = isPhonePrimaryAccount ? (
    <>
      Signed in with mobile{" "}
      <span className="font-medium">{displayNumber || "—"}</span>
    </>
  ) : (
    <>
      Signed in as{" "}
      <span className="font-medium">{currentUser?.email?.trim() || "—"}</span>
    </>
  );

  const beginEditPhone = () => {
    phoneBaselineRef.current =
      customerPhone.trim() || currentUser?.phone?.trim() || "";
    nameBaselineRef.current = customerName.trim() || currentUser?.full_name?.trim() || "";
    setEditing(true);
  };

  const commitPhoneEdit = () => {
    if (!valid) {
      return;
    }
    setEditing(false);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon icon={FaUser} className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Account Details
        </h2>
      </div>
      <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400 text-sm sm:text-base">
        <Icon icon={FaCheckCircle} className="w-5 h-5 shrink-0" />
        <span>{signInLine}</span>
      </div>

      {!isPhonePrimaryAccount && currentUser?.email?.trim() ? (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Contact phone is for order updates only. Changing it here updates your
          checkout details; use{" "}
          <span className="font-medium">Change</span> below if your number
          changed.
        </p>
      ) : null}

      {!hasName || editing ? (
        <div className="mt-1 mb-4 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-100 mb-2">
            Please provide your full name so we can attach it to this order.
          </p>
          <label className="block text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            placeholder="Enter your full name"
            autoComplete="name"
          />
          {!hasName ? (
            <p className="text-xs text-red-600 mt-2">
              Full name is required to place your order.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-1 mb-4 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-100 mb-1">
            Customer Name
          </p>
          <span className="text-base font-semibold text-green-900 dark:text-green-100">
            {customerName}
          </span>
        </div>
      )}

       {changePhoneViaSignOut ? (
        <>
          {phoneOk ? (
            <div className="mt-1 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-100 mb-1 flex items-center gap-1.5">
                  Contact Phone Number
                  <button
                    type="button"
                    onClick={() => setShowPhoneInfo(!showPhoneInfo)}
                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors focus:outline-none"
                    title="Learn more about changing your phone number"
                  >
                    <Icon icon={FaInfoCircle} className="w-3.5 h-3.5" />
                  </button>
                </p>
                <span className="text-base font-semibold text-green-900 dark:text-green-100">
                  {displayNumber}
                </span>
              </div>
              <button
                type="button"
                className="ml-4 px-3 py-1 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700 transition disabled:opacity-50"
                disabled={authActionPending}
                onClick={() => void onRequestPhoneNumberChange()}
              >
                Change
              </button>
            </div>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400">
              Your profile does not have a valid Australian mobile number.
              Please contact support or use Sign out from the sign-in section.
            </p>
          )}
          {showPhoneInfo && (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2">
              Your account uses this mobile number. To use a different number,
              tap Change — you&apos;ll sign out and verify the number you want with
              a code.
            </p>
          )}
        </>
      ) : valid && !editing ? (
        <div className="mt-1 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-100 mb-1">
              Contact Phone Number
            </p>
            <span className="text-base font-semibold text-green-900 dark:text-green-100">
              {customerPhone}
            </span>
          </div>
          <button
            type="button"
            className="ml-4 px-3 py-1 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700 transition"
            onClick={beginEditPhone}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mt-1 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-100 mb-2">
            Please confirm a contact phone number so the store can reach you
            about your order.
          </p>
          <label className="block text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            placeholder="+61 4XX XXX XXX"
          />
          {!valid && customerPhone ? (
            <p className="text-xs text-red-600 mt-2">
              Please enter a valid Australian mobile number.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {valid ? (
              <button
                type="button"
                className="px-3 py-1 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700 transition"
                onClick={commitPhoneEdit}
              >
                Save
              </button>
            ) : null}
            <button
              type="button"
              className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              onClick={() => {
                setEditing(false);
                setCustomerName(
                  currentUser?.full_name?.trim() ||
                    nameBaselineRef.current ||
                    "",
                );
                setCustomerPhone(
                  currentUser?.phone?.trim() || phoneBaselineRef.current || "",
                );
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
