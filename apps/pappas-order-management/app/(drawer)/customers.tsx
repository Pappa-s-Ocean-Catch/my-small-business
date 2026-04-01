import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { 
  Text, 
  Searchbar, 
  Surface, 
  Avatar, 
  IconButton,
  Card,
  useTheme,
  Appbar,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getRecentCustomers, searchCustomers, Customer } from '@/lib/customers';
import { CustomerModal } from '@/components/CustomerModal';

export default function CustomersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ email?: string; phone?: string } | null>(null);

  const loadCustomers = async (search?: string) => {
    try {
      setLoading(true);
      const { data, error } = search 
        ? await searchCustomers(search) 
        : await getRecentCustomers();
      
      if (error) {
        console.error('Error fetching customers:', error);
      } else {
        setCustomers(data || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCustomers(searchQuery);
    }, [searchQuery])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomers(searchQuery);
  };

  const handleCustomerPress = (customer: Customer) => {
    setSelectedCustomer({ email: customer.email, phone: customer.phone });
    setShowCustomerModal(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Card 
      style={styles.card} 
      onPress={() => handleCustomerPress(item)}
      mode="contained"
    >
      <Card.Content style={styles.cardContent}>
        <Avatar.Text 
          size={48} 
          label={getInitials(item.name)} 
          style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]} 
          labelStyle={{ color: theme.colors.onPrimaryContainer }}
        />
        <View style={styles.infoContainer}>
          <Text variant="titleMedium" style={styles.name}>{item.name}</Text>
          <Text variant="bodySmall" style={styles.contact}>{item.email || item.phone}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="cart-outline" size={14} color={theme.colors.secondary} />
              <Text variant="labelSmall" style={styles.statText}>{item.totalOrders} orders</Text>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="currency-usd" size={14} color="#16a34a" />
              <Text variant="labelSmall" style={styles.statText}>${item.totalSpent.toFixed(2)} spent</Text>
            </View>
          </View>
        </View>
        <IconButton icon="chevron-right" size={20} />
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Customers" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="home" onPress={() => router.replace('/(drawer)/(tabs)/live-orders')} iconColor="#fff" />
      </Appbar.Header>

      <Surface style={styles.searchSurface} elevation={1}>
        <Searchbar
          placeholder="Search customers..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          elevation={0}
        />
      </Surface>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.email || item.phone}
          renderItem={renderCustomerItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
        />
      )}

      {selectedCustomer && (
        <CustomerModal
          visible={showCustomerModal}
          email={selectedCustomer.email}
          phone={selectedCustomer.phone}
          onClose={() => setShowCustomerModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appbar: {
    backgroundColor: '#2563eb',
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchSurface: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBar: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: '#1e293b',
  },
  contact: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
});
