import React from 'react';
import { Icon } from '@/components/Icon';
import { FaExclamationTriangle } from 'react-icons/fa';
import Link from 'next/link';

interface DuplicateOrderWarningProps {
  possibleDuplicate: any;
  duplicateConfirmed: boolean;
  setDuplicateConfirmed: (val: boolean) => void;
}

export function DuplicateOrderWarning({
  possibleDuplicate,
  duplicateConfirmed,
  setDuplicateConfirmed,
}: DuplicateOrderWarningProps) {
  if (!possibleDuplicate || duplicateConfirmed) return null;

  return (
    <div className="mb-4 p-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3 animate-in fade-in">
      <Icon
        icon={FaExclamationTriangle}
        className="w-5 h-5 text-amber-500 mt-0.5"
      />
      <div className="flex-1">
        <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1">
          Possible Duplicate Order
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-200 mb-3">
          You already have a live order with the same items and total
          price ( Order{" "}
          <Link
            href={`/order/confirmation?order=${possibleDuplicate.order_number}`}
            className="text-blue-600 underline hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            #{possibleDuplicate.order_number}
          </Link>
          , placed{" "}
          {new Date(possibleDuplicate.created_at).toLocaleString()}
          ).
          <br />
          Placing another order may result in duplicate orders.
        </div>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700"
            onClick={() => setDuplicateConfirmed(true)}
          >
            Yes, I want to place order
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 border border-gray-300"
            onClick={() => (window.location.href = "/order")}
          >
            No, I will change it
          </button>
        </div>
      </div>
    </div>
  );
}
