import type { Metadata } from "next";
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
            <a href="/" className="font-semibold tracking-tight">ShiftFlow</a>
            <nav className="flex items-center gap-3 text-sm">
              <a className="hover:underline" href="/staff">Staff</a>
              <a className="hover:underline" href="/calendar">Calendar</a>
              <a className="rounded-lg border px-3 py-1" href="/\(auth\)/login">Login</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
