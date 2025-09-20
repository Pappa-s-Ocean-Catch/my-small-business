"use client";

import { ReactNode } from "react";
import { X, AlertCircle } from "lucide-react";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
  action?: ReactNode;
}

export default function ErrorModal({
  isOpen,
  onClose,
  title = "Error",
  message,
  details,
  action
}: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <X className="size-4 text-red-600 dark:text-red-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-900 dark:text-gray-100 mb-4">{message}</p>
          {details && (
            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{details}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
          {action || (
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
