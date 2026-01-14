'use client';

import { useState } from 'react';
import { FaStore, FaTruck, FaArrowRight } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
export type OrderType = 'pickup' | 'delivery';

interface OrderTypeSelectorProps {
  onSelect: (type: OrderType) => void;
  selectedType?: OrderType | null;
  enableDelivery?: boolean;
}

export function OrderTypeSelector({ onSelect, selectedType, enableDelivery = true }: OrderTypeSelectorProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Choose Order Type
      </h2>
      <div className={`grid gap-4 ${enableDelivery ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          onClick={() => onSelect('pickup')}
          className={`p-6 border-2 rounded-lg transition-all text-left ${
            selectedType === 'pickup'
              ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-neutral-700 hover:border-blue-600 dark:hover:border-blue-500'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <Icon icon={FaStore} className={`w-8 h-8 ${selectedType === 'pickup' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Pickup Order
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Order online and pick up at the store. Fast and convenient.
          </p>
          {selectedType === 'pickup' && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
              <span>Selected</span>
              <Icon icon={FaArrowRight} className="w-4 h-4" />
            </div>
          )}
        </button>

        {enableDelivery && (
          <button
            type="button"
            onClick={() => onSelect('delivery')}
            className={`p-6 border-2 rounded-lg transition-all text-left ${
              selectedType === 'delivery'
                ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-neutral-700 hover:border-green-600 dark:hover:border-green-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Icon icon={FaTruck} className={`w-8 h-8 ${selectedType === 'delivery' ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`} />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Online Delivery
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Get your order delivered to your door. Fast and reliable delivery service.
            </p>
            {selectedType === 'delivery' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                <span>Selected</span>
                <Icon icon={FaArrowRight} className="w-4 h-4" />
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
