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

type AdminUserListPayload = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  users: Array<{
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    signupSource: 'DIRECT' | 'MBTI_FREE';
    createdAt: string;
    name: string | null;
    hasProfile: boolean;
    mbtiType: string | null;
    walletBalance: number;
    stats: {
      readingCount: number;
      failureCount: number;
      partnerCount: number;
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

function AdminUsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState<AdminUserListPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [roleFilter, setRoleFilter] = useState(
    searchParams.get('role') ?? 'ALL'
  );
  const [profileFilter, setProfileFilter] = useState(
    searchParams.get('profile') ?? 'ALL'
  );
  const [mbtiFilter, setMbtiFilter] = useState(
    searchParams.get('mbti') ?? 'ALL'
  );
  const [signupSourceFilter, setSignupSourceFilter] = useState(
    searchParams.get('signupSource') ?? 'ALL'
  );
  const [walletFilter, setWalletFilter] = useState(
    searchParams.get('wallet') ?? 'ALL'
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
    if (roleFilter !== 'ALL') {
      items.push(`권한: ${roleFilter}`);
    }
    if (profileFilter === 'COMPLETE') {
      items.push('프로필: 완료');
    } else if (profileFilter === 'INCOMPLETE') {
      items.push('프로필: 미완료');
    }
    if (mbtiFilter === 'COMPLETE') {
      items.push('MBTI: 완료');
    } else if (mbtiFilter === 'INCOMPLETE') {
      items.push('MBTI: 미완료');
    }
    if (signupSourceFilter === 'DIRECT') {
      items.push('가입 경로: 직접 가입');
    } else if (signupSourceFilter === 'MBTI_FREE') {
      items.push('가입 경로: 무료 MBTI');
    }
    if (walletFilter === 'POSITIVE') {
      items.push('지갑: 복 보유');
    } else if (walletFilter === 'ZERO') {
      items.push('지갑: 0복 이하');
    }
    return items;
  }, [
    mbtiFilter,
    profileFilter,
    query,
    roleFilter,
    signupSourceFilter,
    walletFilter
  ]);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setRoleFilter(searchParams.get('role') ?? 'ALL');
    setProfileFilter(searchParams.get('profile') ?? 'ALL');
    setMbtiFilter(searchParams.get('mbti') ?? 'ALL');
    setSignupSourceFilter(searchParams.get('signupSource') ?? 'ALL');
    setWalletFilter(searchParams.get('wallet') ?? 'ALL');
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

    const fetchUsers = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(
          `/api/v1/admin/users?${searchParams.toString()}`,
          {
            cache: 'no-store'
          }
        );
        const result = (await response.json()) as AdminUserListPayload & {
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
            result.error ?? '사용자 목록을 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setPayload(result);
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, [router, searchParams, sessionReady]);

  const applyFilters = (page = 1) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    if (roleFilter !== 'ALL') {
      params.set('role', roleFilter);
    }
    if (profileFilter !== 'ALL') {
      params.set('profile', profileFilter);
    }
    if (mbtiFilter !== 'ALL') {
      params.set('mbti', mbtiFilter);
    }
    if (signupSourceFilter !== 'ALL') {
      params.set('signupSource', signupSourceFilter);
    }
    if (walletFilter !== 'ALL') {
      params.set('wallet', walletFilter);
    }
    params.set('page', String(page));
    const queryString = params.toString();
    router.push(queryString ? `/admin/users?${queryString}` : '/admin/users');
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="전체 사용자 목록을 준비하고 있어요."
          description="가입, 프로필, MBTI, 지갑 상태를 한 번에 모으고 있어요."
          messages={[
            '누가 얼마나 해석을 보고 있는지 같이 보고 있어요.',
            '프로필과 실패 횟수도 함께 정리하고 있어요.'
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
            <h1 className="text-2xl font-bold">전체 사용자</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            가입, 프로필, MBTI, 지갑, 해석 사용량을 전체 기준으로 봅니다.
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
            이메일, 이름, MBTI를 기준으로 사용자를 찾습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이메일, 이름, MBTI로 찾기"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="권한 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">권한 전체</SelectItem>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
            </SelectContent>
          </Select>
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger>
              <SelectValue placeholder="프로필 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">프로필 전체</SelectItem>
              <SelectItem value="COMPLETE">프로필 완료</SelectItem>
              <SelectItem value="INCOMPLETE">프로필 전</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mbtiFilter} onValueChange={setMbtiFilter}>
            <SelectTrigger>
              <SelectValue placeholder="MBTI 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">MBTI 전체</SelectItem>
              <SelectItem value="COMPLETE">MBTI 완료</SelectItem>
              <SelectItem value="INCOMPLETE">MBTI 전</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={signupSourceFilter}
            onValueChange={setSignupSourceFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="가입 경로 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">가입 경로 전체</SelectItem>
              <SelectItem value="DIRECT">직접 가입</SelectItem>
              <SelectItem value="MBTI_FREE">무료 MBTI 가입</SelectItem>
            </SelectContent>
          </Select>
          <Select value={walletFilter} onValueChange={setWalletFilter}>
            <SelectTrigger>
              <SelectValue placeholder="지갑 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">지갑 전체</SelectItem>
              <SelectItem value="POSITIVE">복 보유</SelectItem>
              <SelectItem value="ZERO">0복 이하</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => applyFilters(1)}>
            적용
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/users')}
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
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>
            전체 {payload?.totalCount ?? 0}명 · {payload?.page ?? 1}/
            {payload?.totalPages ?? 1} 페이지
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload?.users.length ? (
            payload.users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.name ?? '이름 미입력'} ·{' '}
                    {formatDateTime(user.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={user.role === 'ADMIN' ? 'default' : 'outline'}
                  >
                    {user.role}
                  </Badge>
                  <Badge
                    variant={
                      user.signupSource === 'MBTI_FREE'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {user.signupSource === 'MBTI_FREE'
                      ? '무료 MBTI 가입'
                      : '직접 가입'}
                  </Badge>
                  <Badge variant={user.hasProfile ? 'secondary' : 'outline'}>
                    {user.hasProfile ? '프로필 완료' : '프로필 전'}
                  </Badge>
                  <Badge variant={user.mbtiType ? 'secondary' : 'outline'}>
                    {user.mbtiType ?? 'MBTI 전'}
                  </Badge>
                  <Badge variant="outline">{user.walletBalance}복</Badge>
                  <Badge variant="outline">
                    해석 {user.stats.readingCount}
                  </Badge>
                  <Badge variant="outline">
                    실패 {user.stats.failureCount}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/${user.id}`}>보기</Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              조건에 맞는 사용자가 없습니다.
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

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <LoadingOverlay
            open
            mode="SELF"
            theme="work"
            icon="briefcase"
            title="전체 사용자 목록을 준비하고 있어요."
            description="가입, 프로필, MBTI, 지갑 상태를 한 번에 모으고 있어요."
            messages={[
              '누가 얼마나 해석을 보고 있는지 같이 보고 있어요.',
              '프로필과 실패 횟수도 함께 정리하고 있어요.'
            ]}
          />
        </main>
      }
    >
      <AdminUsersPageContent />
    </Suspense>
  );
}
