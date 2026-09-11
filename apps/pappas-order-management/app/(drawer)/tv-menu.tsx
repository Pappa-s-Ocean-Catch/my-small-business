import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, Image } from 'react-native';
import { Text, Button, Card, ActivityIndicator, IconButton, Switch, useTheme, Appbar } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

type TVMenu = {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  sort_order: number;
};

export default function TVMenuScreen() {
  const [menus, setMenus] = useState<TVMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tv_menus')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setMenus(data || []);
    } catch (error: any) {
      Alert.alert('Error fetching menus', error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadMenu = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      const file = result.assets[0];
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `menus/${fileName}`;

      // Convert local URI to Blob for upload
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('tv_menus')
        .upload(filePath, blob, {
          contentType: file.mimeType || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tv_menus')
        .getPublicUrl(filePath);

      // Insert into database
      const { error: dbError } = await supabase.from('tv_menus').insert({
        name: file.name,
        url: publicUrl,
        is_active: true,
        sort_order: menus.length,
      });

      if (dbError) throw dbError;

      Alert.alert('Success', 'Menu uploaded successfully');
      fetchMenus();
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteMenu = async (id: string, url: string) => {
    Alert.alert('Delete Menu', 'Are you sure you want to delete this menu?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete from database
            const { error: dbError } = await supabase.from('tv_menus').delete().eq('id', id);
            if (dbError) throw dbError;

            // Extract file path from URL and delete from storage
            const filePathMatch = url.match(/tv_menus\/(.+)$/);
            if (filePathMatch && filePathMatch[1]) {
              await supabase.storage.from('tv_menus').remove([filePathMatch[1]]);
            }

            fetchMenus();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tv_menus')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setMenus(menus.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === menus.length - 1)) {
      return;
    }

    const newMenus = [...menus];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap items
    const temp = newMenus[index];
    newMenus[index] = newMenus[swapIndex];
    newMenus[swapIndex] = temp;

    // Update sort_order for both items
    newMenus[index].sort_order = index;
    newMenus[swapIndex].sort_order = swapIndex;

    setMenus(newMenus);

    try {
      // Bulk update is not easily supported in free supabase, do sequential updates
      await supabase.from('tv_menus').update({ sort_order: index }).eq('id', newMenus[index].id);
      await supabase.from('tv_menus').update({ sort_order: swapIndex }).eq('id', newMenus[swapIndex].id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update ordering');
      fetchMenus(); // revert
    }
  };

  const renderItem = ({ item, index }: { item: TVMenu; index: number }) => (
    <Card style={styles.card}>
      <View style={styles.cardContent}>
        <Image source={{ uri: item.url }} style={styles.thumbnail} />
        <View style={styles.menuInfo}>
          <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.actionRow}>
            <Text style={{ marginRight: 8, color: item.is_active ? theme.colors.primary : 'gray' }}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
            <Switch
              value={item.is_active}
              onValueChange={() => toggleActive(item.id, item.is_active)}
            />
          </View>
        </View>
        <View style={styles.orderingControls}>
          <IconButton
            icon="chevron-up"
            disabled={index === 0}
            onPress={() => moveOrder(index, 'up')}
          />
          <IconButton
            icon="chevron-down"
            disabled={index === menus.length - 1}
            onPress={() => moveOrder(index, 'down')}
          />
        </View>
        <IconButton
          icon="delete"
          iconColor="red"
          onPress={() => deleteMenu(item.id, item.url)}
        />
      </View>
    </Card>
  );

  const navigation = useNavigation<DrawerNavigationProp<any>>();

  return (
    <>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="TV Menu Management" titleStyle={{ color: '#fff' }} />
      </Appbar.Header>
      <View style={styles.container}>
      
      <View style={styles.header}>
        <Button
          mode="contained"
          icon="upload"
          onPress={uploadMenu}
          loading={uploading}
          disabled={uploading}
        >
          Upload New Menu Image
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : menus.length === 0 ? (
        <Text style={styles.emptyText}>No menu images found. Upload one to get started.</Text>
      ) : (
        <FlatList
          data={menus}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 16,
  },
  menuName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderingControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: 'gray',
    fontSize: 16,
  },
});
