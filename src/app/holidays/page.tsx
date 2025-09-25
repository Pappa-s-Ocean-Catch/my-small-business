"use client";

import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaCopy, FaEdit, FaTrash, FaCalendarAlt } from "react-icons/fa";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { useSnackbar } from "@/components/Snackbar";
import Modal from "@/components/Modal";
import { ActionButton } from "@/components/ActionButton";
import { 
  getHolidaysForYear, 
  createHoliday, 
  updateHoliday, 
  deleteHoliday, 
  cloneHolidaysToYear,
  getAvailableYears,
  type PublicHoliday,
  type CreateHolidayData 
} from "@/app/actions/holidays";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<PublicHoliday | null>(null);
  const { showSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<CreateHolidayData>({
    name: "",
    holiday_date: "",
    year: selectedYear,
    markup_percentage: 150,
    markup_amount: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [holidaysData, yearsData] = await Promise.all([
        getHolidaysForYear(selectedYear),
        getAvailableYears(),
      ]);
      setHolidays(holidaysData);
      setAvailableYears(yearsData);
    } catch (error) {
      console.error("Error loading data:", error);
      showSnackbar("Failed to load holidays", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, showSnackbar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createHoliday(formData);
      if (result.success) {
        setShowCreateModal(false);
        setFormData({ name: "", holiday_date: "", year: selectedYear, markup_percentage: 150, markup_amount: 0 });
        await loadData();
        showSnackbar("Holiday created successfully", "success");
      } else {
        showSnackbar(result.error || "Failed to create holiday", "error");
      }
    } catch (error) {
      console.error("Error creating holiday:", error);
      showSnackbar("Failed to create holiday", "error");
    }
  };

  const handleUpdateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;

    try {
      const result = await updateHoliday({
        id: editingHoliday.id,
        name: formData.name,
        holiday_date: formData.holiday_date,
        year: formData.year,
        markup_percentage: formData.markup_percentage,
        markup_amount: formData.markup_amount,
      });

      if (result.success) {
        setShowEditModal(false);
        setEditingHoliday(null);
        setFormData({ name: "", holiday_date: "", year: selectedYear, markup_percentage: 150, markup_amount: 0 });
        await loadData();
        showSnackbar("Holiday updated successfully", "success");
      } else {
        showSnackbar(result.error || "Failed to update holiday", "error");
      }
    } catch (error) {
      console.error("Error updating holiday:", error);
      showSnackbar("Failed to update holiday", "error");
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deletingHoliday) return;

    try {
      const result = await deleteHoliday(deletingHoliday.id);
      if (result.success) {
        setShowDeleteDialog(false);
        setDeletingHoliday(null);
        await loadData();
        showSnackbar("Holiday deleted successfully", "success");
      } else {
        showSnackbar(result.error || "Failed to delete holiday", "error");
      }
    } catch (error) {
      console.error("Error deleting holiday:", error);
      showSnackbar("Failed to delete holiday", "error");
    }
  };

  const handleCloneHolidays = async () => {
    try {
      const result = await cloneHolidaysToYear(selectedYear, selectedYear + 1);
      if (result.success) {
        setShowCloneModal(false);
        showSnackbar(`Successfully cloned ${result.clonedCount} holidays to ${selectedYear + 1}`, "success");
        await loadData();
      } else {
        showSnackbar(result.error || "Failed to clone holidays", "error");
      }
    } catch (error) {
      console.error("Error cloning holidays:", error);
      showSnackbar("Failed to clone holidays", "error");
    }
  };

  const openEditModal = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      holiday_date: holiday.holiday_date,
      year: holiday.year,
      markup_percentage: holiday.markup_percentage,
      markup_amount: holiday.markup_amount,
    });
    setShowEditModal(true);
  };

  const openDeleteDialog = (holiday: PublicHoliday) => {
    setDeletingHoliday(holiday);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatRate = (holiday: PublicHoliday) => {
    if (holiday.markup_percentage > 0) {
      return `${holiday.markup_percentage}% (${holiday.markup_percentage === 150 ? 'Time & Half' : 'Custom'})`;
    }
    if (holiday.markup_amount > 0) {
      return `+$${holiday.markup_amount.toFixed(2)}`;
    }
    return 'No adjustment';
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <FaCalendarAlt className="text-blue-600 dark:text-blue-400" />
                  Public Holidays Management
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Manage public holidays and staff rate adjustments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ActionButton
                  onClick={() => setShowCloneModal(true)}
                  variant="success"
                  icon={<FaCopy className="w-4 h-4" />}
                >
                  Clone to {selectedYear + 1}
                </ActionButton>
                <ActionButton
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  icon={<FaPlus className="w-4 h-4" />}
                >
                  Add Holiday
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Holidays List */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading holidays...</p>
              </div>
            ) : holidays.length === 0 ? (
              <div className="p-8 text-center">
                <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No holidays</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No public holidays found for {selectedYear}.
                </p>
                <div className="mt-6">
                  <ActionButton
                    onClick={() => setShowCreateModal(true)}
                    variant="primary"
                    icon={<FaPlus className="w-4 h-4" />}
                  >
                    Add Holiday
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
                  <thead className="bg-gray-50 dark:bg-neutral-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Holiday
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Rate Adjustment
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
                    {holidays.map((holiday) => (
                      <tr key={holiday.id} className="hover:bg-gray-50 dark:hover:bg-neutral-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {holiday.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDate(holiday.holiday_date)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatRate(holiday)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(holiday)}
                              className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                              title="Edit holiday"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteDialog(holiday)}
                              className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title="Delete holiday"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create Holiday Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Add New Holiday"
          size="md"
        >
          <form onSubmit={handleCreateHoliday} className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Markup Percentage
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.markup_percentage}
                  onChange={(e) => setFormData({ ...formData, markup_percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Markup Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.markup_amount}
                  onChange={(e) => setFormData({ ...formData, markup_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </form>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-neutral-600 rounded-md hover:bg-gray-300 dark:hover:bg-neutral-500 transition-colors"
            >
              Cancel
            </button>
            <ActionButton
              onClick={async () => {
                await handleCreateHoliday({ preventDefault: () => {} } as React.FormEvent);
              }}
              variant="primary"
              icon={<FaPlus className="w-4 h-4" />}
            >
              Create Holiday
            </ActionButton>
          </div>
        </Modal>

        {/* Edit Holiday Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Holiday"
          size="md"
        >
          <form onSubmit={handleUpdateHoliday} className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Markup Percentage
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.markup_percentage}
                  onChange={(e) => setFormData({ ...formData, markup_percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Markup Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.markup_amount}
                  onChange={(e) => setFormData({ ...formData, markup_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </form>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-neutral-600 rounded-md hover:bg-gray-300 dark:hover:bg-neutral-500 transition-colors"
            >
              Cancel
            </button>
            <ActionButton
              onClick={async () => {
                await handleUpdateHoliday({ preventDefault: () => {} } as React.FormEvent);
              }}
              variant="primary"
              icon={<FaEdit className="w-4 h-4" />}
            >
              Update Holiday
            </ActionButton>
          </div>
        </Modal>

        {/* Clone Holidays Modal */}
        <Modal
          isOpen={showCloneModal}
          onClose={() => setShowCloneModal(false)}
          title="Clone Holidays"
          size="md"
        >
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will copy all holidays from {selectedYear} to {selectedYear + 1}. 
              If holidays already exist for {selectedYear + 1}, this operation will be cancelled.
            </p>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setShowCloneModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-neutral-600 rounded-md hover:bg-gray-300 dark:hover:bg-neutral-500 transition-colors"
            >
              Cancel
            </button>
            <ActionButton
              onClick={handleCloneHolidays}
              variant="success"
              icon={<FaCopy className="w-4 h-4" />}
            >
              Clone Holidays
            </ActionButton>
          </div>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteHoliday}
          title="Delete Holiday"
          message={`Are you sure you want to delete "${deletingHoliday?.name}"? This action cannot be undone.`}
        />

      </div>
    </AdminGuard>
  );
}
