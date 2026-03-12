'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchClientSession } from '@/lib/auth/client';
import { MbtiFreeExperience } from '@/components/mbti/mbti-free-experience';
import { Button } from '@/components/ui/button';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';

export default function MbtiPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      setIsLoggedIn(session.authenticated);
    };

    void checkSession();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <section className="theme-card-ornament theme-surface rounded-3xl border bg-card/80 px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div>
              <ThemedBrandLogo
                className="h-9 w-auto max-w-[180px] sm:h-10 sm:max-w-[220px]"
                width={220}
                height={66}
                priority
              />
              <h1 className="mt-3 text-2xl font-bold">무료 MBTI</h1>
              <p className="text-sm text-muted-foreground">
                성향을 먼저 읽고, 그 위에 들어온 운까지 이어서 볼 수 있어요.
              </p>
            </div>
            <div className="theme-divider" />
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">MBTI 사주 보러가기</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/">로그인</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">회원가입</Link>
            </Button>
          </div>
        </div>
      </section>
      <MbtiFreeExperience redirectAfterSave="/dashboard" />
    </main>
  );
}
