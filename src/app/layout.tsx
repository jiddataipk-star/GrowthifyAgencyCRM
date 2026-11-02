import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/shell/toaster";
import "./globals.css";

/** Inter for interface text and numbers (tabular figures). */
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

/** Plus Jakarta Sans for headings and key figures. */
const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Growthify OS", template: "%s · Growthify OS" },
  description: "Growthify Agency's private operating system: clients, projects, collections, WhatsApp API, team and growth.",
  applicationName: "Growthify OS",
  // Private internal portal: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#072a1f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
