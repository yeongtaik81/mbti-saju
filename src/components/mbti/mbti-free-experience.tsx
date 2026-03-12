'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchClientSession } from '@/lib/auth/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  evaluateMbtiTest,
  getPublicMbtiQuestions,
  MbtiTestType,
  MbtiTypeValue
} from '@/lib/mbti/test-engine';
import { cn } from '@/lib/utils';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';

type MbtiSourceType = 'DIRECT' | 'MINI_TEST' | 'FULL_TEST';
type MbtiMode = 'MINI' | 'FULL';
type MbtiOptionId = 'A' | 'B';

type SavedMbti = {
  mbtiType: MbtiTypeValue;
  sourceType: MbtiSourceType;
  decidedAt: string;
} | null;

type MbtiFreeExperienceProps = {
  redirectAfterSave?: string;
};

function getMbtiSourceLabel(sourceType: MbtiSourceType): string {
  if (sourceType === 'MINI_TEST') {
    return '미니 테스트';
  }

  if (sourceType === 'FULL_TEST') {
    return '정식 테스트';
  }

  return '직접 입력';
}

export function MbtiFreeExperience({
  redirectAfterSave = '/dashboard'
}: MbtiFreeExperienceProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedMbti, setSavedMbti] = useState<SavedMbti>(null);
  const [mode, setMode] = useState<MbtiMode>('MINI');
  const [answers, setAnswers] = useState<Record<string, MbtiOptionId>>({});
  const [calculatedMbti, setCalculatedMbti] = useState<MbtiTypeValue | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const hasTrackedPageView = useRef(false);

  const testType: MbtiTestType = mode;
  const questions = useMemo(() => getPublicMbtiQuestions(testType), [testType]);
  const unansweredCount = questions.filter(
    (question) => !answers[question.id]
  ).length;
  const resultSourceType: Extract<MbtiSourceType, 'MINI_TEST' | 'FULL_TEST'> =
    mode === 'MINI' ? 'MINI_TEST' : 'FULL_TEST';

  useEffect(() => {
    if (hasTrackedPageView.current) {
      return;
    }

    hasTrackedPageView.current = true;

    void fetch('/api/v1/mbti/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType: 'PAGE_VIEW',
        pagePath: '/mbti'
      })
    }).catch(() => {
      // ignore optional analytics failure
    });
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      const session = await fetchClientSession();
      setIsLoggedIn(session.authenticated);
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setSavedMbti(null);
      return;
    }

    const fetchCurrentMbti = async () => {
      try {
        const response = await fetch('/api/v1/mbti');

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          mbti: SavedMbti;
        };

        if (!payload.mbti) {
          return;
        }

        setSavedMbti(payload.mbti);
      } catch {
        // ignore optional loading failure
      }
    };

    void fetchCurrentMbti();
  }, [isLoggedIn]);

  useEffect(() => {
    setAnswers({});
    setCalculatedMbti(null);
    setStatus('');
  }, [mode]);

  const onChangeAnswer = (questionId: string, optionId: MbtiOptionId) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const onCalculateResult = () => {
    if (unansweredCount > 0) {
      setStatus(
        `아직 ${unansweredCount}문항이 남았어요. 모두 답하면 결과를 확인할 수 있어요.`
      );
      return;
    }

    try {
      const result = evaluateMbtiTest(
        testType,
        questions.map((question) => ({
          questionId: question.id,
          optionId: answers[question.id] as MbtiOptionId
        }))
      );

      setCalculatedMbti(result.mbtiType);
      setStatus('');

      void fetch('/api/v1/mbti/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventType: 'RESULT_VIEWED',
          testType,
          mbtiType: result.mbtiType,
          pagePath: '/mbti'
        })
      }).catch(() => {
        // ignore optional analytics failure
      });
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
        return;
      }
      setStatus(
        '검사 결과를 읽는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
      );
    }
  };

  const onSaveToMyMbti = async () => {
    if (!calculatedMbti) {
      setStatus('먼저 "MBTI 결과 확인하기"를 눌러 주세요.');
      return;
    }

    if (!isLoggedIn) {
      setStatus('로그인하면 지금 결과를 내 정보에 바로 담을 수 있어요.');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/v1/mbti/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mbtiType: calculatedMbti,
          sourceType: resultSourceType
        })
      });

      const payload = (await response.json()) as {
        mbti?: SavedMbti;
        error?: string;
      };

      if (!response.ok || !payload.mbti) {
        setStatus(
          payload.error ??
            'MBTI 결과를 담는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setSavedMbti(payload.mbti);

      void fetch('/api/v1/mbti/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventType: 'RESULT_SAVED',
          testType,
          mbtiType: calculatedMbti,
          pagePath: '/mbti'
        })
      }).catch(() => {
        // ignore optional analytics failure
      });

      router.push(redirectAfterSave);
    } finally {
      setLoading(false);
    }
  };

  const signUpHref =
    calculatedMbti !== null
      ? `/sign-up?mbtiType=${calculatedMbti}&sourceType=${resultSourceType}`
      : '/sign-up';

  return (
    <section className="grid gap-4">
      <Card className="theme-card-ornament theme-surface">
        <CardHeader className="gap-3">
          <div className="space-y-2">
            <ThemedBrandLogo
              className="h-8 w-auto max-w-[160px] sm:h-9 sm:max-w-[200px]"
              width={200}
              height={60}
              priority
            />
            <CardTitle>당신의 MBTI를 검사해 보세요</CardTitle>
            <CardDescription>
              미니 테스트와 36문항 정식 테스트 중 원하는 방식으로 진행해 보세요.
              결과를 저장하면 MBTI 위에 들어온 운까지 바로 이어서 읽을 수
              있습니다.
            </CardDescription>
            <div className="theme-divider" />
            {isLoggedIn ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>현재 내 MBTI: {savedMbti?.mbtiType ?? '미설정'}</span>
                {savedMbti ? (
                  <Badge variant="outline">
                    확정 방식: {getMbtiSourceLabel(savedMbti.sourceType)}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mbti-mode-mini">검사 유형</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as MbtiMode)}
              className="grid w-full max-w-sm grid-cols-2 rounded-lg border bg-muted/40 p-1"
            >
              <div>
                <RadioGroupItem
                  value="MINI"
                  id="mbti-mode-mini"
                  className="sr-only"
                />
                <Label
                  htmlFor="mbti-mode-mini"
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors',
                    mode === 'MINI'
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  미니 테스트
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="FULL"
                  id="mbti-mode-full"
                  className="sr-only"
                />
                <Label
                  htmlFor="mbti-mode-full"
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors',
                    mode === 'FULL'
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  정식 테스트
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {mode === 'MINI' ? '미니 테스트' : '정식 테스트'} · 총{' '}
            {questions.length}문항
          </p>

          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {index + 1}. {question.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[question.id] ?? ''}
                  onValueChange={(value) =>
                    onChangeAnswer(question.id, value as MbtiOptionId)
                  }
                  className="grid gap-2"
                >
                  {question.options.map((option) => {
                    const inputId = `${question.id}-${option.id}`;
                    const isSelected = answers[question.id] === option.id;
                    return (
                      <div
                        key={option.id}
                        className={cn(
                          'flex items-start gap-2 rounded-md border p-3 transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-background'
                        )}
                      >
                        <RadioGroupItem
                          id={inputId}
                          value={option.id}
                          className={cn(
                            isSelected
                              ? 'border-primary-foreground data-[state=checked]:border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary'
                              : undefined
                          )}
                        />
                        <Label
                          htmlFor={inputId}
                          className="cursor-pointer leading-5"
                        >
                          {option.text}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={onCalculateResult}
            className="w-fit"
          >
            MBTI 결과 확인하기
          </Button>

          {isLoggedIn && calculatedMbti ? (
            <div className="grid gap-3">
              <Alert>
                <AlertDescription>
                  이번 검사 결과: {calculatedMbti}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                onClick={() => void onSaveToMyMbti()}
                disabled={loading}
                className="w-fit"
              >
                {loading ? '정리 중...' : '내 MBTI로 저장하고 MBTI 사주로 이동'}
              </Button>
            </div>
          ) : null}

          {!isLoggedIn && calculatedMbti ? (
            <Card className="border-dashed">
              <CardContent className="grid gap-3 pt-6 text-sm">
                <p>이번 검사 결과: {calculatedMbti}</p>
                <p>
                  지금 가입하면 결과가 자동 저장되고, MBTI 위에 들어온 운까지
                  바로 이어서 읽을 수 있어요.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={signUpHref}>가입하고 결과 담기</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">로그인하고 담기</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {status ? (
            <Alert>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <LoadingOverlay
        open={loading}
        mode="SELF"
        theme="relationship"
        icon="sparkles"
        title="MBTI 결과를 내 정보에 담고 있어요."
        description="저장이 끝나면 성향 위에 들어온 운을 바로 읽을 수 있어요."
        messages={[
          '이번 검사 결과를 차곡차곡 정리하고 있어요.',
          '성향 위에서 읽힐 운의 방향을 맞추고 있어요.',
          '지금 결과가 사주 풀이에 자연스럽게 이어지도록 정리하고 있어요.'
        ]}
      />
    </section>
  );
}
