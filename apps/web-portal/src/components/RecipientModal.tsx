import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';

type Customer = {
  profileId: string;
  name: string | null;
  email: string | null;
  optInMarketing?: boolean;
};

type RecipientModalProps = {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  quickSelectCount?: number; // optional default 20
};

export default function RecipientModal({
  open,
  onClose,
  customers,
  selectedIds,
  setSelectedIds,
  quickSelectCount = 20,
}: RecipientModalProps) {
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Customer[]>([]);

  useEffect(() => {
    if (!open) return;
    const term = search.toLowerCase();
    const result = customers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term))
    );
    setFiltered(result);
  }, [search, customers, open]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const quickSelect = (count: number) => {
    const top = customers
      .filter((c) => c.profileId && c.optInMarketing)
      .slice(0, count)
      .map((c) => c.profileId!);
    setSelectedIds(new Set(top));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ✕
        </button>
        <h2 className="text-xl font-semibold mb-4">Select Recipients</h2>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => quickSelect(20)}
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            Top 20
          </button>
          <button
            onClick={() => quickSelect(50)}
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            Top 50
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded ml-auto transition"
          >
            Clear Selection
          </button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <FaSearch className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="max-h-80 overflow-y-auto border rounded">
          {filtered.map((c) => (
            <label
              key={c.profileId}
              className="flex items-center p-2 border-b last:border-0 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(c.profileId!)}
                onChange={() => toggle(c.profileId!)}
                className="mr-2"
              />
              <span className="font-medium">{c.name || 'Unnamed'}</span>
              <span className="ml-2 text-sm text-gray-500">{c.email}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-center text-gray-500">No matching customers.</p>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded mr-2"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded"
          >
            Done ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
