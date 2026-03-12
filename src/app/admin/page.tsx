'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Shield } from 'lucide-react';
import { fetchClientSession, type ClientSessionUser } from '@/lib/auth/client';
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
import { ThemedBrandMark } from '@/components/theme/ThemedBrandMark';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type AdminOverview = {
  summary: {
    userCount: number;
    adminCount: number;
    onboardedCount: number;
    mbtiCompletedCount: number;
    mbtiFreeSignupCount: number;
    readingCount: number;
    reading24hCount: number;
    chargedReadingCount: number;
    failure24hCount: number;
    positiveWalletCount: number;
    paymentCount: number;
    payment24hCount: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    name: string | null;
    hasProfile: boolean;
    mbtiType: string | null;
    walletBalance: number;
  }>;
  recentReadings: Array<{
    id: string;
    createdAt: string;
    userEmail: string;
    readingType: 'SELF' | 'COMPATIBILITY';
    subjectType: string;
    subjectLabel: string;
    targetLabel: string;
    chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
    cacheHit: boolean;
  }>;
  recentFailures: Array<{
    id: string;
    createdAt: string;
    userEmail: string;
    readingType: 'SELF' | 'COMPATIBILITY';
    subjectType: string;
    subjectLabel: string;
    stage: string;
    reasonCode: string;
    reasonMessage: string;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    createdAt: string;
    userEmail: string;
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

function MetricCard(props: {
  title: string;
  value: number;
  description: string;
  href?: string;
}) {
  const content = (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-2xl">{formatNumber(props.value)}</CardTitle>
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

export default function AdminPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [status, setStatus] = useState('');
  const [failureStageFilter, setFailureStageFilter] = useState('ALL');
  const [failureReadingTypeFilter, setFailureReadingTypeFilter] =
    useState('ALL');
  const [failureSearchQuery, setFailureSearchQuery] = useState('');

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

    const fetchOverview = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch('/api/v1/admin/overview', {
          cache: 'no-store'
        });

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (response.status === 403) {
          router.replace('/dashboard');
          return;
        }

        const payload = (await response.json()) as AdminOverview & {
          error?: string;
        };

        if (!response.ok) {
          setStatus(
            payload.error ?? '관리자 요약을 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setOverview(payload);
      } finally {
        setLoading(false);
      }
    };

    void fetchOverview();
  }, [router, sessionReady]);

  const summaryCards = useMemo(() => {
    if (!overview) {
      return [];
    }

    return [
      {
        title: '전체 사용자',
        value: overview.summary.userCount,
        description: `관리자 ${overview.summary.adminCount}명 포함`,
        href: '/admin/users'
      },
      {
        title: '프로필 완료',
        value: overview.summary.onboardedCount,
        description: `MBTI 완료 ${overview.summary.mbtiCompletedCount}명`,
        href: '/admin/users?profile=COMPLETE'
      },
      {
        title: '무료 MBTI 가입',
        value: overview.summary.mbtiFreeSignupCount,
        description: '무료 MBTI 결과를 보고 가입한 사용자',
        href: '/admin/users?signupSource=MBTI_FREE'
      },
      {
        title: '전체 해석',
        value: overview.summary.readingCount,
        description: `최근 24시간 ${overview.summary.reading24hCount}건`,
        href: '/admin/readings'
      },
      {
        title: '유료 차감 해석',
        value: overview.summary.chargedReadingCount,
        description: `복 보유 사용자 ${overview.summary.positiveWalletCount}명`,
        href: '/admin/readings?chargeStatus=CHARGED'
      },
      {
        title: '최근 생성 실패',
        value: overview.summary.failure24hCount,
        description: '최근 24시간 기준',
        href: '/admin/failures'
      },
      {
        title: '모의 충전',
        value: overview.summary.paymentCount,
        description: `최근 24시간 ${overview.summary.payment24hCount}건`,
        href: '/admin/stats'
      }
    ];
  }, [overview]);

  const failureStageOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(
      new Set(overview.recentFailures.map((failure) => failure.stage))
    );
  }, [overview]);

  const filteredFailures = useMemo(() => {
    if (!overview) {
      return [];
    }

    const keyword = failureSearchQuery.trim().toLowerCase();

    return overview.recentFailures.filter((failure) => {
      if (
        failureStageFilter !== 'ALL' &&
        failure.stage !== failureStageFilter
      ) {
        return false;
      }

      if (
        failureReadingTypeFilter !== 'ALL' &&
        failure.readingType !== failureReadingTypeFilter
      ) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        failure.userEmail,
        failure.subjectLabel,
        failure.reasonCode,
        failure.reasonMessage
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [
    failureReadingTypeFilter,
    failureSearchQuery,
    failureStageFilter,
    overview
  ]);

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="관리자 화면을 준비하고 있어요."
          description="사용자와 해석 흐름을 한눈에 볼 수 있게 정리하고 있어요."
          messages={[
            '최근 가입과 해석 흐름을 함께 모으고 있어요.',
            '실패 로그와 충전 흐름도 같이 맞춰 보고 있어요.'
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
            <Shield className="size-5" />
            <h1 className="text-2xl font-bold">관리자</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            사용자, 해석, 실패 로그, 충전 흐름을 한 화면에서 확인합니다.
          </p>
          <div className="theme-divider" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/stats">통계 보기</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">MBTI 사주로 돌아가기</Link>
          </Button>
        </div>
      </header>

      {status ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>{status}</span>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            href={card.href}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="theme-card-ornament theme-surface border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>무료 MBTI 유입</CardTitle>
            <CardDescription>
              무료 MBTI 결과를 본 뒤 가입으로 이어진 흐름을 먼저 봅니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-3xl font-bold">
                {formatNumber(overview?.summary.mbtiFreeSignupCount ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                무료 MBTI를 보고 가입한 사용자
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/admin/mbti">무료 MBTI 보기</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/users?signupSource=MBTI_FREE">
                  가입 사용자 보기
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/stats">전환 통계 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="theme-card-ornament theme-surface">
          <CardHeader>
            <CardTitle>관리 바로가기</CardTitle>
            <CardDescription>
              자주 보는 운영 화면으로 바로 이동합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/users">전체 사용자</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/readings">전체 해석</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/failures">실패 로그</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/stats">통계</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>최근 가입 사용자</CardTitle>
                <CardDescription>
                  이름, MBTI, 지갑 상태를 함께 봅니다.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/users">전체 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.recentUsers.map((user) => (
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
                  <Badge variant={user.hasProfile ? 'secondary' : 'outline'}>
                    {user.hasProfile ? '프로필 완료' : '프로필 전'}
                  </Badge>
                  <Badge variant={user.mbtiType ? 'secondary' : 'outline'}>
                    {user.mbtiType ?? 'MBTI 전'}
                  </Badge>
                  <Badge variant="outline">{user.walletBalance}복</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/${user.id}`}>보기</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>최근 해석</CardTitle>
                <CardDescription>
                  누가 어떤 질문으로 풀이를 봤는지 확인합니다.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/readings">전체 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.recentReadings.map((reading) => (
              <div
                key={reading.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{reading.subjectLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {reading.userEmail} · {reading.targetLabel} ·{' '}
                    {formatDateTime(reading.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{reading.readingType}</Badge>
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
                    <Link href={`/admin/readings/${reading.id}`}>보기</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>최근 생성 실패</CardTitle>
                <CardDescription>
                  어느 단계에서 왜 막혔는지 바로 봅니다.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/failures">전체 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
              <Input
                value={failureSearchQuery}
                onChange={(event) => setFailureSearchQuery(event.target.value)}
                placeholder="이메일, 주제, 에러 코드로 찾기"
              />
              <Select
                value={failureStageFilter}
                onValueChange={setFailureStageFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="단계 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">단계 전체</SelectItem>
                  {failureStageOptions.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={failureReadingTypeFilter}
                onValueChange={setFailureReadingTypeFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="유형 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">유형 전체</SelectItem>
                  <SelectItem value="SELF">사주</SelectItem>
                  <SelectItem value="COMPATIBILITY">궁합</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="justify-center">
                {filteredFailures.length}건
              </Badge>
            </div>

            {filteredFailures.length ? (
              filteredFailures.map((failure) => (
                <div
                  key={failure.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{failure.stage}</Badge>
                      <Badge variant="outline">{failure.subjectLabel}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {failure.userEmail} ·{' '}
                        {formatDateTime(failure.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{failure.reasonCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {failure.reasonMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/failures/${failure.id}`}>보기</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                조건에 맞는 생성 실패가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 복 충전</CardTitle>
            <CardDescription>
              모의 충전 흐름을 최근 순서로 봅니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.recentPayments.length ? (
              overview.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{payment.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(payment.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">+{payment.amount}복</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                최근 충전 내역은 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
