"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { Icon } from "@/components/Icon";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { FaBullhorn, FaCheck, FaEnvelope, FaSpinner } from "react-icons/fa";
import RecipientModal from '@/components/RecipientModal';
import EmailPreviewModal from '@/components/EmailPreviewModal';

type CustomerSummary = {
  profileId: string;
  name: string | null;
  email: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  lastMarketingEmailSentAt: string | null;
  optInMarketing?: boolean;
};

export default function AdminMarketingPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // New state for selected customer IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Discount type (percentage or fixed amount) and amount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountAmount, setDiscountAmount] = useState<number>(10);

  const [searchTerm, setSearchTerm] = useState<string>('');
  // New state for AI-generated email content
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [sendingGenerated, setSendingGenerated] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [isRecipientModalOpen, setRecipientModalOpen] = useState(false);
  const [isPreviewOpen, setPreviewOpen] = useState(false);



  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number, failed: number, message?: string } | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const supa = getSupabaseClient();

      // Fetch customers with valid profileId and email
      const { data, error: fetchErr } = await supa
        .from('customer_summary')
        .select('*')
        .not('profileId', 'is', null)
        .not('email', 'is', null);

      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }

      // Deduplicate by profileId to avoid duplicate list items
      const uniqueCustomersMap = new Map<string, CustomerSummary>();
      for (const c of (data as CustomerSummary[])) {
        if (c.profileId && !uniqueCustomersMap.has(c.profileId)) {
          uniqueCustomersMap.set(c.profileId, c);
        }
      }
      
      const uniqueCustomers = Array.from(uniqueCustomersMap.values());

      // Sort by last marketing email sent at (nulls first, then oldest first)
      const sorted = uniqueCustomers.sort((a, b) => {
        if (!a.lastMarketingEmailSentAt && b.lastMarketingEmailSentAt) return -1;
        if (a.lastMarketingEmailSentAt && !b.lastMarketingEmailSentAt) return 1;
        if (!a.lastMarketingEmailSentAt && !b.lastMarketingEmailSentAt) return 0;
        return new Date(a.lastMarketingEmailSentAt!).getTime() - new Date(b.lastMarketingEmailSentAt!).getTime();
      });

      setCustomers(sorted);
    } catch (e: any) {
      setError(e.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.filter(c => c.profileId).map(c => c.profileId!)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSendMarketingEmails = async () => {
    if (selectedIds.size === 0) return;

    setSending(true);
    setSendResult(null);
    setError(null);

    try {
      const supa = getSupabaseClient();
      const { data: { session } } = await supa.auth.getSession();
      const token = session?.access_token;

      const selectedCustomers = customers
        .filter(c => c.profileId && selectedIds.has(c.profileId))
        .map(c => ({
          id: c.profileId!,
          name: c.name || 'Valued Customer',
          email: c.email!,
        }));

      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          customers: selectedCustomers,
          discountPercentage: discountAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send marketing emails');
      }

      setSendResult({
        success: data.results?.filter((r: any) => r.success === true).length || 0,
        failed: data.results?.filter((r: any) => r.success === false).length || 0,
        message: data.message
      });

      // Refresh the customer list to show updated timestamps
      await load();
      setSelectedIds(new Set()); // clear selection on success
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };
  // Function to send the AI‑generated email content
  const handleSendGeneratedEmails = async () => {
    if (selectedIds.size === 0) return;

    setSendingGenerated(true);
    setSendResult(null);
    setError(null);

    try {
      const supa = getSupabaseClient();
      const { data: { session } } = await supa.auth.getSession();
      const token = session?.access_token;

      const selectedCustomers = customers
        .filter(c => c.profileId && selectedIds.has(c.profileId) && c.optInMarketing)
        .map(c => ({
          id: c.profileId!,
          name: c.name || 'Valued Customer',
          email: c.email!
        }));

      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          customers: selectedCustomers,
          discountPercentage: discountAmount,
          subject: emailSubject,
          htmlBody: emailBody,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      setSendResult({
        success: data.results?.filter((r: any) => r.success === true).length || 0,
        failed: data.results?.filter((r: any) => r.success === false).length || 0,
        message: data.message,
      });

      await load();
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendingGenerated(false);
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-[80vh] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto Marketing</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Send personalized AI-generated marketing emails with unique coupons to customers.
              </p>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={load}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {sendResult && (
            <div className="mb-6 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 flex items-start gap-3">
              <Icon icon={FaCheck} className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Marketing campaign finished</p>
                <p className="text-sm opacity-90 mt-1">
                  Successfully sent: {sendResult.success} | Failed: {sendResult.failed}
                </p>
                {sendResult.message && <p className="text-sm opacity-90">{sendResult.message}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left Col: Customer Selection */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col h-[500px]">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900 shrink-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Selected Recipients ({selectedIds.size})
                </div>
                <button
                  onClick={() => setRecipientModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                  Edit Selection
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-neutral-900/30">
                {selectedIds.size === 0 ? (
                  <div className="text-center text-sm text-gray-500 mt-10">
                    No customers selected. Click edit to choose recipients.
                  </div>
                ) : (
                  customers
                    .filter((c) => c.profileId && selectedIds.has(c.profileId))
                    .map((c) => (
                      <div key={c.profileId} className="flex justify-between items-center bg-white dark:bg-neutral-800 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{c.name || 'Unnamed'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Right Col: Campaign settings */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden self-start">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Campaign Setup
                </div>
              </div>
              
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Discount Amount
                  </label>
                  <div className="relative">
                    {discountType === 'fixed_amount' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    )}
                    <input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className={`w-full h-10 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${discountType === 'fixed_amount' ? 'pl-7 pr-3' : 'px-3'}`}
                      min="1"
                    />
                    {discountType === 'percentage' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm mb-5">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <Icon icon={FaBullhorn} className="w-4 h-4" />
                      What happens next?
                    </p>
                    <ul className="list-disc pl-5 space-y-1 mt-2 text-blue-700 dark:text-blue-300">
                      <li>A unique 1-time-use coupon will be generated.</li>
                      <li>Coupons expire automatically in 7 days.</li>
                      <li>Google AI will write a personalized email highlighting the discount.</li>
                    </ul>
                  </div>

                  <button
                    onClick={async () => {
                      if (selectedIds.size === 0) return;
                      setGenerating(true);
                      try {
                        const supa = getSupabaseClient();
                        const { data: { session } } = await supa.auth.getSession();
                        const token = session?.access_token;
                        const selectedCustomers = customers
                          .filter(c => c.profileId && selectedIds.has(c.profileId) && c.optInMarketing)
                          .map(c => ({ id: c.profileId!, name: c.name || 'Valued Customer', email: c.email! }));
                        const res = await fetch('/api/marketing/generate', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token || ''}`
                          },
                          body: JSON.stringify({ customers: selectedCustomers, discountPercentage: discountAmount })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Generation failed');
                        setEmailSubject(data.subject || '');
                        setEmailBody(data.htmlBody || '');
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setGenerating(false);
                      }
                    }}
                    disabled={generating || selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {generating ? (
                      <>
                        <Icon icon={FaSpinner} className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>Generate Email</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Full Width Col: Email Editing & Preview */}
          {(emailSubject || emailBody) && (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Generated Email Details
                </div>
              </div>
              <div className="p-5 space-y-4">
                {emailSubject && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Email Subject"
                    />
                  </div>
                )}
                {emailBody && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Body (HTML)
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full h-64 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono"
                      placeholder="Email Body (HTML)"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        onClick={() => setPreviewOpen(true)}
                        disabled={!emailBody}
                        className="flex-1 bg-gray-600 text-white py-2.5 rounded-lg font-medium hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Preview Email
                      </button>
                      <button
                        onClick={handleSendGeneratedEmails}
                        disabled={!emailBody || sendingGenerated}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingGenerated ? (
                          <>
                            <Icon icon={FaSpinner} className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>Send Emails</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <RecipientModal open={isRecipientModalOpen} onClose={() => setRecipientModalOpen(false)} customers={customers} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
          <EmailPreviewModal open={isPreviewOpen} onClose={() => setPreviewOpen(false)} subject={emailSubject} htmlBody={emailBody} />
        </div>
      </div>
    </AdminGuard>
  );
}
