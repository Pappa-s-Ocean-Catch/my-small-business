
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { FaCreditCard, FaStore } from "react-icons/fa";
import { LoadingSpinner } from "@/components/Loading";

type PaymentMethod = "online" | "store";

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod | null;
  featureFlagsLoaded: boolean;
  featureFlags: {
    enable_online_payment: boolean;
    enable_instore_payment: boolean;
  };
  orderType: "pickup" | "delivery" | null;
  onSelect: (method: PaymentMethod) => void;
}
export function PaymentMethodSelector({
  paymentMethod,
  featureFlagsLoaded,
  featureFlags,
  orderType,
  onSelect,
}: PaymentMethodSelectorProps) {
  const [showSelector, setShowSelector] = useState(!paymentMethod);

  if (!featureFlagsLoaded) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Payment Method
        </h2>
        <div className="flex items-center gap-3 py-8 justify-center text-gray-600 dark:text-gray-400">
          <LoadingSpinner size="md" />
          <span className="text-sm">Loading payment options…</span>
        </div>
      </div>
    );
  }

  if (paymentMethod && !showSelector) {
    // Compact summary view
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            icon={paymentMethod === "online" ? FaCreditCard : FaStore}
            className={paymentMethod === "online" ? "w-6 h-6 text-blue-600" : "w-6 h-6 text-green-600"}
          />
          <span className="font-medium text-gray-900 dark:text-white">
            {paymentMethod === "online" ? "Pay Online" : "Pay at Store"}
          </span>
        </div>
        <button
          type="button"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          onClick={() => setShowSelector(true)}
        >
          Change
        </button>
      </div>
    );
  }

  // Expanded selector view
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Select Payment Method
      </h2>
      {orderType === "delivery" ? (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Delivery orders must be paid online for security and tracking purposes.
          </p>
        </div>
      ) : null}
      <div
        className={`grid gap-4 ${orderType === "delivery" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}
      >
        <button
          type="button"
          disabled={!featureFlags.enable_online_payment}
          onClick={() => {
            if (featureFlags.enable_online_payment) {
              onSelect("online");
              setShowSelector(false);
            }
          }}
          className={`p-6 border-2 rounded-lg transition-colors text-left ${paymentMethod === "online"
            ? "border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : !featureFlags.enable_online_payment
              ? "border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 opacity-75 cursor-not-allowed"
              : "border-gray-200 dark:border-neutral-700 hover:border-blue-600 dark:hover:border-blue-500"
            }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Icon
              icon={FaCreditCard}
              className={`w-8 h-8 ${!featureFlags.enable_online_payment ? "text-gray-400 dark:text-gray-500" : paymentMethod === "online" ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`}
            />
            {paymentMethod === "online" && (
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">Selected</span>
            )}
            {!featureFlags.enable_online_payment && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                Currently unavailable
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Pay Online
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Pay securely online. All payment will be handled by secured payment gateway.
          </p>
        </button>
        {orderType !== "delivery" && (
          <button
            type="button"
            disabled={!featureFlags.enable_instore_payment}
            onClick={() => {
              if (featureFlags.enable_instore_payment) {
                onSelect("store");
                setShowSelector(false);
              }
            }}
            className={`p-6 border-2 rounded-lg transition-colors text-left ${paymentMethod === "store"
              ? "border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20"
              : !featureFlags.enable_instore_payment
                ? "border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 opacity-75 cursor-not-allowed"
                : "border-gray-200 dark:border-neutral-700 hover:border-green-600 dark:hover:border-green-500"
              }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon
                icon={FaStore}
                className={`w-8 h-8 ${!featureFlags.enable_instore_payment ? "text-gray-400 dark:text-gray-500" : paymentMethod === "store" ? "text-green-600" : "text-gray-600 dark:text-gray-400"}`}
              />
              {paymentMethod === "store" && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">Selected</span>
              )}
              {!featureFlags.enable_instore_payment && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                  Currently unavailable
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Pay at Store
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pay when you pick up your order at our store.
            </p>
          </button>
        )}
        {orderType === "delivery" && (
          <div className="p-6 border-2 border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 rounded-lg opacity-75 cursor-not-allowed">
            <div className="flex items-center gap-2 mb-3">
              <Icon
                icon={FaStore}
                className="w-8 h-8 text-gray-400 dark:text-gray-500"
              />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                Not available for delivery
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Pay at Store
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pay when you pick up your order. Only available for pickup orders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
