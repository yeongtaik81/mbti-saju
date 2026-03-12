'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { fetchClientSession } from '@/lib/auth/client';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';
import {
  emailSchema,
  signInPasswordSchema,
  signInRequestSchema
} from '@/lib/validators/auth';

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const emailInvalid =
    email.length > 0 && !emailSchema.safeParse(email).success;
  const passwordInvalid =
    password.length > 0 && !signInPasswordSchema.safeParse(password).success;

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      if (session.authenticated) {
        router.replace('/dashboard');
        return;
      }

      setCheckingSession(false);
    };

    void checkSession();
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = signInRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      if (firstIssue?.path[0] === 'email') {
        setMessage('올바른 이메일 형식을 입력해 주세요.');
      } else if (firstIssue?.path[0] === 'password') {
        setMessage('비밀번호를 입력해 주세요.');
      } else {
        setMessage('입력값을 다시 확인해 주세요.');
      }
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/v1/auth/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? '이메일 또는 비밀번호를 확인해 주세요.');
        return;
      }

      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-6 sm:px-6 sm:py-10">
        <Card className="w-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              MBTI 사주로 들어가는 길을 열고 있어요.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <Card className="theme-surface mx-auto w-full max-w-md overflow-hidden">
        <CardHeader className="theme-card-ornament">
          <div className="space-y-3">
            <ThemedBrandLogo
              className="h-10 w-auto max-w-[200px] sm:h-12 sm:max-w-[240px]"
              width={240}
              height={72}
              priority
            />
            <div className="space-y-1">
              <CardTitle className="text-2xl">사주는 인생의 지도</CardTitle>
              <CardDescription>
                MBTI 나침반으로, 그 길을 더 또렷하게 찾도록 도와드립니다.
              </CardDescription>
            </div>
          </div>
          <div className="theme-divider" />
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="home-email">이메일</Label>
              <Input
                id="home-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                aria-invalid={emailInvalid}
              />
              {emailInvalid ? (
                <p className="text-xs text-destructive">
                  올바른 이메일 형식을 입력해 주세요.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="home-password">비밀번호</Label>
              <Input
                id="home-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                aria-invalid={passwordInvalid}
              />
              {passwordInvalid ? (
                <p className="text-xs text-destructive">
                  비밀번호를 입력해 주세요.
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || emailInvalid || passwordInvalid}
            >
              {loading ? '들어가는 중...' : '로그인'}
            </Button>
          </form>

          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">이메일로 시작하기</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-primary/80 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Link href="/mbti">무료 MBTI 검사하기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
