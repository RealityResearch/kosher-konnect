import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, Heebo } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const heebo = Heebo({
  variable: "--font-hebrew",
  subsets: ["hebrew"],
  weight: ["400", "500", "600", "700"],
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a0a12",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "JPS | Jewish Positioning System",
  description: "Discover synagogues, kosher restaurants, Chabad houses, JCCs, and more across the United States. Find your community, wherever you are.",
  keywords: ["kosher", "synagogue", "jewish", "chabad", "jcc", "mikvah", "kosher restaurant", "jewish community", "jps"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://tiles.mapbox.com" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${heebo.variable} antialiased bg-[#0f1117] min-h-[100dvh]`}
      >
        {children}
      </body>
    </html>
  );
}
