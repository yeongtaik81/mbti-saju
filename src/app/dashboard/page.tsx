'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  ChevronDown,
  Pencil,
  Plus,
  Settings,
  Shield,
  Trash2
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { MBTI_TYPE_VALUES, type MbtiTypeValue } from '@/lib/mbti/test-engine';
import {
  getDefaultScenarioCode,
  getScenarioCategories,
  getScenarioFallbackSummary,
  getScenarioLabel,
  getScenarioLoadingMeta,
  getScenarioOption,
  type ScenarioCategoryCode,
  type ScenarioCode
} from '@/lib/saju/scenarios';
import {
  fetchClientSession,
  signOutClient,
  type ClientSessionUser
} from '@/lib/auth/client';
import { cn } from '@/lib/utils';
import { partnerCreateSchema } from '@/lib/validators/saju';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';

type OnboardingResponse = {
  onboarding: {
    name: string;
    birthDateTime: string;
    birthDate?: string;
    birthTime?: string | null;
    birthTimeUnknown?: boolean;
    birthCalendarType?: 'SOLAR' | 'LUNAR';
    isLeapMonth?: boolean;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
  } | null;
  mbti: {
    mbtiType: MbtiTypeValue;
    sourceType: 'DIRECT' | 'MINI_TEST' | 'FULL_TEST';
    decidedAt: string;
  } | null;
  itemBalance: number;
};

type PartnerItem = {
  id: string;
  name: string;
  relationship: string | null;
  birthDate: string;
  birthTime: string | null;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mbtiType: MbtiTypeValue | null;
  createdAt: string;
  updatedAt: string;
};

type ReadingItem = {
  id: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
  itemCost: number;
  cacheHit: boolean;
  createdAt: string;
  targetLabel: string;
  summary: string | null;
  firstPartner: {
    id: string;
    name: string;
    mbtiType: MbtiTypeValue | null;
  } | null;
  partner: {
    id: string;
    name: string;
    mbtiType: MbtiTypeValue | null;
  } | null;
};

type ReadingCreateResponse = {
  duplicate?: boolean;
  itemCharged?: boolean;
  readingId?: string;
  balance?: number;
  error?: string;
};

type MbtiSelectValue = MbtiTypeValue | 'UNSET';

type PartnerFormState = {
  name: string;
  relationship: string;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mbtiType: MbtiSelectValue;
};

type PartnerDialogMode = 'create' | 'edit';
type ProfileSelectKey = 'SELF' | `PARTNER:${string}`;

const SELF_PROFILE_KEY: ProfileSelectKey = 'SELF';
const SELF_SCENARIO_CATEGORIES = getScenarioCategories('SELF');
const COMPATIBILITY_SCENARIO_CATEGORIES =
  getScenarioCategories('COMPATIBILITY');

type ScenarioCategory = (typeof SELF_SCENARIO_CATEGORIES)[number];

function toPartnerProfileKey(partnerId: string): ProfileSelectKey {
  return `PARTNER:${partnerId}`;
}

function parseProfileReference(profileKey: ProfileSelectKey):
  | { source: 'SELF' }
  | {
      source: 'PARTNER';
      partnerId: string;
    } {
  if (profileKey === SELF_PROFILE_KEY) {
    return { source: 'SELF' };
  }

  return {
    source: 'PARTNER',
    partnerId: profileKey.replace('PARTNER:', '')
  };
}

