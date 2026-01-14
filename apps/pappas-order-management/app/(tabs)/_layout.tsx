import { Tabs } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Appbar } from 'react-native-paper';

export default function TabsLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
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
          const name =
            route.name === 'orders'
              ? focused
                ? 'receipt'
                : 'receipt-outline'
              : focused
                ? 'settings'
                : 'settings-outline';
          return <Ionicons name={name as any} size={size} color={color} />;
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
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: 'Orders',
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
