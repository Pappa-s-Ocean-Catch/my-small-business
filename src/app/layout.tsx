import type { Metadata } from "next";
import Link from "next/link";
import { HeaderAuth } from "@/components/HeaderAuth";
import { Navigation } from "@/components/Navigation";
import { Logo } from "@/components/Logo";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShiftFlow",
  description: "Modern staff & shift management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-40 backdrop-blur border-b bg-white/50 dark:bg-black/30">
          <div className="w-full px-4 h-16 flex items-center justify-between">
            <Link href="/" aria-label="Home">
              <Logo />
            </Link>
            <nav className="flex items-center h-16 text-sm">
              <Link className="flex items-center h-full px-4 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors" href="/staff" aria-label="Staff">Staff</Link>
              <Link className="flex items-center h-full px-4 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors" href="/calendar" aria-label="Calendar">Calendar</Link>
              <Link className="flex items-center h-full px-4 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors" href="/shop" aria-label="Shop">Shop</Link>
              <Link className="flex items-center h-full px-4 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors" href="/reports" aria-label="Reports">Reports</Link>
              <Link className="flex items-center h-full px-4 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors" href="/settings" aria-label="Settings">Settings</Link>
              <div className="ml-2">
                <HeaderAuth />
              </div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
