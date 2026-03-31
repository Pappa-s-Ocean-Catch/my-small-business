import React, { useEffect, useState } from 'react';
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

/**
 * Custom Drawer Content to include Profile and Sign Out
 */
export function CustomDrawerContent(props: any) {
  const router = useRouter();
  const theme = useTheme();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

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

  const userInitial = user?.email?.[0].toUpperCase() || 'U';

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <View style={styles.drawerContent}>
          <View style={styles.userInfoSection}>
            <View style={{ flexDirection: 'row', marginTop: 15 }}>
              <Avatar.Text 
                label={userInitial} 
                size={50} 
                style={{ backgroundColor: theme.colors.primary }} 
              />
              <View style={{ marginLeft: 15, flexDirection: 'column' }}>
                <Title style={styles.title}>{user?.email?.split('@')[0] || 'User'}</Title>
                <Caption style={styles.caption}>{user?.email || 'pappa@oceancatch.com'}</Caption>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.section}>
                <Paragraph style={[styles.paragraph, styles.caption]}>Order Mgmt</Paragraph>
                <Caption style={styles.caption}>Role: Admin/Staff</Caption>
              </View>
            </View>
          </View>

          <PaperDrawer.Section style={styles.drawerSection}>
            <DrawerItemList {...props} />
          </PaperDrawer.Section>
        </View>
      </DrawerContentScrollView>

      <PaperDrawer.Section style={styles.bottomDrawerSection}>
        <Divider />
        <DrawerItem 
          icon={({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size} />
          )}
          label="Profile"
          onPress={() => {
            Alert.alert('Profile', `Logged in as: ${user?.email}`);
          }}
        />
        <DrawerItem 
          icon={({ color, size }) => (
            <MaterialCommunityIcons name="logout" color={color} size={size} />
          )}
          label="Sign Out"
          onPress={handleLogout}
        />
      </PaperDrawer.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  userInfoSection: {
    paddingLeft: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    marginTop: 3,
    fontWeight: 'bold',
  },
  caption: {
    fontSize: 14,
    lineHeight: 14,
  },
  row: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    flexDirection: 'column',
    marginRight: 15,
  },
  paragraph: {
    fontWeight: 'bold',
    marginRight: 3,
  },
  drawerSection: {
    marginTop: 15,
  },
  bottomDrawerSection: {
    marginBottom: 15,
    borderTopColor: '#f4f4f4',
    borderTopWidth: 1,
  },
});
