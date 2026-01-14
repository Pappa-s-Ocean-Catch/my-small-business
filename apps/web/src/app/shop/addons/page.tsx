'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaChevronDown, FaChevronRight, FaTag, FaDollarSign, FaCheck, FaTimes } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Modal from '@/components/Modal';
import { ActionButton } from '@/components/ActionButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'react-toastify';
import {
  getAddonGroups,
  createAddonGroup,
  updateAddonGroup,
  deleteAddonGroup,
  createAddonItem,
  updateAddonItem,
  deleteAddonItem,
  type AddonGroupWithItems,
  type AddonItem
} from '@/app/actions/addons';

export default function AddonsPage() {
  const { isAdmin } = useAdmin();
  const [addonGroups, setAddonGroups] = useState<AddonGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AddonGroupWithItems | null>(null);
  const [editingItem, setEditingItem] = useState<{ item: AddonItem; groupId: string } | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'group' | 'item'; id: string; name: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Form states
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    is_required: false,
    sort_order: 0,
    is_active: true
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    extra_price: 0,
    sort_order: 0,
    is_active: true
  });

  // Load data
  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAddonGroups();
      
      if (result.error) {
        setError(result.error);
        return;
      }

      setAddonGroups(result.data || []);
      // Expand all groups by default
      if (result.data) {
        setExpandedGroups(new Set(result.data.map(g => g.id)));
      }
    } catch (err) {
      setError('Failed to load add-on groups');
      console.error('Error loading add-on groups:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Modal handlers
  const openGroupModal = (group?: AddonGroupWithItems) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        description: group.description || '',
        is_required: group.is_required,
        sort_order: group.sort_order,
        is_active: group.is_active
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: '',
        description: '',
        is_required: false,
        sort_order: addonGroups.length,
        is_active: true
      });
    }
    setShowGroupModal(true);
  };

  const openItemModal = (groupId: string, item?: AddonItem) => {
    if (item) {
      setEditingItem({ item, groupId });
      setCurrentGroupId(groupId);
      setItemForm({
        name: item.name,
        extra_price: item.extra_price,
        sort_order: item.sort_order,
        is_active: item.is_active
      });
    } else {
      setEditingItem(null);
      setCurrentGroupId(groupId);
      const group = addonGroups.find(g => g.id === groupId);
      setItemForm({
        name: '',
        extra_price: 0,
        sort_order: group?.items.length || 0,
        is_active: true
      });
    }
    setShowItemModal(true);
  };

  const openDeleteDialog = (type: 'group' | 'item', id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setShowDeleteDialog(true);
  };

  // Form submission handlers
  const handleGroupSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      if (editingGroup) {
        const result = await updateAddonGroup(editingGroup.id, groupForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Add-on group updated successfully');
      } else {
        const result = await createAddonGroup(groupForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Add-on group created successfully');
      }
      setShowGroupModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save add-on group');
      console.error('Error saving add-on group:', err);
    }
  };

  const handleItemSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      if (editingItem) {
        const result = await updateAddonItem(editingItem.item.id, {
          name: itemForm.name,
          extra_price: itemForm.extra_price,
          sort_order: itemForm.sort_order,
          is_active: itemForm.is_active
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Add-on item updated successfully');
      } else {
        // Use the current group ID from when modal was opened
        const groupId = currentGroupId || addonGroups[0]?.id;
        if (!groupId) {
          toast.error('No group available. Please create a group first.');
          return;
        }
        const result = await createAddonItem({
          addon_group_id: groupId,
          ...itemForm
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Add-on item created successfully');
      }
      setShowItemModal(false);
      setCurrentGroupId(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save add-on item');
      console.error('Error saving add-on item:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    try {
      let result;
      if (deletingItem.type === 'group') {
        result = await deleteAddonGroup(deletingItem.id);
      } else {
        result = await deleteAddonItem(deletingItem.id);
      }
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success(`${deletingItem.type === 'group' ? 'Add-on group' : 'Add-on item'} deleted successfully`);
      setShowDeleteDialog(false);
      loadData();
    } catch (err) {
      toast.error(`Failed to delete ${deletingItem.type}`);
      console.error('Error deleting:', err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Add-ons</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Icon icon={FaTag} className="text-blue-600" />
                Add-ons Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage add-on groups and items that can be attached to menu items
              </p>
            </div>
            <ActionButton
              onClick={() => openGroupModal()}
              icon={<Icon icon={FaPlus} />}
            >
              Add Group
            </ActionButton>
          </div>
        </div>

        {/* Add-on Groups List */}
        <div className="space-y-4">
          {addonGroups.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700">
              <Icon icon={FaTag} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No add-on groups yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Get started by creating your first add-on group
              </p>
              <button
                onClick={() => openGroupModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Icon icon={FaPlus} className="h-4 w-4 mr-2" />
                Add Group
              </button>
            </div>
          ) : (
            addonGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700"
              >
                {/* Group Header */}
                <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                      >
                        {expandedGroups.has(group.id) ? (
                          <Icon icon={FaChevronDown} className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Icon icon={FaChevronRight} className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {group.name}
                          </h3>
                          {group.is_required && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Required
                            </span>
                          )}
                          {!group.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {group.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openItemModal(group.id)}
                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Add item"
                      >
                        <Icon icon={FaPlus} className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openGroupModal(group)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit group"
                      >
                        <Icon icon={FaEdit} className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteDialog('group', group.id, group.name)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete group"
                      >
                        <Icon icon={FaTrash} className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Group Items */}
                {expandedGroups.has(group.id) && (
                  <div className="p-4">
                    {group.items.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">No items in this group yet</p>
                        <button
                          onClick={() => openItemModal(group.id)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Add first item
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-700 rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {item.name}
                                  </span>
                                  {!item.is_active && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Icon icon={FaDollarSign} className="h-3 w-3" />
                                    {item.extra_price.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openItemModal(group.id, item)}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit item"
                              >
                                <Icon icon={FaEdit} className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteDialog('item', item.id, item.name)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete item"
                              >
                                <Icon icon={FaTrash} className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Group Modal */}
        <Modal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          title={editingGroup ? 'Edit Add-on Group' : 'Add Add-on Group'}
          size="md"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Icon icon={FaTimes} className="h-4 w-4" />
                Cancel
              </button>
              <ActionButton
                onClick={handleGroupSubmit}
                icon={<Icon icon={FaCheck} />}
              >
                {editingGroup ? 'Update' : 'Create'}
              </ActionButton>
            </div>
          }
        >
          <form onSubmit={handleGroupSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                required
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                placeholder="e.g., Extras, Sauces, Sizes"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                placeholder="Optional description for this add-on group"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupForm.is_required}
                  onChange={(e) => setGroupForm({ ...groupForm, is_required: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Required (at least one item must be selected)
                </span>
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupForm.is_active}
                  onChange={(e) => setGroupForm({ ...groupForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort Order
              </label>
              <input
                type="number"
                value={groupForm.sort_order}
                onChange={(e) => setGroupForm({ ...groupForm, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                min="0"
              />
            </div>
          </form>
        </Modal>

        {/* Item Modal */}
        <Modal
          isOpen={showItemModal}
          onClose={() => {
            setShowItemModal(false);
            setCurrentGroupId(null);
          }}
          title={editingItem ? 'Edit Add-on Item' : 'Add Add-on Item'}
          size="md"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Icon icon={FaTimes} className="h-4 w-4" />
                Cancel
              </button>
              <ActionButton
                onClick={handleItemSubmit}
                icon={<Icon icon={FaCheck} />}
              >
                {editingItem ? 'Update' : 'Create'}
              </ActionButton>
            </div>
          }
        >
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                required
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                placeholder="e.g., Extra Cheese, Bacon, Large Size"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Extra Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={itemForm.extra_price}
                  onChange={(e) => setItemForm({ ...itemForm, extra_price: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemForm.is_active}
                  onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort Order
              </label>
              <input
                type="number"
                value={itemForm.sort_order}
                onChange={(e) => setItemForm({ ...itemForm, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                min="0"
              />
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title={`Delete ${deletingItem?.type === 'group' ? 'Add-on Group' : 'Add-on Item'}`}
          message={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
        />
      </div>
    </div>
  );
}
