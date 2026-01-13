"use client";

import { ReactNode } from "react";
import { X, AlertCircle, CheckCircle, AlertTriangle, Check, X as XIcon } from "lucide-react";

type ModalVariant = 'success' | 'warning' | 'error';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
  action?: ReactNode;
  variant?: ModalVariant;
  emailResults?: Array<{ staffName: string; email: string; success: boolean; messageId?: string; error?: string }>;
  staffWithoutEmails?: Array<{ staffName: string; staffEmail: string | null }>;
}

export default function ErrorModal({
  isOpen,
  onClose,
  title = "Error",
  message,
  details,
  action,
  variant = 'error',
  emailResults,
  staffWithoutEmails
}: ErrorModalProps) {
  if (!isOpen) return null;

  // Theme configuration based on variant
  const getThemeConfig = (variant: ModalVariant) => {
    switch (variant) {
      case 'success':
        return {
          icon: CheckCircle,
          headerBg: 'bg-green-50 dark:bg-green-900/20',
          headerBorder: 'border-green-200 dark:border-green-800',
          iconBg: 'bg-green-100 dark:bg-green-900/40',
          iconColor: 'text-green-600 dark:text-green-400',
          titleColor: 'text-green-900 dark:text-green-100',
          closeHover: 'hover:bg-green-100 dark:hover:bg-green-900/40',
          closeColor: 'text-green-600 dark:text-green-400',
          buttonBg: 'bg-green-600 hover:bg-green-700'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          headerBg: 'bg-yellow-50 dark:bg-yellow-900/20',
          headerBorder: 'border-yellow-200 dark:border-yellow-800',
          iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          titleColor: 'text-yellow-900 dark:text-yellow-100',
          closeHover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
          closeColor: 'text-yellow-600 dark:text-yellow-400',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'error':
      default:
        return {
          icon: AlertCircle,
          headerBg: 'bg-red-50 dark:bg-red-900/20',
          headerBorder: 'border-red-200 dark:border-red-800',
          iconBg: 'bg-red-100 dark:bg-red-900/40',
          iconColor: 'text-red-600 dark:text-red-400',
          titleColor: 'text-red-900 dark:text-red-100',
          closeHover: 'hover:bg-red-100 dark:hover:bg-red-900/40',
          closeColor: 'text-red-600 dark:text-red-400',
          buttonBg: 'bg-red-600 hover:bg-red-700'
        };
    }
  };

  const theme = getThemeConfig(variant);
  const IconComponent = theme.icon;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.headerBorder} ${theme.headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full ${theme.iconBg} flex items-center justify-center`}>
              <IconComponent className={`h-5 w-5 ${theme.iconColor}`} />
            </div>
            <h2 className={`text-lg font-semibold ${theme.titleColor}`}>{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-8 w-8 rounded-lg inline-grid place-items-center ${theme.closeHover} transition-colors`}
          >
            <X className={`size-4 ${theme.closeColor}`} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-900 dark:text-gray-100 mb-4">{message}</p>
          {details && (
            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{details}</p>
            </div>
          )}
          
          {/* Email Status List */}
          {(emailResults && emailResults.length > 0) && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Email Status:</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {emailResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{result.staffName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{result.email}</div>
                      {result.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">{result.error}</div>
                      )}
                    </div>
                    <div className="ml-3">
                      {result.success ? (
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <Check className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 dark:text-red-400">
                          <XIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Staff Without Emails */}
          {(staffWithoutEmails && staffWithoutEmails.length > 0) && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Staff Without Email Addresses:</h4>
              <div className="space-y-2">
                {staffWithoutEmails.map((staff, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{staff.staffName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">No email address</div>
                    </div>
                    <div className="ml-3">
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
          {action || (
            <button
              onClick={onClose}
              className={`h-10 px-4 rounded-lg text-white transition-colors ${theme.buttonBg}`}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
