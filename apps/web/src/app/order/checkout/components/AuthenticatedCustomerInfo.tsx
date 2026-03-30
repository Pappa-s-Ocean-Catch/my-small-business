import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { FaCheckCircle, FaUser } from "react-icons/fa";


interface AuthenticatedCustomerInfoProps {
  isAuthenticated: boolean;
  currentUser: { email: string } | null;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
}

function isValidPhone(phone: string) {
  // Accepts +61 4XX XXX XXX or +614XXXXXXXX or 04XXXXXXXX or 04XX XXX XXX
  const cleaned = phone.replace(/\s+/g, "");
  return (
    /^\+614\d{8}$/.test(cleaned) ||
    /^04\d{8}$/.test(cleaned) ||
    /^\+61 4\d{2} \d{3} \d{3}$/.test(phone) ||
    /^04\d{2} \d{3} \d{3}$/.test(phone)
  );
}

export function AuthenticatedCustomerInfo({
  isAuthenticated,
  currentUser,
  customerPhone,
  setCustomerPhone,
}: AuthenticatedCustomerInfoProps) {
  const [editing, setEditing] = useState(false);
  const valid = isValidPhone(customerPhone);

  // If isAuthenticated is undefined/null, show loading
  if (isAuthenticated === undefined || isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white mr-2"></span>
        <span className="text-gray-700 dark:text-gray-200">Loading...</span>
      </div>
    );
  }

  // If not authenticated, show nothing (or could show login form if desired)
  if (!isAuthenticated) return null;

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
      <div className="flex items-center gap-2 mb-4 text-blue-600">
        <Icon icon={FaCheckCircle} className="w-5 h-5" />
        <span>Signed in as {currentUser?.email}</span>
      </div>

      {/* Phone section */}
      {valid && !editing ? (
        <div className="mt-1 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-100 mb-1">
              Contact Phone Number
            </p>
            <span className="text-base font-semibold text-green-900 dark:text-green-100">{customerPhone}</span>
          </div>
          <button
            type="button"
            className="ml-4 px-3 py-1 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700 transition"
            onClick={() => setEditing(true)}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mt-1 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-100 mb-2">
            Please confirm a contact phone number so the store can reach you about
            your order.
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
          {!valid && customerPhone && (
            <p className="text-xs text-red-600 mt-2">Please enter a valid Australian mobile number.</p>
          )}
          {valid && (
            <button
              type="button"
              className="mt-3 px-3 py-1 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700 transition"
              onClick={() => setEditing(false)}
            >
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
