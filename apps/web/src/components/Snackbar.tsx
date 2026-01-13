"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type SnackbarVariant = 'success' | 'error' | 'info';

type Snackbar = { id: number; message: string; variant: SnackbarVariant };

type SnackbarContextValue = {
  showSnackbar: (message: string, variant?: SnackbarVariant) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snacks, setSnacks] = useState<Snackbar[]>([]);
  const showSnackbar = useCallback((message: string, variant: SnackbarVariant = 'info') => {
    const id = Date.now();
    setSnacks((s) => [...s, { id, message, variant }]);
    setTimeout(() => setSnacks((s) => s.filter((n) => n.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {snacks.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
              n.variant === 'success' ? 'bg-green-600' : n.variant === 'error' ? 'bg-red-600' : 'bg-gray-800'
            }`}
          >
            {n.message}
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}


