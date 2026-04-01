import { Drawer } from 'expo-router/drawer';
import { View, StyleSheet, Alert } from 'react-native';
import { 
  DrawerContentScrollView, 
  DrawerItemList, 
  DrawerItem 
} from '@react-navigation/drawer';
import { 
  Avatar, 
  Title, 
  Caption, 
  Paragraph, 
  Drawer as PaperDrawer, 
  Divider,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { CustomDrawerContent } from '@/components/CustomDrawerContent';

export default function DrawerLayout() {
  const theme = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: '#666',
        drawerLabelStyle: {
          marginLeft: -10,
        },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: 'Home',
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
    </Drawer>
  );
}

const styles = StyleSheet.create({});

