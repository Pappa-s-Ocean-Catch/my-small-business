"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { LoadingPage } from "@/components/Loading";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Modal from "@/components/Modal";
import { ActionButton } from "@/components/ActionButton";
import { 
  getAutomationSchedules, 
  createAutomationSchedule, 
  updateAutomationSchedule, 
  deleteAutomationSchedule, 
  toggleAutomationSchedule,
  getAutomationLogs,
  triggerAutomationNow
} from "@/app/actions/automation";
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaToggleOn, 
  FaToggleOff, 
  FaClock, 
  FaBell, 
  FaHistory,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaPlay,
  FaTimes,
  FaSave
} from "react-icons/fa";
import { toast } from 'react-toastify';
import type { AutomationSchedule, CreateScheduleRequest } from "@/lib/qstash";

export default function AutomationPage() {
  const [schedules, setSchedules] = useState<AutomationSchedule[]>([]);
  const [logs, setLogs] = useState<Array<{
    id: string;
    job_type: string;
    status: string;
    message: string;
    executed_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationSchedule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ schedule: AutomationSchedule | null; isOpen: boolean }>({ schedule: null, isOpen: false });
  const [showLogs, setShowLogs] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateScheduleRequest>({
    name: '',
    description: '',
    job_type: 'shift_reminder',
    schedule_type: 'daily',
    schedule_config: {
      time: '09:00',
      days: [1, 2, 3, 4, 5],
    },
    custom_config: {
      recipient_emails: [],
      days_to_check: 7,
      check_all_days: true,
    },
  });

  const fetchData = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const [schedulesResult, logsResult] = await Promise.all([
        getAutomationSchedules(currentUserId),
        getAutomationLogs(currentUserId),
      ]);

      if (schedulesResult.success) {
        setSchedules(schedulesResult.data || []);
      } else {
        toast.error(schedulesResult.error || 'Failed to fetch schedules');
      }

      if (logsResult.success) {
        setLogs((logsResult.data as Array<{
          id: string;
          job_type: string;
          status: string;
          message: string;
          executed_at: string;
        }>) || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Get current user on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { getSupabaseClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (user?.id) {
          setCurrentUserId(user.id);
        } else {
          console.error('No user found:', userError);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };
    
    void getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchData();
    }
  }, [currentUserId, fetchData]);

  const handleSubmit = async () => {
    if (!currentUserId) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      let result;
      if (editing) {
        result = await updateAutomationSchedule(editing.id, form, currentUserId);
      } else {
        result = await createAutomationSchedule(form, currentUserId);
      }

      if (result.success) {
        toast.success(editing ? 'Schedule updated successfully' : 'Schedule created successfully');
        setFormOpen(false);
        setEditing(null);
        resetForm();
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.schedule || !currentUserId) return;

    try {
      const result = await deleteAutomationSchedule(deleteConfirm.schedule.id, currentUserId);
      if (result.success) {
        toast.success('Schedule deleted successfully');
        setDeleteConfirm({ schedule: null, isOpen: false });
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const handleToggle = async (schedule: AutomationSchedule) => {
    if (!currentUserId) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      const result = await toggleAutomationSchedule(schedule.id, !schedule.is_enabled, currentUserId);
      if (result.success) {
        toast.success(`Schedule ${!schedule.is_enabled ? 'enabled' : 'disabled'} successfully`);
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to toggle schedule');
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error('Failed to toggle schedule');
    }
  };

  const handleTriggerNow = async (schedule: AutomationSchedule) => {
    if (!currentUserId) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      toast.info(`Triggering ${schedule.name}...`);
      
      // First, get the schedule details from the server action
      const result = await triggerAutomationNow(schedule.id, currentUserId);
      if (!result.success) {
        toast.error(result.error || 'Failed to get schedule details');
        return;
      }

      // Now make the API call directly from the frontend (with user cookies)
      const baseUrl = window.location.origin;
      let apiUrl: string;
      
      switch (schedule.job_type) {
        case 'shift_reminder':
          apiUrl = `${baseUrl}/api/automation/shift-reminders`;
          break;
        case 'low_stock_notification':
          apiUrl = `${baseUrl}/api/automation/low-stock-notifications`;
          break;
        case 'missing_shift_allocation':
          apiUrl = `${baseUrl}/api/automation/missing-shift-allocation`;
          break;
        default:
          toast.error('Unknown job type');
          return;
      }

      // Debug: Check if we have Supabase cookies in the browser
      console.log('🍪 Browser cookies:', document.cookie);
      
      // Get the user's access token for authentication
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('No valid session found. Please log in again.');
        return;
      }
      
      console.log('🔑 Access token found:', session.access_token.substring(0, 20) + '...');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`, // Include access token
        },
        body: JSON.stringify({
          schedule_id: schedule.id,
          job_type: schedule.job_type,
        }),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(`API call failed (${response.status}): ${errorText}`);
        return;
      }

      const apiResult = await response.json();
      
      if (apiResult.success) {
        toast.success(`${schedule.name} triggered successfully!`);
        await fetchData(); // Refresh to show updated last_run_at
      } else {
        toast.error(apiResult.error || 'Automation execution failed');
      }
    } catch (error) {
      console.error('Error triggering automation:', error);
      toast.error('Failed to trigger automation');
    }
  };

  const startEdit = (schedule: AutomationSchedule) => {
    setEditing(schedule);
    setForm({
      name: schedule.name,
      description: schedule.description || '',
      job_type: schedule.job_type,
      schedule_type: schedule.schedule_type,
      schedule_config: schedule.schedule_config,
      custom_config: schedule.custom_config || {
        recipient_emails: [],
        days_to_check: 7,
        check_all_days: true,
      },
    });
    setFormOpen(true);
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      job_type: 'shift_reminder',
      schedule_type: 'daily',
      schedule_config: {
        time: '09:00',
        days: [1, 2, 3, 4, 5],
      },
      custom_config: {
        recipient_emails: [],
        days_to_check: 7,
        check_all_days: true,
      },
    });
  };

  const getJobTypeIcon = (jobType: string) => {
    switch (jobType) {
      case 'shift_reminder':
        return <FaBell className="w-5 h-5 text-blue-600" />;
      case 'low_stock_notification':
        return <FaExclamationTriangle className="w-5 h-5 text-orange-600" />;
      case 'missing_shift_allocation':
        return <FaCalendarAlt className="w-5 h-5 text-red-600" />;
      default:
        return <FaClock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getJobTypeLabel = (jobType: string) => {
    switch (jobType) {
      case 'shift_reminder':
        return 'Shift Reminders';
      case 'low_stock_notification':
        return 'Low Stock Notifications';
      case 'missing_shift_allocation':
        return 'Missing Shift Allocation';
      default:
        return jobType;
    }
  };

  const formatSchedule = (schedule: AutomationSchedule) => {
    const { time, days } = schedule.schedule_config;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    if (schedule.schedule_type === 'daily') {
      return `Daily at ${time}`;
    } else if (schedule.schedule_type === 'weekly') {
      const dayList = days?.map(d => dayNames[d]).join(', ') || 'Mon-Fri';
      return `Weekly on ${dayList} at ${time}`;
    }
    
    return `${schedule.schedule_type} at ${time}`;
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automation</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage automated tasks and notifications
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FaHistory className="w-4 h-4" />
              {showLogs ? 'Hide' : 'Show'} Logs
            </button>
            <ActionButton
              onClick={async () => {
                setEditing(null);
                resetForm();
                setFormOpen(true);
              }}
              variant="primary"
              size="md"
              icon={<FaPlus className="w-4 h-4" />}
            >
              Add Schedule
            </ActionButton>
          </div>
        </div>

        {/* Schedules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white dark:bg-neutral-900 shadow-lg rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getJobTypeIcon(schedule.job_type)}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{schedule.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getJobTypeLabel(schedule.job_type)}
                    </p>
                  </div>
                </div>
                <ActionButton
                  onClick={async () => handleToggle(schedule)}
                  variant="secondary"
                  size="sm"
                  icon={schedule.is_enabled ? <FaToggleOn className="w-4 h-4" /> : <FaToggleOff className="w-4 h-4" />}
                  loadingText={schedule.is_enabled ? 'Disabling...' : 'Enabling...'}
                  title={schedule.is_enabled ? 'Disable' : 'Enable'}
                  className={`${
                    schedule.is_enabled
                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="sr-only">{schedule.is_enabled ? 'Disable' : 'Enable'}</span>
                </ActionButton>
              </div>

              {schedule.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {schedule.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <FaCalendarAlt className="w-4 h-4" />
                <span>{formatSchedule(schedule)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {schedule.last_run_at && (
                    <div>Last run: {new Date(schedule.last_run_at).toLocaleDateString()}</div>
                  )}
                  {schedule.next_run_at && (
                    <div>Next run: {new Date(schedule.next_run_at).toLocaleDateString()}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    onClick={async () => handleTriggerNow(schedule)}
                    variant="secondary"
                    size="sm"
                    icon={<FaPlay className="w-4 h-4" />}
                    loadingText="Triggering..."
                    title="Trigger Now"
                    className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <span className="sr-only">Trigger Now</span>
                  </ActionButton>
                  <button
                    onClick={() => startEdit(schedule)}
                    className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ schedule, isOpen: true })}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Logs Section */}
        {showLogs && (
          <div className="bg-white dark:bg-neutral-900 shadow-lg rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      log.status === 'success' ? 'bg-green-500' : 
                      log.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getJobTypeLabel(log.job_type)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {log.message}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {log.executed_at}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form Modal */}
        <Modal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            resetForm();
          }}
          title={editing ? 'Edit Schedule' : 'Add Schedule'}
          size="lg"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                  resetForm();
                }}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <FaTimes className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <ActionButton
                onClick={handleSubmit}
                variant="primary"
                size="md"
                icon={<FaSave className="w-4 h-4" />}
                loadingText={editing ? 'Updating...' : 'Creating...'}
              >
                {editing ? 'Update' : 'Create'}
              </ActionButton>
            </div>
          }
        >
          <form id="automation-form" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Type
                  </label>
                  <select
                    value={form.job_type}
                    onChange={(e) => setForm({ ...form, job_type: e.target.value as 'shift_reminder' | 'low_stock_notification' | 'missing_shift_allocation' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="shift_reminder">Shift Reminders</option>
                    <option value="low_stock_notification">Low Stock Notifications</option>
                    <option value="missing_shift_allocation">Missing Shift Allocation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Schedule Type
                  </label>
                  <select
                    value={form.schedule_type}
                    onChange={(e) => setForm({ ...form, schedule_type: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.schedule_config.time}
                    onChange={(e) => setForm({ 
                      ...form, 
                      schedule_config: { ...form.schedule_config, time: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>

                {form.schedule_type === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Days of Week
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <label key={day} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={form.schedule_config.days?.includes(index) || false}
                            onChange={(e) => {
                              const days = form.schedule_config.days || [];
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  schedule_config: {
                                    ...form.schedule_config,
                                    days: [...days, index]
                                  }
                                });
                              } else {
                                setForm({
                                  ...form,
                                  schedule_config: {
                                    ...form.schedule_config,
                                    days: days.filter(d => d !== index)
                                  }
                                });
                              }
                            }}
                            className="mr-1"
                          />
                          <span className="text-xs">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Configuration Fields */}
                {form.job_type === 'missing_shift_allocation' && (
                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Custom Configuration
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Days to Check
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={form.custom_config?.days_to_check || 7}
                        onChange={(e) => setForm({
                          ...form,
                          custom_config: {
                            ...form.custom_config,
                            days_to_check: parseInt(e.target.value) || 7
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Number of days ahead to check for missing shift allocations
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Recipient Emails (Optional)
                      </label>
                      <textarea
                        value={form.custom_config?.recipient_emails?.join(', ') || ''}
                        onChange={(e) => {
                          const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean);
                          setForm({
                            ...form,
                            custom_config: {
                              ...form.custom_config,
                              recipient_emails: emails
                            }
                          });
                        }}
                        placeholder="admin@example.com, manager@example.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                        rows={2}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Comma-separated list of email addresses. Leave empty to use admin emails.
                      </p>
                    </div>
                  </div>
                )}

                {form.job_type === 'low_stock_notification' && (
                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Custom Configuration
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Recipient Emails (Optional)
                      </label>
                      <textarea
                        value={form.custom_config?.recipient_emails?.join(', ') || ''}
                        onChange={(e) => {
                          const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean);
                          setForm({
                            ...form,
                            custom_config: {
                              ...form.custom_config,
                              recipient_emails: emails
                            }
                          });
                        }}
                        placeholder="admin@example.com, manager@example.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                        rows={2}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Comma-separated list of email addresses. Leave empty to use admin emails.
                      </p>
                    </div>
                  </div>
                )}
          </form>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ schedule: null, isOpen: false })}
          onConfirm={handleDelete}
          title="Delete Automation Schedule"
          message={`Are you sure you want to delete "${deleteConfirm.schedule?.name}"? This will stop all automated tasks for this schedule.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </AdminGuard>
  );
}
