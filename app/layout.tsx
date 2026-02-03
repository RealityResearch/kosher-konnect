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
  title: "Kosher Konnect | Find Your Jewish Community",
  description: "Discover synagogues, kosher restaurants, Chabad houses, JCCs, and more across the United States. Find your community, wherever you are.",
  keywords: ["kosher", "synagogue", "jewish", "chabad", "jcc", "mikvah", "kosher restaurant", "jewish community"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0f1117] min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
