import React from 'react';
import { View } from 'react-native';
import { Switch as PaperSwitch } from 'react-native-paper';

/** Keep the native switch centred when its surrounding row is taller. */
export function Switch({ style, ...props }: React.ComponentProps<typeof PaperSwitch>) {
  return <View style={{ width: 52, height: 32, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    <PaperSwitch hitSlop={8} {...props} style={[{ width: 51, height: 31 }, style]} />
  </View>;
}
