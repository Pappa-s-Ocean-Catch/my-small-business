"use client";

import Link from "next/link";
import { AuthenticatedHeader } from "./AuthenticatedHeader";
import { Logo } from "./Logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b bg-white/50 dark:bg-black/30">
      <div className="w-full px-4 h-16 flex items-center justify-center">
        <div className="w-full max-w-7xl flex items-center justify-between" id="header-content">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <AuthenticatedHeader />
          </div>
        </div>
      </div>
    </header>
  );
}
