import type { Metadata } from "next";
import { DynamicHeader } from "@/components/DynamicHeader";
import { AppHeader } from "@/components/AppHeader";
import { SnackbarProvider } from "@/components/Snackbar";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
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
        <AppHeader />
        <SnackbarProvider>
          <DynamicHeader />
          <main>{children}</main>
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar theme="colored"/>
        </SnackbarProvider>
        <Analytics />
      </body>
    </html>
  );
}
