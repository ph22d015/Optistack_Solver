
'use client';

import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
        <p>&copy; {currentYear || new Date().getFullYear()} OptiStack Solver. All rights reserved.</p>
        <p className="mt-2">Made with ❤️ and ☕️</p>
      </div>
    </footer>
  );
}
