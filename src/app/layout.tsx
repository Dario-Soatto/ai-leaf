import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI LaTeX Editor",
    template: "%s | AI LaTeX Editor",
  },
  description: "Create beautiful LaTeX documents with AI assistance. A modern editor with real-time PDF preview and intelligent editing suggestions.",
  keywords: ["LaTeX", "editor", "AI", "PDF", "document editor", "academic writing"],
  authors: [{ name: "Your Name" }],
  creator: "Your Name",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.latex.soatto.com",
    title: "AI LaTeX Editor",
    description: "Create beautiful LaTeX documents with AI assistance",
    siteName: "AI LaTeX Editor",
    images: [
      {
        url: "/og-image.png",
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
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}