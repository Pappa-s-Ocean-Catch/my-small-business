'use client';

import { useState } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { OrderHeader } from '@/components/OrderHeader';
import { FaShoppingCart, FaArrowLeft, FaCheck, FaDollarSign, FaEdit, FaComment } from 'react-icons/fa';
import Link from 'next/link';

export default function OrderSummaryPage() {
  const { items, getTotal, clearCart, isLoading, updateItem } = useCart();
  const router = useRouter();
  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');

  const subtotal = getTotal();
  // Placeholder for future fees
  const deliveryFee = 0;
  const serviceFee = 0;
  const tax = 0;
  const total = subtotal + deliveryFee + serviceFee + tax;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading cart...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <FaShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add some items to your cart to continue
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      {/* Navigation Header */}
      <OrderHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            href="/order"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Menu
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FaShoppingCart className="text-blue-600" />
            Order Summary
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700 last:border-0 last:pb-0"
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Quantity: {item.quantity}
                          </p>
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Add-ons */}
                      {item.addon_groups.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.addon_groups.map(group => (
                            group.selected_items.length > 0 && (
                              <div key={group.id} className="text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {group.name}:
                                </span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                  {group.selected_items.map(addon => addon.name).join(', ')}
                                </span>
                                {group.selected_items.some(addon => addon.extra_price > 0) && (
                                  <span className="text-gray-500 dark:text-gray-500 ml-2">
                                    (+${group.selected_items.reduce((sum, addon) => sum + addon.extra_price, 0).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {/* Comment */}
                      {editingCommentItemId === item.id ? (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Special Instructions
                          </label>
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={2}
                            maxLength={500}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                            placeholder="Add special instructions..."
                            autoFocus
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => {
                                updateItem(item.id, { comment: commentText.trim() || null });
                                setEditingCommentItemId(null);
                                setCommentText('');
                              }}
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingCommentItemId(null);
                                setCommentText('');
                              }}
                              className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {item.comment ? (
                            <div className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-neutral-700 rounded-lg">
                              <FaComment className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.comment}</p>
                              <button
                                onClick={() => {
                                  setEditingCommentItemId(item.id);
                                  setCommentText(item.comment || '');
                                }}
                                className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-neutral-600 transition-colors"
                                aria-label="Edit comment"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCommentItemId(item.id);
                                setCommentText('');
                              }}
                              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2"
                            >
                              <FaComment className="w-4 h-4" />
                              Add special instructions
                            </button>
                          )}
                        </div>
                      )}

                      {/* Price Breakdown */}
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        ${item.base_price.toFixed(2)} × {item.quantity}
                        {item.addon_groups.reduce((sum, group) => 
                          sum + group.selected_items.reduce((itemSum, addon) => itemSum + addon.extra_price, 0), 0
                        ) > 0 && (
                          <span>
                            {' '}+ ${item.addon_groups.reduce((sum, group) => 
                              sum + group.selected_items.reduce((itemSum, addon) => itemSum + addon.extra_price, 0), 0
                            ).toFixed(2)} (add-ons)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Order Summary
              </h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
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
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Placeholder for payment integration
                    alert('Payment integration will be implemented later');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FaDollarSign className="w-4 h-4" />
                  Proceed to Payment
                </button>
                <Link
                  href="/order"
                  className="block w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
                <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <FaCheck className="w-4 h-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Secure Checkout</p>
                    <p className="text-xs">Your payment information is secure and encrypted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
