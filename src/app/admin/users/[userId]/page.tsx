'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

type AdminUserDetail = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  profile: {
    name: string;
    birthDateTime: string;
    birthDate: string | null;
    birthTime: string | null;
    isBirthTimeUnknown: boolean;
    birthCalendarType: 'SOLAR' | 'LUNAR';
    isLeapMonth: boolean;
    birthCountryType: 'KOREA' | 'OTHER';
    birthCountry: string | null;
    birthPlace: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    updatedAt: string;
  } | null;
  mbtiProfile: {
    mbtiType: string;
    sourceType: string;
    updatedAt: string;
  } | null;
  walletBalance: number;
  stats: {
    partnerCount: number;
    readingCount: number;
    chargedReadingCount: number;
    failureCount: number;
    paymentCount: number;
  };
  recentReadings: Array<{
    id: string;
    createdAt: string;
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
  }>;
  recentWalletAdjustments: Array<{
    id: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
    createdAt: string;
    adminEmail: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat('ko-KR');
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
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
}) {
  return (
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
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState('');

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

  const fetchUser = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      setStatus('');

      try {
        const response = await fetch(`/api/v1/admin/users/${userId}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as {
          user?: AdminUserDetail;
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

        if (!response.ok || !payload.user) {
          setStatus(
            payload.error ?? '사용자 정보를 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setUser(payload.user);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [router, userId]
  );

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    void fetchUser();
  }, [fetchUser, sessionReady]);

  const summaryCards = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        title: '보유 복',
        value: user.walletBalance,
        description: '현재 지갑 기준'
      },
      {
        title: '전체 해석',
        value: user.stats.readingCount,
        description: `복 차감 ${user.stats.chargedReadingCount}건`
      },
      {
        title: '등록 프로필',
        value: user.stats.partnerCount,
        description: user.profile ? '내 정보 포함 관리 중' : '내 정보 미완료'
      },
      {
        title: '생성 실패',
        value: user.stats.failureCount,
        description: '누적 실패 로그 기준'
      },
      {
        title: '충전 내역',
        value: user.stats.paymentCount,
        description: '모의 충전 기준'
      }
    ];
  }, [user]);

  const handleWalletAdjustment = async (action: 'CHARGE' | 'DEDUCT') => {
    const amount = Number.parseInt(adjustAmount, 10);
    if (!Number.isFinite(amount) || amount < 1) {
      setAdjustMessage('복 수는 1 이상 숫자로 넣어 주세요.');
      return;
    }

    if (adjustReason.trim().length < 2) {
      setAdjustMessage('조정 이유를 2자 이상 적어 주세요.');
      return;
    }

    setIsAdjusting(true);
    setAdjustMessage('');

    try {
      const response = await fetch(
        `/api/v1/admin/users/${userId}/wallet-adjustments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            amount,
            reason: adjustReason.trim()
          })
        }
      );
      const payload = (await response.json()) as {
        success?: boolean;
        balance?: number;
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

      if (!response.ok || !payload.success) {
        setAdjustMessage(payload.error ?? '복 조정 흐름이 잠시 끊겼어요.');
        return;
      }

      setAdjustMessage(
        `${action === 'CHARGE' ? '복을 채웠어요.' : '복을 차감했어요.'} 현재 잔액은 ${payload.balance ?? 0}복입니다.`
      );
      setAdjustReason('');
      await fetchUser(false);
    } finally {
      setIsAdjusting(false);
    }
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="work"
          icon="briefcase"
          title="사용자 화면을 준비하고 있어요."
          description="프로필과 해석 기록을 한 번에 볼 수 있게 정리하고 있어요."
          messages={[
            '최근 읽은 해석과 지갑 흐름을 함께 모으고 있어요.',
            '프로필과 MBTI 상태도 같이 맞춰 보고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="size-5" />
            <h1 className="text-2xl font-bold">사용자 상세</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            이 사용자의 프로필, 해석, 실패 흐름을 한 번에 봅니다.
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

      {user ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{user.profile?.name ?? user.email}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'outline'}>
                  {user.role}
                </Badge>
                <Badge variant={user.profile ? 'secondary' : 'outline'}>
                  {user.profile ? '프로필 완료' : '프로필 전'}
                </Badge>
                <Badge variant={user.mbtiProfile ? 'secondary' : 'outline'}>
                  {user.mbtiProfile?.mbtiType ?? 'MBTI 전'}
                </Badge>
                <Badge variant="outline">
                  {formatDateTime(user.createdAt)} 가입
                </Badge>
              </div>

              {user.profile ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p>출생지: {user.profile.birthPlace}</p>
                  <p>성별: {user.profile.gender}</p>
                  <p>
                    출생시각:{' '}
                    {user.profile.isBirthTimeUnknown
                      ? '모름'
                      : (user.profile.birthTime ?? user.profile.birthDateTime)}
                  </p>
                  <p>
                    달력:{' '}
                    {user.profile.birthCalendarType === 'SOLAR'
                      ? '양력'
                      : '음력'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  아직 사주를 세울 기본 정보가 비어 있습니다.
                </p>
              )}

              {user.mbtiProfile ? (
                <p className="text-sm text-muted-foreground">
                  MBTI {user.mbtiProfile.mbtiType} ·{' '}
                  {user.mbtiProfile.sourceType}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <MetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                description={card.description}
              />
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>복 수동 조정</CardTitle>
              <CardDescription>
                운영자가 직접 복을 채우거나 차감합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adjustMessage ? (
                <Alert
                  variant={
                    adjustMessage.includes('잠시 끊겼어요') ||
                    adjustMessage.includes('넣어') ||
                    adjustMessage.includes('적어') ||
                    adjustMessage.includes('부족')
                      ? 'destructive'
                      : 'default'
                  }
                >
                  <AlertDescription>{adjustMessage}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto]">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  placeholder="복 수"
                />
                <Input
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="예: 문의 대응 보상, 운영 확인용 조정"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isAdjusting}
                  onClick={() => void handleWalletAdjustment('DEDUCT')}
                >
                  {isAdjusting ? '정리 중...' : '복 차감'}
                </Button>
                <Button
                  type="button"
                  disabled={isAdjusting}
                  onClick={() => void handleWalletAdjustment('CHARGE')}
                >
                  {isAdjusting ? '정리 중...' : '복 채우기'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>최근 해석</CardTitle>
                <CardDescription>
                  무슨 질문으로 운을 읽었는지 봅니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.recentReadings.length ? (
                  user.recentReadings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {reading.subjectLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reading.targetLabel} ·{' '}
                          {formatDateTime(reading.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{reading.readingType}</Badge>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/readings/${reading.id}`}>
                            보기
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    아직 읽은 해석이 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>최근 생성 실패</CardTitle>
                    <CardDescription>
                      어느 단계에서 막혔는지 바로 봅니다.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/failures">전체 보기</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.recentFailures.length ? (
                  user.recentFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="destructive">{failure.stage}</Badge>
                          <Badge variant="outline">
                            {failure.subjectLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
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
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/failures/${failure.id}`}>
                            보기
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    최근 생성 실패는 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>최근 복 충전</CardTitle>
              <CardDescription>
                충전이 언제 얼마나 있었는지 봅니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recentPayments.length ? (
                user.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <p className="text-sm">
                      {formatDateTime(payment.createdAt)}
                    </p>
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

          <Card>
            <CardHeader>
              <CardTitle>최근 복 조정</CardTitle>
              <CardDescription>
                운영자가 직접 바꾼 복 기록입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recentWalletAdjustments.length ? (
                user.recentWalletAdjustments.map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{adjustment.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {adjustment.adminEmail} ·{' '}
                        {formatDateTime(adjustment.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          adjustment.amount > 0 ? 'secondary' : 'outline'
                        }
                      >
                        {adjustment.amount > 0
                          ? `+${adjustment.amount}복`
                          : `${adjustment.amount}복`}
                      </Badge>
                      <Badge variant="outline">
                        {adjustment.balanceBefore} {'->'}{' '}
                        {adjustment.balanceAfter}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  최근 복 조정 기록은 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
