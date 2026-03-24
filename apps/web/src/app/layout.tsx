import type { Metadata } from "next";
import { DynamicHeader } from "@/components/DynamicHeader";
import { AppHeader } from "@/components/AppHeader";
import { SnackbarProvider } from "@/components/Snackbar";
import { CartProvider } from "@/contexts/CartContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import { homeMetadata } from "./metadata";
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = homeMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/favicon/android-chrome-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/favicon/android-chrome-512x512.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SpeedInsights></SpeedInsights>
        <AppHeader />
        <SnackbarProvider>
          <CartProvider>
            <DynamicHeader />
            <main>{children}</main>
          </CartProvider>
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar theme="colored" aria-label="Notifications" />
        </SnackbarProvider>
        <Analytics />
      </body>
    </html>
  );
}
