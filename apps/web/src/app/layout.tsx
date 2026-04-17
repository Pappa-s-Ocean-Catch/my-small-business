import type { Metadata } from "next";
import Script from "next/script";
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
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-17948047773"
          strategy="afterInteractive"
        />
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'AW-17948047773');
          `}
        </Script>
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
