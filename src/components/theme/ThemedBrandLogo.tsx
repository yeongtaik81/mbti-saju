'use client';

import Image from 'next/image';
import { Gaegu } from 'next/font/google';
import type { CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  variant?: 'default' | 'spring';
};

const LOGO_SRC = {
  default: '/brand/mbti-saju-logo.svg'
} as const;

const gaegu = Gaegu({
  weight: '700',
  subsets: ['latin'],
  display: 'swap'
});

export function ThemedBrandLogo({
  className,
  width = 180,
  height = 54,
  priority = false,
  variant
}: Props) {
  const { resolvedTheme } = useTheme();
  const activeTheme =
    variant ?? (resolvedTheme === 'spring' ? 'spring' : 'default');

  if (activeTheme === 'spring') {
    return (
      <div
        className={cn(
          'theme-brand-logo theme-brand-logo--calligraphy',
          'theme-brand-logo--spring',
          className
        )}
        style={
          {
            '--brand-logo-width': `${width}px`,
            '--brand-logo-height': `${height}px`
          } as CSSProperties
        }
        role="img"
        aria-label="MBTI 사주 가로 로고"
      >
        <div className="theme-brand-logo__paper">
          <span className="theme-brand-logo__border theme-brand-logo__border--top" />
          <span className="theme-brand-logo__border theme-brand-logo__border--bottom" />
          <span className="theme-brand-logo__grain" />
          <span className="theme-brand-logo__doodle theme-brand-logo__doodle--flower">
            ✿
          </span>
          <span className="theme-brand-logo__doodle theme-brand-logo__doodle--sparkle">
            ✦
          </span>
          <span className="theme-brand-logo__spring-card">
            <span
              className={cn(
                'theme-brand-logo__text theme-brand-logo__text--spring',
                gaegu.className
              )}
            >
              MBTI 사주
            </span>
          </span>
          <span className="theme-brand-logo__seal theme-brand-logo__seal--spring">
            幸
          </span>
        </div>
      </div>
    );
  }

  return (
    <Image
      className={cn('h-auto w-auto max-w-full object-contain', className)}
      src={LOGO_SRC.default}
      alt="MBTI 사주 가로 로고"
      width={width}
      height={height}
      priority={priority}
    />
  );
}
