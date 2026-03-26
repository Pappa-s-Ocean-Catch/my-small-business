'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderHeader } from '@/components/OrderHeader';
import { getCustomerOrders } from '@/app/actions/orders';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { useCart } from '@/contexts/CartContext';
import { FaClock, FaCheckCircle, FaUtensils, FaSpinner, FaTimesCircle, FaShoppingCart, FaPrint } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import Link from 'next/link';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const { addItem, clearCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndLoadOrders = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const result = await getCustomerOrders();
        if (result.error) {
          setError(result.error);
        } else {
          setOrders(result.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadOrders();
  }, [router]);

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <Icon icon={FaClock} className="w-4 h-4 text-yellow-500" />;
      case 'confirmed':
      case 'preparing':
        return <Icon icon={FaSpinner} className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'ready':
        return <Icon icon={FaCheckCircle} className="w-4 h-4 text-green-500" />;
      case 'completed':
        return <Icon icon={FaCheckCircle} className="w-4 h-4 text-green-600" />;
      case 'cancelled':
        return <Icon icon={FaTimesCircle} className="w-4 h-4 text-red-500" />;
      default:
        return <Icon icon={FaClock} className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'confirmed':
      case 'preparing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ready':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'completed':
        return 'bg-green-200 text-green-900 dark:bg-green-800/30 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'refunded':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const handleReorder = async (order: Order) => {
    if (!order.items || order.items.length === 0) {
      setError('This order has no items to reorder');
      return;
    }

    setReorderingOrderId(order.id);
    try {
      // Clear current cart
      clearCart();

      // Add all items from the order to the cart
      for (const orderItem of order.items) {
        // Group addons by addon_group_id
        const addonsByGroup = new Map<string, Array<{
          id: string;
          name: string;
          extra_price: number;
        }>>();

        // Process addons from the order item
        if (orderItem.addons && orderItem.addons.length > 0) {
          for (const addon of orderItem.addons) {
            if (!addonsByGroup.has(addon.addon_group_id)) {
              addonsByGroup.set(addon.addon_group_id, []);
            }
            addonsByGroup.get(addon.addon_group_id)?.push({
              id: addon.addon_item_id,
              name: addon.addon_item_name,
              extra_price: addon.addon_item_price
            });
          }
        }

        // Convert map to addon groups array
        const addonGroups: Array<{
          id: string;
          name: string;
          is_required: boolean;
          selected_items: Array<{
            id: string;
            name: string;
            extra_price: number;
          }>;
        }> = [];

        // Note: We don't have is_required info from the order, so we'll set it to false
        // The actual validation will happen when the user customizes the item
        for (const [groupId, items] of addonsByGroup.entries()) {
          const firstAddon = orderItem.addons?.find(a => a.addon_group_id === groupId);
          addonGroups.push({
            id: groupId,
            name: firstAddon?.addon_group_name || 'Add-ons',
            is_required: false, // We don't store this in orders, so default to false
            selected_items: items
          });
        }

        addItem({
          product_id: orderItem.product_id,
          name: orderItem.product_name,
          description: orderItem.product_description,
          base_price: orderItem.base_price,
          image_url: orderItem.product_image_url,
          quantity: orderItem.quantity,
          addon_groups: addonGroups,
          removed_ingredients: orderItem.removed_ingredients || [],
          comment: orderItem.comment
        });
      }

      // Navigate to order page
      router.push('/order');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    } finally {
      setReorderingOrderId(null);
    }
  };

  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order ${order.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .order-info { margin-bottom: 20px; }
            .items { margin-bottom: 20px; }
            .item { margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee; }
            .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Pappa's Ocean Catch</h1>
            <h2>Order Receipt</h2>
          </div>
          <div class="order-info">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> ${order.order_status}</p>
            <p><strong>Payment Status:</strong> ${order.payment_status}</p>
            <p><strong>Customer:</strong> ${order.customer_name || order.customer_email}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
          </div>
          <div class="items">
            <h3>Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${order.items?.map(item => `
                  <tr>
                    <td>
                      <strong>${item.product_name}</strong>
                      ${item.removed_ingredients && item.removed_ingredients.length > 0 ? `<br><small>Removed: ${item.removed_ingredients.join(', ')}</small>` : ''}
                      ${item.comment ? `<br><small>Note: ${item.comment}</small>` : ''}
                    </td>
                    <td>${item.quantity}</td>
                    <td>$${item.base_price.toFixed(2)}</td>
                    <td>$${item.subtotal.toFixed(2)}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>
          </div>
          <div class="total">
            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
            ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
            ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
            ${order.service_fee > 0 ? `<p>Service Fee: $${order.service_fee.toFixed(2)}</p>` : ''}
            <p>Total: $${order.total.toFixed(2)}</p>
          </div>
          ${order.special_instructions ? `<p><strong>Special Instructions:</strong> ${order.special_instructions}</p>` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <>
        <OrderHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Icon icon={FaSpinner} className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading your orders...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <OrderHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <OrderHeader />
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Order History</h1>
            <p className="text-gray-600 dark:text-gray-400">View and manage your past orders</p>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-8 text-center">
              <Icon icon={FaUtensils} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Start ordering to see your order history here</p>
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Icon icon={FaShoppingCart} className="w-4 h-4" />
                Start Ordering
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/order/confirmation?order=${order.order_number}`}
                  className="block bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                  tabIndex={0}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="p-6 cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Order #{order.order_number}
                          </h3>
                          <div className="flex flex-row flex-wrap gap-2">
                            {/* Show order status */}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(order.order_status)}
                                {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                              </span>
                            </span>
                            {/* Only show payment status badge if it's different from order status */}
                            {order.payment_status.toLowerCase() !== order.order_status.toLowerCase() && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                                Payment: {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.preventDefault(); handlePrintOrder(order); }}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                          title="Print order"
                        >
                          <Icon icon={FaPrint} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.preventDefault(); handleReorder(order); }}
                          disabled={reorderingOrderId === order.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                          {reorderingOrderId === order.id ? (
                            <>
                              <Icon icon={FaSpinner} className="w-4 h-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Icon icon={FaShoppingCart} className="w-4 h-4" />
                              Reorder
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-neutral-700 pt-4">
                      <div className="space-y-2 mb-4">
                        {order.items?.map((item, index) => (
                          <div key={index} className="flex items-start justify-between text-sm">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.quantity}x{' '}
                                <Link
                                  href={`/order/product/${item.product_id}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  title={`View details for ${item.product_name}`}
                                >
                                  {item.product_name}
                                </Link>
                              </p>
                              {item.comment && (
                                <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                                  Note: {item.comment}
                                </p>
                              )}
                              {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                                <p className="text-orange-700 dark:text-orange-300 text-xs mt-1">
                                  Removed: {item.removed_ingredients.join(', ')}
                                </p>
                              )}
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium">
                              ${item.subtotal.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-neutral-700">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            Total: ${order.total.toFixed(2)}
                          </p>
                          {order.payment_method === 'store' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Pay at store
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
