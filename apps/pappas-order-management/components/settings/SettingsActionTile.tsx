import React from 'react';
import { StyleSheet } from 'react-native';
import { List } from 'react-native-paper';

type SettingsActionTileProps = {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
};

export function SettingsActionTile({ title, description, icon, onPress }: SettingsActionTileProps) {
  return (
    <List.Item
      title={title}
      description={description}
      onPress={onPress}
      left={(props) => <List.Icon {...props} icon={icon} />}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      style={styles.tile}
      titleStyle={styles.title}
      descriptionStyle={styles.description}
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    color: '#666',
  },
});
