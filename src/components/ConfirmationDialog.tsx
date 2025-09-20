"use client";

import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from "react-icons/fa";
import { LoadingSpinner } from "./Loading";

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
  error?: string | null;
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
  error = null,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: FaExclamationTriangle,
          iconColor: "text-red-500",
          confirmButton: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25",
          iconBg: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20",
          borderColor: "border-red-200 dark:border-red-800",
          glowColor: "shadow-red-500/20",
        };
      case "warning":
        return {
          icon: FaExclamationTriangle,
          iconColor: "text-amber-500",
          confirmButton: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25",
          iconBg: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-800/20",
          borderColor: "border-amber-200 dark:border-amber-800",
          glowColor: "shadow-amber-500/20",
        };
      case "info":
        return {
          icon: FaInfoCircle,
          iconColor: "text-blue-500",
          confirmButton: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25",
          iconBg: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          glowColor: "shadow-blue-500/20",
        };
      default:
        return {
          icon: FaExclamationTriangle,
          iconColor: "text-red-500",
          confirmButton: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25",
          iconBg: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20",
          borderColor: "border-red-200 dark:border-red-800",
          glowColor: "shadow-red-500/20",
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

  const IconComponent = styles.icon;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-md grid place-items-center p-4 z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className={`w-full max-w-lg bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient background */}
        <div className={`${styles.iconBg} p-6 border-b border-gray-200 dark:border-neutral-800`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${styles.iconBg} flex items-center justify-center shadow-lg`}>
                <IconComponent className={`w-6 h-6 ${styles.iconColor}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Please confirm your action
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <FaTimes className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
            {message}
          </p>
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mt-0.5">
                  <FaExclamationTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                    Error
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`h-10 px-4 rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${styles.confirmButton}`}
            >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" className="text-white" />
                      Processing...
                    </div>
                  ) : (
                    confirmText
                  )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
