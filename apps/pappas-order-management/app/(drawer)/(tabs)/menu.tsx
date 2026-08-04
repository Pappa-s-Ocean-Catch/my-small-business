import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export default function MenuTabScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleMedium" style={styles.title}>Menu</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>Use the tab again if POS does not open automatically.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    color: '#0f172a',
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
  },
});
