import { Layers3 } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
          <Layers3 size={28} />
          <h1 className="text-2xl font-semibold">OptiStack Solver</h1>
        </Link>
      </div>
    </header>
  );
}
