import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Osun Life — live your Osun story",
  description:
    "A life-sim game set in Osun State. Explore Osogbo, Ile-Ife, Ede and Ilesa.",
  keywords: ["Osun", "Osun Life game", "osun game", "uniosun", "lagos life", "Osogbo game", "life sim"],
    icons: {
      icon: "/app/favicon.ico",
      apple: "/app/favicon.ico",
    },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#eef3ec",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}