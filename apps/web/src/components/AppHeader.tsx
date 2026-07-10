"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthenticatedHeader } from "./AuthenticatedHeader";
import { Logo } from "./Logo";
import { PublicNavigation } from "./PublicNavigation";

// List of public routes that should not show the header
const PUBLIC_ROUTES = [
  "/", // Home page
  "/menu", // Menu page
  "/order", // Order page
  "/qr", // Receipt QR landing page
  "/rewards", // Public rewards page (customer rewards)
  "/profile", // Customer profile should use public-facing header
  "/unsubscribe", // Marketing unsubscribe page should not show admin navigation
  "/auth/callback", // Auth callback - avoid flashing admin navigation for customers
];

// Check if a pathname is a public route
function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  
  // Exact matches
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }
  
  // Routes that start with these paths
  if (
    pathname.startsWith("/menu/") ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/rewards") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/unsubscribe") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/reset-password")
  ) {
    return true;
  }
  
  return false;
}

export function AppHeader() {
  const pathname = usePathname();
  
  // Hide header for all public pages
  if (isPublicRoute(pathname)) {
    return null;
  }
  
  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b bg-white/50 dark:bg-black/30">
      <div className="w-full px-4 h-16 flex items-center justify-center">
        <div className="w-full max-w-7xl flex items-center justify-between" id="header-content">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <PublicNavigation />
            <AuthenticatedHeader />
          </div>
        </div>
      </div>
    </header>
  );
}
