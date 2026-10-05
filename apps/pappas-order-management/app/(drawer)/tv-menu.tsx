import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, Image, Modal, Platform, useWindowDimensions } from 'react-native';
import { Text, Button, Card, ActivityIndicator, IconButton, Switch, useTheme, Appbar } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uploadTVMenuImage, getImageDownloadName, downloadAndShareMenuImage } from '@/lib/tv-menu-images';
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
  const [preview, setPreview] = useState<TVMenu | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { height } = useWindowDimensions();

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
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      const file = result.assets[0];
      await uploadTVMenuImage(file, menus.length, {
        read: async (asset) => {
          if (Platform.OS !== 'web') return new File(asset.uri).arrayBuffer();
          const response = await fetch(asset.uri);
          if (!response.ok) throw new Error(`File read failed (${response.status})`);
          return response.arrayBuffer();
        },
        upload: async (path, bytes, contentType) => {
          const { error } = await supabase.storage.from('tv_menus').upload(path, bytes, { contentType, upsert: false });
          if (error) throw error;
          return supabase.storage.from('tv_menus').getPublicUrl(path).data.publicUrl;
        },
        save: async (row) => {
          const { error } = await supabase.from('tv_menus').insert(row);
          if (error) throw error;
        },
        remove: async (path) => {
          const { error } = await supabase.storage.from('tv_menus').remove([path]);
          if (error) throw error;
        },
      });

      Alert.alert('Success', 'Menu uploaded successfully');
      fetchMenus();
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const openPreview = (item: TVMenu) => {
    setPreviewError(false);
    setPreviewLoading(true);
    setPreview(item);
  };

  const downloadMenu = async (item: TVMenu) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    try {
      const name = getImageDownloadName(item.name, item.url);
      if (Platform.OS === 'web') {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Saving or sharing files is unavailable on this device.');
        if (!FileSystem.cacheDirectory) throw new Error('Download storage is unavailable.');
        const localUri = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
        await downloadAndShareMenuImage(localUri, {
          download: async (uri) => {
            const result = await FileSystem.downloadAsync(item.url, uri);
            if (result.status < 200 || result.status >= 300) throw new Error(`Download failed (${result.status})`);
          },
          share: async (uri) => { await Sharing.shareAsync(uri, { dialogTitle: 'Save menu image' }); },
          remove: async (uri) => { await FileSystem.deleteAsync(uri, { idempotent: true }); },
        });
      }
    } catch (error: any) {
      Alert.alert('Download Error', error.message || 'Could not download the image.');
    } finally {
      setDownloadingId(null);
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
        <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="contain" accessibilityLabel={item.name} />
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
      <Card.Actions style={styles.imageActions}>
        <Button icon="image-search" onPress={() => openPreview(item)} accessibilityLabel={`Preview ${item.name}`}>Preview</Button>
        <Button icon="download" onPress={() => downloadMenu(item)} loading={downloadingId === item.id} disabled={downloadingId !== null} accessibilityLabel={`Download ${item.name}`}>Download</Button>
      </Card.Actions>
    </Card>
  );

  const navigation = useNavigation<DrawerNavigationProp<any>>();

  return (
    <>
      <Modal visible={preview !== null} animationType="fade" onRequestClose={() => setPreview(null)}>
        <SafeAreaView style={[styles.previewContainer, { backgroundColor: theme.colors.background }]}>
          <Appbar.Header statusBarHeight={0}>
            <Appbar.Content title={preview?.name || 'Image preview'} />
            <Appbar.Action icon="close" accessibilityLabel="Close image preview" onPress={() => setPreview(null)} />
          </Appbar.Header>
          <View style={styles.previewBody}>
            {preview && <Image
              key={preview.id}
              source={{ uri: preview.url }}
              style={[styles.previewImage, { height: height * 0.65 }]}
              resizeMode="contain"
              accessibilityLabel={preview.name}
              onLoad={() => setPreviewLoading(false)}
              onError={() => { setPreviewLoading(false); setPreviewError(true); }}
            />}
            {previewLoading && <ActivityIndicator style={styles.previewIndicator} accessibilityLabel="Loading image preview" />}
            {previewError && <Text role="alert">Could not load this image. Check your connection and reopen the preview.</Text>}
          </View>
          <Button style={styles.previewDownload} mode="contained" icon="download" loading={downloadingId === preview?.id} disabled={downloadingId !== null} onPress={() => preview && downloadMenu(preview)}>Download image</Button>
          <Text style={styles.downloadHint}>Choose where to save or share the image.</Text>
        </SafeAreaView>
      </Modal>
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
  imageActions: { flexWrap: 'wrap', gap: 8 },
  previewContainer: { flex: 1 },
  previewBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  previewImage: { width: '100%' },
  previewIndicator: { position: 'absolute' },
  previewDownload: { marginHorizontal: 16 },
  downloadHint: { textAlign: 'center', margin: 16 },
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
