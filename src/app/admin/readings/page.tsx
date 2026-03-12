'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Shield } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type AdminReadingListPayload = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  readings: Array<{
    id: string;
    createdAt: string;
    readingType: 'SELF' | 'COMPATIBILITY';
    subjectType: string;
    subjectLabel: string;
    chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
    cacheHit: boolean;
    itemCost: number;
    user: {
      id: string;
      email: string;
    };
    targetLabel: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

function formatDateTime(value: string): string {
  return dateFormatter.format(new Date(value));
}

function AdminReadingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState<AdminReadingListPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [readingTypeFilter, setReadingTypeFilter] = useState(
    searchParams.get('readingType') ?? 'ALL'
  );
  const [chargeStatusFilter, setChargeStatusFilter] = useState(
    searchParams.get('chargeStatus') ?? 'ALL'
  );
  const [cacheHitFilter, setCacheHitFilter] = useState(
    searchParams.get('cacheHit') ?? 'ALL'
  );

  const currentPage = useMemo(() => {
    const value = Number.parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [searchParams]);

  const activeFilters = useMemo(() => {
    const items: string[] = [];
    if (query.trim()) {
      items.push(`검색: ${query.trim()}`);
    }
    if (readingTypeFilter === 'SELF') {
      items.push('유형: 사주');
    } else if (readingTypeFilter === 'COMPATIBILITY') {
      items.push('유형: 궁합');
    }
    if (chargeStatusFilter === 'CHARGED') {
      items.push('차감: 복 차감');
    } else if (chargeStatusFilter === 'SKIPPED_DUPLICATE') {
      items.push('차감: 중복 재사용');
    }
    if (cacheHitFilter === 'true') {
      items.push('캐시: 사용');
    } else if (cacheHitFilter === 'false') {
      items.push('캐시: 새 생성');
    }
    return items;
  }, [cacheHitFilter, chargeStatusFilter, query, readingTypeFilter]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setReadingTypeFilter(searchParams.get('readingType') ?? 'ALL');
    setChargeStatusFilter(searchParams.get('chargeStatus') ?? 'ALL');
    setCacheHitFilter(searchParams.get('cacheHit') ?? 'ALL');
  }, [searchParams]);

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

    const fetchReadings = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(
          `/api/v1/admin/readings?${searchParams.toString()}`,
          {
            cache: 'no-store'
          }
        );
        const result = (await response.json()) as AdminReadingListPayload & {
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
          setStatus(
            result.error ?? '최근 해석 목록을 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchReadings();
  }, [router, searchParams, sessionReady]);

  const applyFilters = (page = 1) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    if (readingTypeFilter !== 'ALL') {
      params.set('readingType', readingTypeFilter);
    }
    if (chargeStatusFilter !== 'ALL') {
      params.set('chargeStatus', chargeStatusFilter);
    }
    if (cacheHitFilter !== 'ALL') {
      params.set('cacheHit', cacheHitFilter);
    }
    params.set('page', String(page));
    const queryString = params.toString();
    router.push(
      queryString ? `/admin/readings?${queryString}` : '/admin/readings'
    );
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="전체 해석 목록을 준비하고 있어요."
          description="누가 어떤 질문으로 운을 읽었는지 최근 순서대로 모으고 있어요."
          messages={[
            '사주와 궁합이 최근 어떤 흐름으로 생성됐는지 보고 있어요.',
            '사용자, 질문, 캐시 사용 여부도 함께 정리하고 있어요.'
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
            <Shield className="size-5" />
            <h1 className="text-2xl font-bold">전체 최근 해석</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            최근에 생성된 사주와 궁합을 전체 사용자 기준으로 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>
            이메일, 질문, 대상 이름 기준으로 최근 해석을 찾습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_auto_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이메일, 질문, 대상 이름으로 찾기"
          />
          <Select
            value={readingTypeFilter}
            onValueChange={setReadingTypeFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="유형 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">유형 전체</SelectItem>
              <SelectItem value="SELF">사주</SelectItem>
              <SelectItem value="COMPATIBILITY">궁합</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={chargeStatusFilter}
            onValueChange={setChargeStatusFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="차감 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">차감 전체</SelectItem>
              <SelectItem value="CHARGED">복 차감</SelectItem>
              <SelectItem value="SKIPPED_DUPLICATE">중복 재사용</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cacheHitFilter} onValueChange={setCacheHitFilter}>
            <SelectTrigger>
              <SelectValue placeholder="캐시 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">캐시 전체</SelectItem>
              <SelectItem value="true">캐시 사용</SelectItem>
              <SelectItem value="false">새 생성</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => applyFilters(1)}>
            적용
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/readings')}
          >
            초기화
          </Button>
        </CardContent>
        {activeFilters.length ? (
          <CardContent className="flex flex-wrap gap-2 pt-0">
            {activeFilters.map((filter) => (
              <Badge key={filter} variant="secondary">
                {filter}
              </Badge>
            ))}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 해석 목록</CardTitle>
          <CardDescription>
            전체 {payload?.totalCount ?? 0}건 · {payload?.page ?? 1}/
            {payload?.totalPages ?? 1} 페이지
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload?.readings.length ? (
            payload.readings.map((reading) => (
              <div
                key={reading.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{reading.subjectLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {reading.user.email} · {reading.targetLabel} ·{' '}
                    {formatDateTime(reading.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {reading.readingType === 'SELF' ? '사주' : '궁합'}
                  </Badge>
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
                  <Badge variant={reading.cacheHit ? 'secondary' : 'outline'}>
                    {reading.cacheHit ? '캐시 사용' : '새 생성'}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/${reading.user.id}`}>사용자</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/readings/${reading.id}`}>해석</Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              조건에 맞는 최근 해석이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => applyFilters(currentPage - 1)}
        >
          이전
        </Button>
        <p className="text-sm text-muted-foreground">
          {payload?.page ?? 1} / {payload?.totalPages ?? 1}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!payload || currentPage >= payload.totalPages}
          onClick={() => applyFilters(currentPage + 1)}
        >
          다음
        </Button>
      </div>
    </main>
  );
}

export default function AdminReadingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <LoadingOverlay
            open
            mode="SELF"
            theme="work"
            icon="briefcase"
            title="전체 해석 목록을 준비하고 있어요."
            description="누가 어떤 질문으로 운을 읽었는지 최근 순서대로 모으고 있어요."
            messages={[
              '사주와 궁합이 최근 어떤 흐름으로 생성됐는지 보고 있어요.',
              '사용자, 질문, 캐시 사용 여부도 함께 정리하고 있어요.'
            ]}
          />
        </main>
      }
    >
      <AdminReadingsPageContent />
    </Suspense>
  );
}
