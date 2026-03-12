'use client';

import { useEffect, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from 'next-themes';

function LegacyThemeMigration() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('mbti-saju-ui-theme');

    if (storedTheme === 'fortune' || storedTheme === 'bling') {
      setTheme('spring');
      return;
    }

    if (
      storedTheme === 'hanji' ||
      storedTheme === 'ink' ||
      resolvedTheme === 'hanji' ||
      resolvedTheme === 'ink'
    ) {
      setTheme('default');
      return;
    }

    if (resolvedTheme === 'fortune' || resolvedTheme === 'bling') {
      setTheme('spring');
    }
  }, [resolvedTheme, setTheme]);

  return null;
}

export function ThemeStyleProvider({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="data-ui-theme"
      defaultTheme="default"
      disableTransitionOnChange
      enableSystem={false}
      storageKey="mbti-saju-ui-theme"
      themes={['default', 'spring']}
    >
      <LegacyThemeMigration />
      {children}
    </ThemeProvider>
  );
}
