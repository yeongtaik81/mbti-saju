import type { Metadata } from 'next';
import { GNB } from '@/components/layout/GNB';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trading Dashboard',
  description: 'KRX Algorithmic Trading System'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <GNB />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
