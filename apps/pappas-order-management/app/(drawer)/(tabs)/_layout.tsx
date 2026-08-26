import React from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Appbar } from 'react-native-paper';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { marketplaceSyncAlertStore } from '@/stores/marketplaceSyncAlertStore';
import { getMarketplaceSyncIndicatorColor } from '@/lib/marketplace-sync-indicator';
import { BRAND_COLORS } from '@/utils/brand';

export default function TabsLayout() {
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { data: appSettings, isLoading: settingsLoading } = useAppSettingsQuery();
  const alerts = marketplaceSyncAlertStore((state) => state.alerts);
  const hasMarketplaceError = Object.values(alerts).some((alert) => alert?.visible);
  const marketplaceSyncColor = getMarketplaceSyncIndicatorColor(
    !settingsLoading && appSettings.marketplaceAutoSyncEnabled,
    hasMarketplaceError,
  );

  const handleOpenDrawer = () => {
    navigation.openDrawer();
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: BRAND_COLORS.header,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: () => (
          <Appbar.Action icon="menu" onPress={handleOpenDrawer} iconColor="#fff" />
        ),
        headerRight: () => (
          <React.Fragment>
            <Appbar.Action icon="storefront-outline" onPress={() => router.push('/marketplace')} iconColor={marketplaceSyncColor} />
            <Appbar.Action icon="account-circle" onPress={handleOpenDrawer} iconColor="#fff" />
          </React.Fragment>
        ),
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string;
          if (route.name === 'live-orders') {
            iconName = focused ? 'speedometer' : 'speedometer-outline';
          } else if (route.name === 'on-the-way') {
            iconName = focused ? 'car-sport' : 'car-sport-outline';
          } else if (route.name === 'completed') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          }
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#666',
      })}
    >
      <Tabs.Screen
        name="live-orders"
        options={{
          title: 'Live Orders',
          tabBarLabel: 'Live',
        }}
      />
      <Tabs.Screen
        name="on-the-way"
        options={{
          title: 'On the way',
          tabBarLabel: 'On the way',
        }}
      />
      <Tabs.Screen
        name="completed"
        options={{
          title: 'Completed',
          tabBarLabel: 'Completed',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarLabel: 'Menu',
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push('/pos');
          },
        }}
      />
    </Tabs>
  );
}
