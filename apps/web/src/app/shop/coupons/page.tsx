'use client';

import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/app/actions/coupons';
import { type Coupon } from '@/lib/coupons';
import { type PromotionDiscountType } from '@/lib/promotions';
import { Icon } from '@/components/Icon';
import { FaTicketAlt, FaPlus, FaTrash, FaEdit, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import { LoadingSpinner } from '@/components/Loading';

function toDateTimeLocalValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

const DEFAULT_FORM = {
    code: '',
    title: '',
    description: '',
    is_active: true,
    discount_type: 'percent' as PromotionDiscountType,
    discount_value: 10,
    starts_at_local: '',
    ends_at_local: '',
    max_uses: null as number | null,
    max_uses_per_user: 1 as number | null,
    user_id: '',
    target_email: '',
    min_cart_subtotal: 0,
};

export default function CouponsAdminPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [coupons, setCoupons] = useState<Coupon[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState(DEFAULT_FORM);

    useEffect(() => {
        void loadCoupons();
    }, []);

    const loadCoupons = async () => {
        try {
            setLoading(true);
            const res = await getCoupons();
            if (res.error) throw new Error(res.error);
            setCoupons(res.data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load coupons');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setForm(DEFAULT_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (c: Coupon) => {
        setEditingId(c.id);
        setForm({
            code: c.code,
            title: c.title,
            description: c.description || '',
            is_active: c.is_active,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            starts_at_local: toDateTimeLocalValue(c.starts_at),
            ends_at_local: toDateTimeLocalValue(c.ends_at),
            max_uses: c.max_uses,
            max_uses_per_user: c.max_uses_per_user,
            user_id: c.user_id || '',
            target_email: c.target_email || '',
            min_cart_subtotal: c.min_cart_subtotal,
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const payload = {
                code: form.code.trim().toUpperCase(),
                title: form.title.trim(),
                description: form.description.trim() || null,
                is_active: form.is_active,
                discount_type: form.discount_type,
                discount_value: Number(form.discount_value || 0),
                starts_at: fromDateTimeLocalValue(form.starts_at_local),
                ends_at: fromDateTimeLocalValue(form.ends_at_local),
                max_uses: form.max_uses !== null ? Number(form.max_uses) : null,
                max_uses_per_user: form.max_uses_per_user !== null ? Number(form.max_uses_per_user) : null,
                user_id: form.user_id.trim() || null,
                target_email: form.target_email.trim() || null,
                min_cart_subtotal: Number(form.min_cart_subtotal || 0),
            };

            const res = editingId 
                ? await updateCoupon(editingId, payload) 
                : await createCoupon(payload);

            if (res.error) throw new Error(res.error);

            await loadCoupons();
            setIsModalOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save coupon');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon? This will also remove all redemption records.')) return;

        try {
            const res = await deleteCoupon(id);
            if (res.error) throw new Error(res.error);
            await loadCoupons();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete coupon');
        }
    };

    const getStatusBadge = (c: Coupon) => {
        if (!c.is_active) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-300">
                    <Icon icon={FaTimesCircle} /> Inactive
                </span>
            );
        }

        const now = new Date();
        if (c.starts_at && new Date(c.starts_at) > now) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Icon icon={FaClock} /> Scheduled
                </span>
            );
        }

        if (c.ends_at && new Date(c.ends_at) < now) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    <Icon icon={FaExclamationTriangle} /> Expired
                </span>
            );
        }

        if (c.max_uses !== null && c.usage_count >= c.max_uses) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    <Icon icon={FaTimesCircle} /> Reached Limit
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <Icon icon={FaCheckCircle} /> Active
            </span>
        );
    };

    return (
        <AdminGuard>
            <div className="p-6 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Icon icon={FaTicketAlt} className="text-blue-600" />
                            Coupons
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage manual coupon codes for discounts.</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm"
                    >
                        <Icon icon={FaPlus} />
                        New Coupon
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-800 dark:text-red-200">
                        <Icon icon={FaExclamationTriangle} className="flex-shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <LoadingSpinner size="lg" />
                        <p className="text-gray-500 dark:text-gray-400 mt-4">Loading coupons...</p>
                    </div>
                ) : coupons.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm px-6">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon icon={FaTicketAlt} className="text-gray-400 w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No coupons yet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first coupon to start offering discounts.</p>
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                        >
                            <Icon icon={FaPlus} />
                            Create Coupon
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                                        <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Code / Title</th>
                                        <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Discount</th>
                                        <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Usage</th>
                                        <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {coupons.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-lg uppercase">{c.code}</div>
                                                <div className="text-sm text-gray-900 dark:text-white font-medium">{c.title}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900 dark:text-white">
                                                    {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `$${c.discount_value.toFixed(2)} OFF`}
                                                </div>
                                                <div className="text-xs text-gray-500">Min: ${c.min_cart_subtotal.toFixed(2)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(c)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{c.usage_count} uses</div>
                                                {c.max_uses && (
                                                    <div className="text-xs text-gray-500">of {c.max_uses} max</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEdit(c)}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Icon icon={FaEdit} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c.id)}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Icon icon={FaTrash} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                        <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 my-8 flex flex-col max-h-[calc(100vh-4rem)]">
                            <div className="px-8 py-6 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {editingId ? 'Edit Coupon' : 'Create New Coupon'}
                                </h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <Icon icon={FaPlus} className="rotate-45 w-6 h-6" />
                                </button>
                            </div>

                            <div className="px-8 py-6 space-y-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Coupon Code</label>
                                        <input
                                            value={form.code}
                                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                            placeholder="e.g. SUMMER25"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono font-bold text-lg uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Title</label>
                                        <input
                                            value={form.title}
                                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                            placeholder="Public title for the coupon"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Description (optional)</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                        placeholder="Internal notes or extended details..."
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Discount Type</label>
                                            <select
                                                value={form.discount_type}
                                                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as any }))}
                                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            >
                                                <option value="percent">Percent (%)</option>
                                                <option value="fixed">Fixed Amount ($)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Discount Value</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.discount_value}
                                                onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))}
                                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Min. Subtotal</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.min_cart_subtotal}
                                                onChange={(e) => setForm((f) => ({ ...f, min_cart_subtotal: Number(e.target.value) }))}
                                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Start Date (optional)</label>
                                        <input
                                            type="datetime-local"
                                            value={form.starts_at_local}
                                            onChange={(e) => setForm((f) => ({ ...f, starts_at_local: e.target.value }))}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">End Date (optional)</label>
                                        <input
                                            type="datetime-local"
                                            value={form.ends_at_local}
                                            onChange={(e) => setForm((f) => ({ ...f, ends_at_local: e.target.value }))}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Max Total Uses</label>
                                        <input
                                            type="number"
                                            value={form.max_uses ?? ''}
                                            onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value ? Number(e.target.value) : null }))}
                                            placeholder="Unlimited"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Max Uses Per User</label>
                                        <input
                                            type="number"
                                            value={form.max_uses_per_user ?? ''}
                                            onChange={(e) => setForm((f) => ({ ...f, max_uses_per_user: e.target.value ? Number(e.target.value) : null }))}
                                            placeholder="Unlimited"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                    <h4 className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Icon icon={FaUser} /> Targeting & Restrictions (Optional)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target User ID</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Icon icon={FaUser} className="text-gray-400" />
                                                </div>
                                                <input
                                                    value={form.user_id}
                                                    onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                                                    placeholder="Specific profile UUID"
                                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target Email</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Icon icon={FaEnvelope} className="text-gray-400" />
                                                </div>
                                                <input
                                                    value={form.target_email}
                                                    onChange={(e) => setForm((f) => ({ ...f, target_email: e.target.value }))}
                                                    placeholder="Specific customer email"
                                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 py-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={form.is_active}
                                        onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                                        Coupon is active and redeemable
                                    </label>
                                </div>
                            </div>

                            <div className="px-8 py-6 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-end gap-4 flex-shrink-0 bg-gray-50 dark:bg-neutral-800/30">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !form.code.trim() || !form.title.trim()}
                                    className="px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:shadow-none min-w-[120px]"
                                >
                                    {saving ? <LoadingSpinner size="sm" /> : editingId ? 'Update Coupon' : 'Create Coupon'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminGuard>
    );
}
