'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Modal from '@/components/Modal';
import { ImageUpload } from '@/components/ImageUpload';
import { likeItem, getOrderReviews } from '@/app/actions/social-activity';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OrderHeader } from '@/components/OrderHeader';
import { getOrder, getOrderByNumber } from '@/app/actions/orders';
import { getOrderRewardPoints, type OrderRewardPointsSummary } from '@/app/actions/reward-points';
import { useCart } from '@/contexts/CartContext';
import { FaCheckCircle, FaPrint, FaArrowLeft, FaShoppingBag, FaGift, FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/Loading';
import type { Order, OrderItemAddon } from '@my-small-business/types';
import posthog from 'posthog-js';

// Simple toast component
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  return (
    <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded shadow-lg text-white ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
      role="alert">
      <span>{message}</span>
      <button className="ml-4 text-white/80 hover:text-white" onClick={onClose}>&times;</button>
    </div>
  );
}

function OrderConfirmationContent() {
  // Order and routing state (must be above all code that uses them)
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const orderNumber = searchParams.get('order');
  const orderId = searchParams.get('order_id');
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewardSummary, setRewardSummary] = useState<OrderRewardPointsSummary | null>(null);
  const clearedCartRef = useRef(false);
  // --- Move all useState declarations to the top ---
  const { user } = useAuth();

  // Order review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  // Toast state
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };
  // Existing review state
  const [existingReview, setExistingReview] = useState<any | null>(null);
  // Like/dislike state for order items
  const [itemLikes, setItemLikes] = useState<Record<string, boolean | null>>({});
  // Populate like/dislike state for all order items
  useEffect(() => {
    const fetchItemLikes = async () => {
      if (!order || !user?.id || !Array.isArray(order.items) || order.items.length === 0) return;
      const itemIds = order.items.map((item: any) => item.product_id).join(',');
      try {
        const response = await fetch(`/api/social-activity/getItemLikes?userId=${user.id}&itemIds=${itemIds}`);
        const result = await response.json();
        if (response.ok && result.itemLikes) {
          setItemLikes(result.itemLikes);
        } else {
          setItemLikes({});
        }
      } catch (err) {
        setItemLikes({});
      }
    };
    fetchItemLikes();
  }, [order, user]);

  // --- Functions and hooks follow ---
  const handleLikeItem = async (itemId: string, isLike: boolean) => {
    if (!user?.id) {
      console.warn('[OrderConfirmation] Like/dislike: No user ID');
      return;
    }
    setItemLikes(prev => ({ ...prev, [itemId]: isLike }));
    try {
      console.debug('[OrderConfirmation] Like/dislike API call', { userId: user.id, itemId, isLike });
      const response = await fetch('/api/social-activity/likeItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId, isLike })
      });
      const result = await response.json();
      if (!response.ok) {
        console.error('[OrderConfirmation] Like/dislike API error', result.error);
      } else {
        console.debug('[OrderConfirmation] Like/dislike API success', result);
      }
    } catch (err) {
      console.error('[OrderConfirmation] Like/dislike fetch error', err);
    }
  };

  const handleSubmitOrderReview = async () => {
    if (!order || !reviewRating || !user?.id) {
      showToast('Missing order, rating, or user ID', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const response = await fetch('/api/social-activity/addOrderReview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          orderId: order.id,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const result = await response.json();
      if (!response.ok) {
        showToast(result.error || 'Failed to submit review', 'error');
        setSubmittingReview(false);
        return;
      }
      showToast(existingReview ? 'Review updated!' : 'Review submitted!', 'success');
      setSubmittingReview(false);
      setReviewModalOpen(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewPhoto(null);
      setItemLikes({});
      // Refresh review state, but do not show error toast if it fails
      try {
        const { reviews } = await getOrderReviews(order.id);
        const myReview = Array.isArray(reviews) ? reviews.find((r: any) => r.user_id === user.id) : null;
        setExistingReview(myReview || null);
      } catch (refreshErr) {
        console.error('[OrderConfirmation] Failed to refresh review after submit', refreshErr);
      }
    } catch (err) {
      setSubmittingReview(false);
      showToast('Failed to submit review', 'error');
    }
  };
  // Fetch existing review for this user/order
  useEffect(() => {
    const fetchReview = async () => {
      if (!order || !user?.id) {
        console.debug('[OrderConfirmation] Skipping fetchReview: missing order or user', { order, user });
        return;
      }
      try {
        console.debug('[OrderConfirmation] Fetching order reviews for order', order.id);
        const response = await fetch(`/api/social-activity/getOrderReviews?orderId=${order.id}`);
        const result = await response.json();
        if (!response.ok) {
          console.error('[OrderConfirmation] getOrderReviews API error', result.error);
          setExistingReview(null);
          return;
        }
        const { reviews } = result;
        const myReview = Array.isArray(reviews) ? reviews.find((r: any) => r.user_id === user.id) : null;
        console.debug('[OrderConfirmation] Found myReview', myReview);
        setExistingReview(myReview || null);
      } catch (err) {
        console.error('[OrderConfirmation] Error fetching review', err);
        setExistingReview(null);
      }
    };
    fetchReview();
  }, [order, user]);

  // Pre-fill modal with existing review if editing
  const openReviewModal = () => {
    setReviewModalOpen(true);
  };

  // Sync modal fields with latest review when modal opens or review changes
  useEffect(() => {
    if (reviewModalOpen) {
      if (existingReview) {
        setReviewRating(existingReview.rating);
        setReviewComment(existingReview.comment);
      } else {
        setReviewRating(0);
        setReviewComment('');
      }
    }
  }, [reviewModalOpen, existingReview]);

  const promotionsApplied = Array.isArray((order as any)?.promotions_applied)
    ? ((order as any).promotions_applied as any[])
    : [];

  const promotionDiscount = typeof (order as any)?.promotion_discount === 'number'
    ? ((order as any).promotion_discount as number)
    : Number((order as any)?.promotion_discount ?? 0) || 0;

  const aggregatedPromotions = (() => {
    const byKey = new Map<string, { title: string; amount: number }>();
    for (const p of promotionsApplied) {
      if (!p) continue;
      const id = p.id != null ? String(p.id) : '';
      const title = p.title != null ? String(p.title) : 'Promotion';
      const amount = Number(p.amount ?? 0) || 0;
      if (amount <= 0) continue;
      const key = id || title;
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, { title: prev.title, amount: prev.amount + amount });
      } else {
        byKey.set(key, { title, amount });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.amount - a.amount);
  })();

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

        // Helper to check order ownership
        const checkOrderOwnership = (orderData: any) => {
          //
          // Only check if both user and orderData.user_id are loaded
          if (!user?.id || !orderData?.user_id) {
            // Don't set error, just wait for both to be loaded
            return false;
          }
          if (user.id !== orderData.user_id) {
            setError('You do not have permission to view this order. (User mismatch)');
            setOrder(null);
            setLoading(false);
            return false;
          }
          return true;
        };

        // If we have order_id from Stripe redirect, use that
        if (orderId) {
          const result = await getOrder(orderId);
          if (result.error || !result.data) {
            setError(result.error || 'Order not found');
            setLoading(false);
            return;
          }
          if (!checkOrderOwnership(result.data)) return;
          posthog.capture('order_confirmed', {
            order_id: result.data.id,
            order_number: result.data.order_number,
            payment_method: result.data.payment_method,
            total: result.data.total,
          });
          setOrder(result.data);

          // Load reward points earned for this order (concrete value at order time)
          const rewards = await getOrderRewardPoints(orderId);
          if (rewards.data) {
            setRewardSummary(rewards.data);
          }

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
          if (!checkOrderOwnership(result.data)) return;
          posthog.capture('order_confirmed', {
            order_id: result.data.id,
            order_number: result.data.order_number,
            payment_method: result.data.payment_method,
            total: result.data.total,
          });
          setOrder(result.data);

          const rewards = await getOrderRewardPoints(result.data.id);
          if (rewards.data) {
            setRewardSummary(rewards.data);
          }

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
  }, [orderNumber, orderId, sessionId, user]);

  // Auto-refresh open orders every 10s to keep status live
  useEffect(() => {
    if (!order) return;
    if (order.order_status === 'completed' || order.order_status === 'cancelled') return;

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await getOrder(order.id);
        if (cancelled) return;
        if (result.data) {
          setOrder(result.data);
        }
      } catch (err) {
        console.error('[Confirmation] Polling error:', err);
      }
    };

    const id = window.setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [order]);

  // Clear cart once we have a confirmed order (so shopping cart empties after success)
  useEffect(() => {
    if (order && !clearedCartRef.current) {
      // Consider the order placed if it exists; for online we clear after confirmation
      clearCart();
      clearedCartRef.current = true;
    }
  }, [order, clearCart]);

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
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const statusSteps: { id: Order['order_status']; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Accepted' },
    { id: 'preparing', label: 'Cooking' },
    { id: 'ready', label: 'Ready' },
    { id: 'completed', label: 'Collected' },
  ];

  const currentStepIndex = statusSteps.findIndex((s) => s.id === order.order_status);

  const totalItems =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items.reduce((sum, item) => sum + item.quantity, 0)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <OrderHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-8">
        {/* Success Header */}
        <div className="text-center mb-2 md:mb-8">
          <Icon icon={FaCheckCircle} className="w-20 h-20 text-green-600 mx-auto mb-2 md:mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your order has been received and is being processed
          </p>
        </div>

        {/* Order Review Modal */}
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={existingReview ? 'Update Your Review' : 'Review Your Order'}
          size="md"
          bodyClassName="p-6"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Your Rating:</span>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="focus:outline-none"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <svg className={`w-6 h-6 ${reviewRating >= star ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
                </button>
              ))}
            </div>
            <textarea
              className="w-full border rounded p-2"
              rows={3}
              placeholder="Write your review..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
            />
            <div>
              <span className="font-semibold">Photo (optional):</span>
              <ImageUpload
                type="product"
                currentImageUrl={reviewPhoto ?? undefined}
                onImageChange={setReviewPhoto}
                className="mt-2"
              />
            </div>
            {/* List of products in the order for like/dislike */}
            {order && Array.isArray(order.items) && order.items.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Rate Items in Your Order</h4>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
                      {item.product_image_url && (
                        <img src={item.product_image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{item.product_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Qty: {item.quantity}</div>
                      </div>
                      <button
                        className={`flex items-center gap-1 px-2 py-1 rounded ${itemLikes[item.product_id] === true ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-100'}`}
                        onClick={() => handleLikeItem(item.product_id, true)}
                        type="button"
                        aria-label="Like"
                      >
                        <FaThumbsUp />
                      </button>
                      <button
                        className={`flex items-center gap-1 px-2 py-1 rounded ${itemLikes[item.product_id] === false ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-100'}`}
                        onClick={() => handleLikeItem(item.product_id, false)}
                        type="button"
                        aria-label="Dislike"
                      >
                        <FaThumbsDown />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-gray-100"
                onClick={() => setReviewModalOpen(false)}
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={handleSubmitOrderReview} disabled={submittingReview || !reviewRating}>
                {submittingReview ? (existingReview ? 'Updating...' : 'Submitting...') : (existingReview ? 'Update Review' : 'Submit Review')}
              </button>
            </div>
          </div>
        </Modal>
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
              <Icon icon={FaPrint} className="w-4 h-4" />
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
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${order.payment_status === 'paid'
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
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${order.order_status === 'completed'
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

          {/* Live Status Tracker */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Order Progress
            </h3>
            <div className="flex items-center justify-between gap-2">
              {statusSteps.map((step, index) => {
                const isDone = currentStepIndex > index;
                const isCurrent = currentStepIndex === index;
                const isFuture = currentStepIndex < index;
                const baseCircle =
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold';
                const circleClass = isDone
                  ? 'bg-green-600 text-white'
                  : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300';

                return (
                  <div key={step.id} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                      {index > 0 && (
                        <div
                          className={`flex-1 h-1 ${isDone ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                        />
                      )}
                      <div className={`${baseCircle} ${circleClass}`}>
                        {index + 1}
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700" />
                      )}
                    </div>
                    <div className="mt-2 text-xs text-center text-gray-700 dark:text-gray-200">
                      {step.label}
                    </div>
                    {!isFuture && (
                      <div className="sr-only">
                        {isCurrent ? 'Current step' : 'Completed step'}
                      </div>
                    )}
                  </div>
                );
              })}
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 mt-4">
                Order Items
              </h3>
              <div className="space-y-4">
                {order.items.map((item, index) => {
                  const addons = item.addons ?? [];
                  const removed = item.removed_ingredients;

                  return (
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Quantity: {item.quantity} × ${item.base_price.toFixed(2)}
                        </p>
                        {Array.isArray(addons) && addons.length > 0 && (
                          <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-semibold">Add-ons:</span>{' '}
                            {addons
                              .map((addon, idx) => ({ addon, idx }))
                              .sort((a, b) => {
                                const aGroupOrder =
                                  typeof a.addon.display_group_order === 'number'
                                    ? a.addon.display_group_order
                                    : Number.MAX_SAFE_INTEGER;
                                const bGroupOrder =
                                  typeof b.addon.display_group_order === 'number'
                                    ? b.addon.display_group_order
                                    : Number.MAX_SAFE_INTEGER;
                                if (aGroupOrder !== bGroupOrder) return aGroupOrder - bGroupOrder;

                                const aOrder =
                                  typeof a.addon.display_order === 'number'
                                    ? a.addon.display_order
                                    : Number.MAX_SAFE_INTEGER;
                                const bOrder =
                                  typeof b.addon.display_order === 'number'
                                    ? b.addon.display_order
                                    : Number.MAX_SAFE_INTEGER;
                                if (aOrder !== bOrder) return aOrder - bOrder;

                                return a.addon.addon_item_name.localeCompare(b.addon.addon_item_name);
                              })
                              .map(({ addon }, idx, arr) => (
                                <span key={addon.id ?? idx}>
                                  {addon.addon_item_name}
                                  {idx < arr.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                          </div>
                        )}
                        {Array.isArray(removed) && removed.length > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                            <span className="font-semibold">Removed:</span> {removed.join(', ')}
                          </p>
                        )}
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Total */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Items</span>
              <span className="text-gray-900 dark:text-white">
                {totalItems} item{totalItems === 1 ? '' : 's'}
              </span>
            </div>
            {promotionDiscount > 0.009 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-700 dark:text-green-300">Promotions</span>
                <span className="text-green-700 dark:text-green-300">-${promotionDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-gray-900 dark:text-white">${order.subtotal.toFixed(2)}</span>
            </div>

            {aggregatedPromotions.length > 0 && (
              <div className="mt-3 mb-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 px-4 py-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Applied promotions</div>
                <div className="space-y-1">
                  {aggregatedPromotions.map((p, idx) => (
                    <div key={`${p.title}-${idx}`} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span className="truncate pr-3">{p.title}</span>
                      <span className="text-green-700 dark:text-green-300">-${p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">GST</span>
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
            {order.reward_points_used && order.reward_points_used > 0 && order.reward_points_value && order.reward_points_value > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">
                  Reward Points Used ({order.reward_points_used.toLocaleString()} pts)
                </span>
                <span className="text-gray-900 dark:text-white">
                  -${order.reward_points_value.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-neutral-700">
              <span className="text-xl font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${order.total.toFixed(2)}
              </span>
            </div>

            {rewardSummary && rewardSummary.pointsEarned > 0 && (
              <div className="mt-4 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <Icon icon={FaGift} className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Reward Points Earned
                  </p>
                  <p>
                    You earned <span className="font-semibold">{rewardSummary.pointsEarned.toLocaleString()}</span>{' '}
                    points on this order, worth{' '}
                    <span className="font-semibold">
                      ${rewardSummary.dollarValue.toFixed(2)}
                    </span>{' '}
                    towards future orders.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            What's Next?
          </h3>
          {order.order_status === 'completed' ? (
            existingReview ? (
              <div className="mb-4 text-blue-900 dark:text-blue-200">
                <span className="font-semibold">Your Review:</span>
                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg key={star} className={`w-5 h-5 ${existingReview.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
                  ))}
                </div>
                <div className="text-gray-800 dark:text-gray-100 mt-1">{existingReview.comment || <span className="italic text-gray-400">No comment</span>}</div>
                <button
                  className="mt-3 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={openReviewModal}
                >
                  Edit Review
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 text-blue-900 dark:text-blue-200">
                  <span className="font-semibold">We'd love your feedback!</span> Please review your order below.
                </div>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={openReviewModal}
                >
                  Leave a Review
                </button>
              </>
            )
          ) : null}
        </div>

        {/* Order Review Modal */}
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={existingReview ? 'Edit Your Review' : 'Review Your Order'}
          size="md"
          bodyClassName="p-6"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Your Rating:</span>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="focus:outline-none"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <svg className={`w-6 h-6 ${reviewRating >= star ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
                </button>
              ))}
            </div>
            <textarea
              className="w-full border rounded p-2"
              rows={3}
              placeholder="Write your review..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
            />
            <div>
              <span className="font-semibold">Photo (optional):</span>
              <ImageUpload
                type="product"
                currentImageUrl={reviewPhoto ?? undefined}
                onImageChange={setReviewPhoto}
                className="mt-2"
              />
            </div>
            {/* List of products in the order for like/dislike */}
            {order && Array.isArray(order.items) && order.items.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Rate Items in Your Order</h4>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
                      {item.product_image_url && (
                        <img src={item.product_image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{item.product_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Qty: {item.quantity}</div>
                      </div>
                      <button
                        className={`flex items-center gap-1 px-2 py-1 rounded ${itemLikes[item.product_id] === true ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-100'}`}
                        onClick={() => handleLikeItem(item.product_id, true)}
                        type="button"
                        aria-label="Like"
                      >
                        <FaThumbsUp />
                      </button>
                      <button
                        className={`flex items-center gap-1 px-2 py-1 rounded ${itemLikes[item.product_id] === false ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-100'}`}
                        onClick={() => handleLikeItem(item.product_id, false)}
                        type="button"
                        aria-label="Dislike"
                      >
                        <FaThumbsDown />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-gray-100"
                onClick={() => setReviewModalOpen(false)}
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={handleSubmitOrderReview} disabled={submittingReview || !reviewRating}>
                {submittingReview ? (existingReview ? 'Updating...' : 'Submitting...') : (existingReview ? 'Update Review' : 'Submit Review')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/order"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Icon icon={FaShoppingBag} className="w-4 h-4" />
            Order More?
          </Link>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
          >
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
}
