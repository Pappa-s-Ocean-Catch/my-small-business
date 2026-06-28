import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Dialog, FAB, IconButton, List, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  createMobileAddonGroup,
  createMobileAddonItem,
  deleteMobileAddonGroup,
  deleteMobileAddonItem,
  fetchMobileAddonGroups,
  MobileAddonGroup,
  MobileAddonItem,
  updateMobileAddonGroup,
  updateMobileAddonItem,
} from '@/lib/menu-admin';

type GroupFormState = {
  name: string;
  description: string;
  sortOrder: string;
  isRequired: boolean;
  multipleChoice: boolean;
  isActive: boolean;
};

type ItemFormState = {
  name: string;
  extraPrice: string;
  section: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyGroupForm: GroupFormState = {
  name: '',
  description: '',
  sortOrder: '0',
  isRequired: false,
  multipleChoice: true,
  isActive: true,
};

const emptyItemForm: ItemFormState = {
  name: '',
  extraPrice: '0',
  section: '',
  sortOrder: '0',
  isActive: true,
};

const KITCHEN_SECTION_OPTIONS = ['Fried', 'Grilled', 'Till'];

const parseIntSafe = (value: string, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatSafe = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSectionList = (value?: string | null) =>
  Array.from(
    new Set(
      (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is string => KITCHEN_SECTION_OPTIONS.includes(item))
    )
  );

const formatSectionList = (values: string[]) => parseSectionList(values.join(',')).join(',');

export default function AddonsManagementScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<MobileAddonGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [groupDialogVisible, setGroupDialogVisible] = useState(false);
  const [itemDialogVisible, setItemDialogVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MobileAddonGroup | null>(null);
  const [editingItem, setEditingItem] = useState<MobileAddonItem | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);

  const loadData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      const nextGroups = await fetchMobileAddonGroups();
      setGroups(nextGroups);
      setExpandedGroupIds((prev) => {
        const next = { ...prev };
        nextGroups.forEach((group) => {
          if (next[group.id] === undefined) next[group.id] = false;
        });
        return next;
      });
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Unable to load add-ons.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groups;

    return groups
      .map((group) => {
        const matchesGroup =
          group.name.toLowerCase().includes(query)
          || group.description?.toLowerCase().includes(query);
        const matchingItems = group.items.filter((item) =>
          item.name.toLowerCase().includes(query)
          || item.section?.toLowerCase().includes(query)
        );

        if (matchesGroup) return group;
        if (matchingItems.length > 0) return { ...group, items: matchingItems };
        return null;
      })
      .filter((group): group is MobileAddonGroup => Boolean(group));
  }, [groups, searchQuery]);

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setGroupDialogVisible(true);
  };

  const openEditGroup = (group: MobileAddonGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      sortOrder: String(group.sort_order ?? 0),
      isRequired: group.is_required === true,
      multipleChoice: group.multiple_choice !== false,
      isActive: group.is_active !== false,
    });
    setGroupDialogVisible(true);
  };

  const openCreateItem = (groupId: string) => {
    setSelectedGroupId(groupId);
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemDialogVisible(true);
  };

  const openEditItem = (groupId: string, item: MobileAddonItem) => {
    setSelectedGroupId(groupId);
    setEditingItem(item);
    setItemForm({
      name: item.name,
      extraPrice: String(item.extra_price ?? 0),
      section: formatSectionList(parseSectionList(item.section)),
      sortOrder: String(item.sort_order ?? 0),
      isActive: item.is_active !== false,
    });
    setItemDialogVisible(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: groupForm.name,
        description: groupForm.description,
        sort_order: parseIntSafe(groupForm.sortOrder),
        is_required: groupForm.isRequired,
        multiple_choice: groupForm.multipleChoice,
        is_active: groupForm.isActive,
      };
      if (editingGroup) await updateMobileAddonGroup(editingGroup.id, payload);
      else await createMobileAddonGroup(payload);
      setGroupDialogVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save group.');
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    if (!selectedGroupId) {
      Alert.alert('Group required', 'Please choose a group first.');
      return;
    }
    if (!itemForm.name.trim()) {
      Alert.alert('Name required', 'Please enter an item name.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: itemForm.name,
        extra_price: parseFloatSafe(itemForm.extraPrice),
        section: formatSectionList(parseSectionList(itemForm.section)),
        sort_order: parseIntSafe(itemForm.sortOrder),
        is_active: itemForm.isActive,
      };
      if (editingItem) await updateMobileAddonItem(editingItem.id, payload);
      else await createMobileAddonItem({ addon_group_id: selectedGroupId, ...payload });
      setItemDialogVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteGroup = (group: MobileAddonGroup) => {
    Alert.alert('Delete group', `Delete "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMobileAddonGroup(group.id);
            await loadData();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete group.');
          }
        },
      },
    ]);
  };

  const confirmDeleteItem = (item: MobileAddonItem) => {
    Alert.alert('Delete item', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMobileAddonItem(item.id);
            await loadData();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete item.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Add-ons Management" subtitle="Groups and items" />
      </Appbar.Header>

      <View style={styles.managementNavWrap}>
        <SegmentedButtons
          value="addons"
          onValueChange={(value) => {
            if (value === 'menu') router.push('/menu-management');
          }}
          buttons={[
            { value: 'menu', label: 'Menu' },
            { value: 'addons', label: 'Add-ons' },
          ]}
        />
      </View>

      <Card style={styles.infoBanner}>
        <Card.Content style={styles.infoBannerContent}>
          <Text variant="titleSmall">Manage option groups</Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            Add-on item sections have highest priority and can override both product and group fallback sections.
          </Text>
        </Card.Content>
      </Card>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}
      >
        <TextInput
          mode="outlined"
          label="Search groups or items"
          value={searchQuery}
          onChangeText={setSearchQuery}
          left={<TextInput.Icon icon="magnify" />}
        />

        {filteredGroups.map((group) => (
          <Card key={group.id} style={styles.card}>
            <List.Accordion
              title={group.name}
              description={`${group.items.length} items • sort #${group.sort_order ?? 0} • ${group.is_active === false ? 'Inactive' : 'Active'}`}
              expanded={searchQuery.trim() ? true : expandedGroupIds[group.id] === true}
              onPress={() => setExpandedGroupIds((prev) => ({ ...prev, [group.id]: prev[group.id] === false }))}
              left={(props) => <List.Icon {...props} icon="shape-outline" />}
              right={() => (
                <View style={styles.headerActions}>
                  <IconButton icon="plus" onPress={() => openCreateItem(group.id)} />
                  <IconButton icon="pencil" onPress={() => openEditGroup(group)} />
                  <IconButton icon="delete-outline" onPress={() => confirmDeleteGroup(group)} />
                </View>
              )}
            >
              <Card.Content style={styles.groupMeta}>
                <Text variant="bodySmall" style={styles.mutedText}>
                  {group.multiple_choice === false ? 'Single choice' : 'Multiple choice'} • {group.is_required ? 'Required' : 'Optional'}
                </Text>
                {group.description ? <Text variant="bodySmall" style={styles.mutedText}>{group.description}</Text> : null}
              </Card.Content>
              {group.items.map((item) => (
                <List.Item
                  key={item.id}
                  title={item.name}
                  description={`$${(item.extra_price ?? 0).toFixed(2)} • ${formatSectionList(parseSectionList(item.section)) || 'Default Fried'} • sort #${item.sort_order ?? 0}`}
                  left={(props) => <List.Icon {...props} icon="plus-circle-outline" />}
                  right={() => (
                    <View style={styles.headerActions}>
                      <IconButton icon="pencil" onPress={() => openEditItem(group.id, item)} />
                      <IconButton icon="delete-outline" onPress={() => confirmDeleteItem(item)} />
                    </View>
                  )}
                />
              ))}
            </List.Accordion>
          </Card>
        ))}

        {!loading && filteredGroups.length === 0 && (
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? 'No matching add-ons found.' : 'No add-on groups found.'}
          </Text>
        )}
      </ScrollView>

      <FAB icon="plus" label="Add Group" style={styles.fab} onPress={openCreateGroup} />

      <Portal>
        <Dialog visible={groupDialogVisible} onDismiss={() => setGroupDialogVisible(false)}>
          <Dialog.Title>{editingGroup ? 'Edit Group' : 'New Group'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput mode="outlined" label="Name" value={groupForm.name} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, name: value }))} />
              <TextInput mode="outlined" label="Description" value={groupForm.description} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, description: value }))} multiline />
              <TextInput mode="outlined" label="Sort order" value={groupForm.sortOrder} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <View style={styles.switchRow}>
                <Text>Required</Text>
                <Switch value={groupForm.isRequired} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, isRequired: value }))} />
              </View>
              <View style={styles.switchRow}>
                <Text>Allow multiple</Text>
                <Switch value={groupForm.multipleChoice} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, multipleChoice: value }))} />
              </View>
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <Switch value={groupForm.isActive} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, isActive: value }))} />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setGroupDialogVisible(false)}>Cancel</Button>
            <Button loading={saving} onPress={() => void saveGroup()}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={itemDialogVisible} onDismiss={() => setItemDialogVisible(false)}>
          <Dialog.Title>{editingItem ? 'Edit Item' : 'New Item'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput mode="outlined" label="Name" value={itemForm.name} onChangeText={(value) => setItemForm((prev) => ({ ...prev, name: value }))} />
              <TextInput mode="outlined" label="Extra price" value={itemForm.extraPrice} onChangeText={(value) => setItemForm((prev) => ({ ...prev, extraPrice: value }))} keyboardType="decimal-pad" />
              <Text variant="labelMedium">Kitchen sections</Text>
              <View style={styles.checkboxList}>
                {KITCHEN_SECTION_OPTIONS.map((option) => {
                  const selectedSections = parseSectionList(itemForm.section);
                  const checked = selectedSections.includes(option);
                  return (
                    <Checkbox.Item
                      key={option}
                      label={option}
                      status={checked ? 'checked' : 'unchecked'}
                      onPress={() => setItemForm((prev) => {
                        const current = parseSectionList(prev.section);
                        const next = current.includes(option)
                          ? current.filter((item) => item !== option)
                          : [...current, option];
                        return { ...prev, section: formatSectionList(next) };
                      })}
                      style={styles.checkboxItem}
                    />
                  );
                })}
              </View>
              <Text variant="bodySmall" style={styles.helperText}>
                Select one or more sections. Leave everything unchecked to keep the default fried behavior.
              </Text>
              <TextInput mode="outlined" label="Sort order" value={itemForm.sortOrder} onChangeText={(value) => setItemForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <Switch value={itemForm.isActive} onValueChange={(value) => setItemForm((prev) => ({ ...prev, isActive: value }))} />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setItemDialogVisible(false)}>Cancel</Button>
            <Button loading={saving} onPress={() => void saveItem()}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  managementNavWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  infoBannerContent: {
    gap: 4,
  },
  card: {
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupMeta: {
    paddingTop: 0,
    gap: 4,
  },
  mutedText: {
    color: '#6b7280',
  },
  helperText: {
    color: '#6b7280',
    marginTop: -4,
  },
  checkboxList: {
    gap: 2,
  },
  checkboxItem: {
    paddingHorizontal: 0,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialogContent: {
    gap: 12,
    paddingBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
