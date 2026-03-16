'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider, useTheme } from 'next-themes';

const ADMIN_THEME_RETURN_KEY = 'mbti-saju-theme-return';

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

function AdminThemeGuard() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!pathname || !resolvedTheme) {
      return;
    }

    const isAdminRoute = pathname.startsWith('/admin');
    const savedTheme = window.sessionStorage.getItem(ADMIN_THEME_RETURN_KEY);

    if (isAdminRoute) {
      if (resolvedTheme !== 'default') {
        if (!savedTheme && resolvedTheme === 'spring') {
          window.sessionStorage.setItem(ADMIN_THEME_RETURN_KEY, resolvedTheme);
        }

        setTheme('default');
      }

      return;
    }

    if (savedTheme === 'spring' && resolvedTheme === 'default') {
      window.sessionStorage.removeItem(ADMIN_THEME_RETURN_KEY);
      setTheme('spring');
      return;
    }

    if (savedTheme && savedTheme !== 'spring') {
      window.sessionStorage.removeItem(ADMIN_THEME_RETURN_KEY);
    }
  }, [pathname, resolvedTheme, setTheme]);

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
      <AdminThemeGuard />
      {children}
    </ThemeProvider>
  );
}
