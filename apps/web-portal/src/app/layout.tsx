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
          id="new-relic-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.NREUM = window.NREUM || {};
              window.NREUM.init = {
                browser_consent_mode: { enabled: false },
                privacy: { cookies_enabled: true },
                distributed_tracing: { enabled: true },
                performance: { capture_measures: true },
                ajax: { deny_list: ["bam.nr-data.net"], capture_payloads: "none" }
              };
              window.NREUM.loader_config = {
                accountID: "8032202",
                trustKey: "8032202",
                agentID: "653439827",
                licenseKey: "NRJS-ea5aa8652f23ac21df1",
                applicationID: "653439827"
              };
              window.NREUM.info = {
                beacon: "bam.nr-data.net",
                errorBeacon: "bam.nr-data.net",
                licenseKey: "NRJS-ea5aa8652f23ac21df1",
                applicationID: "653439827",
                sa: 1
              };
            `,
          }}
        />
        <Script
          id="new-relic-browser-agent"
          src="https://js-agent.newrelic.com/nr-loader-spa-current.min.js"
          strategy="beforeInteractive"
        />
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
