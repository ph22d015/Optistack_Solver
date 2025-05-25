
import { Layers3 } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
          <Layers3 size={28} />
          <h1 className="text-2xl font-semibold">OptiStack Solver</h1>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/documentation" className="text-muted-foreground hover:text-foreground transition-colors">
            Documentation
          </Link>
          <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
            Help
          </Link>
          <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
