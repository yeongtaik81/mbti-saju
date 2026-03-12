'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Circle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  emailSchema,
  evaluatePasswordPolicy,
  signUpMbtiPresetSchema,
  signUpRequestSchema
} from '@/lib/validators/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mbtiPreset, setMbtiPreset] = useState<{
    mbtiType: string;
    sourceType: 'DIRECT' | 'MINI_TEST' | 'FULL_TEST';
  } | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mbtiType = searchParams.get('mbtiType');
    const sourceType = searchParams.get('sourceType');
    if (!mbtiType || !sourceType) {
      return;
    }

    const parsed = signUpMbtiPresetSchema.safeParse({ mbtiType, sourceType });
    if (!parsed.success) {
      return;
    }

    setMbtiPreset(parsed.data);
  }, []);

  const emailInvalid =
    email.length > 0 && !emailSchema.safeParse(email).success;
  const emailValid = email.length > 0 && !emailInvalid;
  const passwordPolicy = useMemo(
    () => evaluatePasswordPolicy(password, email),
    [password, email]
  );
  const passwordRules = [
    {
      key: 'length',
      label: `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`,
      passed: passwordPolicy.lengthInRange
    },
    {
      key: 'types',
      label: '영문/숫자/특수문자 중 2가지 이상',
      passed: passwordPolicy.twoOrMoreCharacterTypes
    },
    {
      key: 'space',
      label: '공백 사용 금지',
      passed: passwordPolicy.noWhitespace
    },
    {
      key: 'email',
      label: '아이디(이메일) 포함 금지',
      passed: passwordPolicy.noEmailLocalPart
    }
  ];
  const passwordValid =
    password.length > 0 && passwordRules.every((rule) => rule.passed);
  const passwordInvalid = password.length > 0 && !passwordValid;
  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const confirmStepDone = confirmPassword.length > 0 && !passwordMismatch;
  const canSubmit = !loading && emailValid && passwordValid && confirmStepDone;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = signUpRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setMessage(
        fieldErrors.email?.[0] ??
          fieldErrors.password?.[0] ??
          '입력값을 다시 확인해 주세요.'
      );
      return;
    }

    if (passwordMismatch) {
      setMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/v1/auth/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          ...(mbtiPreset ? { mbti: mbtiPreset } : {})
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(
          payload.error ??
            '가입을 여는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-6 sm:px-6 sm:py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>MBTI 사주 시작하기</CardTitle>
          <CardDescription>
            계정을 만들면 타고난 사주 위에 지금 들어온 운을 바로 이어서 읽을 수
            있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mbtiPreset ? (
            <Alert>
              <AlertDescription>
                방금 확인한 MBTI 결과({mbtiPreset.mbtiType})가 가입과 함께 내
                정보에 담기고, 사주 풀이에 바로 이어집니다.
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
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
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                required
                aria-invalid={passwordInvalid}
              />
              <ul className="space-y-1 text-xs">
                {passwordRules.map((rule) => (
                  <li
                    key={rule.key}
                    className={cn(
                      'flex items-center gap-2',
                      rule.passed ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {rule.passed ? (
                      <Check size={13} className="text-primary" />
                    ) : (
                      <Circle size={13} />
                    )}
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                required
                aria-invalid={passwordMismatch}
              />
              {passwordMismatch ? (
                <p className="text-xs text-destructive">
                  비밀번호가 일치하지 않습니다.
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {loading ? '여는 중...' : '가입하고 운 읽기'}
            </Button>
          </form>

          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>이미 계정이 있나요?</span>
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/">로그인하기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
