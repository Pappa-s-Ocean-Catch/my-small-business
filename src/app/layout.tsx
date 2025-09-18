import type { Metadata } from "next";
import Link from "next/link";
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
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight" aria-label="Home">ShiftFlow</Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link className="hover:underline" href="/staff" aria-label="Staff">Staff</Link>
              <Link className="hover:underline" href="/calendar" aria-label="Calendar">Calendar</Link>
              <Link className="rounded-lg border px-3 py-1" href="/login" aria-label="Login">Login</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
