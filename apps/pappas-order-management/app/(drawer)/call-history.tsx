import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Appbar, useTheme, Surface, Text, IconButton, Chip, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { BRAND_COLORS } from '@/utils/brand';

type CallHistoryRecord = {
  id: string;
  created_at: string;
  caller_number: string;
  caller_name: string | null;
  status: string;
  call_id: string | null;
  customer_id: string | null;
};

export default function CallHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase
      .from('phone_call_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (dateFilter === 'today') {
      query = query.gte('created_at', startOfDay(new Date()).toISOString());
    } else if (dateFilter === 'yesterday') {
      const yesterday = subDays(new Date(), 1);
      query = query
        .gte('created_at', startOfDay(yesterday).toISOString())
        .lte('created_at', endOfDay(yesterday).toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching call history:', error);
    } else {
      setCalls(data as CallHistoryRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [dateFilter]);

  useEffect(() => {
    // Subscribe to new calls
    const channel = supabase
      .channel('public:phone_call_history:list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phone_call_history' },
        (payload) => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter]);

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Call History',
      'Are you sure you want to delete all call history logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase
              .from('phone_call_history')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
              
            if (error) {
              console.error('Failed to clear logs:', error);
              Alert.alert('Error', 'Failed to clear logs');
              setLoading(false);
            } else {
              fetchHistory();
            }
          }
        }
      ]
    );
  };

  const handleCallback = (call: CallHistoryRecord) => {
    router.push({
      pathname: '/pos',
      params: { 
        incomingCallPhone: call.caller_number, 
        incomingCallName: call.caller_name ?? '',
        incomingCallCustomerId: call.customer_id ?? ''
      }
    });
  };

  const renderItem = ({ item }: { item: CallHistoryRecord }) => {
    const timeFormatted = format(new Date(item.created_at), 'MMM d, h:mm a');
    
    return (
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <IconButton 
              icon={item.status === 'accepted' ? 'phone-check' : 'phone-missed'} 
              iconColor={item.status === 'accepted' ? theme.colors.primary : theme.colors.error} 
              size={24} 
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.callerNumber}>
              {item.caller_number}
            </Text>
            {item.caller_name ? (
              <Text style={styles.callerName}>{item.caller_name}</Text>
            ) : null}
            <Text style={styles.timeText}>{timeFormatted}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <Chip 
              compact 
              style={{ backgroundColor: item.status === 'accepted' ? '#d1fae5' : '#fee2e2' }}
              textStyle={{ color: item.status === 'accepted' ? '#065f46' : '#991b1b', fontSize: 12 }}
            >
              {item.status === 'accepted' ? 'Accepted' : 'Missed'}
            </Chip>
          </View>
          
          <IconButton 
            icon="phone-forward" 
            mode="contained-tonal"
            iconColor={theme.colors.primary}
            onPress={() => handleCallback(item)} 
          />
        </View>
      </Surface>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Call History" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="trash-can-outline" onPress={handleClearLogs} iconColor="#fff" />
        <Appbar.Action icon="refresh" onPress={fetchHistory} iconColor="#fff" />
      </Appbar.Header>
      
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={dateFilter}
          onValueChange={setDateFilter}
          buttons={[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'yesterday', label: 'Yesterday' },
          ]}
          density="small"
        />
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchHistory} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <IconButton icon="phone-off" size={48} iconColor="#ccc" />
              <Text style={styles.emptyText}>No recent calls</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appbar: {
    backgroundColor: BRAND_COLORS.header,
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  callerNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  callerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusContainer: {
    marginRight: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  }
});
