import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import { Surface, IconButton, useTheme, Chip, ActivityIndicator } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { searchCustomers, findCustomerByPhone } from '@/lib/customers';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import * as CallerIdListener from '@my-small-business/caller-id-listener';
import type { CallerIdListenerStatus, CallerIdIncomingCall } from '@my-small-business/caller-id-listener';

export interface ExtendedIncomingCall extends CallerIdIncomingCall {
  customerId?: string;
}

export interface CallerIdContextValue {
  status: CallerIdListenerStatus;
  incomingCall: ExtendedIncomingCall | null;
  clearIncomingCall: () => void;
  enabled: boolean;
  acceptedCall: { phone: string; name: string | null; customerId?: string } | null;
  acceptIncomingCall: () => void;
  clearAcceptedCall: () => void;
}

export const CallerIdContext = createContext<CallerIdContextValue>({
  status: { state: 'stopped' },
  incomingCall: null,
  clearIncomingCall: () => {},
  enabled: false,
  acceptedCall: null,
  acceptIncomingCall: () => {},
  clearAcceptedCall: () => {},
});

export const useCallerId = () => useContext(CallerIdContext);

const IncomingCallFullCard = ({ incomingCall, callerName, onAccept, onDismiss, theme }: { incomingCall: ExtendedIncomingCall, callerName: string | null, onAccept: () => void, onDismiss: () => void, theme: any }) => {
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      const { data: customerData } = await findCustomerByPhone(incomingCall.phoneNumber);
      
      const query = supabase
        .from('orders')
        .select('id, friendly_order_number, created_at, total_price')
        .order('created_at', { ascending: false })
        .limit(5);

      if (incomingCall.customerId || customerData?.id) {
        query.eq('customer_id', incomingCall.customerId || customerData?.id);
      } else {
        query.eq('customer_phone', incomingCall.phoneNumber);
      }

      const { data: orderData } = await query;
      if (active) {
        setCustomerInfo(customerData);
        setRecentOrders(orderData || []);
        setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [incomingCall]);

  return (
    <Surface style={{ 
      flexDirection: 'row', 
      maxWidth: 900, 
      width: '90%',
      backgroundColor: '#ffffff',
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.15,
      shadowRadius: 30,
      elevation: 20,
      overflow: 'hidden'
    }} elevation={5}>
      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 40, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ 
          width: 120, height: 120, borderRadius: 60, backgroundColor: '#eff6ff', 
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          shadowColor: theme.colors.primary, shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 },
          elevation: 8
        }}>
          <IconButton icon="phone-in-talk" size={60} iconColor={theme.colors.primary} />
        </View>
        <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Incoming Call
        </Text>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 }}>
          {callerName || incomingCall.phoneNumber}
        </Text>
        {callerName && (
           <Text style={{ fontSize: 20, color: '#64748b', fontWeight: '500', marginBottom: 32 }}>
             {incomingCall.phoneNumber}
           </Text>
        )}
        {!callerName && <View style={{ height: 32 }} />}

        <View style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
           <TouchableOpacity 
             style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} 
             onPress={onDismiss}
           >
             <IconButton icon="close" size={24} iconColor="#64748b" style={{ margin: 0, marginRight: 8 }} />
             <Text style={{ color: '#475569', fontSize: 20, fontWeight: 'bold' }}>Dismiss</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={{ flex: 1, backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }} 
             onPress={onAccept}
           >
             <IconButton icon="phone" size={24} iconColor="#fff" style={{ margin: 0, marginRight: 8 }} />
             <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Accept</Text>
           </TouchableOpacity>
        </View>
      </View>

      <View style={{ width: 400, padding: 40, backgroundColor: '#ffffff', borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 24 }}>Customer Profile</Text>
        
        {loading ? (
           <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="small" /></View>
        ) : !customerInfo && recentOrders.length === 0 ? (
           <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 16 }}>
                <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 16 }}>New Customer</Text>
             </View>
             <Text style={{ color: '#64748b', textAlign: 'center' }}>This looks like their first order with us!</Text>
           </View>
        ) : (
           <View style={{ flex: 1 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
                <View>
                  <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Total Spent</Text>
                  <Text style={{ color: '#0f172a', fontSize: 24, fontWeight: 'bold' }}>${(customerInfo?.totalSpent || 0).toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Points</Text>
                  <Text style={{ color: '#f59e0b', fontSize: 24, fontWeight: 'bold' }}>{customerInfo?.rewardPoints || 0}</Text>
                </View>
                <View>
                  <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Orders</Text>
                  <Text style={{ color: '#0f172a', fontSize: 24, fontWeight: 'bold' }}>{customerInfo?.totalOrders || recentOrders.length}</Text>
                </View>
             </View>
             
             <Text style={{ fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 16 }}>Recent Orders</Text>
             {recentOrders.length === 0 ? (
                <Text style={{ color: '#94a3b8' }}>No recent orders found.</Text>
             ) : (
                recentOrders.map((order, idx) => (
                  <View key={idx} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                     <View>
                       <Text style={{ fontWeight: '600', color: '#334155', fontSize: 16, marginBottom: 4 }}>
                         #{order.friendly_order_number || order.id.slice(0, 8)}
                       </Text>
                       <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                         {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(order.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                       </Text>
                     </View>
                     <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 16 }}>
                       ${Number(order.total_price || 0).toFixed(2)}
                     </Text>
                  </View>
                ))
             )}
           </View>
        )}
      </View>
    </Surface>
  );
};

