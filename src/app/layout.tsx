import type { Metadata } from "next";
import Link from "next/link";
import { HeaderAuth } from "@/components/HeaderAuth";
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
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" aria-label="Home">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900" href="/staff" aria-label="Staff">Staff</Link>
              <Link className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900" href="/calendar" aria-label="Calendar">Calendar</Link>
              <Link className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900" href="/settings" aria-label="Settings">Settings</Link>
              <div className="ml-2"><HeaderAuth /></div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
