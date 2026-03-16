'use client';

import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PageLoadingStateProps = {
  title: string;
  description: string;
  shellClassName?: string;
  pageClassName?: string;
  cardClassName?: string;
};

export function PageLoadingState({
  title,
  description,
  shellClassName,
  pageClassName,
  cardClassName
}: PageLoadingStateProps) {
  return (
    <main
      className={cn(
        'theme-spring-shell mx-auto flex min-h-screen w-full items-center px-3 py-5 sm:px-6 sm:py-10',
        shellClassName ?? 'theme-spring-shell--medium',
        pageClassName
      )}
    >
      <Card
        className={cn(
          'theme-card-ornament theme-surface w-full',
          cardClassName
        )}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
              <CardDescription className="text-xs leading-relaxed sm:text-sm">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-muted" />
          <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-muted" />
          <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-muted" />
        </CardContent>
      </Card>
    </main>
  );
}
