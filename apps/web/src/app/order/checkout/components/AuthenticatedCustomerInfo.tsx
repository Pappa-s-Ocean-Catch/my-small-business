import React from "react";
import { Icon } from "@/components/Icon";
import { FaCheckCircle, FaUser } from "react-icons/fa";


interface AuthenticatedCustomerInfoProps {
  isAuthenticated: boolean;
  currentUser: { email: string } | null;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
}

export function AuthenticatedCustomerInfo({
  isAuthenticated,
  currentUser,
  customerPhone,
  setCustomerPhone,
}: AuthenticatedCustomerInfoProps) {

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
      </div>
    </div>
  );
}
