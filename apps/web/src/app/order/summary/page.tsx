'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { OrderHeader } from '@/components/OrderHeader';
import { OrderTypeSelector, type OrderType } from '@/components/OrderTypeSelector';
import { DeliveryAddressForm, type DeliveryAddressInput } from '@/components/DeliveryAddressForm';
import { getFeatureFlags } from '@/app/actions/feature-flags';
import { getActivePromotions } from '@/app/actions/promotions';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { FaShoppingCart, FaArrowLeft, FaCheck, FaDollarSign, FaEdit, FaComment, FaTruck, FaClock, FaSpinner } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Link from 'next/link';
import { computeCartPromotionTotals, type PromotionWithProducts } from '@/lib/promotions';

export default function OrderSummaryPage() {
  const { items, getTotal, clearCart, isLoading, updateItem } = useCart();
  const router = useRouter();
  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');

  // Order type and delivery state
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [enableDelivery, setEnableDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressInput | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<{
    quote_id: string;
    fee: number;
    currency: string;
    expires_at: string;
    estimated_duration_minutes: number;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);

  useEffect(() => {
    const loadPromotions = async () => {
      const res = await getActivePromotions();
      if (res.data) setActivePromotions(res.data);
    };
    void loadPromotions();
  }, []);

  const cartSubtotal = getTotal();
  const promoTotals = computeCartPromotionTotals({
    promotions: activePromotions,
    items: items.map((i) => ({
      product_id: i.product_id,
      base_price: i.base_price,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
    cartSubtotal,
  });

  const subtotal = promoTotals.subtotalAfterPromotions;
  const promotionDiscount = promoTotals.totalDiscount;
  const deliveryFee = deliveryQuote?.fee || 0;
  const serviceFee = 0;
  const tax = 0;
  const total = subtotal + deliveryFee + serviceFee + tax;

  // Check feature flags and auth status
  useEffect(() => {
    const checkFlags = async () => {
      try {
        const flags = await getFeatureFlags();
        setEnableDelivery(flags.enable_online_delivery);

        // Check if user is authenticated
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Error checking feature flags:', error);
      }
    };
    void checkFlags();
  }, []);

  // Get delivery quote when address is provided
  useEffect(() => {
    if (orderType === 'delivery' && deliveryAddress && !deliveryQuote) {
      getDeliveryQuote();
    }
  }, [orderType, deliveryAddress]);

  const getDeliveryQuote = async () => {
    if (!deliveryAddress) return;

    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const response = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_address: {
            address_line1: process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || '123 Main Street',
            city: process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
            state: process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
            postcode: process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
            country: 'AU',
          },
          dropoff_address: deliveryAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get delivery quote');
      }

      setDeliveryQuote(data.data);
    } catch (error) {
      console.error('Error getting delivery quote:', error);
      setQuoteError(error instanceof Error ? error.message : 'Failed to get delivery quote');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleOrderTypeSelect = (type: OrderType) => {
    setOrderType(type);
    if (type === 'pickup') {
      setDeliveryAddress(null);
      setDeliveryQuote(null);
      setQuoteError(null);
    }
  };

  const handleAddressSelect = (address: DeliveryAddressInput) => {
    setDeliveryAddress(address);
    setDeliveryQuote(null); // Reset quote to get new one
    setQuoteError(null);
  };

  const handleProceedToCheckout = () => {
    // Store order type and delivery info in sessionStorage to pass to checkout
    if (orderType === 'delivery' && deliveryAddress && deliveryQuote) {
      sessionStorage.setItem('orderType', 'delivery');
      sessionStorage.setItem('deliveryAddress', JSON.stringify(deliveryAddress));
      sessionStorage.setItem('deliveryQuote', JSON.stringify(deliveryQuote));
    } else if (orderType === 'pickup') {
      sessionStorage.setItem('orderType', 'pickup');
      sessionStorage.removeItem('deliveryAddress');
      sessionStorage.removeItem('deliveryQuote');
    }

    router.push('/order/checkout');
  };

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
          <Icon icon={FaShoppingCart} className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
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
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
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
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
            Back to Menu
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Icon icon={FaShoppingCart} className="text-blue-600" />
            Order Summary
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Order Type Selection */}
            {!orderType && (
              <OrderTypeSelector
                onSelect={handleOrderTypeSelect}
                selectedType={orderType}
                enableDelivery={enableDelivery}
              />
            )}

            {/* Delivery Address Form */}
            {orderType === 'delivery' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Icon icon={FaTruck} className="w-5 h-5 text-green-600" />
                  Delivery Address
                </h2>
                <DeliveryAddressForm
                  onAddressSelect={handleAddressSelect}
                  allowSave={isAuthenticated}
                  isAuthenticated={isAuthenticated}
                />

                {/* Delivery Quote Display */}
                {loadingQuote && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-3">
                    <Icon icon={FaSpinner} className="w-5 h-5 text-blue-600 animate-spin" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">Getting delivery quote...</span>
                  </div>
                )}

                {quoteError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{quoteError}</p>
                    <button
                      onClick={getDeliveryQuote}
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {deliveryQuote && !loadingQuote && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Icon icon={FaTruck} className="w-4 h-4 text-green-600" />
                          Delivery Quote
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Estimated delivery time
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          ${deliveryQuote.fee.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {deliveryQuote.currency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                      <Icon icon={FaClock} className="w-4 h-4 text-green-600" />
                      <span>Estimated delivery: {deliveryQuote.estimated_duration_minutes} minutes</span>
                    </div>
                    <button
                      onClick={() => {
                        setDeliveryQuote(null);
                        getDeliveryQuote();
                      }}
                      className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
                    >
                      Refresh quote
                    </button>
                  </div>
                )}

                {/* Change order type */}
                <button
                  onClick={() => {
                    setOrderType(null);
                    setDeliveryAddress(null);
                    setDeliveryQuote(null);
                    setQuoteError(null);
                  }}
                  className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Change to pickup order
                </button>
              </div>
            )}

            {/* Pickup Order Confirmation */}
            {orderType === 'pickup' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Icon icon={FaCheck} className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Pickup Order Selected
                  </h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your order will be ready for pickup at the store. We'll notify you when it's ready.
                </p>
                <button
                  onClick={() => setOrderType(null)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Change to delivery order
                </button>
              </div>
            )}
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
                              <Icon icon={FaComment} className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.comment}</p>
                              <button
                                onClick={() => {
                                  setEditingCommentItemId(item.id);
                                  setCommentText(item.comment || '');
                                }}
                                className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-neutral-600 transition-colors"
                                aria-label="Edit comment"
                              >
                                <Icon icon={FaEdit} className="w-4 h-4" />
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
                              <Icon icon={FaComment} className="w-4 h-4" />
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
                  <span>Items</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {promotionDiscount > 0.009 && (
                  <div className="flex justify-between text-green-700 dark:text-green-300">
                    <span>Promotions</span>
                    <span>-${promotionDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {orderType === 'delivery' && deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-2">
                      <Icon icon={FaTruck} className="w-4 h-4" />
                      Delivery Fee
                    </span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {orderType === 'delivery' && deliveryQuote && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 pl-6">
                    Estimated {deliveryQuote.estimated_duration_minutes} min delivery
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
                  onClick={handleProceedToCheckout}
                  disabled={!orderType || (orderType === 'delivery' && (!deliveryAddress || !deliveryQuote))}
                  className="block w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Icon icon={FaDollarSign} className="w-4 h-4" />
                  {!orderType ? 'Select Order Type First' : orderType === 'delivery' && (!deliveryAddress || !deliveryQuote) ? 'Complete Delivery Info' : 'Checkout'}
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
                  <Icon icon={FaCheck} className="w-4 h-4 text-green-600 mt-0.5" />
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
