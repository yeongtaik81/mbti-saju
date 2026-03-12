'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
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
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

type BokOverview = {
  balance: number;
  history: Array<{
    id: string;
    amount: number;
    createdAt: string;
  }>;
};

export default function BokPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );
  const [openChargeModal, setOpenChargeModal] = useState(false);
  const [status, setStatus] = useState('');
  const [overview, setOverview] = useState<BokOverview>({
    balance: 0,
    history: []
  });

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      setIsAuthenticated(session.authenticated);
      setSessionReady(true);
    };

    void checkSession();
  }, []);

  const fetchOverview = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
      }
      setStatus('');

      try {
        const response = await fetch('/api/v1/items/overview');

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (!response.ok) {
          setStatus(
            '복 지갑을 불러오는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }

        const payload = (await response.json()) as BokOverview;
        setOverview(payload);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    void fetchOverview();
  }, [fetchOverview, sessionReady, isAuthenticated, router]);

  useEffect(() => {
    if (redirectCountdown === null) {
      return;
    }

    if (redirectCountdown <= 0) {
      router.push('/dashboard');
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirectCountdown((previous) => {
        if (previous === null) {
          return null;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [redirectCountdown, router]);

  const onChargeOneBok = async () => {
    if (!isAuthenticated) {
      setStatus('로그인 흐름이 끊겼어요. 다시 들어와 주세요.');
      return;
    }

    setCharging(true);
    setStatus('');
    setRedirectCountdown(null);

    try {
      const idempotencyKey = `bok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch('/api/v1/items/mock-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 1,
          idempotencyKey
        })
      });

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok) {
        const errorPayload = (await response.json()) as { error?: string };
        setStatus(
          errorPayload.error ??
            '복을 채우는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setOpenChargeModal(false);
      setRedirectCountdown(5);
      await fetchOverview({ silent: true });
    } finally {
      setCharging(false);
    }
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="wealth"
          icon="banknote"
          title="복 지갑을 불러오고 있어요."
          description="지금 다시 읽을 운을 위한 복 상태를 함께 정리하고 있어요."
          messages={[
            '해석에 사용할 복 상태를 차분히 확인하고 있어요.',
            '지갑과 내역의 흐름을 함께 맞춰 보고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <ThemedBrandLogo
            className="h-9 w-auto max-w-[180px] sm:h-10 sm:max-w-[220px]"
            width={220}
            height={66}
            priority
          />
          <h1 className="text-2xl font-bold">복 지갑</h1>
          <p className="text-sm text-muted-foreground">
            1복 = 777원 · 풀이 1회에 1복이 쓰입니다.
          </p>
          <div className="theme-divider" />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">MBTI 사주 페이지로 이동하기</Link>
        </Button>
      </header>

      {status ? (
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {redirectCountdown !== null ? (
        <Alert>
          <AlertDescription>
            복을 채웠어요. MBTI 사주에서 새 풀이를 시작해 보세요. (
            {redirectCountdown}초 뒤 이동)
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="theme-card-ornament theme-surface">
        <CardHeader>
          <CardTitle>현재 보유 복</CardTitle>
          <CardDescription>
            사주나 궁합을 한 번 읽을 때마다 1복이 차감됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Banknote className="size-5" />
            <span>{overview.balance}복</span>
          </div>
          <Button
            type="button"
            onClick={() => setOpenChargeModal(true)}
            disabled={redirectCountdown !== null}
          >
            충전하기
          </Button>
        </CardContent>
      </Card>

      <Card className="theme-card-ornament theme-surface">
        <CardHeader>
          <CardTitle>충전 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 복을 채운 기록이 없어요. 첫 충전으로 다시 읽을 운을 준비해
              보세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {overview.history.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('ko-KR')}
                  </span>
                  <span className="font-medium">+{item.amount}복</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={openChargeModal} onOpenChange={setOpenChargeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>복 충전</DialogTitle>
            <DialogDescription>
              지금은 베타 기간입니다. 확인을 누르면 결제 없이 1복이 바로
              채워집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenChargeModal(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void onChargeOneBok()}
              disabled={charging}
            >
              {charging ? '채우는 중...' : '확인하고 충전'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoadingOverlay
        open={charging}
        mode="SELF"
        theme="wealth"
        icon="banknote"
        title="복 지갑을 다시 채우고 있어요."
        description="확인이 끝나면 새로운 운을 읽을 1복이 바로 채워집니다."
        messages={[
          '지금은 베타 기간이라 결제 없이 충전하고 있어요.',
          '새로운 해석을 읽을 준비를 하고 있어요.',
          '복이 채워지면 지금의 운을 다시 바로 읽을 수 있어요.'
        ]}
      />
    </main>
  );
}
