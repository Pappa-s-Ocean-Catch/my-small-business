import { Switch } from '@/components/ui/Switch';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { Panel, StatusBadge } from '@/components/ui';
import { WorkspaceHeader } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, Image, Platform, useWindowDimensions } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { uploadTVMenuImage, getImageDownloadName, downloadAndShareMenuImage } from '@/lib/tv-menu-images';

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
  const [preview, setPreview] = useState<TVMenu | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { height, width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const columns = contentWidth >= 1100 ? 3 : contentWidth >= 700 ? 2 : 1;
  const gutter = contentWidth >= 1100 ? 16 : 12;
  const cardWidth = Math.max(0, (contentWidth - gutter * 2 - (columns - 1) * 16) / columns);

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
    <Panel style={{ width: cardWidth, flexGrow: 0, flexShrink: 0, gap: 14, padding: width < 600 ? 18 : 20 }}>
      <Image source={{ uri: item.url }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: t.color.navy }} resizeMode="contain" accessibilityLabel={item.name} onLoad={(event) => { const { width, height } = event.nativeEvent.source; setDimensions((prev) => ({ ...prev, [item.id]: { width, height } })); }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: t.color.text }}>{item.name}</Text><StatusBadge label={item.is_active ? 'Active' : 'Inactive'} tone={item.is_active ? 'success' : 'neutral'} /></View>
      <Text style={{ color: t.color.muted, fontSize: 14 }}>{dimensions[item.id] ? `${dimensions[item.id].width} × ${dimensions[item.id].height} · ` : ''}Position {index + 1}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => openPreview(item)} accessibilityLabel={`Preview ${item.name}`}>Preview</Button><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => downloadMenu(item)} loading={downloadingId === item.id} disabled={downloadingId !== null}>Download</Button></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={index === 0} accessibilityLabel={`Move ${item.name} up`} onPress={() => moveOrder(index, 'up')}>Move ↑</Button><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={index === menus.length - 1} accessibilityLabel={`Move ${item.name} down`} onPress={() => moveOrder(index, 'down')}>Move ↓</Button><Button mode="outlined" contentStyle={{ minHeight: 48 }} textColor={t.color.danger} style={{ backgroundColor: t.color.dangerTint }} onPress={() => deleteMenu(item.id, item.url)}>Delete</Button></View>
      <View style={{ minHeight: 64, borderBottomWidth: 1, borderColor: t.color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text>Visible on TV</Text><Switch accessibilityLabel={`Show ${item.name} on TV`} value={item.is_active} onValueChange={() => toggleActive(item.id, item.is_active)} /></View>
    </Panel>
  );


  return <View style={{ flex: 1, backgroundColor: t.color.background }} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
    <EditorSheet visible={preview !== null} title="Preview menu image" subtitle={preview?.name} size="wide" onDismiss={() => setPreview(null)} footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setPreview(null)}>Close</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} loading={downloadingId === preview?.id} disabled={downloadingId !== null} onPress={() => preview && downloadMenu(preview)}>Download image</Button></>}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{preview && <Image key={preview.id} source={{ uri: preview.url }} style={{ width: '100%', height: Math.min(480, height * 0.55), borderRadius: 10, backgroundColor: t.color.navy }} resizeMode="contain" accessibilityLabel={preview.name} onLoad={() => setPreviewLoading(false)} onError={() => { setPreviewLoading(false); setPreviewError(true); }} />}{previewLoading && <ActivityIndicator style={{ position: 'absolute' }} accessibilityLabel="Loading image preview" />}</View>
      {previewError && <Text role="alert">Could not load this image. Check your connection and reopen the preview.</Text>}
    </EditorSheet>
    <WorkspaceHeader title="TV menus" />
    <View style={{ paddingHorizontal: gutter, paddingVertical: width < 600 ? 24 : 16, flexDirection: width < 600 ? 'column' : 'row', gap: 16, alignItems: width < 600 ? 'stretch' : 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><Text style={{ color: t.color.muted }}>Menu images displayed on your connected TVs.</Text><Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={uploadMenu} loading={uploading} disabled={uploading}>Upload menu image</Button></View>
    {loading ? <ActivityIndicator style={{ marginTop: 50 }} size="large" /> : menus.length === 0 ? <Text style={styles.emptyText}>No menu images found. Upload one to get started.</Text> : <FlatList key={columns} numColumns={columns} data={menus} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 28, gap: 16 }} columnWrapperStyle={columns > 1 ? { gap: 16, alignItems: 'flex-start' } : undefined} />}
  </View>;
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
    backgroundColor: t.color.background,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    backgroundColor: t.color.surface,
    borderWidth: 1, borderColor: t.color.border,
    borderRadius: t.radius.card,
  },
  cardContent: {
    flexDirection: 'row',
    flexWrap: 'wrap', gap: 12,
    padding: 16,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: t.radius.card,
    backgroundColor: '#e0e0e0',
  },
  menuInfo: {
    flex: 1,
    minWidth: 140,
    marginLeft: 0,
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
