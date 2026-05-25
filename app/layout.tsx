import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ryva — The Engineering Framework for Agentic AI",
  description: "Structure, testing, and observability for every AI agent, model, and pipeline you ship.",
  openGraph: {
    title: "Ryva — The Engineering Framework for Agentic AI",
    description: "Structure, testing, and observability for every AI agent, model, and pipeline you ship.",
    url: "https://ryvaforge.com",
    siteName: "Ryva",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
