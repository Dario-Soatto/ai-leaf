import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Playfair_Display } from 'next/font/google';
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '400'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cursorforlatex.com'),
  title: {
    default: "Cursor for LaTeX - AI-Powered LaTeX Editor",
    template: "%s | Cursor for LaTeX",
  },
  description: "Create beautiful LaTeX documents with AI assistance. Modern editor with real-time PDF preview, intelligent editing, and instant compilation. Perfect for academic papers, research, and technical writing.",
  keywords: [
    "LaTeX editor",
    "AI LaTeX",
    "LaTeX online",
    "PDF preview",
    "academic writing",
    "research paper editor",
    "technical writing",
    "LaTeX compiler",
    "document editor",
    "mathematical typesetting",
    "scientific writing",
    "thesis editor"
  ],
  authors: [{ name: "Cursor for LaTeX" }],
  creator: "Cursor for LaTeX",
  publisher: "Cursor for LaTeX",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cursorforlatex.com",
    title: "Cursor for LaTeX - AI-Powered LaTeX Editor",
    description: "Create beautiful LaTeX documents with AI assistance. Real-time preview, intelligent editing, and instant compilation.",
    siteName: "Cursor for LaTeX",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cursor for LaTeX Editor Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cursor for LaTeX - AI-Powered LaTeX Editor",
    description: "Create beautiful LaTeX documents with AI assistance. Real-time preview and intelligent editing.",
    images: ["/og-image.png"],
    creator: "@yourtwitterhandle", // Add your Twitter handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://cursorforlatex.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://cursorforlatex.com" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${playfair.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}