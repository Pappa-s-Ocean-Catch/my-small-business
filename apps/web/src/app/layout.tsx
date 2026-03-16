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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppHeader />
        <SnackbarProvider>
          <CartProvider>
            <DynamicHeader />
            <main>{children}</main>
          </CartProvider>
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar theme="colored" aria-label="Notifications"/>
        </SnackbarProvider>
        <Analytics />
      </body>
    </html>
  );
}
