import React from 'react';
import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { OrdersWorkspaceHeader } from '@/components/navigation/OrdersWorkspaceHeader';
export default function TabsLayout() {
  const pathname = usePathname();
  const isOrders = /\/(live-orders|on-the-way|completed|orders)$/.test(pathname);
  return <View style={{ flex: 1 }}>
    {isOrders && <OrdersWorkspaceHeader />}
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, freezeOnBlur: true }}>
      <Tabs.Screen name="live-orders" options={{ title: 'Live orders' }} />
      <Tabs.Screen name="on-the-way" options={{ title: 'On the way' }} />
      <Tabs.Screen name="completed" options={{ title: 'Completed' }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="menu" options={{ href: null }} />
    </Tabs>
  </View>;
}
