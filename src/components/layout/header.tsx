
'use client';

import { Layers3, LogOut, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: 'Could not log out. Please try again.', variant: 'destructive' });
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/documentation', label: 'Documentation' },
    { href: '/help', label: 'Help' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-y-2">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
          <Layers3 size={28} />
          <h1 className="text-2xl font-semibold">OptiStack Solver</h1>
        </Link>
        <nav className="flex items-center flex-wrap gap-x-4 gap-y-2 sm:gap-x-6 text-base font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'transition-colors pb-1',
                pathname === link.href
                  ? 'text-primary font-semibold border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground/50'
              )}
            >
              {link.label}
            </Link>
          ))}
          {!loading && (
            <>
              {user ? (
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" /> Login
                  </Link>
                </Button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
