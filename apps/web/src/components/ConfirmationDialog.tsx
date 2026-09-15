"use client";

import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from "react-icons/fa";
import { LoadingSpinner } from "./Loading";
import { Icon } from "./Icon";

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
          confirmButton: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25",
          iconBg: "bg-red-50 dark:bg-red-500/10",
          borderColor: "border-red-200 dark:border-red-800",
          glowColor: "shadow-red-500/20",
        };
      case "warning":
        return {
          icon: FaExclamationTriangle,
          iconColor: "text-amber-500", // Golden batter
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25",
          iconBg: "bg-amber-50 dark:bg-amber-500/10",
          borderColor: "border-amber-200 dark:border-amber-800",
          glowColor: "shadow-amber-500/20",
        };
      case "info":
        return {
          icon: FaInfoCircle,
          iconColor: "text-cyan-600 dark:text-cyan-400", // Sea Blue
          confirmButton: "bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-600/25",
          iconBg: "bg-cyan-50 dark:bg-cyan-500/10",
          borderColor: "border-cyan-200 dark:border-cyan-800",
          glowColor: "shadow-cyan-500/20",
        };
      default:
        return {
          icon: FaExclamationTriangle,
          iconColor: "text-amber-500",
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25",
          iconBg: "bg-amber-50 dark:bg-amber-500/10",
          borderColor: "border-amber-200 dark:border-amber-800",
          glowColor: "shadow-amber-500/20",
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
      className="fixed inset-0 bg-black/50 backdrop-blur-md grid place-items-center p-4 z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className={`w-full max-w-md bg-white dark:bg-neutral-950 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] p-6 overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full ${styles.iconBg} flex items-center justify-center mb-6`}>
            <Icon icon={styles.icon} className={`w-8 h-8 ${styles.iconColor}`} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-serif">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-base">
            {message}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 w-full p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-left">
              <div className="flex items-start gap-3">
                <Icon icon={FaExclamationTriangle} className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-medium transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 h-12 rounded-xl font-bold transition-all disabled:opacity-50 ${styles.confirmButton}`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" className="text-white" />
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
