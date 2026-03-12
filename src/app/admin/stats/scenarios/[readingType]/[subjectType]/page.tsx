'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type ScenarioStatsPayload = {
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  label: string;
  summary: {
    totalReadingCount: number;
    totalChargedCount: number;
    totalDuplicateCount: number;
    totalCacheHitCount: number;
    totalCacheReuseRate: number;
    totalFailureCount: number;
  };
  period: {
    days: number;
    from: string;
    to: string;
    readingCount: number;
    chargedCount: number;
    duplicateCount: number;
    cacheHitCount: number;
    cacheReuseRate: number;
    failureCount: number;
  };
  recentReadings: Array<{
    id: string;
    createdAt: string;
    chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
    cacheHit: boolean;
    targetLabel: string;
    user: {
      id: string;
      email: string;
    };
  }>;
  recentFailures: Array<{
    id: string;
    createdAt: string;
    stage: string;
    reasonCode: string;
    reasonMessage: string;
    user: {
      id: string;
      email: string;
    };
  }>;
};

const numberFormatter = new Intl.NumberFormat('ko-KR');
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDateTime(value: string): string {
  return dateFormatter.format(new Date(value));
}

function StatCard(props: {
  title: string;
  value: string;
  description: string;
}) {
  return (
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
}

export default function AdminScenarioStatsPage() {
  const router = useRouter();
  const params = useParams<{ readingType: string; subjectType: string }>();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [daysFilter, setDaysFilter] = useState('14');
  const [payload, setPayload] = useState<ScenarioStatsPayload | null>(null);

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

    const fetchScenarioStats = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(
          `/api/v1/admin/stats/scenarios/${params.readingType}/${params.subjectType}?days=${daysFilter}`,
          {
            cache: 'no-store'
          }
        );
        const result = (await response.json()) as ScenarioStatsPayload & {
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

        if (response.status === 404) {
          setStatus(result.error ?? '아직 이 시나리오 데이터가 없어요.');
          setPayload(null);
          return;
        }

        if (!response.ok) {
          setStatus(
            result.error ?? '시나리오 통계를 불러오는 흐름이 잠시 끊겼어요.'
          );
          setPayload(null);
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchScenarioStats();
  }, [
    daysFilter,
    params.readingType,
    params.subjectType,
    router,
    sessionReady
  ]);

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="시나리오 통계를 모으고 있어요."
          description="이 질문이 실제로 얼마나 자주 생성되고 어디서 막히는지 보고 있어요."
          messages={[
            '최근 생성과 실패를 같이 맞춰 보고 있어요.',
            '중복 재사용과 캐시 사용도 함께 살피고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            <h1 className="text-2xl font-bold">
              {payload?.label ?? '시나리오 통계'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            이 질문이 실제로 얼마나 생성되고, 얼마나 재사용되고, 어디서
            실패하는지 봅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
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
            <Link href="/admin/stats">통계로 돌아가기</Link>
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
              title="전체 생성"
              value={formatNumber(payload.summary.totalReadingCount)}
              description={`${payload.readingType === 'SELF' ? '사주' : '궁합'} 기준 누적 생성 수`}
            />
            <StatCard
              title="전체 재사용률"
              value={`${payload.summary.totalCacheReuseRate}%`}
              description={`캐시 사용 ${formatNumber(payload.summary.totalCacheHitCount)}건`}
            />
            <StatCard
              title={`최근 ${payload.period.days}일 생성`}
              value={formatNumber(payload.period.readingCount)}
              description={`복 차감 ${formatNumber(payload.period.chargedCount)}건 · 중복 재사용 ${formatNumber(payload.period.duplicateCount)}건`}
            />
            <StatCard
              title={`최근 ${payload.period.days}일 실패`}
              value={formatNumber(payload.period.failureCount)}
              description={`최근 ${payload.period.days}일 재사용률 ${payload.period.cacheReuseRate}%`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>최근 생성</CardTitle>
                <CardDescription>
                  가장 최근에 실제로 생성된 기록입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.recentReadings.length ? (
                  payload.recentReadings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {reading.user.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reading.targetLabel} ·{' '}
                          {formatDateTime(reading.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            reading.chargeStatus === 'CHARGED'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {reading.chargeStatus === 'CHARGED'
                            ? '복 차감'
                            : '중복 재사용'}
                        </Badge>
                        <Badge
                          variant={reading.cacheHit ? 'secondary' : 'outline'}
                        >
                          {reading.cacheHit ? '캐시 사용' : '새 생성'}
                        </Badge>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/readings/${reading.id}`}>
                            해석 보기
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    최근 생성 기록이 아직 없어요.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>최근 실패</CardTitle>
                <CardDescription>
                  이 시나리오에서 최근에 어디서 실패했는지 봅니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.recentFailures.length ? (
                  payload.recentFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">{failure.stage}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {failure.user.email} ·{' '}
                            {formatDateTime(failure.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {failure.reasonCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {failure.reasonMessage}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/failures/${failure.id}`}>
                          실패 보기
                        </Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    최근 실패 기록은 없어요.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}
