import { ActionButton as Button } from '@/components/ui/ActionButton';
import { SearchField, AsyncState } from '@/components/ui';
import { WorkspaceHeader } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { StatusBadge } from '@/components/ui';
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, useWindowDimensions } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { CustomerModal } from '@/components/CustomerModal';

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
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const loadedFilter = useRef('today');
  const router = useRouter();
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id?: string, phone: string } | null>(null);

  const fetchHistory = async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    if (loadedFilter.current !== dateFilter) {
      loadedFilter.current = dateFilter;
      setCalls([]);
    }
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

    if (request !== latestRequest.current) return;
    if (error) {
      setError('Call history could not be loaded. Try again.');
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

  const filteredCalls = calls.filter((call) => `${call.caller_name || ''} ${call.caller_number}`.toLowerCase().includes(search.trim().toLowerCase()));

  const renderItem = ({ item, index }: { item: CallHistoryRecord; index: number }) => {
    const timeFormatted = format(new Date(item.created_at), 'MMM d, h:mm a');

    return <View style={{ minHeight: 78, paddingVertical: 17, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, backgroundColor: t.color.surface, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: index === 0 ? 1 : 0, borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0, borderBottomLeftRadius: index === filteredCalls.length - 1 ? 16 : 0, borderBottomRightRadius: index === filteredCalls.length - 1 ? 16 : 0, borderColor: t.color.border }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.color.primaryTint }}><IconButton icon="phone-outline" size={20} style={{ margin: 2 }} iconColor={t.color.primary} /></View>
      <View style={{ flex: 1, minWidth: width < 600 ? 150 : 160, gap: 4 }}><Text style={{ fontSize: 16, fontWeight: '700', color: t.color.text }}>{item.caller_name || item.caller_number}</Text><Text style={{ fontSize: 14, color: t.color.muted }}>{item.caller_name ? `${item.caller_number} · ` : ''}{timeFormatted}</Text></View>
      <View style={{ alignSelf: 'center' }}><StatusBadge label={item.status === 'accepted' ? 'Accepted' : 'Missed'} tone={item.status === 'accepted' ? 'success' : 'danger'} /></View>
      <Button mode="outlined" contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} onPress={() => setSelectedCustomer({ id: item.customer_id || undefined, phone: item.caller_number })}>Customer</Button>
      <Button mode="outlined" contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} onPress={() => handleCallback(item)}>Call back</Button>
    </View>;
  };

  return (
    <View style={styles.container}>
      <WorkspaceHeader title="Call history" />
      <View style={{ paddingHorizontal: width >= 1100 ? 16 : 12, paddingTop: width < 600 ? 12 : 16, gap: 24 }}>
        <View style={{ flexDirection: width < 600 ? 'column' : 'row', gap: 8 }}><SearchField placeholder="Search caller or phone" value={search} onChangeText={setSearch} style={{ flex: width < 600 ? undefined : 1 }} /><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={fetchHistory}>Refresh</Button></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>{[{ value: 'all', label: 'All time' }, { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }].map(({ value, label }) => <Button key={value} mode="outlined" accessibilityState={{ selected: dateFilter === value }} contentStyle={{ minHeight: 44 }} style={{ backgroundColor: dateFilter === value ? t.color.primaryTint : t.color.surface, borderColor: dateFilter === value ? '#80B9B5' : t.color.border }} onPress={() => setDateFilter(value)}>{label}</Button>)}</View><IconButton icon="trash-can-outline" accessibilityLabel="Clear call history" onPress={handleClearLogs} /></View>
        {error && <AsyncState title="Calls couldn’t load" description={error} onRetry={fetchHistory} />}
      </View>
      <FlatList
        data={filteredCalls}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: width >= 1100 ? 16 : 12, paddingTop: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchHistory} />
        }
        ListEmptyComponent={!loading && !error ? <AsyncState icon="phone-outline" title={search.trim() ? 'No matching calls' : 'No recent calls'} description={search.trim() ? 'Try another caller name or phone number.' : 'Calls for this period will appear here.'} /> : null}
      />

      <CustomerModal
        visible={!!selectedCustomer}
        profileId={selectedCustomer?.id}
        phone={selectedCustomer?.phone}
        onClose={() => setSelectedCustomer(null)}
        onOrderPress={(orderId) => {
          setSelectedCustomer(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: t.color.background } });
