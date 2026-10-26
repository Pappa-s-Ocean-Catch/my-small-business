import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { useRouter } from 'expo-router';
import { ManagementRow } from '@/components/ui/ManagementRow';
import { SearchField } from '@/components/ui';
import { WorkspaceHeader } from '@/components/ui';
import { useWindowDimensions } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { FormField } from '@/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Checkbox, IconButton, Portal, Switch, Text } from 'react-native-paper';
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
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 600;
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
  const [groupBaseline, setGroupBaseline] = useState('');
  const [itemBaseline, setItemBaseline] = useState('');
  useEffect(() => { if (groupDialogVisible) setGroupBaseline(JSON.stringify(groupForm)); }, [groupDialogVisible]);
  useEffect(() => { if (itemDialogVisible) setItemBaseline(JSON.stringify(itemForm)); }, [itemDialogVisible]);


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
      <WorkspaceHeader title="Add-on groups" onBack={() => router.replace('/menu-management')} />
      <ScrollView
        contentContainerStyle={[styles.content, { padding: compact ? 12 : 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}
      >
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 8, alignItems: 'stretch' }}><SearchField placeholder="Search groups or items" value={searchQuery} onChangeText={setSearchQuery} style={{ flex: compact ? undefined : 1 }} /><Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={openCreateGroup}>Add group</Button></View>
        {filteredGroups.map((group) => {
          const expanded = searchQuery.trim() ? true : !!expandedGroupIds[group.id];
          return <View key={group.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: t.color.border, overflow: 'hidden', backgroundColor: t.color.surface }}>
            <ManagementRow style={{ minHeight: 94, padding: 20, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: expanded ? 1 : 0 }} title={group.name} description={`${group.items.length} items · ${group.is_active === false ? 'Inactive' : 'Active'} · ${group.is_required ? 'Required' : 'Optional'}`} onEdit={() => openEditGroup(group)} onDelete={() => confirmDeleteGroup(group)} actions={<><IconButton style={{ margin: 0, width: 38, height: 44, borderRadius: 10, borderWidth: 1, borderColor: t.color.border }} size={16} icon={expanded ? 'chevron-up' : 'chevron-down'} accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${group.name}`} accessibilityState={{ expanded }} onPress={() => setExpandedGroupIds((prev) => ({ ...prev, [group.id]: !prev[group.id] }))} /><Button mode="outlined" contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} hitSlop={2} onPress={() => openCreateItem(group.id)}>Add item</Button></>} />
            {expanded && <>
              <Text style={{ padding: 16, color: t.color.muted }}>{group.multiple_choice === false ? 'Single choice' : 'Multiple choice'}{group.description ? ` · ${group.description}` : ''}</Text>
              {group.items.map((item) => <ManagementRow style={{ borderLeftWidth: 0, borderRightWidth: 0 }} key={item.id} indent title={item.name} description={`$${(item.extra_price ?? 0).toFixed(2)} · ${formatSectionList(parseSectionList(item.section)) || 'Default Fried'} · Sort ${item.sort_order ?? 0}`} active={item.is_active !== false} onEdit={() => openEditItem(group.id, item)} onDelete={() => confirmDeleteItem(item)} />)}
            </>}
          </View>;
        })}

        {!loading && filteredGroups.length === 0 && (
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? 'No matching add-ons found.' : 'No add-on groups found.'}
          </Text>
        )}
      </ScrollView>



      <Portal>
        <EditorSheet visible={groupDialogVisible} title={editingGroup ? 'Edit add-on group' : 'New add-on group'} pending={saving} dirty={JSON.stringify(groupForm) !== groupBaseline} onDismiss={() => setGroupDialogVisible(false)} footer={(dismiss) => <><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={saving} onPress={dismiss}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={saving || !groupForm.name.trim()} loading={saving} onPress={() => void saveGroup()}>Save group</Button></>}>
              <FormField mode="outlined" label="Name" value={groupForm.name} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, name: value }))} />
              <FormField mode="outlined" label="Description" value={groupForm.description} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, description: value }))} multiline />
              <FormField mode="outlined" label="Sort order" value={groupForm.sortOrder} onChangeText={(value) => setGroupForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <View style={styles.switchRow}>
                <Text>Required</Text>
                <View style={styles.switchControl}><Switch style={{ height: 32 }} value={groupForm.isRequired} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, isRequired: value }))} /></View>
              </View>
              <View style={styles.switchRow}>
                <Text>Allow multiple</Text>
                <View style={styles.switchControl}><Switch style={{ height: 32 }} value={groupForm.multipleChoice} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, multipleChoice: value }))} /></View>
              </View>
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <View style={styles.switchControl}><Switch style={{ height: 32 }} value={groupForm.isActive} onValueChange={(value) => setGroupForm((prev) => ({ ...prev, isActive: value }))} /></View>
              </View>
        </EditorSheet>

        <EditorSheet visible={itemDialogVisible} title={editingItem ? 'Edit item' : 'New item'} pending={saving} dirty={JSON.stringify(itemForm) !== itemBaseline} onDismiss={() => setItemDialogVisible(false)} footer={(dismiss) => <><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={saving} onPress={dismiss}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={saving || !itemForm.name.trim()} loading={saving} onPress={() => void saveItem()}>Save item</Button></>}>
              <FormField mode="outlined" label="Name" value={itemForm.name} onChangeText={(value) => setItemForm((prev) => ({ ...prev, name: value }))} />
              <FormField mode="outlined" label="Extra price" value={itemForm.extraPrice} onChangeText={(value) => setItemForm((prev) => ({ ...prev, extraPrice: value }))} keyboardType="decimal-pad" />
              <Text variant="labelMedium">Kitchen sections</Text>
              <View style={styles.checkboxList}>
                {KITCHEN_SECTION_OPTIONS.map((option) => {
                  const selectedSections = parseSectionList(itemForm.section);
                  const checked = selectedSections.includes(option);
                  return (
                    <Checkbox.Item mode="android"
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
              <FormField mode="outlined" label="Sort order" value={itemForm.sortOrder} onChangeText={(value) => setItemForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <View style={styles.switchControl}><Switch style={{ height: 32 }} value={itemForm.isActive} onValueChange={(value) => setItemForm((prev) => ({ ...prev, isActive: value }))} /></View>
              </View>
        </EditorSheet>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  groupActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: t.color.border },
  screen: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  content: {
    padding: 12,
    paddingBottom: 120,
    gap: 16,
  },
  managementNavWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  infoBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: t.color.surface,
  },
  infoBannerContent: {
    gap: 4,
  },
  card: {
    overflow: 'hidden',
    backgroundColor: t.color.surface,
    borderWidth: 1, borderColor: t.color.border,
    borderRadius: t.radius.card,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  groupMeta: {
    paddingTop: 0,
    gap: 4,
  },
  mutedText: {
    color: t.color.muted,
  },
  helperText: {
    color: t.color.muted,
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
    color: t.color.muted,
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
  switchControl: {
    height: 32,
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
});
