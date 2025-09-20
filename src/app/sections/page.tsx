'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import Modal from '@/components/Modal';
import Card from '@/components/Card';
import { FaPlus, FaEdit, FaTrash, FaPalette, FaTimes, FaSave, FaToggleOn, FaToggleOff, FaGripVertical } from 'react-icons/fa';
import { getSupabaseClient } from '@/lib/supabase/client';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  arrayMove,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateSectionOrder } from '@/app/actions/sections';

interface Section {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  sort_order: number;
}

export default function SectionsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Section | null>(null);
  const [showToggleDialog, setShowToggleDialog] = useState<Section | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    sort_order: 0
  });

  const supabase = getSupabaseClient();

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchSections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchSections();
  }, [fetchSections]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      color: '#3B82F6',
      sort_order: sections.length + 1 // Auto-set to next available order
    });
    setEditingSection(null);
  };

  const startEdit = (section: Section) => {
    setForm({
      name: section.name,
      description: section.description || '',
      color: section.color,
      sort_order: section.sort_order
    });
    setEditingSection(section);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (editingSection) {
        const { error } = await supabase
          .from('sections')
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            color: form.color,
            sort_order: form.sort_order
          })
          .eq('id', editingSection.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sections')
          .insert({
            name: form.name.trim(),
            description: form.description.trim() || null,
            color: form.color,
            sort_order: form.sort_order
          });

        if (error) throw error;
      }

      await fetchSections();
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Error saving section:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;

    try {
      const { error } = await supabase
        .from('sections')
        .update({ active: false })
        .eq('id', showDeleteDialog.id);

      if (error) throw error;

      await fetchSections();
      setShowDeleteDialog(null);
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  const toggleActive = async () => {
    if (!showToggleDialog) return;

    try {
      const { error } = await supabase
        .from('sections')
        .update({ active: !showToggleDialog.active })
        .eq('id', showToggleDialog.id);

      if (error) throw error;

      await fetchSections();
      setShowToggleDialog(null);
    } catch (error) {
      console.error('Error toggling section:', error);
    }
  };

  // Drag & drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const oldIndex = sections.findIndex(section => section.id === active.id);
    const newIndex = sections.findIndex(section => section.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveId(null);
      return;
    }

    // Update local state immediately for better UX
    const newSections = arrayMove(sections, oldIndex, newIndex);
    setSections(newSections);
    setActiveId(null);

    // Update sort orders in the database
    try {
      const updatedSections = newSections.map((section, index) => ({
        id: section.id,
        sort_order: index + 1
      }));

      const result = await updateSectionOrder({ sections: updatedSections });
      
      if (!result.success) {
        console.error('Failed to update section order:', result.error);
        // Revert local state on error
        await fetchSections();
      }
    } catch (error) {
      console.error('Error updating section order:', error);
      // Revert local state on error
      await fetchSections();
    }
  };

  // Sortable Section Component
  function SortableSection({ section }: { section: Section }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: section.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`transition-all ${isDragging ? 'opacity-50 z-50' : ''}`}
      >
        <Card
          variant={section.active ? "elevated" : "outlined"}
          padding="md"
          className={`transition-all ${
            section.active
              ? ''
              : 'opacity-60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Drag to reorder"
              >
                <FaGripVertical className="w-4 h-4 text-gray-400" />
              </div>
              
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: section.color }}
              />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {section.name}
                </h3>
                {section.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {section.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Order: {section.sort_order}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    section.active
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {section.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowToggleDialog(section)}
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors ${
                  section.active
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
                }`}
              >
                {section.active ? (
                  <>
                    <FaToggleOff className="w-3 h-3" />
                    <span>Deactivate</span>
                  </>
                ) : (
                  <>
                    <FaToggleOn className="w-3 h-3" />
                    <span>Activate</span>
                  </>
                )}
              </button>
              <button
                onClick={() => startEdit(section)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded transition-colors"
              >
                <FaEdit className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => setShowDeleteDialog(section)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded transition-colors"
              >
                <FaTrash className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-3 sm:p-6 max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shop Sections</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Drag sections by the grip handle to reorder them
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Add Section
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4">
              {sections.map((section) => (
                <SortableSection key={section.id} section={section} />
              ))}
            </div>
          </SortableContext>
          
          <DragOverlay>
            {activeId ? (
              <div className="opacity-50">
                <SortableSection section={sections.find(s => s.id === activeId)!} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {sections.length === 0 && (
          <div className="text-center py-12">
            <FaPalette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No sections found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first shop section to organize shifts by work areas.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaPlus className="w-4 h-4" />
              Add Section
            </button>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        <Modal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
          title={editingSection ? 'Edit Section' : 'Add Section'}
          size="md"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <FaTimes className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                form="section-form"
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <FaSave className="w-4 h-4" />
                <span>{editingSection ? 'Update' : 'Create'}</span>
              </button>
            </>
          }
        >
          <form id="section-form" onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Fry, Cashier, Grill"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of this section's responsibilities"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={!!showDeleteDialog}
          onClose={() => setShowDeleteDialog(null)}
          onConfirm={handleDelete}
          title="Deactivate Section"
          message={`Are you sure you want to deactivate "${showDeleteDialog?.name}"? This will hide it from the calendar but preserve existing shifts.`}
          confirmText="Deactivate"
          variant="danger"
        />

        {/* Toggle Status Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={!!showToggleDialog}
          onClose={() => setShowToggleDialog(null)}
          onConfirm={toggleActive}
          title={showToggleDialog?.active ? "Deactivate Section" : "Activate Section"}
          message={
            showToggleDialog?.active
              ? `Are you sure you want to deactivate "${showToggleDialog?.name}"? This will hide it from the system but preserve existing data.`
              : `Are you sure you want to activate "${showToggleDialog?.name}"? This will make it available for use.`
          }
          confirmText={showToggleDialog?.active ? "Deactivate" : "Activate"}
          variant={showToggleDialog?.active ? "warning" : "info"}
        />
      </div>
    </AdminGuard>
  );
}
