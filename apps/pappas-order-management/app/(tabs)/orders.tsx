import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getAllOrders, updateOrderStatus } from '../../lib/orders';
import type { Order, OrderStatus } from '@my-small-business/types';
import { playNewOrderSound } from '../../lib/sounds';
import { Audio } from 'expo-av';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  ready: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastOrderIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const router = useRouter();

  const loadOrders = async () => {
    try {
      const filters: { status?: string; date?: string } = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      const today = new Date().toISOString().split('T')[0];
      filters.date = today;

      const result = await getAllOrders(filters);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        const newOrders = result.data || [];
        
        // Check for new orders
        if (newOrders.length > 0 && soundEnabled) {
          const mostRecentOrder = newOrders[0];
          if (lastOrderIdRef.current && lastOrderIdRef.current !== mostRecentOrder.id) {
            const orderTime = new Date(mostRecentOrder.created_at).getTime();
            const now = Date.now();
            if (now - orderTime < 10000) {
              playNewOrderSound();
            }
          }
          lastOrderIdRef.current = mostRecentOrder.id;
        }
        
        setOrders(newOrders);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initialize audio
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    loadOrders();

    // Set up realtime subscription
    subscriptionRef.current = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && soundEnabled) {
            const newOrder = payload.new as { id: string; created_at: string };
            const orderTime = new Date(newOrder.created_at).getTime();
            const now = Date.now();
            if (now - orderTime < 10000 && lastOrderIdRef.current !== newOrder.id) {
              playNewOrderSound();
              lastOrderIdRef.current = newOrder.id;
            }
          }
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleOrderPress = (order: Order) => {
    router.push({
      pathname: '/order-detail',
      params: { orderId: order.id },
    });
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      loadOrders();
    }
  };

  const renderOrderItem = ({ item: order }: { item: Order }) => {
    const statusColor = STATUS_COLORS[order.order_status];
    const statusLabel = STATUS_LABELS[order.order_status];

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(order)}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
            <Text style={styles.customerName}>
              {order.customer_name || order.customer_email}
            </Text>
            <Text style={styles.orderType}>
              {order.order_type === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.orderTime}>
            {new Date(order.created_at).toLocaleTimeString()}
          </Text>
          <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
        </View>

        <View style={styles.quickActions}>
          {order.order_status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
              onPress={() => handleStatusChange(order.id, 'confirmed')}
            >
              <Text style={styles.actionButtonText}>Confirm</Text>
            </TouchableOpacity>
          )}
          {order.order_status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#8b5cf6' }]}
              onPress={() => handleStatusChange(order.id, 'preparing')}
            >
              <Text style={styles.actionButtonText}>Start Preparing</Text>
            </TouchableOpacity>
          )}
          {order.order_status === 'preparing' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10b981' }]}
              onPress={() => handleStatusChange(order.id, 'ready')}
            >
              <Text style={styles.actionButtonText}>Mark Ready</Text>
            </TouchableOpacity>
          )}
          {order.order_status === 'ready' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#6b7280' }]}
              onPress={() => handleStatusChange(order.id, 'completed')}
            >
              <Text style={styles.actionButtonText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, statusFilter === status && styles.filterButtonActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  filters: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  orderType: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  orderTime: {
    fontSize: 14,
    color: '#666',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
