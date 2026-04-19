import React from "react";
import { Icon } from "@/components/Icon";
import { FaGift } from "react-icons/fa";

interface OrderSummaryProps {
  paymentMethod: string | null;
  cartSubtotal: number;
  promotionDiscount: number;
  subtotal: number;
  rewardPointsDiscount: number;
  couponDiscount?: number;
  couponCode?: string | null;
  tax: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  rewardPointsSettings: { enabled: boolean };
  estimatedPointsEarned: number;
  estimatedPointsValue: number;
  isAuthenticated: boolean;
  itemCount: number;
}

export function OrderSummary({
  paymentMethod,
  cartSubtotal,
  promotionDiscount,
  subtotal,
  rewardPointsDiscount,
  couponDiscount = 0,
  couponCode,
  tax,
  deliveryFee,
  serviceFee,
  total,
  rewardPointsSettings,
  estimatedPointsEarned,
  estimatedPointsValue,
  isAuthenticated,
  itemCount,
}: OrderSummaryProps) {
  if (!paymentMethod) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Order Summary
      </h2>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Items</span>
          <span>{itemCount}</span>
        </div>
        {promotionDiscount > 0.009 && (
          <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
            <span>Promotions</span>
            <span>-${promotionDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {rewardPointsDiscount > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
            <span className="flex items-center gap-2">
              <Icon icon={FaGift} className="w-4 h-4" />
              Reward Points Discount
            </span>
            <span>-${rewardPointsDiscount.toFixed(2)}</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
            <span className="flex items-center gap-2">
              <Icon icon={FaGift} className="w-4 h-4" />
              Coupon ({couponCode})
            </span>
            <span>-${couponDiscount.toFixed(2)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Delivery Fee</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {serviceFee > 0 && (
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Service Fee</span>
            <span>${serviceFee.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 dark:border-neutral-700 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Total
            </span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
        {rewardPointsSettings.enabled && estimatedPointsEarned > 0 && (
          <div className="mt-2 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <Icon icon={FaGift} className="w-4 h-4 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">
                {isAuthenticated
                  ? `You will earn approximately ${estimatedPointsEarned.toLocaleString()} points for this order.`
                  : `Sign in or create an account to earn approximately ${estimatedPointsEarned.toLocaleString()} points for this order.`}
              </p>
              <p className="mt-1">
                This is worth about ${estimatedPointsValue.toFixed(2)} off a
                future order.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
