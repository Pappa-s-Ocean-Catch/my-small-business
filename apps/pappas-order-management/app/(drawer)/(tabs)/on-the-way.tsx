import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function OnTheWayScreen() {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>On the way</Text>
          <Text variant="bodyMedium" style={styles.body}>
            Delivery workflow will live here. For now this tab is reserved for driver and delivery tracking.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
  },
  content: {
    gap: 8,
  },
  title: {
    color: '#0f172a',
    fontWeight: '800',
  },
  body: {
    color: '#64748b',
    lineHeight: 22,
  },
});
