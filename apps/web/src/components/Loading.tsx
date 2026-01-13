"use client";

import { FaSpinner } from "react-icons/fa";

interface LoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  className?: string;
}

export function Loading({ 
  message = "Loading...", 
  size = "md", 
  fullScreen = false,
  className = ""
}: LoadingProps) {
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return {
          spinner: "w-4 h-4",
          text: "text-sm",
          container: "p-4"
        };
      case "md":
        return {
          spinner: "w-8 h-8",
          text: "text-base",
          container: "p-6"
        };
      case "lg":
        return {
          spinner: "w-12 h-12",
          text: "text-lg",
          container: "p-8"
        };
      default:
        return {
          spinner: "w-8 h-8",
          text: "text-base",
          container: "p-6"
        };
    }
  };

  const sizeClasses = getSizeClasses();

  const content = (
    <div className={`flex flex-col items-center justify-center ${sizeClasses.container} ${className}`}>
      <FaSpinner className={`${sizeClasses.spinner} text-blue-600 animate-spin mb-3`} />
      <p className={`${sizeClasses.text} text-gray-600 dark:text-gray-400 font-medium`}>
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}

// Specialized loading components for common use cases
export function LoadingSpinner({ size = "sm", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-4 h-4";
      case "md":
        return "w-6 h-6";
      case "lg":
        return "w-8 h-8";
      default:
        return "w-6 h-6";
    }
  };

  return (
    <FaSpinner className={`${getSizeClasses()} text-blue-600 animate-spin ${className}`} />
  );
}

export function LoadingPage({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
      <Loading message={message} size="lg" />
    </div>
  );
}

export function LoadingCard({ message = "Loading...", className = "" }: { message?: string; className?: string }) {
  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 ${className}`}>
      <Loading message={message} size="md" />
    </div>
  );
}

export function LoadingOverlay({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
      <Loading message={message} size="md" />
    </div>
  );
}
