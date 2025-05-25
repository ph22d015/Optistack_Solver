
import type { Metadata } from 'next';
import { Roboto, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { AuthProvider } from '@/contexts/auth-context';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'], // Common weights
  variable: '--font-roboto-sans',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'], // Common weights
  variable: '--font-roboto-mono',
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
        className={`${roboto.variable} ${robotoMono.variable} font-sans antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
