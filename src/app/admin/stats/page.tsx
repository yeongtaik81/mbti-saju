'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { fetchClientSession, type ClientSessionUser } from '@/lib/auth/client';
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
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { ThemedBrandMark } from '@/components/theme/ThemedBrandMark';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type AdminStatsPayload = {
  summary: {
    userCount: number;
    onboardedCount: number;
    mbtiCompletedCount: number;
    mbtiFreeSignupCount: number;
    readingCount: number;
    chargedReadingCount: number;
    duplicateReuseCount: number;
    cacheHitCount: number;
    cacheReuseRate: number;
    failureCount: number;
    paymentCount: number;
  };
  mbti: {
    summary: {
      guestVisitors: number;
      memberVisitors: number;
      guestCompletions: number;
      memberCompletions: number;
      miniCompletions: number;
      fullCompletions: number;
      savedResults: number;
      signupCount: number;
      dropOffCount: number;
      dropOffRate: number;
      signupConversionRate: number;
    };
    period: {
      days: number;
      guestVisitors: number;
      memberVisitors: number;
      guestCompletions: number;
      memberCompletions: number;
      miniCompletions: number;
      fullCompletions: number;
      savedResults: number;
      signupCount: number;
      dropOffCount: number;
      dropOffRate: number;
      signupConversionRate: number;
    };
  };
  period: {
    days: number;
    from: string;
    to: string;
    readingCount: number;
    cacheHitCount: number;
    cacheReuseRate: number;
  };
  mixes: {
    readingTypes: Array<{
      key: string;
      label: string;
      count: number;
    }>;
    chargeStatuses: Array<{
      key: string;
      label: string;
      count: number;
    }>;
    failureStages: Array<{
      stage: string;
      count: number;
    }>;
  };
  topScenarios: Array<{
    readingType: 'SELF' | 'COMPATIBILITY';
    subjectType: string;
    label: string;
    count: number;
  }>;
  daily: Array<{
    key: string;
    label: string;
    users: number;
    readings: number;
    chargedReadings: number;
    duplicateReuses: number;
    cacheHits: number;
    failures: number;
    payments: number;
    paymentAmount: number;
    mbtiPageViews: number;
    mbtiResultViews: number;
    mbtiMiniResults: number;
    mbtiFullResults: number;
    mbtiSignups: number;
  }>;
};

