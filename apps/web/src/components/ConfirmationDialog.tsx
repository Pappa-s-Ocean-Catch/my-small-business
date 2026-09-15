"use client";

import { FaQuestion, FaExclamationCircle } from "react-icons/fa";
import { LoadingSpinner } from "./Loading";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "friendly";
  isLoading?: boolean;
  error?: string | null;
  icon?: React.ElementType;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
  error = null,
  icon: CustomIcon,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: CustomIcon || FaExclamationCircle,
          iconColor: "text-rose-500",
          confirmButton: "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25",
          iconBg: "bg-rose-100 dark:bg-rose-500/20",
        };
      case "warning":
      case "friendly":
        return {
          icon: CustomIcon || FaQuestion,
          iconColor: "text-amber-500", // Golden batter
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25",
          iconBg: "bg-amber-100 dark:bg-amber-500/20",
        };
      case "info":
        return {
          icon: CustomIcon || FaQuestion,
          iconColor: "text-cyan-600 dark:text-cyan-400", // Sea Blue
          confirmButton: "bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-600/25",
          iconBg: "bg-cyan-100 dark:bg-cyan-500/20",
        };
      default:
        return {
          icon: CustomIcon || FaQuestion,
          iconColor: "text-amber-500",
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25",
          iconBg: "bg-amber-100 dark:bg-amber-500/20",
        };
    }
  };

  const styles = getVariantStyles();
  const IconComponent = styles.icon;

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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full ${styles.iconBg} flex items-center justify-center mb-6`}>
            <IconComponent className={`w-10 h-10 ${styles.iconColor}`} />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 font-serif">
            {title}
          </h3>
          
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-base leading-relaxed">
            {message}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 w-full p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-left">
              <div className="flex items-start gap-3">
                <FaExclamationCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 h-14 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center ${styles.confirmButton}`}
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
