"use client";

import { FaExclamationTriangle } from "react-icons/fa";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconColor: "text-red-600 dark:text-red-400",
          confirmButton: "bg-red-600 hover:bg-red-700 text-white",
          iconBg: "bg-red-100 dark:bg-red-900/20",
        };
      case "warning":
        return {
          iconColor: "text-yellow-600 dark:text-yellow-400",
          confirmButton: "bg-yellow-600 hover:bg-yellow-700 text-white",
          iconBg: "bg-yellow-100 dark:bg-yellow-900/20",
        };
      case "info":
        return {
          iconColor: "text-blue-600 dark:text-blue-400",
          confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
          iconBg: "bg-blue-100 dark:bg-blue-900/20",
        };
      default:
        return {
          iconColor: "text-red-600 dark:text-red-400",
          confirmButton: "bg-red-600 hover:bg-red-700 text-white",
          iconBg: "bg-red-100 dark:bg-red-900/20",
        };
    }
  };

  const styles = getVariantStyles();

  const handleConfirm = () => {
    onConfirm();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
            <FaExclamationTriangle className={`w-5 h-5 ${styles.iconColor}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {message}
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${styles.confirmButton}`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </div>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
