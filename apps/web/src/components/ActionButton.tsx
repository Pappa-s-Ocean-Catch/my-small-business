"use client";

import { useState, ReactNode } from "react";
import { LoadingSpinner } from "@/components/Loading";

interface ActionButtonProps {
  onClick: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loadingText?: string;
  title?: string;
}

export function ActionButton({
  onClick,
  children,
  className = "",
  disabled = false,
  variant = 'primary',
  size = 'md',
  icon,
  loadingText,
  title
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    
    setLoading(true);
    try {
      await onClick();
    } catch (error) {
      console.error('ActionButton error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90';
      case 'secondary':
        return 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-neutral-800';
      case 'danger':
        return 'text-red-600 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20';
      case 'success':
        return 'bg-green-600 text-white hover:bg-green-700';
      default:
        return 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 px-3 text-sm';
      case 'md':
        return 'h-9 px-3 text-sm';
      case 'lg':
        return 'h-10 px-4 text-base';
      default:
        return 'h-9 px-3 text-sm';
    }
  };

  const baseClasses = "rounded-lg inline-flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClasses = getVariantClasses();
  const sizeClasses = getSizeClasses();

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      title={title}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          {loadingText || children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
