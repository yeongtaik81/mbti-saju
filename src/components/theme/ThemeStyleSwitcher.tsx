'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Palette, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ThemeOption = {
  value: 'default' | 'spring';
  label: string;
  accentIcon: typeof Palette;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'default',
    label: '기본',
    accentIcon: Palette
  },
  {
    value: 'spring',
    label: '봄결',
    accentIcon: Sparkles
  }
];

export function ThemeStyleSwitcher({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const activeTheme = useMemo(
    () =>
      THEME_OPTIONS.some((option) => option.value === resolvedTheme)
        ? (resolvedTheme as ThemeOption['value'])
        : 'default',
    [resolvedTheme]
  );

  const activeOption =
    THEME_OPTIONS.find((option) => option.value === activeTheme) ??
    ({
      value: 'default',
      label: '기본',
      accentIcon: Palette
    } satisfies ThemeOption);
  const ActiveIcon = activeOption.accentIcon;

  if (!mounted) {
    return null;
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="size-9 p-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <ActiveIcon className="size-4" />
        <span className="hidden sm:inline">{activeOption.label}</span>
        <ChevronDown
          className={cn(
            'hidden size-4 transition-transform sm:inline-block',
            open && 'rotate-180'
          )}
        />
      </Button>

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-2 min-w-36 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-1 shadow-xl backdrop-blur-md">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.accentIcon;
            const isActive = option.value === activeTheme;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4" />
                  <span>{option.label}</span>
                </span>
                {isActive ? <Check className="size-4" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
