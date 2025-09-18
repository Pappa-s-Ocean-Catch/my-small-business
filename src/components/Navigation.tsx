"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/staff", label: "Staff" },
    { href: "/calendar", label: "Calendar" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex items-center h-16 text-sm">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center h-full px-4 transition-colors relative ${
              isActive
                ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-neutral-900"
            }`}
            aria-label={item.label}
          >
            {item.label}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
