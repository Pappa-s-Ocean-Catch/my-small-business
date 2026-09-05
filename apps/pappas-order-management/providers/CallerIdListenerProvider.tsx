import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Surface, IconButton, useTheme, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { searchCustomers } from '@/lib/customers';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import * as CallerIdListener from '@my-small-business/caller-id-listener';
import type { CallerIdListenerStatus, CallerIdIncomingCall } from '@my-small-business/caller-id-listener';

export interface CallerIdContextValue {
  status: CallerIdListenerStatus;
  incomingCall: CallerIdIncomingCall | null;
  clearIncomingCall: () => void;
  enabled: boolean;
  acceptedCall: { phone: string; name: string | null } | null;
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
  const [incomingCall, setIncomingCall] = useState<CallerIdIncomingCall | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [acceptedCall, setAcceptedCall] = useState<{ phone: string; name: string | null } | null>(null);
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

    if (CallerIdListener.isRunning() && currentPort !== targetPort) {
      CallerIdListener.stop();
    }
    
    if (!CallerIdListener.isRunning()) {
      CallerIdListener.start(targetPort);
    }
  }, [authenticated, settings.callerIdEnabled, settings.callerIdPort]);

  // Subscribe to native events
  useEffect(() => {
    const statusSub = CallerIdListener.addStatusListener((newStatus: CallerIdListenerStatus) => {
      setStatus(newStatus);
    });

    const callSub = CallerIdListener.addIncomingCallListener((call: CallerIdIncomingCall) => {
      setIncomingCall(call);
      setCallerName(null);
      
      searchCustomers(call.phoneNumber, 0, 1).then(({ data }) => {
        if (data && data.length > 0) {
          setCallerName(data[0].name);
        }
      }).catch(() => {});
      
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

    return () => {
      statusSub.remove();
      callSub.remove();
      rawSub.remove();
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
      setAcceptedCall({ phone: incomingCall.phoneNumber, name: callerName });
      router.push({
        pathname: '/pos',
        params: { incomingCallPhone: incomingCall.phoneNumber, incomingCallName: callerName ?? '' }
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
