
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google'; // Note: Geist is typically a local font.
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

const geistSans = Geist({
  variable: '--font-geist-sans', // This defines the CSS variable name
  subsets: ['latin'],
  // If Geist is a local font, you should use import localFont from 'next/font/local'
  // and provide the src path, e.g., src: '../fonts/Geist-Regular.woff2'
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono', // This defines the CSS variable name
  subsets: ['latin'],
  // If Geist is a local font, you should use import localFont from 'next/font/local'
  // and provide the src path
});

export const metadata: Metadata = {
  title: 'OptiStack Solver',
  description: 'Optical response solver for multi-layered stacks',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.className} ${geistMono.className} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning={true}
      >
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
