"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FaFish, FaHome, FaSyncAlt } from "react-icons/fa";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 relative overflow-hidden bg-red-50/50 dark:bg-neutral-900 rounded-3xl m-4 sm:m-8 border border-red-100 dark:border-neutral-800 shadow-inner">
      {/* Decorative background elements */}
      <div className="absolute top-10 right-10 w-32 h-32 bg-red-200/40 dark:bg-red-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten animate-pulse" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-amber-200/40 dark:bg-amber-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten animate-pulse delay-1000" />
      
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 shadow-[0_8px_30px_rgb(0,0,0,0.05)] border-4 border-white dark:border-neutral-800">
          <FaFish className="w-10 h-10 transform rotate-180 opacity-80" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold font-serif text-gray-900 dark:text-white mb-4">
          Kitchen Mishap!
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Something went squiddy on our end.
        </p>
        <p className="text-base text-gray-500 dark:text-gray-500 mb-10 max-w-md mx-auto">
          Our kitchen staff has been notified of the error. Please try again or head back to safety.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-lg shadow-amber-500/25"
          >
            <FaSyncAlt className="w-5 h-5" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold border-2 border-gray-200 dark:border-neutral-700 transition-all shadow-sm"
          >
            <FaHome className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
