'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Beaker } from 'lucide-react';

const NAV_ITEMS = [{ href: '/lab', label: '연구실', icon: Beaker }] as const;

export function GNB() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link href="/lab" className="mr-8 text-lg font-bold text-primary">
          Trading Lab
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
