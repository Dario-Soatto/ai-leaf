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
  title: {
    default: "AI LaTeX Editor",
    template: "%s | AI LaTeX Editor",
  },
  description: "Create beautiful LaTeX documents with AI assistance. A modern editor with real-time PDF preview and intelligent editing suggestions.",
  keywords: ["LaTeX", "editor", "AI", "PDF", "document editor", "academic writing"],
  authors: [{ name: "Your Name" }], // Replace with your name
  creator: "Your Name", // Replace with your name
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.latex.soatto.com", // Replace with your actual domain
    title: "AI LaTeX Editor",
    description: "Create beautiful LaTeX documents with AI assistance",
    siteName: "AI LaTeX Editor",
    images: [
      {
        url: "/og-image.png", // You can add this later
        width: 1200,
        height: 630,
        alt: "AI LaTeX Editor Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI LaTeX Editor",
    description: "Create beautiful LaTeX documents with AI assistance",
    images: ["/og-image.png"], // You can add this later
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png", // You can add this later
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
