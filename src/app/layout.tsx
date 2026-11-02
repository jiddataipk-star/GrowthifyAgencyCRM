import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/shell/toaster";
import "./globals.css";

const montserrat = localFont({
  src: [
    { path: "./fonts/montserrat-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/montserrat-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Growthify OS", template: "%s · Growthify OS" },
  description: "Growthify Agency's private operating system: clients, projects, money, team and growth.",
  applicationName: "Growthify OS",
  // Private internal portal: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#06140e",
  width: "device-width",
  initialScale: 1,
};

/** Applies the saved theme before first paint (dark is the brand default). */
const themeScript = `try{var t=localStorage.getItem("gos-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