function getTodayDate(): string {
  const now = new Date();
  const year = '1984';
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultPartnerForm(): PartnerFormState {
  return {
    name: '',
    relationship: '',
    birthDate: getTodayDate(),
    birthTime: '12:00',
    birthTimeUnknown: false,
    birthCalendarType: 'SOLAR',
    isLeapMonth: false,
    gender: 'FEMALE',
    mbtiType: 'UNSET'
  };
}

function getRelationLabel(relationship: string | null | undefined): string {
  const value = relationship?.trim();
  return value && value.length > 0 ? value : '미정';
}

function getReadingCardHint(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string
): string | null {
  if (readingType === 'COMPATIBILITY') {
    if (subjectType === 'COMPAT_ROMANCE_LEFT_ON_READ') {
      return '답이 늦어지는 이유를 본 궁합';
    }

    if (subjectType === 'COMPAT_ROMANCE_GHOSTED') {
      return '끊긴 흐름을 본 궁합';
    }

    if (subjectType === 'COMPAT_ROMANCE_EX') {
      return '헤어진 뒤 남은 결을 본 궁합';
    }

    if (subjectType.startsWith('COMPAT_ROMANCE_')) {
      return '두 사람의 속도를 본 궁합';
    }

    if (subjectType === 'COMPAT_FRIEND_CUT_OFF') {
      return '지켜야 할 거리감을 본 궁합';
    }

    if (subjectType.startsWith('COMPAT_FRIEND_')) {
      return '편안함과 거리감을 본 궁합';
    }

    if (subjectType === 'COMPAT_WORK_BOSS') {
      return '보고 리듬을 본 궁합';
    }

    if (subjectType === 'COMPAT_WORK_DIFFICULT_BOSS') {
      return '덜 부딪히는 거리를 본 궁합';
    }

    if (subjectType === 'COMPAT_WORK_BUSINESS_PARTNER') {
      return '역할과 경계를 본 궁합';
    }

    if (subjectType.startsWith('COMPAT_WORK_')) {
      return '함께 일할 호흡을 본 궁합';
    }

    if (subjectType === 'COMPAT_FAMILY_MOTHER_DAUGHTER') {
      return '가까운 기대와 거리를 본 궁합';
    }

    if (subjectType.startsWith('COMPAT_FAMILY_')) {
      return '가족 사이의 기대를 본 궁합';
    }

    if (subjectType === 'COMPAT_MISC_IDOL') {
      return '왜 강하게 끌리는지 본 궁합';
    }

    return '두 사람 사이의 결을 본 궁합';
  }

  switch (subjectType) {
    case 'SELF_YEARLY_FORTUNE':
      return '올해 힘이 붙는 곳을 본 풀이';
    case 'SELF_DAILY_FORTUNE':
      return '오늘의 리듬을 본 풀이';
    case 'SELF_DAEUN':
      return '지금 10년 운을 본 풀이';
    case 'SELF_LIFETIME_FLOW':
      return '길게 이어지는 운을 본 풀이';
    case 'SELF_LOVE_RECONCILIATION':
      return '다시 이어질 여지를 본 풀이';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락 흐름을 본 풀이';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '마음을 꺼낼 때를 본 풀이';
    case 'SELF_MARRIAGE_GENERAL':
      return '오래 가는 관계를 본 풀이';
    case 'SELF_CAREER_GENERAL':
      return '일에서 힘이 붙는 방향을 본 풀이';
    case 'SELF_CAREER_APTITUDE':
      return '맞는 일의 결을 본 풀이';
    case 'SELF_CAREER_JOB_CHANGE':
      return '옮길 때를 본 풀이';
    case 'SELF_WEALTH_GENERAL':
      return '돈의 흐름을 본 풀이';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 붙는 길을 본 풀이';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새는 틈을 본 풀이';
    case 'SELF_RELATIONSHIP_GENERAL':
      return '사람 사이의 거리를 본 풀이';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '거리 조절을 본 풀이';
    case 'SELF_FAMILY_GENERAL':
      return '가족 안의 감정 결을 본 풀이';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계를 본 풀이';
    case 'SELF_LUCK_UP':
      return '운을 살리는 기준을 본 풀이';
    default:
      return '지금 들어온 운을 본 풀이';
  }
}

function ScenarioCategorySection({
  category,
  selectedCode,
  expanded,
  creating,
  onToggle,
  onSelect,
  onStartReading
}: {
  category: ScenarioCategory;
  selectedCode: ScenarioCode;
  expanded: boolean;
  creating: boolean;
  onToggle: (categoryCode: ScenarioCategoryCode) => void;
  onSelect: (
    scenarioCode: ScenarioCode,
    categoryCode: ScenarioCategoryCode
  ) => void;
  onStartReading: () => void;
}) {
  return (
    <div className="theme-surface rounded-lg border">
      <button
        type="button"
        onClick={() => onToggle(category.code)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold">{category.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {category.description}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {category.options.length}개 항목
          </p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            expanded ? 'rotate-180' : 'rotate-0'
          )}
        />
      </button>

      {expanded ? (
        <div className="grid gap-2 border-t px-4 py-3">
          {category.options.map((option) => {
            const isSelected = option.code === selectedCode;
            return (
              <div
                key={option.code}
                className={cn(
                  'rounded-lg border px-3 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:border-foreground/40'
                )}
              >
                <div
                  className={cn(
                    'flex gap-3',
                    isSelected ? 'items-center' : 'items-start'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(option.code, category.code)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p
                      className={cn(
                        'mt-1 text-xs leading-relaxed',
                        isSelected
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {option.description}
                    </p>
                  </button>
                  {isSelected ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0 bg-background/90 text-foreground hover:bg-background"
                      disabled={creating}
                      onClick={onStartReading}
                    >
                      {creating ? '풀이 중...' : '해석하기'}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [fetching, setFetching] = useState(true);
  const [creatingReading, setCreatingReading] = useState(false);
  const [readingType, setReadingType] = useState<'SELF' | 'COMPATIBILITY'>(
    'SELF'
  );
  const [selectedSelfScenarioCode, setSelectedSelfScenarioCode] =
    useState<ScenarioCode>(() => getDefaultScenarioCode('SELF'));
  const [
    selectedCompatibilityScenarioCode,
    setSelectedCompatibilityScenarioCode
  ] = useState<ScenarioCode>(() => getDefaultScenarioCode('COMPATIBILITY'));
  const [expandedSelfCategoryCodes, setExpandedSelfCategoryCodes] = useState<
    ScenarioCategoryCode[]
  >(() => SELF_SCENARIO_CATEGORIES.map((category) => category.code));
  const [
    expandedCompatibilityCategoryCodes,
    setExpandedCompatibilityCategoryCodes
  ] = useState<ScenarioCategoryCode[]>(() =>
    COMPATIBILITY_SCENARIO_CATEGORIES.map((category) => category.code)
  );
  const [selectedSingleProfileKey, setSelectedSingleProfileKey] =
    useState<ProfileSelectKey>(SELF_PROFILE_KEY);
  const [selectedFirstProfileKey, setSelectedFirstProfileKey] =
    useState<ProfileSelectKey>(SELF_PROFILE_KEY);
  const [selectedSecondProfileKey, setSelectedSecondProfileKey] = useState<
    ProfileSelectKey | undefined
  >(undefined);
  const [openPartnerDialog, setOpenPartnerDialog] = useState(false);
  const [openDeletePartnerDialog, setOpenDeletePartnerDialog] = useState(false);
  const [openDeleteReadingDialog, setOpenDeleteReadingDialog] = useState(false);
  const [partnerDialogMode, setPartnerDialogMode] =
    useState<PartnerDialogMode>('create');
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(
    null
  );
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(
    null
  );
  const [partnerForm, setPartnerForm] = useState<PartnerFormState>(() =>
    createDefaultPartnerForm()
  );
  const [status, setStatus] = useState('');
  const [statusVariant, setStatusVariant] = useState<'default' | 'destructive'>(
    'default'
  );
  const [itemBalance, setItemBalance] = useState(0);
  const [onboarding, setOnboarding] =
    useState<OnboardingResponse['onboarding']>(null);
  const [mbti, setMbti] = useState<OnboardingResponse['mbti']>(null);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [savingPartner, setSavingPartner] = useState(false);
  const [deletingPartner, setDeletingPartner] = useState(false);
  const [deletingReading, setDeletingReading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      setIsAuthenticated(session.authenticated);
      setSessionUser(session.user);
      setSessionReady(true);
    };

    void checkSession();
  }, []);

  const clearStatus = useCallback(() => {
    setStatus('');
    setStatusVariant('default');
  }, []);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    setStatusVariant('default');
  }, []);

  const showErrorStatus = useCallback((message: string) => {
    setStatus(message);
    setStatusVariant('destructive');
  }, []);

  const fetchReadings = useCallback(async () => {
    const response = await fetch('/api/v1/saju/readings?limit=30');

    if (response.status === 401) {
      router.replace('/');
      return;
    }

    if (!response.ok) {
      showErrorStatus(
        '읽어 둔 해석을 불러오는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
      );
      return;
    }

    const payload = (await response.json()) as {
      readings: ReadingItem[];
    };

    setReadings(payload.readings);
  }, [router, showErrorStatus]);

  const fetchPartners = useCallback(async () => {
    const response = await fetch('/api/v1/partners');

    if (response.status === 401) {
      router.replace('/');
      return;
    }

    if (!response.ok) {
      showErrorStatus(
        '프로필 목록을 불러오는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
      );
      return;
    }

    const payload = (await response.json()) as {
      partners: PartnerItem[];
    };

    setPartners(payload.partners);
    const firstPartnerKey = payload.partners[0]
      ? toPartnerProfileKey(payload.partners[0].id)
      : undefined;

    setSelectedSingleProfileKey((prev) => {
      if (prev === SELF_PROFILE_KEY) {
        return prev;
      }
      const exists = payload.partners.some(
        (partner) => toPartnerProfileKey(partner.id) === prev
      );
      return exists ? prev : SELF_PROFILE_KEY;
    });

    setSelectedFirstProfileKey((prev) => {
      if (prev === SELF_PROFILE_KEY) {
        return prev;
      }
      const exists = payload.partners.some(
        (partner) => toPartnerProfileKey(partner.id) === prev
      );
      return exists ? prev : SELF_PROFILE_KEY;
    });

    setSelectedSecondProfileKey((prev) => {
      if (!prev) {
        return firstPartnerKey;
      }
      const exists = payload.partners.some(
        (partner) => toPartnerProfileKey(partner.id) === prev
      );
      return exists ? prev : firstPartnerKey;
    });
  }, [router, showErrorStatus]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    const fetchDashboardData = async () => {
      setFetching(true);
      clearStatus();

      try {
        const response = await fetch('/api/v1/onboarding');

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (!response.ok) {
          showErrorStatus(
            '내 정보를 불러오는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }

        const payload = (await response.json()) as OnboardingResponse;
        setItemBalance(payload.itemBalance);
        setOnboarding(payload.onboarding);
        setMbti(payload.mbti);

        if (!payload.onboarding) {
          router.replace('/onboarding');
          return;
        }

        await Promise.all([fetchReadings(), fetchPartners()]);
      } finally {
        setFetching(false);
      }
    };

    void fetchDashboardData();
  }, [
    sessionReady,
    isAuthenticated,
    router,
    fetchReadings,
    fetchPartners,
    clearStatus,
    showErrorStatus
  ]);

  const onSignOut = async () => {
    await signOutClient();
    setIsAuthenticated(false);
    router.push('/');
  };

  const onCreateReading = async () => {
    if (!isAuthenticated) {
      showErrorStatus('먼저 로그인하고 다시 읽어 주세요.');
      return;
    }

    if (itemBalance <= 0) {
      router.push('/bok');
      return;
    }

    if (readingType === 'COMPATIBILITY' && !selectedSecondProfileKey) {
      showErrorStatus('궁합을 볼 두 번째 사람을 선택해 주세요.');
      return;
    }

    if (
      readingType === 'COMPATIBILITY' &&
      selectedSecondProfileKey &&
      selectedFirstProfileKey === selectedSecondProfileKey
    ) {
      showErrorStatus('궁합은 서로 다른 두 사람을 선택해 주세요.');
      return;
    }

    setCreatingReading(true);
    clearStatus();

    try {
      const body =
        readingType === 'SELF'
          ? {
              readingType: 'SELF',
              scenarioCode: selectedSelfScenarioCode,
              profile: parseProfileReference(selectedSingleProfileKey)
            }
          : {
              readingType: 'COMPATIBILITY',
              scenarioCode: selectedCompatibilityScenarioCode,
              profileA: parseProfileReference(selectedFirstProfileKey),
              profileB: parseProfileReference(selectedSecondProfileKey!)
            };

      const response = await fetch('/api/v1/saju/readings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const payload = (await response.json()) as ReadingCreateResponse;
      if (!response.ok) {
        if (typeof payload.balance === 'number') {
          setItemBalance(payload.balance);
        }
        if (response.status === 402) {
          router.push('/bok');
          return;
        }
        if (response.status === 401) {
          router.replace('/');
          return;
        }
        showErrorStatus(
          payload.error ??
            '운을 읽는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }
      if (!payload.readingId) {
        showErrorStatus(
          '운을 읽는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setItemBalance(payload.balance ?? itemBalance);

      if (payload.duplicate) {
        showStatus(
          '이미 읽어 본 같은 결의 풀이가 있어요. 그 결과로 바로 이어갈게요.'
        );
      } else {
        showStatus('풀이가 준비됐어요. 지금 바로 읽으러 이동할게요.');
      }

      await fetchReadings();
      router.push(`/saju/readings/${payload.readingId}`);
    } catch {
      showErrorStatus(
        '풀이를 여는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setCreatingReading(false);
    }
  };

  const onStartCreatePartner = () => {
    setPartnerDialogMode('create');
    setEditingPartnerId(null);
    setPartnerForm(createDefaultPartnerForm());
    setOpenPartnerDialog(true);
  };

  const onStartEditPartner = (partner: PartnerItem) => {
    setPartnerDialogMode('edit');
    setEditingPartnerId(partner.id);
    setPartnerForm({
      name: partner.name,
      relationship: partner.relationship ?? '',
      birthDate: partner.birthDate,
      birthTime: partner.birthTime ?? '12:00',
      birthTimeUnknown: partner.birthTimeUnknown,
      birthCalendarType: partner.birthCalendarType,
      isLeapMonth: partner.isLeapMonth,
      gender: partner.gender,
      mbtiType: partner.mbtiType ?? 'UNSET'
    });
    setOpenPartnerDialog(true);
  };

  const onStartDeletePartner = (partnerId: string) => {
    setDeletingPartnerId(partnerId);
    setOpenDeletePartnerDialog(true);
  };

  const onStartDeleteReading = (readingId: string) => {
    setDeletingReadingId(readingId);
    setOpenDeleteReadingDialog(true);
  };

  const onSavePartner = async () => {
    if (!isAuthenticated) {
      showErrorStatus('먼저 로그인하고 프로필을 정리해 주세요.');
      return;
    }

    if (partnerDialogMode === 'edit' && !editingPartnerId) {
      showErrorStatus('지금 수정할 프로필을 찾지 못했어요.');
      return;
    }

    const submitPayload = {
      name: partnerForm.name,
      ...(partnerForm.relationship.trim().length > 0
        ? { relationship: partnerForm.relationship.trim() }
        : {}),
      birthDate: partnerForm.birthDate,
      birthTime: partnerForm.birthTimeUnknown ? null : partnerForm.birthTime,
      birthTimeUnknown: partnerForm.birthTimeUnknown,
      birthCalendarType: partnerForm.birthCalendarType,
      isLeapMonth: partnerForm.isLeapMonth,
      gender: partnerForm.gender,
      ...(partnerForm.mbtiType !== 'UNSET'
        ? { mbtiType: partnerForm.mbtiType }
        : {})
    };

    const validation = partnerCreateSchema.safeParse(submitPayload);
    if (!validation.success) {
      showErrorStatus(
        validation.error.issues[0]?.message ?? '입력 내용을 다시 확인해 주세요.'
      );
      return;
    }

    setSavingPartner(true);
    clearStatus();

    try {
      const endpoint =
        partnerDialogMode === 'create'
          ? '/api/v1/partners'
          : `/api/v1/partners/${editingPartnerId}`;
      const body = {
        ...submitPayload,
        ...(partnerDialogMode === 'edit' && partnerForm.mbtiType === 'UNSET'
          ? { mbtiType: null }
          : {}),
        ...(partnerDialogMode === 'edit' &&
        partnerForm.relationship.trim().length === 0
          ? { relationship: null }
          : {})
      };

      const response = await fetch(endpoint, {
        method: partnerDialogMode === 'create' ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const payload = (await response.json()) as {
        partner?: PartnerItem;
        error?: string;
      };

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok || !payload.partner) {
        showErrorStatus(
          payload.error ??
            '프로필을 정리하는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      if (partnerDialogMode === 'create') {
        setPartners((prev) => [payload.partner!, ...prev]);
      } else {
        setPartners((prev) =>
          prev.map((item) =>
            item.id === payload.partner!.id ? payload.partner! : item
          )
        );
      }
      const savedProfileKey = toPartnerProfileKey(payload.partner.id);
      setSelectedSecondProfileKey(savedProfileKey);
      setOpenPartnerDialog(false);
      setEditingPartnerId(null);
      setPartnerForm(createDefaultPartnerForm());
      showStatus(
        partnerDialogMode === 'create'
          ? '새 프로필을 내 목록에 담았어요.'
          : '프로필 정보를 새 기준으로 다시 정리했어요.'
      );
    } catch {
      showErrorStatus(
        '프로필을 정리하는 중 흐름이 잠시 끊겼어요. 다시 시도해 주세요.'
      );
    } finally {
      setSavingPartner(false);
    }
  };

  const onDeletePartner = async () => {
    if (!isAuthenticated) {
      showErrorStatus('먼저 로그인하고 프로필을 정리해 주세요.');
      return;
    }

    if (!deletingPartnerId) {
      return;
    }

    setDeletingPartner(true);
    clearStatus();

    try {
      const response = await fetch(`/api/v1/partners/${deletingPartnerId}`, {
        method: 'DELETE'
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok || !payload.success) {
        showErrorStatus(
          payload.error ??
            '프로필을 정리하는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setPartners((prev) => {
        const filtered = prev.filter((item) => item.id !== deletingPartnerId);
        const deletedProfileKey = toPartnerProfileKey(deletingPartnerId);
        const fallbackProfileKey = filtered[0]
          ? toPartnerProfileKey(filtered[0].id)
          : undefined;

        setSelectedSingleProfileKey((current) =>
          current === deletedProfileKey ? SELF_PROFILE_KEY : current
        );
        setSelectedFirstProfileKey((current) =>
          current === deletedProfileKey ? SELF_PROFILE_KEY : current
        );
        setSelectedSecondProfileKey((current) => {
          if (current !== deletedProfileKey) {
            return current;
          }
          return fallbackProfileKey;
        });
        return filtered;
      });
      setReadings((prev) =>
        prev.map((item) =>
          item.partner?.id === deletingPartnerId ||
          item.firstPartner?.id === deletingPartnerId
            ? {
                ...item,
                partner:
                  item.partner?.id === deletingPartnerId ? null : item.partner,
                firstPartner:
                  item.firstPartner?.id === deletingPartnerId
                    ? null
                    : item.firstPartner,
                targetLabel:
                  item.readingType === 'SELF'
                    ? item.firstPartner?.id === deletingPartnerId
                      ? '내 정보'
                      : item.targetLabel
                    : `${item.firstPartner?.id === deletingPartnerId ? '내 정보' : (item.firstPartner?.name ?? '내 정보')} · ${item.partner?.id === deletingPartnerId ? '내 정보' : (item.partner?.name ?? '내 정보')}`
              }
            : item
        )
      );
      setOpenDeletePartnerDialog(false);
      setDeletingPartnerId(null);
      showStatus('프로필을 목록에서 정리했어요.');
    } catch {
      showErrorStatus(
        '프로필을 정리하는 중 흐름이 잠시 끊겼어요. 다시 시도해 주세요.'
      );
    } finally {
      setDeletingPartner(false);
    }
  };

  const onDeleteReading = async () => {
    if (!isAuthenticated) {
      showErrorStatus('먼저 로그인하고 해석 기록을 정리해 주세요.');
      return;
    }

    if (!deletingReadingId) {
      return;
    }

    setDeletingReading(true);
    clearStatus();

    try {
      const response = await fetch(
        `/api/v1/saju/readings/${deletingReadingId}`,
        {
          method: 'DELETE'
        }
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok || !payload.success) {
        showErrorStatus(
          payload.error ??
            '해석 기록을 정리하는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setReadings((prev) =>
        prev.filter((item) => item.id !== deletingReadingId)
      );
      setOpenDeleteReadingDialog(false);
      setDeletingReadingId(null);
      showStatus('해석 기록을 조용히 정리했어요.');
    } catch {
      showErrorStatus(
        '해석 기록을 정리하는 중 흐름이 잠시 끊겼어요. 다시 시도해 주세요.'
      );
    } finally {
      setDeletingReading(false);
    }
  };

  const genderLabel =
    onboarding?.gender === 'MALE'
      ? '남성'
      : onboarding?.gender === 'FEMALE'
        ? '여성'
        : onboarding?.gender === 'OTHER'
          ? '기타'
          : null;

  const calendarLabel = onboarding
    ? onboarding.birthCalendarType === 'SOLAR'
      ? '양력'
      : onboarding.isLeapMonth
        ? '음력(윤달)'
        : '음력(평달)'
    : null;

  const birthDateLabel =
    onboarding?.birthDate ?? onboarding?.birthDateTime.slice(0, 10) ?? null;
  const birthTimeLabel = onboarding
    ? onboarding.birthTimeUnknown
      ? '모름'
      : (onboarding.birthTime ?? onboarding.birthDateTime.slice(11, 16))
    : null;

  const infoValues = useMemo(() => {
    return [
      onboarding?.name ?? null,
      birthDateLabel,
      birthTimeLabel,
      calendarLabel,
      genderLabel,
      mbti?.mbtiType ?? null
    ].filter((value): value is string => Boolean(value));
  }, [
    onboarding,
    birthDateLabel,
    birthTimeLabel,
    calendarLabel,
    genderLabel,
    mbti
  ]);

  const profileOptions = useMemo(
    () => [
      {
        key: SELF_PROFILE_KEY,
        label: `${onboarding?.name?.trim() || '내 정보'}(나)`
      },
      ...partners.map((partner) => ({
        key: toPartnerProfileKey(partner.id),
        label: `${partner.name}(${getRelationLabel(partner.relationship)})`
      }))
    ],
    [partners, onboarding?.name]
  );

  const compatibilitySecondOptions = useMemo(
    () =>
      profileOptions.filter((option) => option.key !== selectedFirstProfileKey),
    [profileOptions, selectedFirstProfileKey]
  );
  const selectedScenario = useMemo(
    () =>
      getScenarioOption(
        readingType === 'SELF'
          ? selectedSelfScenarioCode
          : selectedCompatibilityScenarioCode
      ),
    [readingType, selectedSelfScenarioCode, selectedCompatibilityScenarioCode]
  );

  const selectedLoadingMeta = useMemo(
    () =>
      getScenarioLoadingMeta(
        readingType === 'SELF'
          ? selectedSelfScenarioCode
          : selectedCompatibilityScenarioCode
      ),
    [readingType, selectedSelfScenarioCode, selectedCompatibilityScenarioCode]
  );

  const dashboardBlockingOverlay = useMemo(() => {
    if (savingPartner) {
      return {
        title:
          partnerDialogMode === 'create'
            ? '새 프로필을 정리하고 있어요.'
            : '프로필 정보를 다시 정리하고 있어요.',
        description:
          partnerDialogMode === 'create'
            ? '입력한 사람 정보를 차곡차곡 담고 있어요.'
            : '바뀐 내용을 기준에 맞게 정리하고 있어요.'
      };
    }

    if (deletingPartner) {
      return {
        title: '프로필을 조용히 정리하고 있어요.',
        description: '연결된 선택 상태도 함께 맞추고 있어요.'
      };
    }

    if (deletingReading) {
      return {
        title: '해석 기록을 조용히 정리하고 있어요.',
        description: '보던 목록도 함께 정리하고 있어요.'
      };
    }

    return null;
  }, [deletingPartner, deletingReading, partnerDialogMode, savingPartner]);

  const toggleScenarioCategory = useCallback(
    (mode: 'SELF' | 'COMPATIBILITY', categoryCode: ScenarioCategoryCode) => {
      const setter =
        mode === 'SELF'
          ? setExpandedSelfCategoryCodes
          : setExpandedCompatibilityCategoryCodes;

      setter((current) =>
        current.includes(categoryCode)
          ? current.filter((code) => code !== categoryCode)
          : [...current, categoryCode]
      );
    },
    []
  );

  const selectScenario = useCallback(
    (
      mode: 'SELF' | 'COMPATIBILITY',
      scenarioCode: ScenarioCode,
      categoryCode: ScenarioCategoryCode
    ) => {
      if (mode === 'SELF') {
        setSelectedSelfScenarioCode(scenarioCode);
        setExpandedSelfCategoryCodes([categoryCode]);
        return;
      }

      setSelectedCompatibilityScenarioCode(scenarioCode);
      setExpandedCompatibilityCategoryCodes([categoryCode]);
    },
    []
  );

  useEffect(() => {
    if (
      selectedSecondProfileKey &&
      compatibilitySecondOptions.some(
        (option) => option.key === selectedSecondProfileKey
      )
    ) {
      return;
    }

    setSelectedSecondProfileKey(compatibilitySecondOptions[0]?.key);
  }, [selectedSecondProfileKey, compatibilitySecondOptions]);

  if (!sessionReady || (isAuthenticated && fetching)) {
    return (
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          title="당신의 MBTI 사주 공간을 준비하고 있어요."
          description="타고난 사주와 읽어 둔 운을 함께 불러오고 있어요."
          messages={[
            '오늘 다시 읽을 운의 결을 정리하고 있어요.',
            '내 정보와 복 상태를 함께 맞추고 있어요.',
            '타고난 성향 위에 들어온 운을 펼치고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <div className="space-y-2">
            <ThemedBrandLogo
              className="h-9 w-auto max-w-[180px] sm:h-10 sm:max-w-[220px]"
              width={220}
              height={66}
              priority
            />
            <div className="theme-divider max-w-56" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            타고난 사주와 지금의 운을 MBTI와 함께 읽습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessionUser?.role === 'ADMIN' ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin">
                <Shield className="size-4" />
                <span>관리자</span>
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/bok">
              <Banknote className="size-4" />
              <span>{itemBalance}복</span>
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSignOut}>
            로그아웃
          </Button>
        </div>
      </header>

      {status ? (
        <Alert variant={statusVariant}>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="relative">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="absolute top-4 right-4"
          aria-label="내 정보 수정"
        >
          <Link href="/onboarding">
            <Settings className="size-4" />
          </Link>
        </Button>
        <CardHeader>
          <CardTitle>내 정보</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {infoValues.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2 text-sm">
              {infoValues.map((value, index) => (
                <Badge key={`${value}-${index}`} variant="secondary">
                  {value}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                아직 사주를 세울 내 정보가 비어 있어요.
              </p>
              <Button asChild size="sm">
                <Link href="/onboarding">내 정보 입력하기</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>새 해석 시작</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <CardDescription className="m-0">
              {itemBalance > 0
                ? '지금 들어온 운의 방향을 바로 읽어보세요.'
                : '복을 채우면 지금의 운을 다시 읽을 수 있어요.'}
            </CardDescription>
            {itemBalance <= 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/bok">충전하러가기</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="reading-type-self">해석 유형</Label>
            <RadioGroup
              value={readingType}
              onValueChange={(value) =>
                setReadingType(value as 'SELF' | 'COMPATIBILITY')
              }
              className="grid w-full max-w-sm grid-cols-2 rounded-lg border bg-muted/40 p-1"
            >
              <div>
                <RadioGroupItem
                  value="SELF"
                  id="reading-type-self"
                  className="sr-only"
                />
                <Label
                  htmlFor="reading-type-self"
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors',
                    readingType === 'SELF'
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  사주 보기
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="COMPATIBILITY"
                  id="reading-type-compatibility"
                  className="sr-only"
                />
                <Label
                  htmlFor="reading-type-compatibility"
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors',
                    readingType === 'COMPATIBILITY'
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  궁합 보기
                </Label>
              </div>
            </RadioGroup>
          </div>

          {selectedScenario ? (
            <div className="theme-surface rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">이번에 읽을 주제</p>
              <p className="text-sm font-medium">{selectedScenario.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {selectedScenario.description}
              </p>
            </div>
          ) : null}

          {readingType === 'SELF' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="single-profile-select">해석할 사람</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onStartCreatePartner}
                  >
                    <Plus className="size-4" />
                    프로필 등록
                  </Button>
                </div>
                <Select
                  value={selectedSingleProfileKey}
                  onValueChange={(value) =>
                    setSelectedSingleProfileKey(value as ProfileSelectKey)
                  }
                >
                  <SelectTrigger id="single-profile-select" className="w-full">
                    <SelectValue placeholder="해석할 사람을 선택해 주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {profileOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>보고 싶은 항목</Label>
                <div className="grid gap-3">
                  {SELF_SCENARIO_CATEGORIES.map((category) => (
                    <ScenarioCategorySection
                      key={category.code}
                      category={category}
                      selectedCode={selectedSelfScenarioCode}
                      expanded={expandedSelfCategoryCodes.includes(
                        category.code
                      )}
                      creating={creatingReading}
                      onToggle={(categoryCode) =>
                        toggleScenarioCategory('SELF', categoryCode)
                      }
                      onSelect={(scenarioCode, categoryCode) =>
                        selectScenario('SELF', scenarioCode, categoryCode)
                      }
                      onStartReading={() => void onCreateReading()}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="compat-first-profile-select">
                    첫 번째 사람
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onStartCreatePartner}
                  >
                    <Plus className="size-4" />
                    프로필 등록
                  </Button>
                </div>
                <Select
                  value={selectedFirstProfileKey}
                  onValueChange={(value) =>
                    setSelectedFirstProfileKey(value as ProfileSelectKey)
                  }
                >
                  <SelectTrigger
                    id="compat-first-profile-select"
                    className="w-full"
                  >
                    <SelectValue placeholder="첫 번째 사람을 선택해 주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {profileOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="compat-second-profile-select">
                  두 번째 사람
                </Label>
                <Select
                  value={selectedSecondProfileKey}
                  onValueChange={(value) =>
                    setSelectedSecondProfileKey(value as ProfileSelectKey)
                  }
                >
                  <SelectTrigger
                    id="compat-second-profile-select"
                    className="w-full"
                  >
                    <SelectValue placeholder="두 번째 사람을 선택해 주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibilitySecondOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {compatibilitySecondOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    두 명 궁합을 보려면 비교할 프로필이 최소 2명 필요해요.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>궁합 항목</Label>
                <div className="grid gap-3">
                  {COMPATIBILITY_SCENARIO_CATEGORIES.map((category) => (
                    <ScenarioCategorySection
                      key={category.code}
                      category={category}
                      selectedCode={selectedCompatibilityScenarioCode}
                      expanded={expandedCompatibilityCategoryCodes.includes(
                        category.code
                      )}
                      creating={creatingReading}
                      onToggle={(categoryCode) =>
                        toggleScenarioCategory('COMPATIBILITY', categoryCode)
                      }
                      onSelect={(scenarioCode, categoryCode) =>
                        selectScenario(
                          'COMPATIBILITY',
                          scenarioCode,
                          categoryCode
                        )
                      }
                      onStartReading={() => void onCreateReading()}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>등록된 프로필</Label>
                {partners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    아직 함께 읽을 사람의 프로필이 없어요.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {partners.map((partner) => (
                      <li
                        key={partner.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {partner.name} (
                            {getRelationLabel(partner.relationship)})
                            {partner.mbtiType ? ` · ${partner.mbtiType}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {partner.birthDate}{' '}
                            {partner.birthTimeUnknown
                              ? '시간 미상'
                              : (partner.birthTime ?? '12:00')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="프로필 수정"
                            onClick={() => onStartEditPartner(partner)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="프로필 삭제"
                            onClick={() => onStartDeletePartner(partner.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 본 해석</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 읽어 본 해석이 없어요. 첫 번째 운부터 읽어보세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {readings.map((reading) => (
                <li key={reading.id}>
                  <div className="flex items-start gap-2 rounded-md border px-3 py-3">
                    <Link
                      href={`/saju/readings/${reading.id}`}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="w-full">
                        <p className="text-xs text-muted-foreground">
                          {new Date(reading.createdAt).toLocaleString('ko-KR')}
                        </p>
                        <p className="text-sm font-medium">
                          {getScenarioLabel(
                            reading.readingType,
                            reading.subjectType
                          )}
                          {reading.targetLabel
                            ? ` · ${reading.targetLabel}`
                            : ''}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {getReadingCardHint(
                            reading.readingType,
                            reading.subjectType
                          )}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {reading.summary ??
                            getScenarioFallbackSummary(
                              reading.readingType,
                              reading.subjectType
                            )}
                        </p>
                      </div>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="해석 삭제"
                      onClick={() => onStartDeleteReading(reading.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={openPartnerDialog}
        onOpenChange={(open) => {
          setOpenPartnerDialog(open);
          if (!open) {
            setPartnerDialogMode('create');
            setEditingPartnerId(null);
            setPartnerForm(createDefaultPartnerForm());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {partnerDialogMode === 'create' ? '프로필 등록' : '프로필 수정'}
            </DialogTitle>
            <DialogDescription>
              사주와 궁합에서 바로 선택할 수 있도록 사람 정보를 저장해 둘 수
              있어요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="partner-name">이름</Label>
              <Input
                id="partner-name"
                value={partnerForm.name}
                onChange={(event) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    name: event.target.value
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-relationship">나와의 관계 (선택)</Label>
              <Input
                id="partner-relationship"
                value={partnerForm.relationship}
                onChange={(event) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    relationship: event.target.value
                  }))
                }
                placeholder="예: 친구, 동료, 배우자"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-birth-date">생년월일</Label>
              <Input
                id="partner-birth-date"
                type="date"
                value={partnerForm.birthDate}
                onChange={(event) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    birthDate: event.target.value
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-birth-time">출생시각</Label>
              <Input
                id="partner-birth-time"
                type="time"
                value={partnerForm.birthTime}
                onChange={(event) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    birthTime: event.target.value
                  }))
                }
                disabled={partnerForm.birthTimeUnknown}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="partner-birth-time-unknown"
                checked={partnerForm.birthTimeUnknown}
                onCheckedChange={(checked) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    birthTimeUnknown: checked === true,
                    birthTime: checked === true ? '' : prev.birthTime
                  }))
                }
              />
              <Label htmlFor="partner-birth-time-unknown" className="text-sm">
                출생시각 모름
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-calendar-type">달력 구분</Label>
              <Select
                value={partnerForm.birthCalendarType}
                onValueChange={(value) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    birthCalendarType: value as 'SOLAR' | 'LUNAR',
                    isLeapMonth: value === 'SOLAR' ? false : prev.isLeapMonth
                  }))
                }
              >
                <SelectTrigger id="partner-calendar-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOLAR">양력</SelectItem>
                  <SelectItem value="LUNAR">음력</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {partnerForm.birthCalendarType === 'LUNAR' ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="partner-is-leap-month"
                  checked={partnerForm.isLeapMonth}
                  onCheckedChange={(checked) =>
                    setPartnerForm((prev) => ({
                      ...prev,
                      isLeapMonth: checked === true
                    }))
                  }
                />
                <Label htmlFor="partner-is-leap-month" className="text-sm">
                  윤달
                </Label>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="partner-gender">성별</Label>
              <Select
                value={partnerForm.gender}
                onValueChange={(value) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    gender: value as 'MALE' | 'FEMALE' | 'OTHER'
                  }))
                }
              >
                <SelectTrigger id="partner-gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEMALE">여성</SelectItem>
                  <SelectItem value="MALE">남성</SelectItem>
                  <SelectItem value="OTHER">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-mbti">MBTI (선택)</Label>
              <Select
                value={partnerForm.mbtiType}
                onValueChange={(value) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    mbtiType: value as MbtiSelectValue
                  }))
                }
              >
                <SelectTrigger id="partner-mbti" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNSET">미설정</SelectItem>
                  {MBTI_TYPE_VALUES.map((mbtiType) => (
                    <SelectItem key={mbtiType} value={mbtiType}>
                      {mbtiType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenPartnerDialog(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void onSavePartner()}
              disabled={savingPartner}
            >
              {savingPartner
                ? '정리 중...'
                : partnerDialogMode === 'create'
                  ? '등록하기'
                  : '저장하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDeletePartnerDialog}
        onOpenChange={(open) => {
          setOpenDeletePartnerDialog(open);
          if (!open) {
            setDeletingPartnerId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로필 삭제 확인</DialogTitle>
            <DialogDescription>
              삭제한 프로필은 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            선택한 프로필을 삭제할까요?
            <span className="font-semibold">
              {' '}
              {partners.find((partner) => partner.id === deletingPartnerId)
                ?.name ?? '선택한 사람'}
            </span>
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenDeletePartnerDialog(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onDeletePartner()}
              disabled={deletingPartner}
            >
              {deletingPartner ? '정리 중...' : '삭제하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDeleteReadingDialog}
        onOpenChange={(open) => {
          setOpenDeleteReadingDialog(open);
          if (!open) {
            setDeletingReadingId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>해석 삭제 확인</DialogTitle>
            <DialogDescription>
              삭제한 해석 기록은 복구할 수 없고, 사용한 복도 다시 돌아오지
              않습니다.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            선택한 해석 기록을 삭제할까요?
            <span className="font-semibold">
              {' '}
              {readings.find((item) => item.id === deletingReadingId)
                ?.targetLabel ?? '선택한 해석'}
            </span>
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenDeleteReadingDialog(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onDeleteReading()}
              disabled={deletingReading}
            >
              {deletingReading ? '정리 중...' : '삭제하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoadingOverlay
        open={creatingReading}
        mode={readingType}
        theme={selectedLoadingMeta?.theme ?? 'timing'}
        icon={selectedLoadingMeta?.icon ?? 'sparkles'}
        motion={selectedLoadingMeta?.motion}
        illustration={selectedLoadingMeta?.illustration}
        variant="folk"
        title={
          selectedLoadingMeta?.title ??
          '당신의 운명을 타고난 성향에 맞게 풀이하고 있어요.'
        }
        description={
          selectedScenario
            ? `${selectedScenario.label}에 담긴 운의 결을 읽을 준비를 하고 있어요.`
            : undefined
        }
        badgeLabel={selectedScenario?.label}
        messages={
          selectedLoadingMeta?.messages ?? [
            '사주를 세우고 지금의 운을 읽고 있어요.',
            '오행의 결을 천천히 맞춰 보고 있어요.',
            '당신에게 맞는 말로 차분히 풀어내고 있어요.'
          ]
        }
      />

      <LoadingOverlay
        open={dashboardBlockingOverlay !== null}
        mode="SELF"
        theme="timing"
        icon="sparkles"
        title={dashboardBlockingOverlay?.title ?? '차분히 정리하고 있어요.'}
        description={dashboardBlockingOverlay?.description}
        messages={[
          '입력한 내용을 빠짐없이 확인하고 있어요.',
          '화면과 목록 상태도 함께 맞추고 있어요.'
        ]}
      />
    </main>
  );
}
