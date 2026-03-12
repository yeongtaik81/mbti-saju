'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Shield } from 'lucide-react';
import { fetchClientSession, type ClientSessionUser } from '@/lib/auth/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { SajuDataSection } from '@/components/saju/SajuDataSection';
import type { SajuFrontendMetadata } from '@/lib/saju/generator/metadata-transform';
import { getScenarioLabel, getScenarioResultTitle } from '@/lib/saju/scenarios';

type AdminReadingDetail = {
  id: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
  itemCost: number;
  cacheHit: boolean;
  cacheKey: string | null;
  createdAt: string;
  targetLabel: string;
  user: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
  };
  firstProfile: {
    source: 'SELF' | 'PARTNER';
    id: string | null;
    name: string;
    mbtiType: string | null;
  };
  secondProfile: {
    source: 'SELF' | 'PARTNER';
    id: string | null;
    name: string;
    mbtiType: string | null;
  } | null;
  partner: {
    id: string;
    name: string;
    mbtiType: string | null;
  } | null;
  sajuData: SajuFrontendMetadata | null;
  summary: string | null;
  sectionsJson: {
    storyTitle?: string;
    overview?: string;
    sajuBasis?: string;
    narrativeFlow?: string;
    subjectLens?: string;
    tenYearFlow?: string;
    currentDaewoon?: string;
    yearlyFlow?: string;
    wealthFlow?: string;
    relationshipFlow?: string;
    pairDynamic?: string;
    attractionPoint?: string;
    conflictTrigger?: string;
    communicationTip?: string;
    coreSignal?: string;
    relationshipLens?: string;
    careerMoneyLens?: string;
    timingHint?: string;
    caution?: string;
    actions?: string[];
    reflectionQuestion?: string;
  } | null;
  versions: {
    ruleVersion: string;
    templateVersion: string;
    promptVersion: string;
    modelVersion: string;
  } | null;
};

const SECTION_TITLES: Record<string, string> = {
  overview: '타고난 사주와 지금의 운',
  sajuBasis: '사주의 바탕',
  narrativeFlow: '현재 풀이',
  subjectLens: '먼저 볼 점',
  currentDaewoon: '지금 들어온 큰 운',
  yearlyFlow: '올해 운',
  tenYearFlow: '앞으로 10년 운',
  coreSignal: '지금 읽어야 할 핵심',
  wealthFlow: '돈의 흐름',
  relationshipFlow: '관계의 흐름',
  pairDynamic: '두 사람의 흐름',
  attractionPoint: '잘 맞는 점',
  conflictTrigger: '엇갈리는 점',
  communicationTip: '잘 통하는 말',
  relationshipLens: '관계에서 볼 점',
  careerMoneyLens: '일과 돈에서 볼 점',
  timingHint: '지금 움직이기 좋은 때',
  caution: '조심하면 좋은 점',
  actions: '지금 해볼 실천',
  reflectionQuestion: '한 번 더 생각해볼 질문'
};

const SELF_SECTION_ORDER = [
  'overview',
  'narrativeFlow',
  'sajuBasis',
  'subjectLens',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'coreSignal',
  'wealthFlow',
  'relationshipFlow',
  'relationshipLens',
  'careerMoneyLens',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
] as const;

const COMPAT_SECTION_ORDER = [
  'subjectLens',
  'pairDynamic',
  'attractionPoint',
  'conflictTrigger',
  'communicationTip',
  'narrativeFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
] as const;

function TextSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </section>
  );
}

export default function AdminReadingDetailPage() {
  const router = useRouter();
  const params = useParams<{ readingId: string }>();
  const readingId = params.readingId;
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState<AdminReadingDetail | null>(null);

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

    const fetchReading = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(`/api/v1/admin/readings/${readingId}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as {
          reading?: AdminReadingDetail;
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

        if (!response.ok || !payload.reading) {
          setStatus(
            payload.error ?? '해석 상세를 불러오는 흐름이 잠시 끊겼어요.'
          );
          return;
        }

        setReading(payload.reading);
      } finally {
        setLoading(false);
      }
    };

    void fetchReading();
  }, [readingId, router, sessionReady]);

  const actions = useMemo(() => {
    const list = reading?.sectionsJson?.actions;
    return Array.isArray(list) ? list : [];
  }, [reading]);

  const sectionOrder =
    reading?.readingType === 'COMPATIBILITY'
      ? COMPAT_SECTION_ORDER
      : SELF_SECTION_ORDER;

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="해석 상세를 펼치고 있어요."
          description="원국 데이터와 읽기 결과를 함께 불러오고 있어요."
          messages={[
            '이 해석이 어떤 질문에서 나왔는지 함께 맞추고 있어요.',
            '사주 데이터와 풀이 방향도 같이 정리하고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="size-5" />
            <h1 className="text-2xl font-bold">해석 상세</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            이 해석이 어떤 질문에서 만들어졌는지 운영자 관점으로 확인합니다.
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

      {reading ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {reading.summary ??
                getScenarioResultTitle(
                  reading.readingType,
                  reading.subjectType
                )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {getScenarioLabel(reading.readingType, reading.subjectType)}
              </Badge>
              <Badge variant="outline">
                {reading.readingType === 'SELF' ? '사주' : '궁합'}
              </Badge>
              <Badge variant="outline">{reading.itemCost}복</Badge>
              {reading.cacheHit ? (
                <Badge variant="outline">캐시 사용</Badge>
              ) : (
                <Badge variant="outline">새 생성</Badge>
              )}
              <Badge variant="outline">
                {new Date(reading.createdAt).toLocaleString('ko-KR')}
              </Badge>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>조회 사용자: {reading.user.email}</p>
              <p>함께 본 대상: {reading.targetLabel}</p>
              {reading.cacheKey ? <p>캐시 키: {reading.cacheKey}</p> : null}
            </div>

            {reading.sectionsJson?.storyTitle ? (
              <Badge variant="outline">{reading.sectionsJson.storyTitle}</Badge>
            ) : null}

            <SajuDataSection sajuData={reading.sajuData} />

            {sectionOrder.map((sectionKey) => {
              const title = SECTION_TITLES[sectionKey] ?? sectionKey;
              switch (sectionKey) {
                case 'actions':
                  return actions.length ? (
                    <section key={sectionKey} className="space-y-1">
                      <h2 className="text-sm font-semibold">{title}</h2>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {actions.map((action, index) => (
                          <li key={`${action}-${index}`}>
                            {index + 1}. {action}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null;
                default: {
                  const value =
                    reading.sectionsJson?.[
                      sectionKey as keyof typeof reading.sectionsJson
                    ];
                  return typeof value === 'string' && value ? (
                    <TextSection key={sectionKey} title={title} text={value} />
                  ) : null;
                }
              }
            })}

            {reading.versions ? (
              <section className="space-y-2 pt-2">
                <h2 className="text-sm font-semibold">생성 버전</h2>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    rule {reading.versions.ruleVersion}
                  </Badge>
                  <Badge variant="outline">
                    template {reading.versions.templateVersion}
                  </Badge>
                  <Badge variant="outline">
                    prompt {reading.versions.promptVersion}
                  </Badge>
                  <Badge variant="outline">
                    model {reading.versions.modelVersion}
                  </Badge>
                </div>
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
