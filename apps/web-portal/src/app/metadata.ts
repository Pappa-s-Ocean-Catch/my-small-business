import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pappasfishnchips.com.au";
const siteName = "Pappa's Ocean Catch";
const description = "Fresh fish and chips takeaway in Melton. Order online or call (03) 9743 8150. Traditional batter, hand-cut chips, and the freshest seafood daily.";

export const homeMetadata: Metadata = {
  title: `${siteName} | Fresh Fish and Chips Takeaway in Melton`,
  description,
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      {
        url: "/favicon/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  keywords: [
    "fish and chips",
    "fish and chips melton",
    "takeaway melton",
    "seafood melton",
    "fresh fish",
    "ocean catch",
    "pappa's ocean catch",
    "fish and chips takeaway",
    "seafood restaurant",
    "melton restaurant",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: siteUrl,
    siteName,
    title: `${siteName} | Fresh Fish and Chips Takeaway in Melton`,
    description,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${siteName} - Fresh Fish and Chips`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} | Fresh Fish and Chips Takeaway in Melton`,
    description,
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};
