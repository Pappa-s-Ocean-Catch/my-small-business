import { Tabs } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from 'react-native';
import { Appbar } from 'react-native-paper';

export default function TabsLayout() {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => (
          <Appbar.Action icon="logout" onPress={handleLogout} iconColor="#fff" />
        ),
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string;
          if (route.name === 'live-orders') {
            iconName = focused ? 'speedometer' : 'speedometer-outline';
          } else if (route.name === 'orders') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else {
            iconName = focused ? 'settings' : 'settings-outline';
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
        name="orders"
        options={{
          title: 'Order History',
          tabBarLabel: 'History',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
