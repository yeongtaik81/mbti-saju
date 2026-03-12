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

type AdminFailureListPayload = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  failures: Array<{
    id: string;
    createdAt: string;
    readingType: 'SELF' | 'COMPATIBILITY';
    subjectType: string;
    subjectLabel: string;
    stage: string;
    reasonCode: string;
    reasonMessage: string;
    cacheKey: string | null;
    user: {
      id: string;
      email: string;
    };
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

function AdminFailuresPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState<AdminFailureListPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [stageFilter, setStageFilter] = useState(
    searchParams.get('stage') ?? 'ALL'
  );
  const [readingTypeFilter, setReadingTypeFilter] = useState(
    searchParams.get('readingType') ?? 'ALL'
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
    if (stageFilter !== 'ALL') {
      items.push(`단계: ${stageFilter}`);
    }
    if (readingTypeFilter === 'SELF') {
      items.push('유형: 사주');
    } else if (readingTypeFilter === 'COMPATIBILITY') {
      items.push('유형: 궁합');
    }
    return items;
  }, [query, readingTypeFilter, stageFilter]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setStageFilter(searchParams.get('stage') ?? 'ALL');
    setReadingTypeFilter(searchParams.get('readingType') ?? 'ALL');
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

    const fetchFailures = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(
          `/api/v1/admin/failures?${searchParams.toString()}`,
          {
            cache: 'no-store'
          }
        );
        const result = (await response.json()) as AdminFailureListPayload & {
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
            result.error ?? '실패 로그를 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchFailures();
  }, [router, searchParams, sessionReady]);

  const stageOptions = useMemo(
    () => [
      'RULE_DRAFT',
      'LLM_RENDER',
      'CODE_VALIDATE',
      'LLM_REVIEW',
      'FINAL_GUARD',
      'PERSIST'
    ],
    []
  );

  const applyFilters = (page = 1) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    if (stageFilter !== 'ALL') {
      params.set('stage', stageFilter);
    }
    if (readingTypeFilter !== 'ALL') {
      params.set('readingType', readingTypeFilter);
    }
    params.set('page', String(page));
    const queryString = params.toString();
    router.push(
      queryString ? `/admin/failures?${queryString}` : '/admin/failures'
    );
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="실패 로그를 모으고 있어요."
          description="어느 단계에서 막혔는지 최근 순서대로 정리하고 있어요."
          messages={[
            '실패 코드와 원인 메시지를 함께 맞춰 보고 있어요.',
            '사용자와 질문도 한눈에 따라갈 수 있게 모으고 있어요.'
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
            <h1 className="text-2xl font-bold">전체 실패 로그</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            생성이 어디에서 끊겼는지 최근 순서와 원인 기준으로 봅니다.
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
            이메일, 질문, 에러 코드, 메시지 기준으로 실패를 찾습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이메일, 질문, 에러 코드로 찾기"
          />
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger>
              <SelectValue placeholder="단계 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">단계 전체</SelectItem>
              {stageOptions.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button type="button" onClick={() => applyFilters(1)}>
            적용
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/failures')}
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
          <CardTitle>실패 로그 목록</CardTitle>
          <CardDescription>
            전체 {payload?.totalCount ?? 0}건 · {payload?.page ?? 1}/
            {payload?.totalPages ?? 1} 페이지
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload?.failures.length ? (
            payload.failures.map((failure) => (
              <div
                key={failure.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{failure.reasonCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {failure.user.email} · {failure.subjectLabel} ·{' '}
                    {formatDateTime(failure.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {failure.reasonMessage}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">{failure.stage}</Badge>
                  <Badge variant="outline">
                    {failure.readingType === 'SELF' ? '사주' : '궁합'}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/${failure.user.id}`}>사용자</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/failures/${failure.id}`}>보기</Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              조건에 맞는 실패 로그가 없습니다.
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

export default function AdminFailuresPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <LoadingOverlay
            open
            mode="SELF"
            theme="timing"
            icon="sparkles"
            title="실패 로그를 모으고 있어요."
            description="어느 단계에서 막혔는지 최근 순서대로 정리하고 있어요."
            messages={[
              '실패 코드와 원인 메시지를 함께 맞춰 보고 있어요.',
              '사용자와 질문도 한눈에 따라갈 수 있게 모으고 있어요.'
            ]}
          />
        </main>
      }
    >
      <AdminFailuresPageContent />
    </Suspense>
  );
}
