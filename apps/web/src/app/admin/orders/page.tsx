'use client';

import { useState, useEffect, useRef } from 'react';
import { getAllOrders, updateOrderStatus, updatePaymentStatus, getOrder } from '@/app/actions/orders';
import { LoadingSpinner } from '@/components/Loading';
import { AdminGuard } from '@/components/AdminGuard';
import { FaEye,FaPrint, FaCheckCircle, FaTimesCircle, FaClock, FaSpinner, FaFilter, FaPlay, FaCheck, FaShoppingBag, FaChevronLeft, FaChevronRight, FaCalendar } from 'react-icons/fa';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Icon } from '@/components/Icon';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';

// Sound notification for new orders
const playNewOrderSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Higher pitch for alert
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Also try to play a notification sound if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Order Received!', {
        body: 'A new order has been placed',
        icon: '/favicon/favicon-32x32.png',
        tag: 'new-order'
      });
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export default function OrdersPage() {
  // Get current date in YYYY-MM-DD format for default
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<{ orderId: string; status: OrderStatus } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const lastOrderIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    loadOrders();

    // Set up Supabase realtime subscription for orders
    const supabase = getSupabaseClient();
    
    // Subscribe to order changes
    subscriptionRef.current = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🔔 [Orders] Realtime event received:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            // New order received
            const newOrder = payload.new as { id: string; order_number: string; created_at: string };
            console.log('🆕 [Orders] New order detected via realtime:', {
              id: newOrder.id,
              orderNumber: newOrder.order_number,
              createdAt: newOrder.created_at
            });
            
            // Only notify if the order is for the selected date
            const orderDate = new Date(newOrder.created_at).toISOString().split('T')[0];
            if (orderDate === selectedDate) {
              // Check if this is actually a new order (not already in our list)
              if (lastOrderIdRef.current !== newOrder.id && soundEnabled) {
                console.log('🔔 [Orders] Playing notification for realtime new order');
                playNewOrderSound();
              }
              
              // Update last order ID immediately to prevent duplicate notifications
              lastOrderIdRef.current = newOrder.id;
              
              // Reload orders to get the new one
              loadOrders();
            }
          } else if (payload.eventType === 'UPDATE') {
            // Order updated - check if it's for the selected date
            const updatedOrder = payload.new as { created_at: string };
            const orderDate = new Date(updatedOrder.created_at).toISOString().split('T')[0];
            if (orderDate === selectedDate) {
              console.log('🔄 [Orders] Order updated:', payload.new);
              // Reload orders to get updated data
              loadOrders();
            }
          }
        }
      )
      .subscribe();

    return () => {
      // Cleanup subscription
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [statusFilter, paymentFilter, selectedDate]);

  // Detect new orders and play sound (backup detection if realtime doesn't fire)
  useEffect(() => {
    if (orders.length > 0 && previousOrderIdsRef.current.size > 0) {
      const currentOrderIds = new Set(orders.map(o => o.id));
      const newOrderIds = [...currentOrderIds].filter(id => !previousOrderIdsRef.current.has(id));
      
      if (newOrderIds.length > 0 && soundEnabled) {
        console.log('🆕 [Orders] New orders detected via polling:', newOrderIds);
        // Only play sound if we haven't already played it via realtime
        // The realtime subscription will handle most cases
        const newOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at).toISOString().split('T')[0];
          return newOrderIds.includes(o.id) && orderDate === selectedDate;
        });
        const veryRecentOrders = newOrders.filter(o => {
          const orderTime = new Date(o.created_at).getTime();
          const now = Date.now();
          return (now - orderTime) < 10000; // Within last 10 seconds
        });
        
        if (veryRecentOrders.length > 0) {
          playNewOrderSound();
        }
      }
      
      previousOrderIdsRef.current = currentOrderIds;
    } else if (orders.length > 0) {
      // First load - initialize the set
      previousOrderIdsRef.current = new Set(orders.map(o => o.id));
    }
  }, [orders, soundEnabled, selectedDate]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const filters: { status?: string; payment_status?: string; date?: string } = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (paymentFilter !== 'all') {
        filters.payment_status = paymentFilter;
      }
      if (selectedDate) {
        filters.date = selectedDate;
      }
      const result = await getAllOrders(filters);
      if (result.error) {
        setError(result.error);
      } else {
        const newOrders = result.data || [];
        
        // Check for new orders by comparing the most recent order ID
        if (newOrders.length > 0) {
          const mostRecentOrder = newOrders[0]; // Orders are sorted by created_at DESC
          const currentLastOrderId = mostRecentOrder.id;
          const currentLastOrderTime = new Date(mostRecentOrder.created_at).getTime();
          
          // If we have a previous last order ID and it's different, we have a new order
          if (lastOrderIdRef.current) {
            if (lastOrderIdRef.current !== currentLastOrderId) {
              console.log('🆕 [Orders] New order detected by ID comparison:', {
                previousLastId: lastOrderIdRef.current,
                currentLastId: currentLastOrderId,
                orderNumber: mostRecentOrder.order_number
              });
              
              // Check if this order was created recently (within last 2 minutes)
              const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
              if (currentLastOrderTime > twoMinutesAgo && soundEnabled) {
                console.log('🔔 [Orders] Playing notification for new order:', {
                  orderId: currentLastOrderId,
                  orderNumber: mostRecentOrder.order_number,
                  created: new Date(mostRecentOrder.created_at).toLocaleString()
                });
                playNewOrderSound();
              }
            }
          } else {
            // First load - just set the last order ID without playing sound
            console.log('📋 [Orders] Initial load, setting last order ID:', currentLastOrderId);
          }
          
          // Update the last order ID
          lastOrderIdRef.current = currentLastOrderId;
        }
        
        setOrders(newOrders);
        setLastUpdated(new Date());
        setRefreshCountdown(30); // Reset countdown to 30 seconds
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for refresh button
  useEffect(() => {
    if (refreshCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            // Auto-refresh when countdown reaches 0
            loadOrders();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCountdown]);

  const handleViewOrder = async (orderId: string) => {
    try {
      const result = await getOrder(orderId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setSelectedOrder(result.data);
        setShowOrderModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setStatusToUpdate({ orderId, status: newStatus });
    setShowStatusDialog(true);
  };

  const confirmStatusUpdate = async () => {
    if (!statusToUpdate) return;

    try {
      setUpdatingStatus(statusToUpdate.orderId);
      const result = await updateOrderStatus(statusToUpdate.orderId, statusToUpdate.status);
      if (result.error) {
        setError(result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === statusToUpdate.orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
      setShowStatusDialog(false);
      setStatusToUpdate(null);
    }
  };

  const handlePaymentStatusUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    try {
      setUpdatingStatus(orderId);
      const result = await updatePaymentStatus(orderId, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Quick action handlers for status progression
  const handleQuickAction = async (orderId: string, action: 'prepare' | 'ready' | 'completed') => {
    const statusMap: Record<string, OrderStatus> = {
      prepare: 'preparing',
      ready: 'ready',
      completed: 'completed'
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    try {
      setUpdatingStatus(orderId);
      const result = await updateOrderStatus(orderId, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getNextQuickAction = (currentStatus: OrderStatus): { action: string; label: string; icon: React.ReactNode } | null => {
    switch (currentStatus) {
      case 'confirmed':
        return { action: 'prepare', label: 'Start Preparing', icon: <Icon icon={FaPlay} className="w-3 h-3" /> };
      case 'preparing':
        return { action: 'ready', label: 'Mark Ready', icon: <Icon icon={FaCheckCircle} className="w-3 h-3" /> };
      case 'ready':
        return { action: 'completed', label: 'Complete', icon: <Icon icon={FaCheck} className="w-3 h-3" /> };
      default:
        return null;
    }
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order ${order.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .order-info { margin-bottom: 20px; }
            .order-items { margin: 20px 0; }
            .item { margin: 10px 0; padding: 10px; border-bottom: 1px solid #ddd; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
            .status { padding: 5px 10px; border-radius: 5px; display: inline-block; }
            .pending { background: #fef3c7; color: #92400e; }
            .confirmed { background: #dbeafe; color: #1e40af; }
            .preparing { background: #d1fae5; color: #065f46; }
            .ready { background: #fce7f3; color: #9f1239; }
            .completed { background: #d1fae5; color: #065f46; }
            .cancelled { background: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order Receipt</h1>
            <h2>${order.order_number}</h2>
          </div>
          <div class="order-info">
            <p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="status ${order.order_status}">${order.order_status}</span></p>
            <p><strong>Payment:</strong> ${order.payment_method} - ${order.payment_status}</p>
          </div>
          ${order.special_instructions ? `<p><strong>Special Instructions:</strong> ${order.special_instructions}</p>` : ''}
          <div class="order-items">
            <h3>Items:</h3>
            ${order.items?.map(item => `
              <div class="item">
                <p><strong>${item.product_name}</strong> × ${item.quantity}</p>
                <p>$${item.base_price.toFixed(2)} each = $${item.subtotal.toFixed(2)}</p>
                ${item.comment ? `<p><em>Note: ${item.comment}</em></p>` : ''}
              </div>
            `).join('') || ''}
          </div>
          <div class="total">
            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
            ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
            ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
            ${order.service_fee > 0 ? `<p>Service Fee: $${order.service_fee.toFixed(2)}</p>` : ''}
            <p>Total: $${order.total.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      preparing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      ready: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    const colors: Record<PaymentStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Order Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View and manage customer orders for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Date Navigation */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Orders by Date</h2>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const date = new Date(selectedDate);
                  date.setDate(date.getDate() - 1);
                  setSelectedDate(date.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 transition-colors"
                title="Previous day"
              >
                <Icon icon={FaChevronLeft} className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 flex-1">
                <Icon icon={FaCalendar} className="text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm font-medium"
                />
                {selectedDate === getTodayDateString() && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">(Today)</span>
                )}
              </div>
              
              <button
                onClick={() => {
                  const date = new Date(selectedDate);
                  date.setDate(date.getDate() + 1);
                  const today = new Date();
                  const maxDate = new Date(today);
                  maxDate.setDate(maxDate.getDate() + 1); // Allow tomorrow
                  if (date <= maxDate) {
                    setSelectedDate(date.toISOString().split('T')[0]);
                  }
                }}
                disabled={new Date(selectedDate) >= new Date(getTodayDateString())}
                className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next day"
              >
                <Icon icon={FaChevronRight} className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setSelectedDate(getTodayDateString())}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Icon icon={FaFilter} className="text-gray-500" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment:
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {lastUpdated && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    soundEnabled
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title={soundEnabled ? 'Sound enabled' : 'Sound disabled'}
                >
                  {soundEnabled ? '🔔 On' : '🔕 Off'}
                </button>
                <button
                  onClick={loadOrders}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Icon icon={FaSpinner} className="inline-block w-3 h-3 mr-1 animate-spin" />
                      Refreshing...
                    </>
                  ) : refreshCountdown > 0 ? (
                    `Refresh in ${refreshCountdown}s`
                  ) : (
                    'Refresh'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Orders List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-12 text-center">
              <Icon icon={FaShoppingBag} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">No orders found</p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">
                {selectedDate === getTodayDateString() 
                  ? "No orders for today yet."
                  : `No orders found for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
                }
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {order.order_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {order.customer_name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {order.customer_email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            ${order.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <select
                              value={order.order_status}
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                              disabled={updatingStatus === order.id}
                              className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.order_status)} border-0 cursor-pointer disabled:opacity-50`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="preparing">Preparing</option>
                              <option value="ready">Ready</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            {getNextQuickAction(order.order_status) && (
                              <button
                                onClick={() => handleQuickAction(order.id, getNextQuickAction(order.order_status)!.action as 'prepare' | 'ready' | 'completed')}
                                disabled={updatingStatus === order.id}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title={getNextQuickAction(order.order_status)!.label}
                              >
                                {getNextQuickAction(order.order_status)!.icon}
                                <span className="hidden sm:inline">{getNextQuickAction(order.order_status)!.label}</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={order.payment_status}
                            onChange={(e) => handlePaymentStatusUpdate(order.id, e.target.value as PaymentStatus)}
                            disabled={updatingStatus === order.id}
                            className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(order.payment_status)} border-0 cursor-pointer disabled:opacity-50`}
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewOrder(order.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View Details"
                            >
                              <Icon icon={FaEye} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrint(order)}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                              title="Print"
                            >
                              <Icon icon={FaPrint} className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Order Detail Modal */}
          {showOrderModal && selectedOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Order {selectedOrder.order_number}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(selectedOrder)}
                        className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Icon icon={FaPrint} className="w-4 h-4" />
                        Print
                      </button>
                      <button
                        onClick={() => setShowOrderModal(false)}
                        className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Customer Information
                      </h3>
                      <p className="text-gray-900 dark:text-white">{selectedOrder.customer_name || 'N/A'}</p>
                      <p className="text-gray-600 dark:text-gray-400">{selectedOrder.customer_email}</p>
                      <p className="text-gray-600 dark:text-gray-400">{selectedOrder.customer_phone}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Order Details
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        Payment: <span className="capitalize">{selectedOrder.payment_method}</span>
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        Status: <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedOrder.order_status)}`}>
                          {selectedOrder.order_status}
                        </span>
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        Payment Status: <span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                          {selectedOrder.payment_status}
                        </span>
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {new Date(selectedOrder.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {selectedOrder.special_instructions && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Special Instructions
                      </h3>
                      <p className="text-gray-900 dark:text-white">{selectedOrder.special_instructions}</p>
                    </div>
                  )}

                  {/* Order Items */}
                  {selectedOrder.items && selectedOrder.items.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                        Order Items
                      </h3>
                      <div className="space-y-4">
                        {selectedOrder.items.map((item, index) => (
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
                                <p className="text-sm text-gray-500 dark:text-gray-500 italic mb-2">
                                  Note: {item.comment}
                                </p>
                              )}
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                ${item.subtotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order Total */}
                  <div className="pt-6 border-t border-gray-200 dark:border-neutral-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="text-gray-900 dark:text-white">${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedOrder.tax > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Tax</span>
                        <span className="text-gray-900 dark:text-white">${selectedOrder.tax.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.delivery_fee > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                        <span className="text-gray-900 dark:text-white">${selectedOrder.delivery_fee.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.service_fee > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Service Fee</span>
                        <span className="text-gray-900 dark:text-white">${selectedOrder.service_fee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-neutral-700">
                      <span className="text-xl font-semibold text-gray-900 dark:text-white">Total</span>
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ${selectedOrder.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Update Confirmation Dialog */}
          <ConfirmationDialog
            isOpen={showStatusDialog}
            onClose={() => {
              setShowStatusDialog(false);
              setStatusToUpdate(null);
            }}
            onConfirm={confirmStatusUpdate}
            title="Update Order Status"
            message={`Are you sure you want to update this order status to "${statusToUpdate?.status}"?`}
          />
        </div>
      </div>
    </AdminGuard>
  );
}
