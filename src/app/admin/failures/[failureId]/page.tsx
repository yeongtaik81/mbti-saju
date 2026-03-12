'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';

type AdminFailureDetail = {
  id: string;
  createdAt: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  subjectLabel: string;
  cacheKey: string | null;
  periodScope: string | null;
  periodKey: string | null;
  stage: string;
  reasonCode: string;
  reasonMessage: string;
  detailJson: unknown;
  user: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
  };
};

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

function formatDateTime(value: string): string {
  return dateFormatter.format(new Date(value));
}

function MetricCard(props: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-base">{props.value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminFailureDetailPage() {
  const router = useRouter();
  const params = useParams<{ failureId: string }>();
  const failureId = params.failureId;
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState<AdminFailureDetail | null>(null);

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

    const fetchFailure = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(`/api/v1/admin/failures/${failureId}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as {
          failure?: AdminFailureDetail;
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

        if (!response.ok || !payload.failure) {
          setStatus(
            payload.error ?? '실패 로그 상세를 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setFailure(payload.failure);
      } finally {
        setLoading(false);
      }
    };

    void fetchFailure();
  }, [failureId, router, sessionReady]);

  const detailJsonText = useMemo(() => {
    if (failure?.detailJson === null || failure?.detailJson === undefined) {
      return null;
    }

    return JSON.stringify(failure.detailJson, null, 2);
  }, [failure]);

  const summaryCards = useMemo(() => {
    if (!failure) {
      return [];
    }

    return [
      {
        title: '실패 단계',
        value: failure.stage,
        description: '파이프라인에서 끊긴 지점'
      },
      {
        title: '질문 유형',
        value: failure.subjectLabel,
        description: failure.readingType === 'SELF' ? '사주 질문' : '궁합 질문'
      },
      {
        title: '캐시 키',
        value: failure.cacheKey ?? '없음',
        description: '중복 재사용/생성 추적용'
      },
      {
        title: '기간 기준',
        value: failure.periodScope ?? '없음',
        description: failure.periodKey ?? 'period key 없음'
      }
    ];
  }, [failure]);

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="실패 로그 상세를 펼치고 있어요."
          description="어느 단계에서 왜 막혔는지 자세히 정리하고 있어요."
          messages={[
            '실패 메시지와 내부 detailJson을 함께 모으고 있어요.',
            '사용자와 질문 맥락도 같이 확인하고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="size-5" />
            <h1 className="text-2xl font-bold">실패 로그 상세</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            실패 코드와 내부 디버그 정보를 같이 봅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sessionUser?.email}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/failures">실패 목록으로 돌아가기</Link>
          </Button>
        </div>
      </header>

      {status ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {failure ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{failure.reasonCode}</CardTitle>
              <CardDescription>
                {failure.subjectLabel} · {formatDateTime(failure.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">{failure.stage}</Badge>
                <Badge variant="outline">
                  {failure.readingType === 'SELF' ? '사주' : '궁합'}
                </Badge>
                <Badge variant="outline">{failure.user.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {failure.reasonMessage}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users/${failure.user.id}`}>
                    {failure.user.email}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <CardTitle>detailJson</CardTitle>
              <CardDescription>
                실패 시점에 저장한 내부 디버그 데이터입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detailJsonText ? (
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                  {detailJsonText}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  저장된 detailJson은 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
