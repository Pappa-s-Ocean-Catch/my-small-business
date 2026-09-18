import { Pressable, StyleSheet, View, Image } from 'react-native';

export function IdleImageDisplay({ onOpenSettings, imageUri }: { onOpenSettings: () => void; imageUri?: string }) {
  return (
    <Pressable
      style={styles.container}
      onLongPress={onOpenSettings}
      delayLongPress={800}
      accessibilityRole="button"
      accessibilityLabel="Welcome display. Long press to open settings."
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <Image source={require('../../assets/idle-artwork.jpg')} style={styles.image} resizeMode="cover" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { width: '100%', height: '100%' },
});
