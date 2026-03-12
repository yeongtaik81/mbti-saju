import type { Metadata } from 'next';
import { Nanum_Brush_Script } from 'next/font/google';
import './globals.css';
import { ThemeStyleProvider } from '@/components/theme/ThemeStyleProvider';
import { ThemeStyleSwitcher } from '@/components/theme/ThemeStyleSwitcher';

const brushFont = Nanum_Brush_Script({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brush'
});

export const metadata: Metadata = {
  title: 'MBTI 사주',
  description: 'MBTI 기반 사주·궁합 해석 서비스',
  icons: {
    icon: '/brand/mbti-saju-mark-concept-3.svg',
    shortcut: '/brand/mbti-saju-mark-concept-3.svg',
    apple: '/brand/mbti-saju-mark-concept-3.svg'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={brushFont.variable}>
        <ThemeStyleProvider>
          <div className="pointer-events-none fixed top-3 right-3 z-[80] sm:top-4 sm:right-4">
            <ThemeStyleSwitcher className="pointer-events-auto" />
          </div>
          {children}
        </ThemeStyleProvider>
      </body>
    </html>
  );
}
