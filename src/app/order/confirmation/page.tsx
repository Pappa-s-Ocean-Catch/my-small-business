'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { OrderHeader } from '@/components/OrderHeader';
import { getOrder, getOrderByNumber } from '@/app/actions/orders';
import { FaCheckCircle, FaPrint, FaArrowLeft, FaShoppingBag } from 'react-icons/fa';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/Loading';
import type { Order } from '@/app/actions/orders';

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('order');
  const orderId = searchParams.get('order_id');
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // If we have session_id and order_id from Stripe redirect, verify payment first
        if (sessionId && orderId) {
          try {
            // Verify the Stripe checkout session and update order status if payment succeeded
            const verifyResponse = await fetch('/api/payments/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, orderId })
            });

            const verifyData = await verifyResponse.json();
            if (verifyData.success && verifyData.paymentStatus === 'paid') {
              console.log('[Confirmation] Payment verified, order updated to paid');
            }
          } catch (verifyError) {
            console.error('[Confirmation] Error verifying session:', verifyError);
            // Continue to load order even if verification fails
          }
        }

        // If we have order_id from Stripe redirect, use that
        if (orderId) {
          const result = await getOrder(orderId);
          if (result.error || !result.data) {
            setError(result.error || 'Order not found');
            setLoading(false);
            return;
          }
          setOrder(result.data);
          setLoading(false);
          return;
        }

        // Otherwise, try to get by order number
        if (orderNumber) {
          const result = await getOrderByNumber(orderNumber);
          if (result.error || !result.data) {
            setError(result.error || 'Order not found');
            setLoading(false);
            return;
          }
          setOrder(result.data);
          setLoading(false);
          return;
        }

        // If we have session_id but no order_id, we might need to wait for webhook
        // For now, show an error
        if (sessionId) {
          setError('Order is being processed. Please check back in a moment.');
          setLoading(false);
          return;
        }

        setError('Order number or ID not provided');
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber, orderId, sessionId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error || 'Order not found'}
          </h2>
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
      <OrderHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <FaCheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your order has been received and is being processed
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                Order Number
              </h2>
              <p className="text-2xl font-bold text-blue-600">{order.order_number}</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              <FaPrint className="w-4 h-4" />
              Print
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Customer Information
              </h3>
              <p className="text-gray-900 dark:text-white">{order.customer_name || 'N/A'}</p>
              <p className="text-gray-600 dark:text-gray-400">{order.customer_email}</p>
              <p className="text-gray-600 dark:text-gray-400">{order.customer_phone}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Order Details
              </h3>
              <p className="text-gray-900 dark:text-white">
                Payment Method: <span className="capitalize">{order.payment_method}</span>
              </p>
              <p className="text-gray-900 dark:text-white">
                Payment Status:{' '}
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    order.payment_status === 'paid'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : order.payment_status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : order.payment_status === 'refunded'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {order.payment_status === 'paid' ? '✓ Paid' : order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                </span>
              </p>
              <p className="text-gray-900 dark:text-white">
                Order Status:{' '}
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    order.order_status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : order.order_status === 'cancelled'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : order.order_status === 'ready'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                </span>
              </p>
              <p className="text-gray-900 dark:text-white">
                Date: {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {order.special_instructions && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Special Instructions
              </h3>
              <p className="text-gray-900 dark:text-white">{order.special_instructions}</p>
            </div>
          )}

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Order Items
              </h3>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700 last:border-0 last:pb-0"
                  >
                    {item.product_image_url && (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {item.product_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Quantity: {item.quantity} × ${item.base_price.toFixed(2)}
                      </p>
                      {item.comment && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                          Note: {item.comment}
                        </p>
                      )}
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-2">
                        ${item.subtotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Total */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-gray-900 dark:text-white">${order.subtotal.toFixed(2)}</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-white">${order.tax.toFixed(2)}</span>
              </div>
            )}
            {order.delivery_fee > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                <span className="text-gray-900 dark:text-white">${order.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            {order.service_fee > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">Service Fee</span>
                <span className="text-gray-900 dark:text-white">${order.service_fee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-neutral-700">
              <span className="text-xl font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${order.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            What's Next?
          </h3>
          {order.payment_method === 'online' ? (
            order.payment_status === 'paid' ? (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your payment has been successfully processed. We'll notify you when your order is ready for pickup.
              </p>
            ) : order.payment_status === 'failed' ? (
              <p className="text-sm text-red-800 dark:text-red-200">
                Your payment could not be processed. Please contact us or try placing your order again.
              </p>
            ) : (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your payment is being processed. You'll receive a confirmation email shortly.
              </p>
            )
          ) : (
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Please pay for your order when you pick it up at the store. We'll notify you when your order is ready.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/order"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <FaShoppingBag className="w-4 h-4" />
            Place Another Order
          </Link>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
