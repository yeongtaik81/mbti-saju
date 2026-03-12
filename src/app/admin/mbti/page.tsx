'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, AlertCircle } from 'lucide-react';
import { fetchClientSession, type ClientSessionUser } from '@/lib/auth/client';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type AdminMbtiPayload = {
  focus:
    | 'ALL_ACTIVITY'
    | 'GUEST_VISITORS'
    | 'MEMBER_VISITORS'
    | 'GUEST_COMPLETIONS'
    | 'MEMBER_COMPLETIONS'
    | 'MINI_RESULTS'
    | 'FULL_RESULTS'
    | 'SIGNUPS';
  focusLabel: string;
  days: number;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  entries: Array<{
    kind: 'EVENT' | 'SIGNUP';
    id: string;
    createdAt: string;
    email: string | null;
    userId: string | null;
    name?: string | null;
    mbtiType: string | null;
    sourceType?: string | null;
    sessionId?: string | null;
    isAuthenticated?: boolean;
    eventType?: string | null;
    testType?: string | null;
    pagePath?: string | null;
    label: string;
  }>;
};

const FOCUS_OPTIONS = [
  { value: 'ALL_ACTIVITY', label: '전체 MBTI 활동' },
  { value: 'GUEST_VISITORS', label: '비로그인 접속' },
  { value: 'MEMBER_VISITORS', label: '로그인 접속' },
  { value: 'GUEST_COMPLETIONS', label: '비로그인 검사 완료' },
  { value: 'MEMBER_COMPLETIONS', label: '로그인 검사 완료' },
  { value: 'MINI_RESULTS', label: '미니 테스트 결과' },
  { value: 'FULL_RESULTS', label: '정식 테스트 결과' },
  { value: 'SIGNUPS', label: '무료 MBTI 가입' }
] as const;

const DAY_OPTIONS = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
  { value: '90', label: '최근 90일' }
] as const;

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

function formatDateTime(value: string): string {
  return dateFormatter.format(new Date(value));
}

function AdminMbtiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState<AdminMbtiPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [focusFilter, setFocusFilter] = useState(
    searchParams.get('focus') ?? 'ALL_ACTIVITY'
  );
  const [daysFilter, setDaysFilter] = useState(
    searchParams.get('days') ?? '14'
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
    if (focusFilter !== 'ALL_ACTIVITY') {
      const label =
        FOCUS_OPTIONS.find((option) => option.value === focusFilter)?.label ??
        focusFilter;
      items.push(`구간: ${label}`);
    }
    if (daysFilter !== '14') {
      const label =
        DAY_OPTIONS.find((option) => option.value === daysFilter)?.label ??
        daysFilter;
      items.push(`기간: ${label}`);
    }
    return items;
  }, [daysFilter, focusFilter, query]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setFocusFilter(searchParams.get('focus') ?? 'ALL_ACTIVITY');
    setDaysFilter(searchParams.get('days') ?? '14');
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

    const fetchPayload = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(
          `/api/v1/admin/mbti?${searchParams.toString()}`,
          {
            cache: 'no-store'
          }
        );
        const result = (await response.json()) as AdminMbtiPayload & {
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
            result.error ?? '무료 MBTI 흐름을 불러오는 중 잠시 끊겼어요.'
          );
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchPayload();
  }, [router, searchParams, sessionReady]);

  const applyFilters = (page = 1) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    if (focusFilter !== 'ALL_ACTIVITY') {
      params.set('focus', focusFilter);
    }
    if (daysFilter !== '14') {
      params.set('days', daysFilter);
    }
    params.set('page', String(page));
    const queryString = params.toString();
    router.push(queryString ? `/admin/mbti?${queryString}` : '/admin/mbti');
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="무료 MBTI 흐름을 모으고 있어요."
          description="접속, 결과 확인, 가입 흐름을 한눈에 볼 수 있게 정리하고 있어요."
          messages={[
            '누가 어디까지 이어졌는지 단계별로 보고 있어요.',
            '가입으로 이어진 흐름과 중간 이탈도 함께 정리하고 있어요.'
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
            <Activity className="size-5" />
            <h1 className="text-2xl font-bold">무료 MBTI 흐름</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            접속, 결과 확인, 가입까지 이어지는 흐름을 최근{' '}
            {payload?.days ?? Number.parseInt(daysFilter, 10)}일 기준으로
            봅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>
            단계별 흐름과 가입 사용자를 바로 찾아봅니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.7fr_auto_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이메일, 이름, MBTI로 찾기"
          />
          <Select value={focusFilter} onValueChange={setFocusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="전체 MBTI 활동" />
            </SelectTrigger>
            <SelectContent>
              {FOCUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger>
              <SelectValue placeholder="최근 14일" />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => applyFilters(1)}>
            적용
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/mbti')}
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
          <CardTitle>{payload?.focusLabel ?? '무료 MBTI 활동'}</CardTitle>
          <CardDescription>
            최근 {payload?.days ?? Number.parseInt(daysFilter, 10)}일 · 총{' '}
            {payload ? payload.totalCount.toLocaleString('ko-KR') : 0}건
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload?.entries.length ? (
            payload.entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.label}</span>
                      {entry.kind === 'SIGNUP' ? (
                        <Badge variant="secondary">가입</Badge>
                      ) : entry.isAuthenticated ? (
                        <Badge variant="outline">로그인</Badge>
                      ) : (
                        <Badge variant="outline">비로그인</Badge>
                      )}
                      {entry.testType ? (
                        <Badge variant="outline">{entry.testType}</Badge>
                      ) : null}
                      {entry.mbtiType ? (
                        <Badge variant="outline">{entry.mbtiType}</Badge>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.email ??
                        (entry.sessionId
                          ? `visitor ${entry.sessionId.slice(0, 8)}`
                          : '익명 방문자')}
                    </div>
                    {entry.name ? (
                      <div className="text-xs text-muted-foreground">
                        이름 {entry.name}
                      </div>
                    ) : null}
                    {entry.pagePath ? (
                      <div className="text-xs text-muted-foreground">
                        경로 {entry.pagePath}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.userId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/users/${entry.userId}`}>
                          사용자 보기
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              조건에 맞는 무료 MBTI 활동이 아직 없어요.
            </p>
          )}
        </CardContent>
      </Card>

      {payload && payload.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            페이지 {payload.page} / {payload.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => applyFilters(currentPage - 1)}
            >
              이전
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= payload.totalPages}
              onClick={() => applyFilters(currentPage + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function AdminMbtiPage() {
  return (
    <Suspense fallback={null}>
      <AdminMbtiPageContent />
    </Suspense>
  );
}
