"use client";

import { twMerge } from "tailwind-merge";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={twMerge("inline-flex items-center gap-2", className)}>
      <div className="relative">
        <span className="absolute inset-0 blur-xl bg-gradient-to-tr from-violet-500/40 to-fuchsia-500/40 rounded-xl" />
        <span className="relative grid place-items-center h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white font-bold">O</span>
      </div>
      <span className="font-semibold tracking-tight">OperateFlow</span>
    </div>
  );
}


