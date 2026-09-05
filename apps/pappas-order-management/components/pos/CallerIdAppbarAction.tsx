import React from 'react';
import { Appbar, useTheme } from 'react-native-paper';
import { useCallerId } from '@/providers/CallerIdListenerProvider';

export const CallerIdAppbarAction: React.FC = () => {
  const { status, enabled } = useCallerId();
  const theme = useTheme();

  if (!enabled) return null;

  let iconName = 'phone-off';
  let color = theme.colors.onSurfaceDisabled;

  switch (status.state) {
    case 'listening':
      iconName = 'phone-in-talk';
      color = theme.colors.primary;
      break;
    case 'error':
      iconName = 'alert-circle';
      color = theme.colors.error;
      break;
    case 'starting':
      iconName = 'sync';
      color = theme.colors.primary;
      break;
  }

  return <Appbar.Action icon={iconName} iconColor={color} accessibilityLabel="Caller ID status" />;
};
