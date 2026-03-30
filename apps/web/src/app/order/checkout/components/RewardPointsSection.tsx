import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { FaGift, FaChevronDown, FaChevronUp } from "react-icons/fa";

interface RewardPointsSectionProps {
  paymentMethod: string | null;
  isAuthenticated: boolean;
  userRewardPoints: { current_balance: number } | null;
  rewardPointsSettings: { enabled: boolean; dollars_per_point: number };
  useRewardPoints: boolean;
  setUseRewardPoints: (val: boolean) => void;
  rewardPointsToUse: number;
  setRewardPointsToUse: (val: number) => void;
  maxPointsToUse: number;
  maxPointsForOrder: number;
}

export function RewardPointsSection({
  paymentMethod,
  isAuthenticated,
  userRewardPoints,
  rewardPointsSettings,
  useRewardPoints,
  setUseRewardPoints,
  rewardPointsToUse,
  setRewardPointsToUse,
  maxPointsToUse,
  maxPointsForOrder,
}: RewardPointsSectionProps) {
  const [showRewardPointsSection, setShowRewardPointsSection] = useState(false);

  // Only allow reward points for online payment method
  if (
    !(
      paymentMethod === "online" &&
      isAuthenticated &&
      userRewardPoints &&
      userRewardPoints.current_balance > 0 &&
      rewardPointsSettings.enabled
    )
  ) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setShowRewardPointsSection(!showRewardPointsSection)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon icon={FaGift} className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Use Reward Points
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({userRewardPoints.current_balance.toLocaleString()} pts = $
            {(
              userRewardPoints.current_balance *
              rewardPointsSettings.dollars_per_point
            ).toFixed(2)}
            )
          </span>
        </div>
        {showRewardPointsSection ? (
          <Icon icon={FaChevronUp} className="w-4 h-4 text-gray-400" />
        ) : (
          <Icon icon={FaChevronDown} className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {showRewardPointsSection && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-neutral-700 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRewardPoints}
                onChange={(e) => {
                  setUseRewardPoints(e.target.checked);
                  if (!e.target.checked) {
                    setRewardPointsToUse(0);
                  } else {
                    setRewardPointsToUse(
                      Math.min(maxPointsToUse, maxPointsForOrder),
                    );
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Apply points discount
              </span>
            </label>
          </div>

          {useRewardPoints && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={maxPointsToUse}
                  step="1"
                  value={rewardPointsToUse}
                  onChange={(e) => {
                    const value = Math.min(
                      Math.max(0, parseInt(e.target.value) || 0),
                      maxPointsToUse,
                    );
                    setRewardPointsToUse(value);
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => setRewardPointsToUse(maxPointsToUse)}
                  className="px-3 py-2 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  Use All
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Discount: $
                {(
                  rewardPointsToUse * rewardPointsSettings.dollars_per_point
                ).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
