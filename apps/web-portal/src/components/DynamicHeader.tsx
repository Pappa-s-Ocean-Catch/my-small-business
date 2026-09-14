"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function DynamicHeader() {
  const pathname = usePathname();

  useEffect(() => {
    const headerContent = document.getElementById('header-content');
    if (!headerContent) return;

    // Remove max-width constraint for calendar page
    if (pathname === '/calendar') {
      headerContent.classList.remove('max-w-7xl');
      headerContent.classList.add('max-w-none');
    } else {
      // Add max-width constraint for all other pages
      headerContent.classList.remove('max-w-none');
      headerContent.classList.add('max-w-7xl');
    }
  }, [pathname]);

  return null; // This component doesn't render anything
}
