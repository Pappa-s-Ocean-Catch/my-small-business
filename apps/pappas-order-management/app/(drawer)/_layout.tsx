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
        name="about"
        options={{
          drawerLabel: 'About',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="information-outline" color={color} size={size} />
          ),
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({});