const numberFormatter = new Intl.NumberFormat('ko-KR');
const shortDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit'
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDateRange(from: string, to: string): string {
  return `${shortDateFormatter.format(new Date(from))} ~ ${shortDateFormatter.format(new Date(to))}`;
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function StatCard(props: {
  title: string;
  value: string;
  description: string;
  href?: string;
}) {
  const content = (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-2xl">{props.value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardContent>
    </Card>
  );

  if (!props.href) {
    return content;
  }

  return (
    <Link
      href={props.href}
      className="block transition-transform hover:-translate-y-0.5"
    >
      {content}
    </Link>
  );
}

function HorizontalStatList(props: {
  items: Array<{
    label: string;
    value: number;
    badge?: string;
    href?: string;
  }>;
  emptyText: string;
}) {
  const maxValue = useMemo(
    () => Math.max(...props.items.map((item) => item.value), 1),
    [props.items]
  );

  if (props.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{props.emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {props.items.map((item) => (
        <div key={`${item.label}-${item.badge ?? ''}`} className="space-y-1">
          {item.href ? (
            <Link
              href={item.href}
              className="block rounded-md p-2 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.badge ? (
                    <Badge variant="outline">{item.badge}</Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground">
                  {formatNumber(item.value)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-foreground/80"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0)}%`
                  }}
                />
              </div>
            </Link>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.badge ? (
                    <Badge variant="outline">{item.badge}</Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground">
                  {formatNumber(item.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-foreground/80"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0)}%`
                  }}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function FunnelStepCard(props: {
  title: string;
  value: number;
  description: string;
  rateLabel?: string;
  href?: string;
}) {
  const content = (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-2xl">{formatNumber(props.value)}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <p className="text-sm text-muted-foreground">{props.description}</p>
        {props.rateLabel ? (
          <Badge variant="secondary">{props.rateLabel}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!props.href) {
    return content;
  }

  return (
    <Link
      href={props.href}
      className="block transition-transform hover:-translate-y-0.5"
    >
      {content}
    </Link>
  );
}

function AdminStatsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState<AdminStatsPayload | null>(null);

  const daysFilter = useMemo(() => {
    const value = searchParams.get('days');
    if (value === '7' || value === '14' || value === '30' || value === '90') {
      return value;
    }
    return '14';
  }, [searchParams]);

  const mbtiFunnel = useMemo(() => {
    if (!payload) {
      return null;
    }

    const guestVisitors = payload.mbti.period.guestVisitors;
    const guestCompletions = payload.mbti.period.guestCompletions;
    const signupCount = payload.mbti.period.signupCount;

    const viewToCompletionRate =
      guestVisitors > 0
        ? Math.round((guestCompletions / guestVisitors) * 1000) / 10
        : 0;
    const completionToSignupRate =
      guestCompletions > 0
        ? Math.round((signupCount / guestCompletions) * 1000) / 10
        : 0;
    const viewToSignupRate =
      guestVisitors > 0
        ? Math.round((signupCount / guestVisitors) * 1000) / 10
        : 0;

    return {
      guestVisitors,
      guestCompletions,
      signupCount,
      viewToCompletionRate,
      completionToSignupRate,
      viewToSignupRate
    };
  }, [payload]);

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      if (!session.authenticated || !session.user) {
        router.replace('/');
        return;
      }

      if (session.user.role !== 'ADMIN') {
        router.replace('/dashboard');
        return;
      }

      setSessionUser(session.user);
      setSessionReady(true);
    };

    void checkSession();
  }, [router]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(`/api/v1/admin/stats?days=${daysFilter}`, {
          cache: 'no-store'
        });
        const result = (await response.json()) as AdminStatsPayload & {
          error?: string;
        };

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (response.status === 403) {
          router.replace('/dashboard');
          return;
        }

        if (!response.ok) {
          setStatus(result.error ?? '통계를 불러오는 흐름이 잠시 끊겼어요.');
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [daysFilter, router, sessionReady]);

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="운영 통계를 모으고 있어요."
          description="가입, 해석, 재사용, 실패 흐름을 한 화면에 정리하고 있어요."
          messages={[
            '최근 14일 동안 어떤 변화가 있었는지 함께 보고 있어요.',
            '어디서 생성이 잘 붙고 어디서 끊기는지도 같이 살피고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ThemedBrandMark size="sm" />
            <BarChart3 className="size-5" />
            <h1 className="text-2xl font-bold">통계</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            최근 {payload?.period.days ?? Number.parseInt(daysFilter, 10)}일
            흐름과 전체 운영 지표를 함께 봅니다.
          </p>
          <div className="theme-divider" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
          <Select
            value={daysFilter}
            onValueChange={(value) => router.push(`/admin/stats?days=${value}`)}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">최근 7일</SelectItem>
              <SelectItem value="14">최근 14일</SelectItem>
              <SelectItem value="30">최근 30일</SelectItem>
              <SelectItem value="90">최근 90일</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">관리자로 돌아가기</Link>
          </Button>
        </div>
      </header>

      {status ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="전체 사용자"
              value={formatNumber(payload.summary.userCount)}
              description={`프로필 완료 ${formatNumber(payload.summary.onboardedCount)}명 · MBTI 완료 ${formatNumber(payload.summary.mbtiCompletedCount)}명`}
              href="/admin/users"
            />
            <StatCard
              title="전체 해석"
              value={formatNumber(payload.summary.readingCount)}
              description={`복 차감 ${formatNumber(payload.summary.chargedReadingCount)}건 · 중복 재사용 ${formatNumber(payload.summary.duplicateReuseCount)}건`}
              href="/admin/readings"
            />
            <StatCard
              title="캐시 재사용률"
              value={`${payload.summary.cacheReuseRate}%`}
              description={`전체 캐시 사용 ${formatNumber(payload.summary.cacheHitCount)}건`}
              href="/admin/readings?cacheHit=true"
            />
            <StatCard
              title="최근 14일 재사용률"
              value={`${payload.period.cacheReuseRate}%`}
              description={`최근 14일 해석 ${formatNumber(payload.period.readingCount)}건 · 캐시 사용 ${formatNumber(payload.period.cacheHitCount)}건`}
              href="/admin/readings?cacheHit=true"
            />
          </section>

          <Card className="theme-card-ornament theme-surface border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>무료 MBTI 흐름</CardTitle>
                  <CardDescription>
                    접속, 검사, 가입 전환, 이탈까지 한 구간에서 봅니다.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/mbti?days=${payload.mbti.period.days}`}>
                    전체 보기
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="비로그인 접속"
                  value={formatNumber(payload.mbti.summary.guestVisitors)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.guestVisitors)}명`}
                  href={`/admin/mbti?focus=GUEST_VISITORS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="로그인 접속"
                  value={formatNumber(payload.mbti.summary.memberVisitors)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.memberVisitors)}명`}
                  href={`/admin/mbti?focus=MEMBER_VISITORS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="비로그인 검사 완료"
                  value={formatNumber(payload.mbti.summary.guestCompletions)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.guestCompletions)}명`}
                  href={`/admin/mbti?focus=GUEST_COMPLETIONS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="로그인 검사 완료"
                  value={formatNumber(payload.mbti.summary.memberCompletions)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.memberCompletions)}명`}
                  href={`/admin/mbti?focus=MEMBER_COMPLETIONS&days=${payload.mbti.period.days}`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  title="무료 MBTI로 가입"
                  value={formatNumber(payload.summary.mbtiFreeSignupCount)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.signupCount)}명`}
                  href={`/admin/mbti?focus=SIGNUPS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="가입 없이 이탈"
                  value={formatNumber(payload.mbti.summary.dropOffCount)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.dropOffCount)}명`}
                />
                <StatCard
                  title="미니 테스트 결과 확인"
                  value={formatNumber(payload.mbti.summary.miniCompletions)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.miniCompletions)}회`}
                  href={`/admin/mbti?focus=MINI_RESULTS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="정식 테스트 결과 확인"
                  value={formatNumber(payload.mbti.summary.fullCompletions)}
                  description={`최근 ${payload.mbti.period.days}일 ${formatNumber(payload.mbti.period.fullCompletions)}회`}
                  href={`/admin/mbti?focus=FULL_RESULTS&days=${payload.mbti.period.days}`}
                />
                <StatCard
                  title="가입 전환율"
                  value={`${payload.mbti.summary.signupConversionRate}%`}
                  description={`최근 ${payload.mbti.period.days}일 ${payload.mbti.period.signupConversionRate}% · 이탈률 ${payload.mbti.period.dropOffRate}%`}
                />
              </div>

              {mbtiFunnel ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      최근 {payload.mbti.period.days}일 무료 MBTI 전환 퍼널
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      비로그인 접속자가 결과를 보고 가입까지 이어지는 흐름을
                      단계별로 봅니다.
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
                    <FunnelStepCard
                      title="비로그인 접속"
                      value={mbtiFunnel.guestVisitors}
                      description="무료 MBTI 페이지를 연 익명 방문자입니다."
                      href={`/admin/mbti?focus=GUEST_VISITORS&days=${payload.mbti.period.days}`}
                    />
                    <div className="hidden items-center justify-center text-sm text-muted-foreground lg:flex">
                      {formatPercent(mbtiFunnel.viewToCompletionRate)}
                    </div>
                    <FunnelStepCard
                      title="결과 확인"
                      value={mbtiFunnel.guestCompletions}
                      description="검사를 끝내고 결과를 실제로 본 방문자입니다."
                      rateLabel={`접속 대비 ${formatPercent(mbtiFunnel.viewToCompletionRate)}`}
                      href={`/admin/mbti?focus=GUEST_COMPLETIONS&days=${payload.mbti.period.days}`}
                    />
                    <div className="hidden items-center justify-center text-sm text-muted-foreground lg:flex">
                      {formatPercent(mbtiFunnel.completionToSignupRate)}
                    </div>
                    <FunnelStepCard
                      title="가입 완료"
                      value={mbtiFunnel.signupCount}
                      description="무료 MBTI 결과를 본 뒤 가입까지 이어진 사용자입니다."
                      rateLabel={`결과 대비 ${formatPercent(mbtiFunnel.completionToSignupRate)} · 전체 ${formatPercent(mbtiFunnel.viewToSignupRate)}`}
                      href={`/admin/mbti?focus=SIGNUPS&days=${payload.mbti.period.days}`}
                    />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>최근 {payload.period.days}일 추이</CardTitle>
                <CardDescription>
                  {formatDateRange(payload.period.from, payload.period.to)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.daily.map((day) => (
                  <div
                    key={day.key}
                    className="grid gap-2 rounded-lg border p-3 md:grid-cols-[80px_1fr_auto]"
                  >
                    <div className="text-sm font-medium">{day.label}</div>
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>가입 {formatNumber(day.users)}</span>
                        <span>해석 {formatNumber(day.readings)}</span>
                        <span>실패 {formatNumber(day.failures)}</span>
                        <span>충전 {formatNumber(day.payments)}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="bg-foreground/85"
                          style={{
                            width: `${Math.min(day.readings * 8, 100)}%`
                          }}
                        />
                        <div
                          className="bg-destructive/80"
                          style={{
                            width: `${Math.min(day.failures * 8, 100)}%`
                          }}
                        />
                        <div
                          className="bg-primary/70"
                          style={{
                            width: `${Math.min(day.payments * 8, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      캐시 {formatNumber(day.cacheHits)} · 재사용{' '}
                      {formatNumber(day.duplicateReuses)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    무료 MBTI 최근 {payload.mbti.period.days}일 추이
                  </CardTitle>
                  <CardDescription>
                    접속, 결과 확인, 가입 전환 흐름을 함께 봅니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payload.daily.map((day) => (
                    <div
                      key={`mbti-${day.key}`}
                      className="grid gap-2 rounded-lg border p-3 md:grid-cols-[80px_1fr_auto]"
                    >
                      <div className="text-sm font-medium">{day.label}</div>
                      <div className="grid gap-2">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>접속 {formatNumber(day.mbtiPageViews)}</span>
                          <span>결과 {formatNumber(day.mbtiResultViews)}</span>
                          <span>가입 {formatNumber(day.mbtiSignups)}</span>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-foreground/85"
                            style={{
                              width: `${Math.min(day.mbtiPageViews * 10, 100)}%`
                            }}
                          />
                          <div
                            className="bg-primary/80"
                            style={{
                              width: `${Math.min(day.mbtiResultViews * 10, 100)}%`
                            }}
                          />
                          <div
                            className="bg-emerald-500/80"
                            style={{
                              width: `${Math.min(day.mbtiSignups * 20, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        미니 {formatNumber(day.mbtiMiniResults)} · 정식{' '}
                        {formatNumber(day.mbtiFullResults)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>읽기 유형</CardTitle>
                  <CardDescription>
                    최근 {payload.period.days}일 기준
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HorizontalStatList
                    items={payload.mixes.readingTypes.map((item) => ({
                      label: item.label,
                      value: item.count,
                      href: `/admin/readings?readingType=${item.key}`
                    }))}
                    emptyText="최근 14일 데이터가 아직 없어요."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>과금/재사용 구조</CardTitle>
                  <CardDescription>전체 누적 기준</CardDescription>
                </CardHeader>
                <CardContent>
                  <HorizontalStatList
                    items={payload.mixes.chargeStatuses.map((item) => ({
                      label: item.label,
                      value: item.count,
                      href: `/admin/readings?chargeStatus=${item.key}`
                    }))}
                    emptyText="아직 해석 데이터가 없어요."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>실패 stage</CardTitle>
                  <CardDescription>
                    최근 {payload.period.days}일 기준
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HorizontalStatList
                    items={payload.mixes.failureStages.map((item) => ({
                      label: item.stage,
                      value: item.count,
                      href: `/admin/failures?stage=${item.stage}`
                    }))}
                    emptyText="최근 실패가 없어요."
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>
                최근 {payload.period.days}일 많이 본 시나리오
              </CardTitle>
              <CardDescription>
                어떤 질문이 실제로 많이 생성되는지 봅니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payload.topScenarios.length ? (
                <div className="space-y-3">
                  {payload.topScenarios.map((scenario) => {
                    const maxValue = Math.max(
                      ...payload.topScenarios.map((item) => item.count),
                      1
                    );
                    return (
                      <Link
                        key={`${scenario.readingType}:${scenario.subjectType}`}
                        href={`/admin/stats/scenarios/${scenario.readingType}/${scenario.subjectType}`}
                        className="block space-y-1 rounded-lg p-2 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {scenario.label}
                            </span>
                            <Badge variant="outline">
                              {scenario.readingType === 'SELF'
                                ? '사주'
                                : '궁합'}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground">
                            {formatNumber(scenario.count)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-foreground/80"
                            style={{
                              width: `${Math.max((scenario.count / maxValue) * 100, scenario.count > 0 ? 8 : 0)}%`
                            }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  최근 {payload.period.days}일 시나리오 데이터가 아직 없어요.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}

export default function AdminStatsPage() {
  return (
    <Suspense fallback={null}>
      <AdminStatsPageContent />
    </Suspense>
  );
}
