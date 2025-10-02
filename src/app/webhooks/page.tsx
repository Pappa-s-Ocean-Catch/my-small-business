'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { AdminGuard } from '@/components/AdminGuard';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaKey, FaGlobe } from 'react-icons/fa';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

type Webhook = {
  id: string;
  name: string;
  description: string | null;
  webhook_type: 'transaction' | 'inventory' | 'customer' | 'order';
  secret_ref: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ webhook: Webhook | null; isOpen: boolean }>({ webhook: null, isOpen: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    webhook_type: 'transaction' as 'transaction' | 'inventory' | 'customer' | 'order',
    is_enabled: true,
    auth_header_name: '',
    auth_header_value: ''
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      setError('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (webhook: Webhook) => {
    setEditing(webhook);
    setForm({
      name: webhook.name,
      description: webhook.description || '',
      webhook_type: webhook.webhook_type,
      is_enabled: webhook.is_enabled,
      auth_header_name: '',
      auth_header_value: ''
    });
    setShowForm(true);
  };

  const startAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      webhook_type: 'transaction',
      is_enabled: true,
      auth_header_name: '',
      auth_header_value: ''
    });
    setShowForm(true);
  };

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();

      // If we have auth header values, save them to Doppler first
      let secretRef = null;
      if (form.auth_header_name && form.auth_header_value) {
        const response = await fetch('/api/webhooks/save-secret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookId: editing?.id || 'new',
            headerName: form.auth_header_name,
            headerValue: form.auth_header_value
          })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to save authentication secret');
        }
        secretRef = result.secretRef;
      }

      const webhookData = {
        name: form.name,
        description: form.description || null,
        webhook_type: form.webhook_type,
        is_enabled: form.is_enabled,
        secret_ref: secretRef || editing?.secret_ref || null,
        created_by: currentUserId
      };

      if (editing) {
        const { error } = await supabase
          .from('webhooks')
          .update(webhookData)
          .eq('id', editing.id);

        if (error) throw error;
        setSuccess('Webhook updated successfully');
      } else {
        const { error } = await supabase
          .from('webhooks')
          .insert(webhookData);

        if (error) throw error;
        setSuccess('Webhook created successfully');
      }

      await loadWebhooks();
      setShowForm(false);
      setEditing(null);
    } catch (error) {
      console.error('Error saving webhook:', error);
      setError(error instanceof Error ? error.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async (webhook: Webhook) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhook.id);

      if (error) throw error;
      setSuccess('Webhook deleted successfully');
      await loadWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      setError('Failed to delete webhook');
    }
  };

  const toggleWebhook = async (webhook: Webhook) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('webhooks')
        .update({ is_enabled: !webhook.is_enabled })
        .eq('id', webhook.id);

      if (error) throw error;
      setSuccess(`Webhook ${!webhook.is_enabled ? 'enabled' : 'disabled'} successfully`);
      await loadWebhooks();
    } catch (error) {
      console.error('Error toggling webhook:', error);
      setError('Failed to toggle webhook');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading webhooks...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Webhook Configuration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure webhooks to receive transaction data from external systems
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Add Button */}
        <div className="mb-6">
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>

        {/* Webhooks List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {webhooks.length === 0 ? (
            <div className="p-8 text-center">
              <FaGlobe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No webhooks configured</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first webhook to start receiving transaction data from external systems.
              </p>
              <button
                onClick={startAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="w-4 h-4" />
                Add Webhook
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Auth
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {webhook.name}
                          </div>
                          {webhook.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {webhook.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          webhook.webhook_type === 'transaction' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                            : webhook.webhook_type === 'inventory'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200'
                            : webhook.webhook_type === 'customer'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200'
                        }`}>
                          {webhook.webhook_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleWebhook(webhook)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                            webhook.is_enabled
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/30'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-900/30'
                          }`}
                        >
                          {webhook.is_enabled ? (
                            <>
                              <FaToggleOn className="w-3 h-3" />
                              Enabled
                            </>
                          ) : (
                            <>
                              <FaToggleOff className="w-3 h-3" />
                              Disabled
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {webhook.secret_ref ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <FaKey className="w-3 h-3" />
                            <span className="text-xs">Secured</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">No auth</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(webhook)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit webhook"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ webhook, isOpen: true })}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete webhook"
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

        {/* Webhook Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {editing ? 'Edit Webhook' : 'Add Webhook'}
                </h2>

                <form onSubmit={saveWebhook} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., POS System Webhook"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Optional description of this webhook's purpose"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Webhook Type *
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={form.webhook_type}
                      onChange={(e) => setForm(f => ({ ...f, webhook_type: e.target.value as 'transaction' | 'inventory' | 'customer' | 'order' }))}
                    >
                      <option value="transaction">Transaction</option>
                      <option value="inventory">Inventory</option>
                      <option value="customer">Customer</option>
                      <option value="order">Order</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Type of data this webhook will process
                    </p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Configure header-based authentication for this webhook
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Header Name
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          value={form.auth_header_name}
                          onChange={(e) => setForm(f => ({ ...f, auth_header_name: e.target.value }))}
                          placeholder="X-API-Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Header Value
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          value={form.auth_header_value}
                          onChange={(e) => setForm(f => ({ ...f, auth_header_value: e.target.value }))}
                          placeholder="Secret value"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_enabled"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={form.is_enabled}
                      onChange={(e) => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
                    />
                    <label htmlFor="is_enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Enable webhook
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : (editing ? 'Update' : 'Create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ webhook: null, isOpen: false })}
          onConfirm={() => {
            if (deleteConfirm.webhook) {
              deleteWebhook(deleteConfirm.webhook);
              setDeleteConfirm({ webhook: null, isOpen: false });
            }
          }}
          title="Delete Webhook"
          message={`Are you sure you want to delete the webhook "${deleteConfirm.webhook?.name}"? This action cannot be undone.`}
        />
      </div>
    </div>
    </AdminGuard>
  );
}
