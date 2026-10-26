import { Drawer } from 'expo-router/drawer';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CustomDrawerContent } from '@/components/CustomDrawerContent';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { designTokens as t } from '@/lib/redesign';

export default function DrawerLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 600;

  return (
    <View style={{ flex: 1, flexDirection: compact ? 'column' : 'row', backgroundColor: t.color.background }}>
      {!compact && <AppNavigation />}
      <View style={{ flex: 1, minWidth: 0 }}>
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        swipeEnabled: false,
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: t.color.muted,
        drawerLabelStyle: {
          marginLeft: -10,
        },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: 'Orders',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="pre-orders"
        options={{
          drawerLabel: 'Pre-orders',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="customers"
        options={{
          drawerLabel: 'Customers',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="marketing"
        options={{
          drawerLabel: 'Marketing',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bullhorn-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="coupons"
        options={{
          drawerLabel: 'Coupons',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="ticket-percent-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="marketplace"
        options={{
          drawerLabel: 'Marketplace',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="delivery-management"
        options={{
          drawerLabel: 'Deliveries',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="truck-delivery-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="report"
        options={{
          drawerLabel: 'Report',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-line" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          drawerLabel: 'Settings',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="call-history"
        options={{
          drawerLabel: 'Call History',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="phone-log" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="about"
        options={{
          drawerLabel: 'About',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="information-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="tv-menu"
        options={{
          drawerLabel: 'TV Menu',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="television" color={color} size={size} />
          ),
        }}
      />
    </Drawer>
      </View>
      {compact && <AppNavigation />}
    </View>
  );
}
