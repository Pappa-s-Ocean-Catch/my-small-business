import React from 'react';
import { Icon } from '@/components/Icon';
import { FaExclamationTriangle } from 'react-icons/fa';

interface DuplicateOrderModalProps {
  showDuplicateModal: boolean;
  duplicateOrder: any;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DuplicateOrderModal({
  showDuplicateModal,
  duplicateOrder,
  onCancel,
  onConfirm,
}: DuplicateOrderModalProps) {
  if (!showDuplicateModal || !duplicateOrder) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-md w-full p-6 border border-amber-400 dark:border-amber-700 animate-in fade-in">
        <div className="flex items-center gap-3 mb-4">
          <Icon
            icon={FaExclamationTriangle}
            className="w-6 h-6 text-amber-500"
          />
          <h2 className="text-lg font-bold text-amber-700 dark:text-amber-300">
            Possible Duplicate Order
          </h2>
        </div>
        <p className="mb-3 text-gray-700 dark:text-gray-200">
          You already have a live order with the same items and total price.
          Placing another order may result in duplicate orders.
        </p>
        <div className="mb-4 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">
              Order #{duplicateOrder.order_number}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(duplicateOrder.created_at).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Status:{" "}
            <span className="font-semibold">
              {duplicateOrder.order_status}
            </span>{" "}
            &bull; Total:{" "}
            <span className="font-semibold">
              ${duplicateOrder.total.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-neutral-600"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700"
            onClick={onConfirm}
          >
            Place Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
