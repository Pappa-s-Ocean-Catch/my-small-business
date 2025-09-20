import type { Metadata } from "next";
import Link from "next/link";
import { AuthenticatedHeader } from "@/components/AuthenticatedHeader";
import { DynamicHeader } from "@/components/DynamicHeader";
import { Logo } from "@/components/Logo";
import { SnackbarProvider } from "@/components/Snackbar";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  title: "OperateFlow",
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
          <div className="w-full px-4 h-16 flex items-center justify-center">
            <div className="w-full max-w-7xl flex items-center justify-between" id="header-content">
              <Link href="/" aria-label="Home">
                <Logo />
              </Link>
              <div className="flex items-center gap-2">
                <AuthenticatedHeader />
              </div>
            </div>
          </div>
        </header>
        <SnackbarProvider>
          <DynamicHeader />
          <main>{children}</main>
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar theme="colored"/>
        </SnackbarProvider>
      </body>
    </html>
  );
}
