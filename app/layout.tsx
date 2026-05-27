import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ryva — AI Governance Platform",
  description: "Test, trace, align, and govern every AI agent, model, and pipeline. Built for teams shipping AI in production.",
  openGraph: {
    title: "Ryva — AI Governance Platform",
    description: "Test, trace, align, and govern every AI agent, model, and pipeline.",
    url: "https://ryvaforge.com",
    siteName: "Ryva",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
