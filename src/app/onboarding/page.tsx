'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchClientSession } from '@/lib/auth/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { MBTI_TYPE_VALUES, type MbtiTypeValue } from '@/lib/mbti/test-engine';
import { onboardingCreateSchema } from '@/lib/validators/onboarding';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';

type OnboardingResponse = {
  onboarding: {
    name: string;
    birthDateTime: string;
    birthDate?: string;
    birthTime?: string | null;
    birthTimeUnknown?: boolean;
    birthCalendarType?: 'SOLAR' | 'LUNAR';
    isLeapMonth?: boolean;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
  } | null;
  mbti: {
    mbtiType: MbtiTypeValue;
    sourceType: 'DIRECT' | 'MINI_TEST' | 'FULL_TEST';
    decidedAt: string;
  } | null;
};

type MbtiSelectValue = MbtiTypeValue | 'UNSET';

type FormState = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mbtiType: MbtiSelectValue;
};

function getDefaultBirthDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `1984-${month}-${day}`;
}

function createDefaultForm(): FormState {
  return {
    name: '',
    birthDate: getDefaultBirthDate(),
    birthTime: '12:00',
    birthTimeUnknown: false,
    birthCalendarType: 'SOLAR',
    isLeapMonth: false,
    gender: 'FEMALE',
    mbtiType: 'UNSET'
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState<FormState>(() => createDefaultForm());

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      setIsAuthenticated(session.authenticated);
      setSessionReady(true);
    };

    void checkSession();
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    const fetchOnboarding = async () => {
      setFetching(true);
      setStatus('');

      try {
        const response = await fetch('/api/v1/onboarding');

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (!response.ok) {
          setStatus(
            '내 정보를 불러오는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }

        const payload = (await response.json()) as OnboardingResponse;
        const mbtiType = payload.mbti?.mbtiType ?? 'UNSET';

        if (!payload.onboarding) {
          setForm((prev) => ({ ...prev, mbtiType }));
          setIsEditMode(false);
          return;
        }

        setForm({
          name: payload.onboarding.name,
          birthDate:
            payload.onboarding.birthDate ??
            payload.onboarding.birthDateTime.slice(0, 10),
          birthTime:
            payload.onboarding.birthTime ??
            (payload.onboarding.birthTimeUnknown
              ? ''
              : payload.onboarding.birthDateTime.slice(11, 16)),
          birthTimeUnknown: payload.onboarding.birthTimeUnknown ?? false,
          birthCalendarType: payload.onboarding.birthCalendarType ?? 'SOLAR',
          isLeapMonth: payload.onboarding.isLeapMonth ?? false,
          gender: payload.onboarding.gender,
          mbtiType
        });
        setIsEditMode(true);
      } finally {
        setFetching(false);
      }
    };

    void fetchOnboarding();
  }, [sessionReady, isAuthenticated, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setStatus('로그인 흐름이 끊겼어요. 다시 들어와 주세요.');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const submitPayload = {
        name: form.name,
        birthDate: form.birthDate,
        birthTime: form.birthTimeUnknown ? null : form.birthTime,
        birthTimeUnknown: form.birthTimeUnknown,
        birthCalendarType: form.birthCalendarType,
        isLeapMonth: form.isLeapMonth,
        gender: form.gender,
        ...(form.mbtiType !== 'UNSET' ? { mbtiType: form.mbtiType } : {})
      };

      const validation = onboardingCreateSchema.safeParse(submitPayload);
      if (!validation.success) {
        setStatus(
          validation.error.issues[0]?.message ??
            '입력 내용을 다시 확인해 주세요.'
        );
        return;
      }

      const response = await fetch('/api/v1/onboarding', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitPayload)
      });

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok) {
        const errorPayload = (await response.json()) as { error?: string };
        setStatus(
          errorPayload.error ??
            '내 정보를 담는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionReady || (isAuthenticated && fetching)) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="내 정보를 불러오고 있어요."
          description="사주를 읽기 위한 기본 정보를 차분히 정리하고 있어요."
          messages={[
            '생년월일과 MBTI 정보를 함께 맞춰 보고 있어요.',
            '타고난 사주를 세울 준비를 하고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-6 sm:px-6 sm:py-10">
      <Card className="theme-card-ornament theme-surface w-full">
        <CardHeader>
          <div className="space-y-3">
            <ThemedBrandLogo
              className="h-9 w-auto max-w-[180px] sm:h-10 sm:max-w-[220px]"
              width={220}
              height={66}
              priority
            />
            <div className="space-y-2">
              <CardTitle>
                {isEditMode ? '내 정보 수정' : '내 정보 설정'}
              </CardTitle>
              <CardDescription>
                입력한 정보는 사주와 궁합을 읽는 바탕이 됩니다. 저장하면 바로
                MBTI 사주로 이어집니다.
              </CardDescription>
            </div>
          </div>
          <div className="theme-divider" />
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="onboarding-name">이름</Label>
              <Input
                id="onboarding-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="onboarding-birth-date">생년월일</Label>
              <Input
                id="onboarding-birth-date"
                type="date"
                value={form.birthDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    birthDate: event.target.value
                  }))
                }
                required
              />
            </div>

            <div className="grid gap-3">
              <Label>출생시각</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="birth-time-unknown"
                  checked={form.birthTimeUnknown}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      birthTimeUnknown: checked === true,
                      birthTime: checked === true ? '' : prev.birthTime
                    }))
                  }
                />
                <Label htmlFor="birth-time-unknown" className="text-sm">
                  출생시각 모름
                </Label>
              </div>
              <Input
                id="onboarding-birth-time"
                type="time"
                value={form.birthTime}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    birthTime: event.target.value
                  }))
                }
                required={!form.birthTimeUnknown}
                disabled={form.birthTimeUnknown}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calendar-type">달력 구분</Label>
              <Select
                value={form.birthCalendarType}
                onValueChange={(value) => {
                  const nextValue = value as 'SOLAR' | 'LUNAR';
                  setForm((prev) => ({
                    ...prev,
                    birthCalendarType: nextValue,
                    isLeapMonth:
                      nextValue === 'SOLAR' ? false : prev.isLeapMonth
                  }));
                }}
              >
                <SelectTrigger id="calendar-type">
                  <SelectValue placeholder="달력 구분 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOLAR">양력</SelectItem>
                  <SelectItem value="LUNAR">음력</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.birthCalendarType === 'LUNAR' ? (
              <div className="grid gap-2">
                <Label htmlFor="leap-month">윤달 여부</Label>
                <Select
                  value={form.isLeapMonth ? 'YES' : 'NO'}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      isLeapMonth: value === 'YES'
                    }))
                  }
                >
                  <SelectTrigger id="leap-month">
                    <SelectValue placeholder="윤달 여부 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">평달</SelectItem>
                    <SelectItem value="YES">윤달</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="gender">성별</Label>
              <Select
                value={form.gender}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    gender: value as FormState['gender']
                  }))
                }
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="성별 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">남성</SelectItem>
                  <SelectItem value="FEMALE">여성</SelectItem>
                  <SelectItem value="OTHER">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mbti-type">MBTI (선택 항목)</Label>
              <Select
                value={form.mbtiType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    mbtiType: value as MbtiSelectValue
                  }))
                }
              >
                <SelectTrigger id="mbti-type">
                  <SelectValue placeholder="MBTI 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNSET">선택 안함</SelectItem>
                  {MBTI_TYPE_VALUES.map((mbtiType) => (
                    <SelectItem key={mbtiType} value={mbtiType}>
                      {mbtiType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? '정리 중...' : '저장하고 MBTI 사주로 이동'}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard">MBTI 사주로 돌아가기</Link>
              </Button>
            </div>
          </form>

          {status ? (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <LoadingOverlay
        open={loading}
        mode="SELF"
        theme="timing"
        icon="sparkles"
        title="입력한 내 정보를 정리하고 있어요."
        description="저장이 끝나면 당신의 운을 읽는 화면으로 이동합니다."
        messages={[
          '사주에 필요한 기준 정보를 차곡차곡 담고 있어요.',
          'MBTI 위에 지금의 운을 읽을 준비를 하고 있어요.'
        ]}
      />
    </main>
  );
}