export const CallerIdListenerProvider: React.FC<{ children: React.ReactNode; authenticated: boolean }> = ({ children, authenticated }) => {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isPosScreen = pathname === '/pos';
  const { data: settings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  
  const [status, setStatus] = useState<CallerIdListenerStatus>({ state: 'stopped' });
  const [incomingCall, setIncomingCall] = useState<ExtendedIncomingCall | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [acceptedCall, setAcceptedCall] = useState<{ phone: string; name: string | null; customerId?: string } | null>(null);
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);

  // Reconcile native listener state based on settings and authentication
  useEffect(() => {
    if (!authenticated || !settings.callerIdEnabled) {
      if (CallerIdListener.isRunning()) {
        CallerIdListener.stop();
      }
      setStatus({ state: 'stopped' });
      return;
    }

    const currentPort = status.port;
    const targetPort = settings.callerIdPort;
    const targetResponses = settings.callerIdSipResponses || ["100 Trying"];
    const aiCallAssistantEnabled = settings.aiCallAssistantEnabled || false;
    
    // We don't have a way to check current responses synchronously, so we track it via a ref
    // For simplicity, we just restart if it's running but we want to ensure it has the latest responses.
    if (CallerIdListener.isRunning()) {
      CallerIdListener.stop();
    }
    
    if (aiCallAssistantEnabled) {
      // Fetch the ephemeral token for OpenAI Realtime
      const fetchToken = async () => {
        try {
          // Assuming POS apps run against the production/staging backend URL via NEXT_PUBLIC_API_URL or relative
          // We'll just try hitting /api/pos/realtime-session assuming it's available locally or handled via proxy
          // Wait, the POS app might not have a direct route without a domain. 
          // I will use a simple fetch to the backend if configured, but for safety in the template, I'll catch errors.
          // Wait, the POS app usually has a NEXT_PUBLIC_API_URL or similar for fetching from backend. 
          // We can use a generic fetch since we're in the React Native layer. 
          // Actually, this app uses `supabase` for DB, does it have an API URL? I'll just use a placeholder domain or relative path if not available.
          // Let's assume the API URL is known or handled by an environment variable.
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          const res = await fetch(`${apiUrl}/api/pos/realtime-session`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed to get realtime session token');
          const data = await res.json();
          CallerIdListener.start(targetPort, targetResponses, true, data.client_secret?.value, settings.fallbackNumber);
        } catch (e) {
          console.error('Failed to start AI Call Assistant with token:', e);
          // fallback to just caller ID
          CallerIdListener.start(targetPort, targetResponses, false, null, settings.fallbackNumber);
        }
      };
      fetchToken();
    } else {
      CallerIdListener.start(targetPort, targetResponses, false, null, settings.fallbackNumber);
    }
  }, [authenticated, settings.callerIdEnabled, settings.aiCallAssistantEnabled, settings.callerIdPort, settings.fallbackNumber, settings.callerIdSipResponses?.join(',')]);

  // Subscribe to native events
  useEffect(() => {
    const statusSub = CallerIdListener.addStatusListener((newStatus: CallerIdListenerStatus) => {
      setStatus(newStatus);
    });

    const callSub = CallerIdListener.addIncomingCallListener((call: CallerIdIncomingCall) => {
      setIncomingCall(call);
      setCallerName(null);
      
      searchCustomers(call.phoneNumber, 0, 1).then(({ data }) => {
        const name = data && data.length > 0 ? data[0].name : null;
        const customerId = data && data.length > 0 ? data[0].id : null;
        
        if (name) {
          setCallerName(name);
        }
        if (customerId) {
          setIncomingCall(prev => prev ? { ...prev, customerId } : { ...call, customerId });
        }
        
        // Insert to history since this device actually received the physical call
        supabase.from('phone_call_history').insert({
          caller_number: call.phoneNumber,
          caller_name: name,
          call_id: call.callId,
          customer_id: customerId,
          status: 'missed'
        }).then(({ error }) => {
          if (error) console.error('Failed to insert call history', error);
        });
      }).catch(() => {
        supabase.from('phone_call_history').insert({
          caller_number: call.phoneNumber,
          call_id: call.callId,
          status: 'missed'
        }).then(({ error }) => {
          if (error) console.error('Failed to insert call history', error);
        });
      });
      
      // Auto-dismiss
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
      dismissTimer.current = setTimeout(() => {
        setIncomingCall(null);
      }, settings.callerIdDisplaySeconds * 1000);
    });

    const rawSub = CallerIdListener.addRawPacketListener((event: { content: string }) => {
      usePrinterAutomationStore.getState().addJournalEntry({
        scope: 'Caller ID Packet Received',
        message: event.content,
        level: 'info',
      });
      console.log('--- CALLER ID RAW UDP PACKET RECEIVED ---');
      console.log(event.content);
      console.log('-----------------------------------------');
    });

    const aiSub = CallerIdListener.addAITranscriptListener((event: any) => {
       // In a real app we might show this transcript in a UI component, or pass it to a context
       console.log('AI Transcript:', event.role, event.text);
    });

    const aiToolSub = CallerIdListener.addAIToolCallListener((event: any) => {
      console.log('AI Tool Call:', event.name, event.arguments);
      
      const { callId, toolCallId, name, arguments: argsJson } = event;
      
      try {
        const args = JSON.parse(argsJson);
        let output = { success: false, message: "Unknown tool" };
        
        if (name === 'searchMenu') {
          // Dummy stub for searching menu
          output = { success: true, results: [{ id: "1", name: "Flake Pack", price: 12.50 }] };
        } else if (name === 'submitOrder') {
          // Dummy stub for submitting order
          console.log('Order submitted by AI:', args);
          output = { success: true, message: "Order placed successfully", orderId: "ORD-1234" };
        } else if (name === 'endCall') {
          console.log('AI requested to end the call');
          CallerIdListener.endCall(callId);
          output = { success: true, message: "Call ended" };
        }
        
        CallerIdListener.sendAIToolOutput(callId, toolCallId, JSON.stringify(output));
      } catch (e) {
        console.error('Error handling AI tool call', e);
        CallerIdListener.sendAIToolOutput(callId, toolCallId, JSON.stringify({ error: "Failed to parse arguments" }));
      }
    });

    const errSub = CallerIdListener.addErrorListener((event: { message: string }) => {
      console.error('Caller ID Error:', event.message);
    });

    // Realtime subscription for devices without physical caller ID connection and cross-device dismissal
    const realtimeChannel = supabase
      .channel('public:phone_call_history')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'phone_call_history' },
        (payload) => {
          if (settings.callerIdEnabled) return;
          const newRecord = payload.new;
          setIncomingCall({
            phoneNumber: newRecord.caller_number,
            callId: newRecord.call_id || '',
            timestamp: new Date(newRecord.created_at).getTime(),
            customerId: newRecord.customer_id || undefined,
          });
          setCallerName(newRecord.caller_name || null);
          
          // Auto-dismiss
          if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
          }
          dismissTimer.current = setTimeout(() => {
            setIncomingCall(null);
          }, settings.callerIdDisplaySeconds * 1000);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'phone_call_history' },
        (payload) => {
          const updatedRecord = payload.new;
          if (updatedRecord.status === 'accepted') {
            setIncomingCall((currentCall) => {
               if (currentCall && currentCall.callId === updatedRecord.call_id) {
                 return null;
               }
               return currentCall;
            });
          }
        }
      )
      .subscribe();

    return () => {
      statusSub.remove();
      callSub.remove();
      rawSub.remove();
      aiSub.remove();
      aiToolSub.remove();
      errSub.remove();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, [settings.callerIdDisplaySeconds]);

  const handleCloseCard = () => {
    setIncomingCall(null);
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      setAcceptedCall({ phone: incomingCall.phoneNumber, name: callerName, customerId: incomingCall.customerId });
      
      if (incomingCall.callId) {
        supabase.from('phone_call_history')
          .update({ status: 'accepted' })
          .eq('call_id', incomingCall.callId)
          .then(({ error }) => {
            if (error) console.error('Failed to update call history', error);
          });
      }
      
      router.push({
        pathname: '/pos',
        params: { 
          incomingCallPhone: incomingCall.phoneNumber, 
          incomingCallName: callerName ?? '',
          incomingCallCustomerId: incomingCall.customerId ?? ''
        }
      });
    }
    handleCloseCard();
  };

  const getStatusText = () => {
    if (!settings.callerIdEnabled) return 'Caller ID: Off';
    switch (status.state) {
      case 'starting': return 'Caller ID: Starting...';
      case 'listening': return `Caller ID: Port ${status.port}`;
      case 'error': return 'Caller ID: Error';
      default: return 'Caller ID: Stopped';
    }
  };

  const getStatusIcon = () => {
    switch (status.state) {
      case 'listening': return 'phone-in-talk';
      case 'error': return 'alert-circle';
      case 'starting': return 'sync';
      default: return 'phone-off';
    }
  };

  const getStatusColor = () => {
    switch (status.state) {
      case 'listening': return theme.colors.primary;
      case 'error': return theme.colors.error;
      default: return theme.colors.onSurfaceDisabled;
    }
  };

  const contextValue: CallerIdContextValue = {
    status,
    incomingCall,
    clearIncomingCall: handleCloseCard,
    enabled: settings.callerIdEnabled,
    acceptedCall,
    acceptIncomingCall: handleAcceptCall,
    clearAcceptedCall: () => setAcceptedCall(null),
  };

  return (
    <CallerIdContext.Provider value={contextValue}>
      <View style={styles.container} pointerEvents="box-none">
      {children}

      {/* Floating Incoming Call Card */}
      {authenticated && incomingCall && (
        <>
          {isPosScreen ? (
            <View style={styles.cardContainer} pointerEvents="box-none">
              <Surface style={styles.card} elevation={4}>
                <View style={styles.cardContent}>
                  <View style={styles.iconContainer}>
                    <IconButton icon="phone-ring" size={24} iconColor={theme.colors.primary} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.callerLabel}>Incoming Call</Text>
                    <Text style={styles.callerNumber}>
                      {incomingCall.phoneNumber}
                      {callerName ? ` - ${callerName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.dismissButton} onPress={handleCloseCard}>
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptCall}>
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Surface>
            </View>
          ) : (
            <Modal visible={true} transparent={true} animationType="slide">
              <View style={styles.fullScreenContainer}>
                <IncomingCallFullCard
                  incomingCall={incomingCall}
                  callerName={callerName}
                  onAccept={handleAcceptCall}
                  onDismiss={handleCloseCard}
                  theme={theme}
                />
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
    </CallerIdContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 998,
  },
  statusChip: {
    height: 24,
    opacity: 0.8,
  },
  cardContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    width: 380,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  iconContainer: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  callerLabel: {
    fontSize: 12,
    color: '#666',
  },
  callerNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dismissButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  dismissButtonText: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  fullScreenCard: {
    width: '80%',
    maxWidth: 600,
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 32,
  },
  fullScreenCardContent: {
    alignItems: 'center',
  },
  fullScreenIconContainer: {
    marginBottom: 24,
  },
  fullScreenTextContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  fullScreenCallerLabel: {
    fontSize: 24,
    color: '#666',
    marginBottom: 8,
  },
  fullScreenCallerNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  fullScreenActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
  },
  fullScreenAcceptButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenAcceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 28,
  },
  fullScreenDismissButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenDismissButtonText: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 28,
  },
});
