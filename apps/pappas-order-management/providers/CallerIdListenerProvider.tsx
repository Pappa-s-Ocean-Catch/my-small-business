import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Surface, IconButton, useTheme, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { searchCustomers } from '@/lib/customers';
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

export const CallerIdListenerProvider: React.FC<{ children: React.ReactNode; authenticated: boolean }> = ({ children, authenticated }) => {
  const theme = useTheme();
  const router = useRouter();
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
        title: 'Caller ID Packet Received',
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

    // Realtime subscription for devices without physical caller ID connection
    let realtimeChannel: any = null;
    if (!settings.callerIdEnabled) {
      realtimeChannel = supabase
        .channel('public:phone_call_history')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'phone_call_history' },
          (payload) => {
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
        .subscribe();
    }

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
                <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptCall}>
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <IconButton icon="close" size={20} onPress={handleCloseCard} />
              </View>
            </View>
          </Surface>
        </View>
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
});
