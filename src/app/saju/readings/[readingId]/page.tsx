'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchClientSession } from '@/lib/auth/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { SajuDataSection } from '@/components/saju/SajuDataSection';
import { LoadingOverlay } from '@/components/loading/LoadingOverlay';
import { PageLoadingState } from '@/components/loading/PageLoadingState';
import { ThemedBrandLogo } from '@/components/theme/ThemedBrandLogo';
import type { SajuFrontendMetadata } from '@/lib/saju/generator/metadata-transform';
import { SELF_SUBJECT_LABEL, type SelfSubjectType } from '@/lib/saju/constants';
import {
  getLegacySubjectTypeFromCode,
  getScenarioLabel,
  getScenarioResultTitle
} from '@/lib/saju/scenarios';

type ReadingDetail = {
  id: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
  itemCost: number;
  cacheHit: boolean;
  cacheKey: string | null;
  createdAt: string;
  targetLabel: string;
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
    sajuEvidence?: string[];
    sajuBasis?: string;
    subjectLens?: string;
    overview?: string;
    narrativeFlow?: string;
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

function TextSection({
  id,
  title,
  text
}: {
  id?: string;
  title: string;
  text: string;
}) {
  return (
    <section id={id} className="theme-reading-section scroll-mt-24 space-y-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </section>
  );
}

const DETAIL_SECTION_TITLE = {
  overview: '먼저 읽을 결론',
  sajuBasis: '타고난 기질',
  sajuEvidence: '이 해석의 근거',
  narrativeFlow: '자세한 풀이',
  subjectLens: '핵심 포인트',
  tenYearFlow: '앞으로 이어질 흐름',
  currentDaewoon: '지금 크게 들어온 흐름',
  yearlyFlow: '올해 운',
  coreSignal: '지금 가장 중요한 흐름',
  wealthFlow: '돈 흐름',
  relationshipFlow: '관계 흐름',
  pairDynamic: '두 사람 흐름',
  attractionPoint: '잘 맞는 점',
  conflictTrigger: '엇갈리기 쉬운 점',
  communicationTip: '말이 잘 통하는 방식',
  relationshipLens: '관계에서 볼 점',
  careerMoneyLens: '일과 재물에서 볼 점',
  timingHint: '움직이기 좋은 때',
  caution: '조심할 점',
  actions: '바로 해볼 것',
  reflectionQuestion: '한 번 더 생각할 질문'
} as const;

type DetailSectionKey = keyof typeof DETAIL_SECTION_TITLE;

const DETAIL_QUICK_JUMP_LABEL: Partial<Record<DetailSectionKey, string>> = {
  overview: '결론',
  coreSignal: '핵심',
  sajuBasis: '기질',
  sajuEvidence: '근거',
  relationshipFlow: '관계',
  wealthFlow: '돈/일',
  timingHint: '타이밍',
  actions: '실천'
};

const DETAIL_QUICK_JUMP_KEYS: DetailSectionKey[] = [
  'overview',
  'coreSignal',
  'sajuBasis',
  'sajuEvidence',
  'relationshipFlow',
  'wealthFlow',
  'timingHint',
  'actions'
];

const BASIC_SELF_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'narrativeFlow',
  'sajuBasis',
  'sajuEvidence',
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
];

const PREMIUM_SELF_TIMING_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'narrativeFlow',
  'subjectLens',
  'sajuBasis',
  'sajuEvidence',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'coreSignal',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const PREMIUM_SELF_WORK_MONEY_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'narrativeFlow',
  'subjectLens',
  'sajuBasis',
  'sajuEvidence',
  'wealthFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'coreSignal',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const PREMIUM_SELF_RELATION_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'narrativeFlow',
  'subjectLens',
  'sajuBasis',
  'sajuEvidence',
  'relationshipFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'coreSignal',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const COMPATIBILITY_BASIC_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'sajuBasis',
  'sajuEvidence',
  'coreSignal',
  'subjectLens',
  'pairDynamic',
  'attractionPoint',
  'conflictTrigger',
  'communicationTip',
  'narrativeFlow',
  'relationshipFlow',
  'wealthFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const COMPATIBILITY_RELATION_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'sajuBasis',
  'sajuEvidence',
  'coreSignal',
  'subjectLens',
  'pairDynamic',
  'attractionPoint',
  'conflictTrigger',
  'communicationTip',
  'narrativeFlow',
  'relationshipFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const COMPATIBILITY_WORK_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'sajuBasis',
  'sajuEvidence',
  'coreSignal',
  'subjectLens',
  'pairDynamic',
  'attractionPoint',
  'conflictTrigger',
  'communicationTip',
  'narrativeFlow',
  'wealthFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

const COMPATIBILITY_MISC_SECTION_ORDER: DetailSectionKey[] = [
  'overview',
  'sajuBasis',
  'sajuEvidence',
  'coreSignal',
  'subjectLens',
  'pairDynamic',
  'attractionPoint',
  'communicationTip',
  'narrativeFlow',
  'currentDaewoon',
  'yearlyFlow',
  'tenYearFlow',
  'timingHint',
  'caution',
  'actions',
  'reflectionQuestion'
];

function getFocusedSelfSectionOrder(
  subjectCode: string,
  subjectType: SelfSubjectType
): DetailSectionKey[] {
  switch (subjectCode) {
    case 'SELF_LOVE_GENERAL':
    case 'SELF_LOVE_RECONCILIATION':
    case 'SELF_LOVE_CONTACT_RETURN':
    case 'SELF_LOVE_CONFESSION_TIMING':
    case 'SELF_MARRIAGE_GENERAL':
    case 'SELF_RELATIONSHIP_GENERAL':
    case 'SELF_RELATIONSHIP_CUT_OFF':
    case 'SELF_FAMILY_GENERAL':
    case 'SELF_FAMILY_PARENTS':
      return PREMIUM_SELF_RELATION_SECTION_ORDER;
    case 'SELF_CAREER_GENERAL':
    case 'SELF_CAREER_APTITUDE':
    case 'SELF_CAREER_JOB_CHANGE':
    case 'SELF_WEALTH_GENERAL':
    case 'SELF_WEALTH_ACCUMULATION':
    case 'SELF_WEALTH_LEAK':
      return PREMIUM_SELF_WORK_MONEY_SECTION_ORDER;
    case 'SELF_LIFETIME_FLOW':
    case 'SELF_DAEUN':
    case 'SELF_YEARLY_FORTUNE':
    case 'SELF_DAILY_FORTUNE':
    case 'SELF_LUCK_UP':
      return PREMIUM_SELF_TIMING_SECTION_ORDER;
    default:
      break;
  }

  switch (subjectType) {
    case 'CAREER':
      return PREMIUM_SELF_WORK_MONEY_SECTION_ORDER;
    case 'WEALTH':
      return PREMIUM_SELF_WORK_MONEY_SECTION_ORDER;
    case 'ROMANCE':
    case 'MARRIAGE':
    case 'RELATIONSHIPS':
    case 'FAMILY':
      return PREMIUM_SELF_RELATION_SECTION_ORDER;
    case 'LIFETIME_FLOW':
    case 'DAEUN':
    case 'YEAR_MONTH_DAY_FORTUNE':
    case 'LUCK_UP':
      return PREMIUM_SELF_TIMING_SECTION_ORDER;
    case 'BASIC':
    default:
      return BASIC_SELF_SECTION_ORDER;
  }
}

function getCompatibilitySectionOrder(subjectType: string): DetailSectionKey[] {
  if (subjectType === 'COMPAT_BASIC') {
    return COMPATIBILITY_BASIC_SECTION_ORDER;
  }

  if (subjectType.startsWith('COMPAT_WORK_')) {
    return COMPATIBILITY_WORK_SECTION_ORDER;
  }

  if (subjectType.startsWith('COMPAT_FAMILY_')) {
    return COMPATIBILITY_RELATION_SECTION_ORDER;
  }

  if (subjectType.startsWith('COMPAT_MISC_')) {
    return COMPATIBILITY_MISC_SECTION_ORDER;
  }

  if (subjectType.startsWith('COMPAT_ROMANCE_')) {
    return COMPATIBILITY_RELATION_SECTION_ORDER;
  }

  if (subjectType.startsWith('COMPAT_FRIEND_')) {
    return COMPATIBILITY_RELATION_SECTION_ORDER;
  }

  return COMPATIBILITY_BASIC_SECTION_ORDER;
}

function getCompatibilityDetailTitle(
  subjectType: string,
  section:
    | 'subjectLens'
    | 'pairDynamic'
    | 'attractionPoint'
    | 'conflictTrigger'
    | 'communicationTip'
): string {
  if (subjectType === 'COMPAT_ROMANCE_LEFT_ON_READ') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '답이 늦어지는 이유';
      case 'attractionPoint':
        return '다시 이어질 여지';
      case 'conflictTrigger':
        return '조급해지기 쉬운 지점';
      case 'communicationTip':
        return '연락 흐름을 여는 말';
    }
  }

  if (subjectType === 'COMPAT_BASIC') {
    switch (section) {
      case 'subjectLens':
        return '이 궁합에서 먼저 볼 점';
      case 'pairDynamic':
        return '두 사람 전체 흐름';
      case 'attractionPoint':
        return '편안하게 맞는 점';
      case 'conflictTrigger':
        return '반복해 엇갈리는 지점';
      case 'communicationTip':
        return '덜 어긋나는 대화법';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_GHOSTED') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '흐름이 끊긴 이유';
      case 'attractionPoint':
        return '다시 닿을 실마리';
      case 'conflictTrigger':
        return '기대가 어긋난 지점';
      case 'communicationTip':
        return '다시 말을 꺼내기 전 볼 점';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_EX') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '다시 엮이는 이유';
      case 'attractionPoint':
        return '아직 남아 있는 정';
      case 'conflictTrigger':
        return '반복되기 쉬운 상처';
      case 'communicationTip':
        return '다시 닿을 때의 말';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_LOVER') {
    switch (section) {
      case 'subjectLens':
        return '지금 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '애정과 안정의 흐름';
      case 'attractionPoint':
        return '계속 붙어 있는 힘';
      case 'conflictTrigger':
        return '반복해 닳는 지점';
      case 'communicationTip':
        return '덜 서운하게 맞추는 말';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_MARRIAGE_PARTNER') {
    switch (section) {
      case 'subjectLens':
        return '결혼을 생각할 때 먼저 볼 점';
      case 'pairDynamic':
        return '오래 갈 생활의 결';
      case 'attractionPoint':
        return '함께 살고 싶은 이유';
      case 'conflictTrigger':
        return '생활이 부딪히는 지점';
      case 'communicationTip':
        return '미래 기준을 맞추는 말';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_MARRIED') {
    switch (section) {
      case 'subjectLens':
        return '부부 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '같이 사는 리듬';
      case 'attractionPoint':
        return '서로를 붙드는 힘';
      case 'conflictTrigger':
        return '생활 피로가 쌓이는 지점';
      case 'communicationTip':
        return '다시 맞추는 말의 순서';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_BLIND_DATE') {
    switch (section) {
      case 'subjectLens':
        return '이 만남에서 먼저 볼 점';
      case 'pairDynamic':
        return '첫 만남의 결';
      case 'attractionPoint':
        return '다음 약속이 붙는 점';
      case 'conflictTrigger':
        return '식기 쉬운 지점';
      case 'communicationTip':
        return '가볍게 이어가는 말';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_CRUSH') {
    switch (section) {
      case 'subjectLens':
        return '이 마음에서 먼저 볼 점';
      case 'pairDynamic':
        return '마음이 커지는 이유';
      case 'attractionPoint':
        return '가까워질 여지';
      case 'conflictTrigger':
        return '혼자 커지기 쉬운 기대';
      case 'communicationTip':
        return '부담 덜 주는 말';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_FLIRTING') {
    switch (section) {
      case 'subjectLens':
        return '이 썸에서 먼저 볼 점';
      case 'pairDynamic':
        return '설렘이 붙는 속도';
      case 'attractionPoint':
        return '자꾸 이어지는 이유';
      case 'conflictTrigger':
        return '애매해지기 쉬운 순간';
      case 'communicationTip':
        return '부담 덜 주는 연결법';
    }
  }

  if (subjectType === 'COMPAT_ROMANCE_FRIEND_TO_LOVER') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '친구에서 달라지는 지점';
      case 'attractionPoint':
        return '연인으로 번질 여지';
      case 'conflictTrigger':
        return '어색해지기 쉬운 순간';
      case 'communicationTip':
        return '감정을 꺼내는 말';
    }
  }

  if (subjectType === 'COMPAT_FRIEND_CUT_OFF') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '지금 거리가 벌어지는 이유';
      case 'attractionPoint':
        return '아직 지킬 수 있는 점';
      case 'conflictTrigger':
        return '마음이 닳는 지점';
      case 'communicationTip':
        return '거리 조절의 말';
    }
  }

  if (subjectType === 'COMPAT_FRIEND_TRAVEL') {
    switch (section) {
      case 'subjectLens':
        return '같이 움직일 때 먼저 볼 점';
      case 'pairDynamic':
        return '여행에서 맞는 호흡';
      case 'attractionPoint':
        return '함께 있으면 편한 점';
      case 'conflictTrigger':
        return '지치기 쉬운 순간';
      case 'communicationTip':
        return '덜 부딪히는 여행 대화법';
    }
  }

  if (subjectType === 'COMPAT_FRIEND_BEST') {
    switch (section) {
      case 'subjectLens':
        return '이 우정에서 먼저 볼 점';
      case 'pairDynamic':
        return '오래 편한 이유';
      case 'attractionPoint':
        return '서로 기대는 힘';
      case 'conflictTrigger':
        return '익숙함이 상처가 되는 지점';
      case 'communicationTip':
        return '오래 가는 말의 방식';
    }
  }

  if (subjectType === 'COMPAT_FRIEND_ROOMMATE') {
    switch (section) {
      case 'subjectLens':
        return '같이 살 때 먼저 볼 점';
      case 'pairDynamic':
        return '생활 리듬의 합';
      case 'attractionPoint':
        return '같이 살아도 편한 점';
      case 'conflictTrigger':
        return '예민해지기 쉬운 생활선';
      case 'communicationTip':
        return '덜 지치는 생활 대화법';
    }
  }

  if (subjectType.startsWith('COMPAT_MISC_')) {
    switch (section) {
      case 'subjectLens':
        return '이 궁합을 볼 때 먼저 볼 점';
      case 'pairDynamic':
        return '이 궁합의 느낌';
      case 'attractionPoint':
        return '끌리는 이유';
      case 'conflictTrigger':
        return '거리 두면 좋은 점';
      case 'communicationTip':
        return '이 궁합을 읽는 포인트';
    }
  }

  if (subjectType === 'COMPAT_FAMILY_PARENT_CHILD') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '보호와 기대의 흐름';
      case 'attractionPoint':
        return '서로를 놓지 않는 힘';
      case 'conflictTrigger':
        return '걱정이 상처가 되는 지점';
      case 'communicationTip':
        return '덜 다치게 말하는 순서';
    }
  }

  if (subjectType.startsWith('COMPAT_WORK_')) {
    if (subjectType === 'COMPAT_WORK_BOSS') {
      switch (section) {
        case 'subjectLens':
          return '이 관계에서 먼저 볼 점';
        case 'pairDynamic':
          return '보고 리듬';
        case 'attractionPoint':
          return '일이 잘 맞는 지점';
        case 'conflictTrigger':
          return '엇갈리는 기준';
        case 'communicationTip':
          return '덜 꼬이는 보고법';
      }
    }

    if (subjectType === 'COMPAT_WORK_DIFFICULT_BOSS') {
      switch (section) {
        case 'subjectLens':
          return '이 관계에서 먼저 볼 점';
        case 'pairDynamic':
          return '까다롭게 느껴지는 이유';
        case 'attractionPoint':
          return '그래도 맞는 일의 결';
        case 'conflictTrigger':
          return '소모가 커지는 순간';
        case 'communicationTip':
          return '덜 부딪히는 말의 순서';
      }
    }

    if (subjectType === 'COMPAT_WORK_BUSINESS_PARTNER') {
      switch (section) {
        case 'subjectLens':
          return '이 관계에서 먼저 볼 점';
        case 'pairDynamic':
          return '같이 벌 때의 결';
        case 'attractionPoint':
          return '서로 살리는 역할';
        case 'conflictTrigger':
          return '책임이 엇갈리는 지점';
        case 'communicationTip':
          return '선을 맞추는 대화법';
      }
    }

    if (subjectType === 'COMPAT_WORK_COWORKER') {
      switch (section) {
        case 'subjectLens':
          return '이 관계에서 먼저 볼 점';
        case 'pairDynamic':
          return '같이 일할 때의 호흡';
        case 'attractionPoint':
          return '서로 살리는 강점';
        case 'conflictTrigger':
          return '작게 꼬이기 쉬운 기준';
        case 'communicationTip':
          return '덜 피곤한 협업 대화법';
      }
    }

    if (subjectType === 'COMPAT_WORK_WORK_DUMPER') {
      switch (section) {
        case 'subjectLens':
          return '이 관계에서 먼저 볼 점';
        case 'pairDynamic':
          return '일이 쏠리는 이유';
        case 'attractionPoint':
          return '그래도 맞는 협업 포인트';
        case 'conflictTrigger':
          return '억울함이 쌓이는 지점';
        case 'communicationTip':
          return '선을 분명히 하는 말';
      }
    }

    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '함께 일할 때의 흐름';
      case 'attractionPoint':
        return '잘 맞는 업무 강점';
      case 'conflictTrigger':
        return '부딪히기 쉬운 지점';
      case 'communicationTip':
        return '일할 때 맞는 소통법';
    }
  }

  if (subjectType.startsWith('COMPAT_ROMANCE_')) {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '지금 두 사람 사이의 결';
      case 'attractionPoint':
        return '마음이 닿는 점';
      case 'conflictTrigger':
        return '엇갈리기 쉬운 순간';
      case 'communicationTip':
        return '지금 맞는 대화법';
      default:
        return DETAIL_SECTION_TITLE[section];
    }
  }

  if (subjectType === 'COMPAT_FAMILY_MOTHER_DAUGHTER') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '서로 기대하는 역할';
      case 'attractionPoint':
        return '마음이 닿는 점';
      case 'conflictTrigger':
        return '상처가 쌓이는 지점';
      case 'communicationTip':
        return '덜 다치게 말하는 법';
    }
  }

  if (subjectType === 'COMPAT_FAMILY_MOTHER_IN_LAW') {
    switch (section) {
      case 'subjectLens':
        return '이 관계에서 먼저 볼 점';
      case 'pairDynamic':
        return '기대 역할이 맞물리는 방식';
      case 'attractionPoint':
        return '편안해질 수 있는 지점';
      case 'conflictTrigger':
        return '예민해지기 쉬운 순간';
      case 'communicationTip':
        return '덜 거칠어지는 말의 순서';
    }
  }

  return DETAIL_SECTION_TITLE[section];
}

const FOCUSED_SELF_DETAIL_TITLE_OVERRIDES: Partial<
  Record<string, Partial<Record<DetailSectionKey, string>>>
> = {
  SELF_LOVE_RECONCILIATION: {
    overview: '재회 질문에서 먼저 읽을 결',
    sajuBasis: '재회에 깔린 사주 바탕',
    sajuEvidence: '재회를 읽는 사주 근거',
    relationshipFlow: '재회가 다시 붙는 흐름',
    coreSignal: '재회를 가르는 핵심 신호',
    timingHint: '다시 닿아도 되는 타이밍',
    caution: '재회를 서두르면 안 되는 이유',
    actions: '재회 전에 해볼 정리',
    reflectionQuestion: '재회 전에 스스로에게 물을 질문'
  },
  SELF_LOVE_CONTACT_RETURN: {
    overview: '다시 연락 질문에서 먼저 읽을 결',
    sajuBasis: '연락 흐름에 깔린 사주 바탕',
    sajuEvidence: '연락 여부를 읽는 사주 근거',
    relationshipFlow: '다시 연락이 닿는 흐름',
    coreSignal: '연락 흐름을 가르는 핵심 신호',
    timingHint: '기다릴지 움직일지 가르는 타이밍',
    caution: '혼자 의미를 키우기 쉬운 지점',
    actions: '연락 전에 해볼 정리',
    reflectionQuestion: '이 연락을 기다리는 이유를 묻는 질문'
  },
  SELF_LOVE_CONFESSION_TIMING: {
    overview: '고백 질문에서 먼저 읽을 결',
    sajuBasis: '고백 타이밍에 깔린 사주 바탕',
    sajuEvidence: '고백 타이밍을 읽는 사주 근거',
    relationshipFlow: '마음을 꺼내기 좋은 흐름',
    coreSignal: '고백 전 읽어야 할 핵심 신호',
    timingHint: '고백을 움직여도 되는 타이밍',
    caution: '고백을 서두르면 꺾이는 지점',
    actions: '고백 전에 해볼 준비',
    reflectionQuestion: '고백 전에 스스로 확인할 질문'
  },
  SELF_CAREER_APTITUDE: {
    overview: '적성 질문에서 먼저 읽을 결',
    sajuBasis: '적성에 깔린 사주 바탕',
    sajuEvidence: '적성을 읽는 사주 근거',
    wealthFlow: '일이 오래 붙는 흐름',
    coreSignal: '적성을 가르는 핵심 신호',
    timingHint: '강점이 살아나는 타이밍',
    caution: '억지로 버티면 닳는 지점',
    actions: '적성을 확인하는 실천',
    reflectionQuestion: '지금 일에서 다시 물어볼 질문'
  },
  SELF_CAREER_JOB_CHANGE: {
    overview: '이직 질문에서 먼저 읽을 결',
    sajuBasis: '이직 흐름에 깔린 사주 바탕',
    sajuEvidence: '이직을 읽는 사주 근거',
    wealthFlow: '옮길 자리가 열리는 흐름',
    coreSignal: '이직을 가르는 핵심 신호',
    timingHint: '이직을 움직여도 되는 타이밍',
    caution: '성급히 옮기면 반복되는 지점',
    actions: '이직 전에 해볼 정리',
    reflectionQuestion: '옮기기 전에 스스로 묻는 질문'
  },
  SELF_WEALTH_ACCUMULATION: {
    overview: '돈이 모이는 흐름에서 먼저 읽을 결',
    sajuBasis: '축재 흐름에 깔린 사주 바탕',
    sajuEvidence: '돈이 붙는 흐름을 읽는 사주 근거',
    wealthFlow: '돈이 붙기 시작하는 흐름',
    coreSignal: '돈이 모이는 힘의 핵심',
    timingHint: '모으는 힘을 키우는 타이밍',
    caution: '돈복이 흩어지기 쉬운 지점',
    actions: '지금 돈길을 살리는 실천',
    reflectionQuestion: '돈을 모으려면 먼저 볼 질문'
  },
  SELF_WEALTH_LEAK: {
    overview: '돈 누수 질문에서 먼저 읽을 결',
    sajuBasis: '새는 돈에 깔린 사주 바탕',
    sajuEvidence: '돈이 새는 패턴을 읽는 사주 근거',
    wealthFlow: '돈이 새는 틈의 흐름',
    coreSignal: '누수를 키우는 핵심 신호',
    timingHint: '지출선을 다시 잡을 타이밍',
    caution: '감정소비가 커지기 쉬운 지점',
    actions: '지금 새는 돈을 막는 실천',
    reflectionQuestion: '돈이 새는 이유를 짚는 질문'
  },
  SELF_RELATIONSHIP_CUT_OFF: {
    overview: '손절 질문에서 먼저 읽을 결',
    sajuBasis: '거리 조절에 깔린 사주 바탕',
    sajuEvidence: '관계 정리를 읽는 사주 근거',
    relationshipFlow: '거리를 조절해야 하는 흐름',
    coreSignal: '관계를 가르는 핵심 신호',
    timingHint: '선을 그어도 되는 타이밍',
    caution: '죄책감에 끌려가기 쉬운 지점',
    actions: '거리 조절 전에 해볼 정리',
    reflectionQuestion: '끊어야 하는 관계인지 묻는 질문'
  },
  SELF_FAMILY_PARENTS: {
    overview: '부모와의 관계에서 먼저 읽을 결',
    sajuBasis: '부모와의 관계에 깔린 사주 바탕',
    sajuEvidence: '부모와의 관계를 읽는 사주 근거',
    relationshipFlow: '부모와의 거리감 흐름',
    coreSignal: '상처가 쌓이는 핵심 신호',
    timingHint: '말 순서를 바꿔야 하는 타이밍',
    caution: '기대가 상처로 바뀌는 지점',
    actions: '부모와의 관계에서 해볼 정리',
    reflectionQuestion: '부모와의 관계에서 다시 묻는 질문'
  }
};

const FOCUSED_SELF_SUBJECT_DETAIL_TITLE: Partial<
  Record<SelfSubjectType, Partial<Record<DetailSectionKey, string>>>
> = {
  CAREER: {
    overview: '일 방향에서 먼저 읽을 결',
    sajuBasis: '일에 깔린 사주 바탕',
    sajuEvidence: '일 흐름을 읽는 사주 근거',
    coreSignal: '일 방향을 가르는 핵심 신호',
    timingHint: '움직여도 되는 타이밍',
    caution: '일에서 무리하기 쉬운 지점',
    actions: '일의 방향을 다지는 실천',
    reflectionQuestion: '일에서 다시 물어볼 질문'
  },
  WEALTH: {
    overview: '돈 흐름에서 먼저 읽을 결',
    sajuBasis: '돈에 깔린 사주 바탕',
    sajuEvidence: '재물 흐름을 읽는 사주 근거',
    coreSignal: '돈 흐름의 핵심 신호',
    timingHint: '돈의 흐름을 조정할 타이밍',
    caution: '돈이 흔들리기 쉬운 지점',
    actions: '돈 흐름을 다지는 실천',
    reflectionQuestion: '돈에서 다시 물어볼 질문'
  },
  ROMANCE: {
    overview: '마음 흐름에서 먼저 읽을 결',
    sajuBasis: '연애에 깔린 사주 바탕',
    sajuEvidence: '연애 흐름을 읽는 사주 근거',
    coreSignal: '마음 흐름의 핵심 신호',
    timingHint: '감정을 움직여도 되는 타이밍',
    caution: '마음이 앞서기 쉬운 지점',
    actions: '감정 흐름을 살피는 실천',
    reflectionQuestion: '마음에서 다시 물어볼 질문'
  },
  MARRIAGE: {
    overview: '관계 구조에서 먼저 읽을 결',
    sajuBasis: '배우자운에 깔린 사주 바탕',
    sajuEvidence: '배우자운을 읽는 사주 근거',
    coreSignal: '관계의 핵심 신호',
    timingHint: '관계를 다져도 되는 타이밍',
    caution: '기대가 무거워지기 쉬운 지점',
    actions: '관계를 편안하게 하는 실천',
    reflectionQuestion: '관계에서 다시 물어볼 질문'
  },
  RELATIONSHIPS: {
    overview: '관계를 볼 때 먼저 읽을 결',
    sajuBasis: '관계운에 깔린 사주 바탕',
    sajuEvidence: '인간관계를 읽는 사주 근거',
    coreSignal: '관계를 가르는 핵심 신호',
    timingHint: '거리 조절이 필요한 타이밍',
    caution: '관계 피로가 쌓이는 지점',
    actions: '관계를 정리하는 실천',
    reflectionQuestion: '관계에서 다시 물어볼 질문'
  },
  FAMILY: {
    overview: '가족 관계에서 먼저 읽을 결',
    sajuBasis: '가족운에 깔린 사주 바탕',
    sajuEvidence: '가족 관계를 읽는 사주 근거',
    coreSignal: '가족 관계의 핵심 신호',
    timingHint: '말 순서를 바꿀 타이밍',
    caution: '가족 기대가 무거워지는 지점',
    actions: '가족 관계에서 해볼 실천',
    reflectionQuestion: '가족 관계에서 다시 물어볼 질문'
  },
  LIFETIME_FLOW: {
    overview: '긴 흐름에서 먼저 읽을 결',
    sajuBasis: '평생 총운에 깔린 사주 바탕',
    sajuEvidence: '긴 흐름을 읽는 사주 근거',
    coreSignal: '긴 흐름의 핵심 신호',
    timingHint: '힘을 실어야 할 타이밍',
    caution: '운의 리듬을 놓치기 쉬운 지점',
    actions: '긴 흐름을 살리는 실천',
    reflectionQuestion: '삶의 방향에서 다시 물어볼 질문'
  },
  DAEUN: {
    overview: '대운에서 먼저 읽을 결',
    sajuBasis: '대운에 깔린 사주 바탕',
    sajuEvidence: '대운을 읽는 사주 근거',
    coreSignal: '대운의 핵심 신호',
    timingHint: '이 10년을 써야 할 타이밍',
    caution: '대운을 거스르기 쉬운 지점',
    actions: '지금 10년을 살리는 실천',
    reflectionQuestion: '이 10년에서 다시 물어볼 질문'
  },
  YEAR_MONTH_DAY_FORTUNE: {
    overview: '지금 시기에서 먼저 읽을 결',
    sajuBasis: '시기운에 깔린 사주 바탕',
    sajuEvidence: '지금 시기를 읽는 사주 근거',
    coreSignal: '지금 시기의 핵심 신호',
    timingHint: '지금 힘을 써야 할 타이밍',
    caution: '지금 무리하기 쉬운 지점',
    actions: '지금 시기에 맞는 실천',
    reflectionQuestion: '지금 시기에서 다시 물어볼 질문'
  },
  LUCK_UP: {
    overview: '개운에서 먼저 읽을 결',
    sajuBasis: '개운에 깔린 사주 바탕',
    sajuEvidence: '개운 포인트를 읽는 사주 근거',
    coreSignal: '운을 살리는 핵심 신호',
    timingHint: '생활을 바꾸기 좋은 타이밍',
    caution: '효과가 약해지기 쉬운 지점',
    actions: '운을 붙이는 실천',
    reflectionQuestion: '생활 기준에서 다시 물어볼 질문'
  }
};

const COMPATIBILITY_DETAIL_TITLE_OVERRIDES: Partial<
  Record<string, Partial<Record<DetailSectionKey, string>>>
> = {
  COMPAT_BASIC: {
    overview: '기본 궁합에서 먼저 읽을 결론',
    sajuBasis: '두 사람 타고난 기질',
    sajuEvidence: '기본 궁합을 읽는 근거',
    coreSignal: '두 사람 궁합의 핵심 신호',
    narrativeFlow: '기본 궁합 풀이',
    relationshipFlow: '마음과 거리의 흐름',
    wealthFlow: '같이 쓰는 기준의 흐름',
    timingHint: '서로 리듬을 살펴보기 좋은 때',
    caution: '좋은 궁합이어도 조심할 점',
    actions: '두 사람을 위해 바로 해볼 것',
    reflectionQuestion: '이 관계를 위해 다시 물어볼 질문'
  },
  COMPAT_ROMANCE_LOVER: {
    narrativeFlow: '연인 궁합 풀이',
    relationshipFlow: '지금 관계가 이어지는 흐름',
    timingHint: '관계를 다시 맞춰 보기 좋은 타이밍',
    caution: '익숙함이 설명을 줄이기 쉬운 지점',
    actions: '지금 관계를 위한 실천',
    reflectionQuestion: '이 관계가 더 편안해지는지 묻는 질문'
  },
  COMPAT_ROMANCE_MARRIAGE_PARTNER: {
    narrativeFlow: '결혼 상대 궁합 풀이',
    relationshipFlow: '오래 함께 갈 관계 흐름',
    timingHint: '미래 기준을 맞춰 볼 타이밍',
    caution: '설렘이 현실 기준을 가리기 쉬운 지점',
    actions: '결혼 전 해볼 실천',
    reflectionQuestion: '함께 살 그림이 편안한지 묻는 질문'
  },
  COMPAT_ROMANCE_MARRIED: {
    narrativeFlow: '부부 궁합 풀이',
    relationshipFlow: '함께 사는 관계 흐름',
    timingHint: '생활 기준을 다시 맞출 타이밍',
    caution: '익숙함이 피로를 오래 끌기 쉬운 지점',
    actions: '부부 관계를 위한 실천',
    reflectionQuestion: '이 관계를 덜 무겁게 만드는 질문'
  },
  COMPAT_ROMANCE_FLIRTING: {
    narrativeFlow: '썸 궁합 풀이',
    relationshipFlow: '썸이 자라는 관계 흐름',
    timingHint: '관계를 한 단계 올려도 되는 타이밍',
    caution: '확답을 서두르기 쉬운 지점',
    actions: '썸 흐름을 살리는 실천',
    reflectionQuestion: '이 썸이 자라고 있는지 묻는 질문'
  },
  COMPAT_ROMANCE_EX: {
    narrativeFlow: '전연인 궁합 풀이',
    relationshipFlow: '다시 이어졌을 때의 관계 흐름',
    timingHint: '재회를 다시 꺼낼 타이밍',
    caution: '추억이 현실 판단을 가리기 쉬운 지점',
    actions: '다시 만나기 전에 해볼 정리',
    reflectionQuestion: '다시 만나도 괜찮은지 묻는 질문'
  },
  COMPAT_ROMANCE_CRUSH: {
    narrativeFlow: '짝사랑 궁합 풀이',
    relationshipFlow: '가까워지는 관계 흐름',
    timingHint: '호감을 가볍게 드러낼 타이밍',
    caution: '상상을 키우기 쉬운 지점',
    actions: '부담 덜 주는 실천',
    reflectionQuestion: '이 마음을 꺼내도 되는지 묻는 질문'
  },
  COMPAT_ROMANCE_BLIND_DATE: {
    narrativeFlow: '소개팅 궁합 풀이',
    relationshipFlow: '다음 만남으로 이어지는 흐름',
    timingHint: '다음 약속을 잡아도 되는 타이밍',
    caution: '예의와 호감을 헷갈리기 쉬운 지점',
    actions: '첫 만남 뒤 해볼 실천',
    reflectionQuestion: '이 만남을 더 이어도 되는지 묻는 질문'
  },
  COMPAT_ROMANCE_FRIEND_TO_LOVER: {
    narrativeFlow: '친구에서 연인 궁합 풀이',
    relationshipFlow: '친구 선을 넘어가는 흐름',
    timingHint: '감정을 꺼내도 되는 타이밍',
    caution: '어색함이 오래 남기 쉬운 지점',
    actions: '관계를 흐리지 않는 실천',
    reflectionQuestion: '이 감정을 꺼냈을 때 지키고 싶은 것을 묻는 질문'
  },
  COMPAT_ROMANCE_GHOSTED: {
    narrativeFlow: '끊긴 흐름 궁합 풀이',
    relationshipFlow: '다시 닿는 관계 흐름',
    timingHint: '다시 말을 꺼내도 되는 타이밍',
    caution: '침묵을 혼자 해석하기 쉬운 지점',
    actions: '다시 닿기 전에 해볼 정리',
    reflectionQuestion: '이 관계를 다시 열 이유가 남아 있는지 묻는 질문'
  },
  COMPAT_ROMANCE_LEFT_ON_READ: {
    narrativeFlow: '읽씹 궁합 풀이',
    relationshipFlow: '연락 뒤 관계가 이어지는 흐름',
    timingHint: '연락을 다시 넣어도 되는 타이밍',
    caution: '답장 하나에 의미를 키우기 쉬운 지점',
    actions: '연락 전에 해볼 실천',
    reflectionQuestion: '이 연락을 다시 열 이유를 묻는 질문'
  },
  COMPAT_FRIEND_BEST: {
    narrativeFlow: '베프 궁합 풀이',
    relationshipFlow: '오래 가는 우정 흐름',
    timingHint: '서운함을 말하기 좋은 타이밍',
    caution: '익숙함이 무례가 되기 쉬운 지점',
    actions: '우정을 오래 가게 하는 실천',
    reflectionQuestion: '이 우정에서 당연하게 여긴 것을 묻는 질문'
  },
  COMPAT_FRIEND_CUT_OFF: {
    narrativeFlow: '손절 고민 궁합 풀이',
    relationshipFlow: '거리를 조절하는 우정 흐름',
    timingHint: '거리를 두어도 되는 타이밍',
    caution: '죄책감이 판단을 흐리기 쉬운 지점',
    actions: '거리 조절 전에 해볼 실천',
    reflectionQuestion: '이 우정을 지켜야 하는지 묻는 질문'
  },
  COMPAT_FRIEND_TRAVEL: {
    narrativeFlow: '여행 궁합 풀이',
    relationshipFlow: '같이 움직일 때의 우정 흐름',
    timingHint: '같이 움직이기 좋은 타이밍',
    caution: '피로가 쌓이기 쉬운 지점',
    actions: '여행 전에 맞춰둘 실천',
    reflectionQuestion: '이 여행에서 가장 중요한 기준을 묻는 질문'
  },
  COMPAT_FRIEND_ROOMMATE: {
    narrativeFlow: '룸메이트 궁합 풀이',
    relationshipFlow: '같이 살 때의 생활 흐름',
    timingHint: '생활 선을 맞추기 좋은 타이밍',
    caution: '작은 생활 마찰이 커지기 쉬운 지점',
    actions: '같이 살기 전에 맞출 실천',
    reflectionQuestion: '편하게 살려면 꼭 필요한 기준을 묻는 질문'
  },
  COMPAT_WORK_COWORKER: {
    narrativeFlow: '직장 동료 궁합 풀이',
    wealthFlow: '협업 성과의 흐름',
    timingHint: '협업 기준을 맞출 타이밍',
    caution: '작은 기준 차이가 커지기 쉬운 지점',
    actions: '협업 피로를 줄이는 실천',
    reflectionQuestion: '이 협업에서 먼저 맞춰야 할 기준을 묻는 질문'
  },
  COMPAT_WORK_BOSS: {
    narrativeFlow: '상사 궁합 풀이',
    wealthFlow: '보고와 성과의 흐름',
    timingHint: '보고 흐름을 다시 맞출 타이밍',
    caution: '눈치로 버티기 쉬운 지점',
    actions: '상사와 일할 때 해볼 실천',
    reflectionQuestion: '이 관계에서 먼저 확인해야 할 기준을 묻는 질문'
  },
  COMPAT_WORK_DIFFICULT_BOSS: {
    narrativeFlow: '까다로운 상사 궁합 풀이',
    wealthFlow: '소모를 줄이는 업무 흐름',
    timingHint: '기준을 다시 확인할 타이밍',
    caution: '감정 소모가 커지기 쉬운 지점',
    actions: '덜 부딪히는 실천',
    reflectionQuestion: '버티는 것과 조정하는 것 중 무엇이 필요한지 묻는 질문'
  },
  COMPAT_WORK_BUSINESS_PARTNER: {
    narrativeFlow: '동업 궁합 풀이',
    wealthFlow: '같이 벌고 책임지는 흐름',
    timingHint: '역할과 돈 기준을 정할 타이밍',
    caution: '신뢰만으로 밀기 쉬운 지점',
    actions: '동업 전에 맞출 실천',
    reflectionQuestion: '같이 벌기 전에 같이 책임질 수 있는지를 묻는 질문'
  },
  COMPAT_WORK_WORK_DUMPER: {
    narrativeFlow: '일이 쏠리는 동료 궁합 풀이',
    wealthFlow: '일이 몰리는 흐름',
    timingHint: '선을 다시 그을 타이밍',
    caution: '억울함을 오래 참기 쉬운 지점',
    actions: '일이 쏠릴 때 해볼 실천',
    reflectionQuestion: '이 관계에서 어디까지 맡을지 묻는 질문'
  },
  COMPAT_FAMILY_MOTHER_DAUGHTER: {
    narrativeFlow: '엄마와 딸 궁합 풀이',
    relationshipFlow: '기대와 간섭의 관계 흐름',
    timingHint: '말 순서를 바꿀 타이밍',
    caution: '사랑이 간섭으로 느껴지기 쉬운 지점',
    actions: '덜 상처받는 실천',
    reflectionQuestion: '사랑과 간섭의 선이 어디인지 묻는 질문'
  },
  COMPAT_FAMILY_PARENT_CHILD: {
    narrativeFlow: '부모와 자식 궁합 풀이',
    relationshipFlow: '보호와 기대의 관계 흐름',
    timingHint: '기대를 다시 말할 타이밍',
    caution: '걱정이 통제로 바뀌기 쉬운 지점',
    actions: '거리를 살리는 실천',
    reflectionQuestion: '이 관계에서 지켜야 할 거리를 묻는 질문'
  },
  COMPAT_FAMILY_MOTHER_IN_LAW: {
    narrativeFlow: '시어머니와의 궁합 풀이',
    relationshipFlow: '예의와 거리의 관계 흐름',
    timingHint: '기대 역할을 조정할 타이밍',
    caution: '예민함이 쌓이기 쉬운 지점',
    actions: '거리와 예의를 지키는 실천',
    reflectionQuestion: '편안함을 위해 필요한 선이 무엇인지 묻는 질문'
  },
  COMPAT_MISC_IDOL: {
    narrativeFlow: '아이돌 궁합 풀이',
    timingHint: '마음을 건강하게 두는 타이밍',
    caution: '현실 감각이 흐려지기 쉬운 지점',
    actions: '덕질 리듬을 지키는 실천',
    reflectionQuestion: '이 마음이 내 일상에 주는 것을 묻는 질문'
  }
};

function getFocusedSelfDetailTitle(
  subjectCode: string,
  subjectType: SelfSubjectType,
  section: DetailSectionKey
): string {
  const override = FOCUSED_SELF_DETAIL_TITLE_OVERRIDES[subjectCode]?.[section];
  if (override) {
    return override;
  }

  switch (section) {
    case 'narrativeFlow':
      return getFocusedNarrativeTitle(subjectCode, subjectType);
    case 'subjectLens':
      return getFocusedSubjectLensTitle(subjectCode, subjectType);
    case 'currentDaewoon':
      return getCurrentDaewoonTitle('SELF', subjectCode, subjectType);
    case 'yearlyFlow':
      return getYearlyFlowTitle('SELF', subjectCode, subjectType);
    case 'tenYearFlow':
      return getTenYearFlowTitle('SELF', subjectCode, subjectType);
    case 'wealthFlow':
    case 'relationshipFlow':
      return (
        getFocusedPrimaryFlowTitle(subjectCode, subjectType) ||
        DETAIL_SECTION_TITLE[section]
      );
    default:
      return (
        FOCUSED_SELF_SUBJECT_DETAIL_TITLE[subjectType]?.[section] ??
        DETAIL_SECTION_TITLE[section]
      );
  }
}

function getCompatibilitySectionTitle(
  subjectType: string,
  section: DetailSectionKey
): string {
  const override = COMPATIBILITY_DETAIL_TITLE_OVERRIDES[subjectType]?.[section];
  if (override) {
    return override;
  }

  switch (section) {
    case 'subjectLens':
    case 'pairDynamic':
    case 'attractionPoint':
    case 'conflictTrigger':
    case 'communicationTip':
      return getCompatibilityDetailTitle(subjectType, section);
    case 'narrativeFlow':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '업무 궁합 풀이';
      }
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '가족 관계 궁합 풀이';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '우정 궁합 풀이';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '연애 궁합 풀이';
      }
      if (subjectType.startsWith('COMPAT_MISC_')) {
        return '이 궁합 풀이';
      }
      return DETAIL_SECTION_TITLE.narrativeFlow;
    case 'currentDaewoon':
      return getCurrentDaewoonTitle('COMPATIBILITY', subjectType, null);
    case 'yearlyFlow':
      return getYearlyFlowTitle('COMPATIBILITY', subjectType, null);
    case 'tenYearFlow':
      return getTenYearFlowTitle('COMPATIBILITY', subjectType, null);
    case 'timingHint':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '협업 기준을 맞추는 타이밍';
      }
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '기대와 거리를 조정하는 타이밍';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '거리와 말의 선을 맞추는 타이밍';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '감정 속도를 맞추는 타이밍';
      }
      if (subjectType.startsWith('COMPAT_MISC_')) {
        return '이 마음을 다루는 타이밍';
      }
      return DETAIL_SECTION_TITLE.timingHint;
    case 'relationshipFlow':
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '이 관계의 거리감 흐름';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '이 우정이 이어지는 흐름';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '이 관계가 이어지는 흐름';
      }
      return DETAIL_SECTION_TITLE.relationshipFlow;
    case 'wealthFlow':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '함께 성과를 내는 흐름';
      }
      return DETAIL_SECTION_TITLE.wealthFlow;
    case 'caution':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '기준 차이를 감정 문제로 오해하기 쉬운 지점';
      }
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '가까움이 부담이 되기 쉬운 지점';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '편함이 상처가 되기 쉬운 지점';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '감정이 앞서기 쉬운 지점';
      }
      if (subjectType.startsWith('COMPAT_MISC_')) {
        return '마음을 크게 싣기 쉬운 지점';
      }
      return DETAIL_SECTION_TITLE.caution;
    case 'actions':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '지금 협업에서 해볼 실천';
      }
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '지금 가족 관계에서 해볼 실천';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '지금 우정에서 해볼 실천';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '지금 관계에서 해볼 실천';
      }
      if (subjectType.startsWith('COMPAT_MISC_')) {
        return '지금 마음을 다루는 실천';
      }
      return DETAIL_SECTION_TITLE.actions;
    case 'reflectionQuestion':
      if (subjectType.startsWith('COMPAT_WORK_')) {
        return '이 업무 관계에서 다시 물어볼 질문';
      }
      if (subjectType.startsWith('COMPAT_FAMILY_')) {
        return '이 가족 관계에서 다시 물어볼 질문';
      }
      if (subjectType.startsWith('COMPAT_FRIEND_')) {
        return '이 우정에서 다시 물어볼 질문';
      }
      if (subjectType.startsWith('COMPAT_ROMANCE_')) {
        return '이 관계에서 다시 물어볼 질문';
      }
      if (subjectType.startsWith('COMPAT_MISC_')) {
        return '이 궁합에서 다시 물어볼 질문';
      }
      return DETAIL_SECTION_TITLE.reflectionQuestion;
    default:
      return DETAIL_SECTION_TITLE[section];
  }
}

function getSectionAnchorId(section: DetailSectionKey): string {
  return `detail-section-${section}`;
}

function getResolvedSectionTitle(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  focusedSelfSubject: SelfSubjectType | null,
  section: DetailSectionKey
): string {
  if (readingType === 'COMPATIBILITY') {
    return getCompatibilitySectionTitle(subjectType, section);
  }

  if (focusedSelfSubject) {
    return getFocusedSelfDetailTitle(subjectType, focusedSelfSubject, section);
  }

  switch (section) {
    case 'currentDaewoon':
      return getCurrentDaewoonTitle('SELF', subjectType, focusedSelfSubject);
    case 'yearlyFlow':
      return getYearlyFlowTitle('SELF', subjectType, focusedSelfSubject);
    case 'tenYearFlow':
      return getTenYearFlowTitle('SELF', subjectType, focusedSelfSubject);
    default:
      return DETAIL_SECTION_TITLE[section];
  }
}

const SELF_RELATION_SUBJECTS = new Set<SelfSubjectType>([
  'ROMANCE',
  'MARRIAGE',
  'RELATIONSHIPS',
  'FAMILY'
]);

const SELF_WORK_MONEY_SUBJECTS = new Set<SelfSubjectType>(['CAREER', 'WEALTH']);
const SELF_SHOW_TEN_YEAR_SUBJECTS = new Set<SelfSubjectType>([
  'LIFETIME_FLOW',
  'DAEUN',
  'YEAR_MONTH_DAY_FORTUNE',
  'CAREER',
  'WEALTH',
  'ROMANCE',
  'MARRIAGE',
  'RELATIONSHIPS',
  'FAMILY',
  'LUCK_UP'
]);
const SELF_SHOW_CURRENT_DAEUN_SUBJECTS = new Set<SelfSubjectType>([
  'LIFETIME_FLOW',
  'DAEUN',
  'YEAR_MONTH_DAY_FORTUNE',
  'CAREER',
  'WEALTH',
  'ROMANCE',
  'MARRIAGE',
  'RELATIONSHIPS',
  'FAMILY',
  'LUCK_UP'
]);
const SELF_SHOW_YEARLY_FLOW_SUBJECTS = new Set<SelfSubjectType>([
  'LIFETIME_FLOW',
  'DAEUN',
  'CAREER',
  'WEALTH',
  'ROMANCE',
  'MARRIAGE',
  'RELATIONSHIPS',
  'FAMILY',
  'YEAR_MONTH_DAY_FORTUNE',
  'LUCK_UP'
]);

function isSelfSubjectType(value: string): value is SelfSubjectType {
  return value in SELF_SUBJECT_LABEL;
}

function getFocusedNarrativeTitle(
  subjectCode: string,
  subjectType: SelfSubjectType
): string {
  switch (subjectCode) {
    case 'SELF_BASIC':
      return '기본 해석 풀이';
    case 'SELF_LIFETIME_FLOW':
      return '평생 총운 풀이';
    case 'SELF_DAEUN':
      return '현재 대운 풀이';
    case 'SELF_LUCK_UP':
      return '개운법(운을 살리는 생활 루틴) 풀이';
    case 'SELF_LOVE_RECONCILIATION':
      return '재회 가능성 풀이';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락 올까 풀이';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 타이밍 풀이';
    case 'SELF_CAREER_APTITUDE':
      return '적성 풀이';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 타이밍 풀이';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 모이는 흐름 풀이';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새는 이유 풀이';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '손절 타이밍 풀이';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계 풀이';
  }

  switch (subjectType) {
    case 'CAREER':
      return '직업운 풀이';
    case 'WEALTH':
      return '재물운 풀이';
    case 'ROMANCE':
      return '연애운 풀이';
    case 'MARRIAGE':
      return '결혼운 풀이';
    case 'RELATIONSHIPS':
      return '인간관계운 풀이';
    case 'FAMILY':
      return '가족운 풀이';
    case 'LIFETIME_FLOW':
      return '평생 총운 풀이';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '지금 시기의 운 풀이';
    case 'DAEUN':
      return '대운 풀이';
    case 'LUCK_UP':
      return '개운 풀이';
    case 'BASIC':
    default:
      return DETAIL_SECTION_TITLE.narrativeFlow;
  }
}

function getFocusedSubjectLensTitle(
  subjectCode: string,
  subjectType: SelfSubjectType
): string {
  switch (subjectCode) {
    case 'SELF_BASIC':
      return '기본 해석에서 볼 점';
    case 'SELF_LIFETIME_FLOW':
      return '평생 흐름에서 볼 점';
    case 'SELF_DAEUN':
      return '현재 대운에서 볼 점';
    case 'SELF_LUCK_UP':
      return '개운에서 먼저 볼 점';
    case 'SELF_LOVE_RECONCILIATION':
      return '재회에서 먼저 볼 점';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락에서 먼저 볼 점';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 전에 볼 점';
    case 'SELF_CAREER_APTITUDE':
      return '적성에서 먼저 볼 점';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 전에 볼 점';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 붙는 자리에서 볼 점';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새는 틈에서 볼 점';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '관계를 정리하기 전에 볼 점';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계에서 볼 점';
  }

  switch (subjectType) {
    case 'CAREER':
      return '직업운에서 볼 점';
    case 'WEALTH':
      return '재물운에서 볼 점';
    case 'ROMANCE':
      return '연애운에서 볼 점';
    case 'MARRIAGE':
      return '결혼운에서 볼 점';
    case 'RELATIONSHIPS':
      return '인간관계에서 볼 점';
    case 'FAMILY':
      return '가족운에서 볼 점';
    case 'LIFETIME_FLOW':
      return '긴 흐름에서 볼 점';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '지금 시기에서 볼 점';
    case 'DAEUN':
      return '대운에서 볼 점';
    case 'LUCK_UP':
      return '개운 포인트';
    case 'BASIC':
    default:
      return DETAIL_SECTION_TITLE.subjectLens;
  }
}

function getFocusedPrimaryFlowTitle(
  subjectCode: string,
  subjectType: SelfSubjectType
): string {
  switch (subjectCode) {
    case 'SELF_BASIC':
      return '전체 운의 흐름';
    case 'SELF_LIFETIME_FLOW':
      return '평생 운의 흐름';
    case 'SELF_DAEUN':
      return '현재 대운 흐름';
    case 'SELF_LUCK_UP':
      return '운을 살리는 흐름';
    case 'SELF_LOVE_RECONCILIATION':
      return '재회 흐름';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락 흐름';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 흐름';
    case 'SELF_CAREER_APTITUDE':
      return '적성 흐름';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 흐름';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 붙는 흐름';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새는 흐름';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '거리 조절 흐름';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계 흐름';
  }

  switch (subjectType) {
    case 'CAREER':
      return '직업운 흐름';
    case 'WEALTH':
      return '재물운 흐름';
    case 'ROMANCE':
      return '연애운 흐름';
    case 'MARRIAGE':
      return '결혼운 흐름';
    case 'RELATIONSHIPS':
      return '인간관계운 흐름';
    case 'FAMILY':
      return '가족운 흐름';
    default:
      return '';
  }
}

function getReadingIntroDescription(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  focusedSelfSubject: SelfSubjectType | null
): string {
  if (readingType === 'COMPATIBILITY') {
    if (subjectType === 'COMPAT_BASIC') {
      return '두 사람이 편안해지는 흐름과 자주 어긋나는 지점부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_LEFT_ON_READ') {
      return '먼저 침묵이 길어진 이유부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_GHOSTED') {
      return '먼저 흐름이 끊긴 지점부터 짚어보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_EX') {
      return '다시 만나도 달라질 수 있는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_LOVER') {
      return '지금 관계가 더 편안해질 수 있는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_MARRIAGE_PARTNER') {
      return '오래 함께 살 기준이 맞는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_MARRIED') {
      return '같이 사는 리듬이 맞는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_BLIND_DATE') {
      return '첫인상보다 다음 흐름이 붙는지 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_CRUSH') {
      return '왜 자꾸 마음이 가는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_FLIRTING') {
      return '설렘의 속도가 같이 붙는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_FRIEND_TO_LOVER') {
      return '편안함이 설렘으로 번질 여지가 있는지 보세요.';
    }

    if (subjectType.startsWith('COMPAT_ROMANCE_')) {
      return '두 사람의 속도부터 맞는지 보세요.';
    }

    if (subjectType === 'COMPAT_FRIEND_CUT_OFF') {
      return '지킬 관계인지 거리 둘 관계인지부터 보세요.';
    }

    if (subjectType === 'COMPAT_FRIEND_TRAVEL') {
      return '같이 움직일 때 편안한지부터 보세요.';
    }

    if (subjectType === 'COMPAT_FRIEND_BEST') {
      return '오래 봐도 편안한지부터 보세요.';
    }

    if (subjectType === 'COMPAT_FRIEND_ROOMMATE') {
      return '같이 살아도 덜 지치는지부터 보세요.';
    }

    if (subjectType.startsWith('COMPAT_FRIEND_')) {
      return '편안함과 거리감이 함께 맞는지 보세요.';
    }

    if (subjectType === 'COMPAT_WORK_BOSS') {
      return '상사와는 보고 리듬부터 맞는지 보세요.';
    }

    if (subjectType === 'COMPAT_WORK_DIFFICULT_BOSS') {
      return '덜 부딪히는 기준이 무엇인지부터 보세요.';
    }

    if (subjectType === 'COMPAT_WORK_BUSINESS_PARTNER') {
      return '역할과 책임의 선부터 맞는지 보세요.';
    }

    if (subjectType === 'COMPAT_WORK_COWORKER') {
      return '같이 일할 기준이 맞는지부터 보세요.';
    }

    if (subjectType === 'COMPAT_WORK_WORK_DUMPER') {
      return '어디서 일이 쏠리는지부터 보세요.';
    }

    if (subjectType.startsWith('COMPAT_WORK_')) {
      return '함께 일할 기준과 호흡부터 보세요.';
    }

    if (subjectType === 'COMPAT_FAMILY_MOTHER_DAUGHTER') {
      return '사랑과 걱정이 엇갈리는 지점부터 보세요.';
    }

    if (subjectType === 'COMPAT_FAMILY_MOTHER_IN_LAW') {
      return '기대 역할과 거리의 선부터 보세요.';
    }

    if (subjectType === 'COMPAT_FAMILY_PARENT_CHILD') {
      return '걱정과 기대가 어긋나는 지점부터 보세요.';
    }

    if (subjectType.startsWith('COMPAT_FAMILY_')) {
      return '가까운 사이일수록 어떤 기대가 쌓이는지 보세요.';
    }

    if (subjectType === 'COMPAT_MISC_IDOL') {
      return '왜 강하게 끌리는지부터 보세요.';
    }

    if (subjectType.startsWith('COMPAT_MISC_')) {
      return '왜 강하게 끌리는지부터 보세요.';
    }

    return '이 관계에서 가장 먼저 봐야 할 흐름부터 읽어보세요.';
  }

  switch (focusedSelfSubject) {
    case null:
      if (subjectType === 'SELF_BASIC') {
        return '지금 내 결이 어떻게 드러나는지부터 보세요.';
      }
      if (subjectType === 'SELF_LIFETIME_FLOW') {
        return '내 삶에서 반복되는 운의 결부터 보세요.';
      }
      if (subjectType === 'SELF_DAEUN') {
        return '지금 10년이 어디를 밀고 있는지부터 보세요.';
      }
      if (subjectType === 'SELF_LUCK_UP') {
        return '지금 바꾸면 좋은 생활 기준부터 보세요.';
      }
      if (subjectType === 'SELF_LOVE_RECONCILIATION') {
        return '다시 이어져도 괜찮을지부터 보세요.';
      }
      if (subjectType === 'SELF_LOVE_GENERAL') {
        return '지금 마음이 어디로 향하는지부터 보세요.';
      }
      if (subjectType === 'SELF_LOVE_CONTACT_RETURN') {
        return '기다릴지 움직일지부터 보세요.';
      }
      if (subjectType === 'SELF_LOVE_CONFESSION_TIMING') {
        return '지금 마음을 꺼내도 되는지부터 보세요.';
      }
      if (subjectType === 'SELF_CAREER_JOB_CHANGE') {
        return '지금 옮길지 더 다질지부터 보세요.';
      }
      if (subjectType === 'SELF_CAREER_GENERAL') {
        return '지금 내 일이 맞는 방향인지부터 보세요.';
      }
      if (subjectType === 'SELF_CAREER_APTITUDE') {
        return '오래 힘이 붙는 일이 무엇인지부터 보세요.';
      }
      if (subjectType === 'SELF_WEALTH_GENERAL') {
        return '지금 돈이 붙고 새는 지점부터 보세요.';
      }
      if (subjectType === 'SELF_WEALTH_ACCUMULATION') {
        return '돈이 붙는 길부터 보세요.';
      }
      if (subjectType === 'SELF_WEALTH_LEAK') {
        return '돈이 새는 틈부터 보세요.';
      }
      if (subjectType === 'SELF_RELATIONSHIP_CUT_OFF') {
        return '관계를 지킬지 거리를 둘지부터 보세요.';
      }
      if (subjectType === 'SELF_RELATIONSHIP_GENERAL') {
        return '지금 나를 살리는 관계부터 보세요.';
      }
      if (subjectType === 'SELF_FAMILY_GENERAL') {
        return '가족 안의 기대와 거리부터 보세요.';
      }
      if (subjectType === 'SELF_FAMILY_PARENTS') {
        return '부모와의 거리부터 보세요.';
      }
      if (subjectType === 'SELF_YEARLY_FORTUNE') {
        return '올해 어디에 힘을 써야 하는지부터 보세요.';
      }
      if (subjectType === 'SELF_DAILY_FORTUNE') {
        return '오늘 힘을 써야 할 한 가지부터 보세요.';
      }
      return '타고난 사주 위에 지금 들어온 운의 방향부터 보세요.';
    case 'CAREER':
      return '일의 방향부터 보세요.';
    case 'WEALTH':
      return '돈의 흐름부터 보세요.';
    case 'ROMANCE':
      return '마음이 향하는 방향부터 보세요.';
    case 'MARRIAGE':
      return '오래 편안한 관계의 결부터 보세요.';
    case 'RELATIONSHIPS':
      return '사람 사이의 거리부터 보세요.';
    case 'FAMILY':
      return '가족 안의 기대와 거리부터 보세요.';
    case 'LIFETIME_FLOW':
      return '길게 이어지는 운의 방향부터 보세요.';
    case 'DAEUN':
      return '지금 10년 운의 결부터 보세요.';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '지금 시기에 들어온 운부터 보세요.';
    case 'LUCK_UP':
      return '지금 운을 살리는 기준부터 보세요.';
    case 'BASIC':
    default:
      return '타고난 사주 위에 지금 들어온 운의 방향부터 보세요.';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDisplaySummary(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  summary: string | null
): string | null {
  if (!summary) {
    return null;
  }

  let normalized = summary.trim();
  normalized = normalized
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim();

  const label = getScenarioLabel(readingType, subjectType);
  const labelCandidates = [
    label,
    label.replace(/\s*해석$/, '').trim(),
    label.replace(/\s*궁합$/, '').trim()
  ].filter(Boolean);

  for (const candidate of labelCandidates) {
    const labelPrefix = new RegExp(`^${escapeRegExp(candidate)}\\s*:\\s*`);
    normalized = normalized.replace(labelPrefix, '').trim();
  }

  normalized = normalized
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim();

  return normalized || null;
}

function getCurrentDaewoonTitle(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  focusedSelfSubject: SelfSubjectType | null
): string {
  if (readingType === 'COMPATIBILITY') {
    if (subjectType.startsWith('COMPAT_WORK_')) {
      return '함께 일할 때 깔린 큰 흐름';
    }
    if (subjectType.startsWith('COMPAT_FAMILY_')) {
      return '지금 관계에 깔린 큰 흐름';
    }
    if (subjectType.startsWith('COMPAT_MISC_')) {
      return '지금 이 궁합의 큰 흐름';
    }
    return '지금 두 사람 사이의 큰 흐름';
  }

  switch (subjectType) {
    case 'SELF_LOVE_RECONCILIATION':
      return '다시 이어질 힘이 붙는 큰 운';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락을 기다릴 때 깔린 큰 운';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '마음을 꺼내기 전 깔린 큰 운';
    case 'SELF_CAREER_APTITUDE':
      return '일의 결이 맞아드는 큰 운';
    case 'SELF_CAREER_JOB_CHANGE':
      return '옮길 자리를 가르는 큰 운';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 붙기 시작하는 큰 운';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새기 쉬운 틈을 만드는 큰 운';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '관계를 정리하게 되는 큰 운';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 거리감에 깔린 큰 운';
  }

  switch (focusedSelfSubject) {
    case 'CAREER':
      return '일에서 힘이 붙는 큰 운';
    case 'WEALTH':
      return '돈을 다루는 큰 운';
    case 'ROMANCE':
    case 'MARRIAGE':
    case 'RELATIONSHIPS':
    case 'FAMILY':
      return '관계에 깔린 큰 운';
    case 'LUCK_UP':
      return '지금 바꾸기 좋은 큰 흐름';
    case 'DAEUN':
    case 'LIFETIME_FLOW':
    case 'BASIC':
    case null:
    default:
      return '지금 들어온 큰 운';
  }
}

function getYearlyFlowTitle(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  focusedSelfSubject: SelfSubjectType | null
): string {
  if (readingType === 'COMPATIBILITY') {
    if (subjectType.startsWith('COMPAT_WORK_')) {
      return '올해 함께 일하는 흐름';
    }
    if (subjectType.startsWith('COMPAT_FAMILY_')) {
      return '올해 가족 관계 흐름';
    }
    if (subjectType.startsWith('COMPAT_MISC_')) {
      return '올해 이 궁합의 흐름';
    }
    return '올해 관계 흐름';
  }

  switch (subjectType) {
    case 'SELF_LOVE_RECONCILIATION':
      return '올해 다시 닿을 흐름';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '올해 다시 연락이 닿을 흐름';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '올해 마음을 꺼내기 좋은 흐름';
    case 'SELF_CAREER_APTITUDE':
      return '올해 내 일이 맞아드는 흐름';
    case 'SELF_CAREER_JOB_CHANGE':
      return '올해 옮겨도 되는 흐름';
    case 'SELF_WEALTH_ACCUMULATION':
      return '올해 돈이 붙는 흐름';
    case 'SELF_WEALTH_LEAK':
      return '올해 돈이 새기 쉬운 흐름';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '올해 거리를 조절해야 하는 흐름';
    case 'SELF_FAMILY_PARENTS':
      return '올해 부모와의 관계 흐름';
  }

  switch (focusedSelfSubject) {
    case 'CAREER':
      return '올해 일의 흐름';
    case 'WEALTH':
      return '올해 돈의 흐름';
    case 'ROMANCE':
      return '올해 연애 흐름';
    case 'MARRIAGE':
      return '올해 관계 흐름';
    case 'RELATIONSHIPS':
      return '올해 인간관계 흐름';
    case 'FAMILY':
      return '올해 가족 흐름';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '지금 시기의 흐름';
    case 'LUCK_UP':
      return '올해 바꾸기 좋은 흐름';
    case 'LIFETIME_FLOW':
    case 'BASIC':
    case null:
    default:
      return '올해 들어온 운';
  }
}

function getTenYearFlowTitle(
  readingType: 'SELF' | 'COMPATIBILITY',
  subjectType: string,
  focusedSelfSubject: SelfSubjectType | null
): string {
  if (readingType === 'COMPATIBILITY') {
    if (subjectType.startsWith('COMPAT_WORK_')) {
      return '앞으로 이어질 협업 흐름';
    }
    if (subjectType.startsWith('COMPAT_FAMILY_')) {
      return '앞으로 이어질 관계 흐름';
    }
    if (subjectType.startsWith('COMPAT_MISC_')) {
      return '앞으로 이어질 궁합 흐름';
    }
    return '앞으로 이어질 관계 흐름';
  }

  switch (subjectType) {
    case 'SELF_LOVE_RECONCILIATION':
      return '앞으로 다시 엮일 수 있는 흐름';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '앞으로 연락의 흐름이 바뀌는 방향';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '앞으로 마음을 꺼내기 좋은 방향';
    case 'SELF_CAREER_APTITUDE':
      return '앞으로 일의 결이 맞아드는 방향';
    case 'SELF_CAREER_JOB_CHANGE':
      return '앞으로 자리를 옮기는 방향';
    case 'SELF_WEALTH_ACCUMULATION':
      return '앞으로 돈이 붙는 방향';
    case 'SELF_WEALTH_LEAK':
      return '앞으로 돈의 틈을 막아야 하는 방향';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '앞으로 관계 정리가 필요한 방향';
    case 'SELF_FAMILY_PARENTS':
      return '앞으로 부모와의 거리감이 바뀌는 방향';
  }

  switch (focusedSelfSubject) {
    case 'CAREER':
      return '앞으로 이어질 일의 흐름';
    case 'WEALTH':
      return '앞으로 이어질 돈의 흐름';
    case 'ROMANCE':
    case 'MARRIAGE':
    case 'RELATIONSHIPS':
    case 'FAMILY':
      return '앞으로 이어질 관계 흐름';
    case 'DAEUN':
    case 'LIFETIME_FLOW':
    case 'BASIC':
    case null:
    default:
      return '앞으로 이어질 10년';
  }
}

export default function SajuReadingDetailPage() {
  const router = useRouter();
  const params = useParams<{ readingId: string }>();
  const readingId = params.readingId;
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState<ReadingDetail | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingReading, setDeletingReading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await fetchClientSession();
      setIsAuthenticated(session.authenticated);
      setSessionReady(true);
    };

    void checkSession();
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    const fetchReading = async () => {
      setLoading(true);
      setStatus('');

      try {
        const response = await fetch(`/api/v1/saju/readings/${readingId}`);

        const payload = (await response.json()) as {
          reading?: ReadingDetail;
          error?: string;
        };

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (!response.ok || !payload.reading) {
          setStatus(
            payload.error ??
              '사주 해석을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }

        setReading(payload.reading);
      } finally {
        setLoading(false);
      }
    };

    void fetchReading();
  }, [sessionReady, isAuthenticated, readingId, router]);

  const actions = useMemo(() => {
    const list = reading?.sectionsJson?.actions;
    if (!list || !Array.isArray(list)) {
      return [];
    }
    return list;
  }, [reading]);

  const focusedSelfSubject = useMemo(() => {
    if (!reading || reading.readingType !== 'SELF') {
      return null;
    }

    const resolvedSubjectType =
      getLegacySubjectTypeFromCode(reading.subjectType) ?? reading.subjectType;
    if (!isSelfSubjectType(resolvedSubjectType)) {
      return null;
    }

    return resolvedSubjectType === 'BASIC' ? null : resolvedSubjectType;
  }, [reading]);

  const showFocusedSelfLayout = focusedSelfSubject !== null;

  const sectionOrder = useMemo<DetailSectionKey[]>(() => {
    if (!reading) {
      return BASIC_SELF_SECTION_ORDER;
    }

    if (reading.readingType === 'COMPATIBILITY') {
      return getCompatibilitySectionOrder(reading.subjectType);
    }

    if (focusedSelfSubject) {
      return getFocusedSelfSectionOrder(
        reading.subjectType,
        focusedSelfSubject
      );
    }

    return BASIC_SELF_SECTION_ORDER;
  }, [focusedSelfSubject, reading]);

  const readingIntroDescription = useMemo(() => {
    if (!reading) {
      return '지금 들어온 운이 어디로 향하는지부터 보세요.';
    }

    return getReadingIntroDescription(
      reading.readingType,
      reading.subjectType,
      focusedSelfSubject
    );
  }, [focusedSelfSubject, reading]);

  const displaySummary = useMemo(() => {
    if (!reading) {
      return null;
    }

    return getDisplaySummary(
      reading.readingType,
      reading.subjectType,
      reading.summary
    );
  }, [reading]);

  const quickJumpSections = useMemo(() => {
    if (!reading) {
      return [];
    }

    return DETAIL_QUICK_JUMP_KEYS.filter((sectionKey) => {
      switch (sectionKey) {
        case 'overview':
          return Boolean(reading.sectionsJson?.overview);
        case 'coreSignal':
          return Boolean(reading.sectionsJson?.coreSignal);
        case 'sajuBasis':
          return Boolean(reading.sectionsJson?.sajuBasis);
        case 'sajuEvidence':
          return Boolean(
            reading.sectionsJson?.sajuEvidence &&
            Array.isArray(reading.sectionsJson.sajuEvidence) &&
            reading.sectionsJson.sajuEvidence.length > 0
          );
        case 'relationshipFlow':
          return Boolean(
            reading.sectionsJson?.relationshipFlow &&
            (!showFocusedSelfLayout ||
              (focusedSelfSubject !== null &&
                SELF_RELATION_SUBJECTS.has(focusedSelfSubject)))
          );
        case 'wealthFlow':
          return Boolean(
            reading.sectionsJson?.wealthFlow &&
            (!showFocusedSelfLayout ||
              (focusedSelfSubject !== null &&
                SELF_WORK_MONEY_SUBJECTS.has(focusedSelfSubject)))
          );
        case 'timingHint':
          return Boolean(reading.sectionsJson?.timingHint);
        case 'actions':
          return actions.length > 0;
        default:
          return false;
      }
    }).map((sectionKey) => ({
      key: sectionKey,
      label:
        DETAIL_QUICK_JUMP_LABEL[sectionKey] ??
        getResolvedSectionTitle(
          reading.readingType,
          reading.subjectType,
          focusedSelfSubject,
          sectionKey
        )
    }));
  }, [actions, focusedSelfSubject, reading, showFocusedSelfLayout]);

  const onDeleteReading = async () => {
    setDeletingReading(true);
    setStatus('');

    try {
      const response = await fetch(`/api/v1/saju/readings/${readingId}`, {
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
        setStatus(
          payload.error ??
            '해석 기록을 정리하는 흐름이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      router.push('/dashboard');
    } catch {
      setStatus(
        '해석 기록을 정리하는 중 흐름이 잠시 끊겼어요. 다시 시도해 주세요.'
      );
    } finally {
      setDeletingReading(false);
    }
  };

  if (!sessionReady || loading) {
    return (
      <PageLoadingState
        title="사주 풀이를 펼치고 있어요."
        description="타고난 사주와 지금 읽어야 할 운의 방향을 함께 불러오고 있어요."
        shellClassName="theme-spring-shell--subtle"
        pageClassName="theme-reading-paper max-w-3xl"
      />
    );
  }

  return (
    <main className="theme-reading-paper theme-spring-shell theme-spring-shell--subtle mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-3 py-5 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-2 sm:space-y-3">
          <ThemedBrandLogo
            className="h-8 w-auto max-w-[156px] sm:h-10 sm:max-w-[220px]"
            width={220}
            height={66}
            priority
          />
          <h1 className="text-xl font-bold sm:text-2xl">풀이 보기</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {readingIntroDescription}
          </p>
          <div className="theme-divider" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Link href="/dashboard">MBTI 사주로 돌아가기</Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setOpenDeleteDialog(true)}
          >
            삭제하기
          </Button>
        </div>
      </header>

      {reading ? (
        <Card className="theme-card-ornament theme-reading-intro theme-surface">
          <CardHeader className="pb-2 sm:pb-6">
            <CardTitle>
              {getScenarioResultTitle(reading.readingType, reading.subjectType)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Badge variant="secondary">
                {getScenarioLabel(reading.readingType, reading.subjectType)}
              </Badge>
              <Badge variant="outline">{reading.itemCost}복 사용</Badge>
              {reading.cacheHit ? (
                <Badge variant="outline">이전 풀이 불러옴</Badge>
              ) : null}
              <Badge variant="outline">
                {new Date(reading.createdAt).toLocaleString('ko-KR')}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground sm:text-sm">
              이번 풀이 대상: {reading.targetLabel}
            </p>

            {displaySummary ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                {displaySummary}
              </p>
            ) : null}

            {reading.sectionsJson?.storyTitle ? (
              <Badge variant="outline">{reading.sectionsJson.storyTitle}</Badge>
            ) : null}

            <SajuDataSection sajuData={reading.sajuData} />

            {quickJumpSections.length > 1 ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">빠르게 이동</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {quickJumpSections.map((section) => (
                    <a
                      key={section.key}
                      href={`#${getSectionAnchorId(section.key)}`}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      {section.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {sectionOrder.map((sectionKey) => {
              const sectionId = getSectionAnchorId(sectionKey);
              const sectionTitle = getResolvedSectionTitle(
                reading.readingType,
                reading.subjectType,
                focusedSelfSubject,
                sectionKey
              );

              switch (sectionKey) {
                case 'overview':
                  return reading.sectionsJson?.overview ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.overview}
                    />
                  ) : null;
                case 'sajuBasis':
                  return reading.sectionsJson?.sajuBasis ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.sajuBasis}
                    />
                  ) : null;
                case 'sajuEvidence':
                  return reading.sectionsJson?.sajuEvidence &&
                    Array.isArray(reading.sectionsJson.sajuEvidence) &&
                    reading.sectionsJson.sajuEvidence.length > 0 ? (
                    <section
                      id={sectionId}
                      key={sectionKey}
                      className="theme-reading-section scroll-mt-24 space-y-1"
                    >
                      <h2 className="text-sm font-semibold">{sectionTitle}</h2>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {reading.sectionsJson.sajuEvidence.map(
                          (item, index) => (
                            <li key={`${item}-${index}`}>- {item}</li>
                          )
                        )}
                      </ul>
                    </section>
                  ) : null;
                case 'narrativeFlow':
                  return reading.sectionsJson?.narrativeFlow ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.narrativeFlow}
                    />
                  ) : null;
                case 'subjectLens':
                  if (!reading.sectionsJson?.subjectLens) {
                    return null;
                  }
                  if (!showFocusedSelfLayout) {
                    return (
                      <TextSection
                        key={sectionKey}
                        id={sectionId}
                        title={sectionTitle}
                        text={reading.sectionsJson.subjectLens}
                      />
                    );
                  }
                  return focusedSelfSubject ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.subjectLens}
                    />
                  ) : null;
                case 'currentDaewoon':
                  return reading.sectionsJson?.currentDaewoon &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_SHOW_CURRENT_DAEUN_SUBJECTS.has(
                          focusedSelfSubject
                        ))) ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.currentDaewoon}
                    />
                  ) : null;
                case 'yearlyFlow':
                  return reading.sectionsJson?.yearlyFlow &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_SHOW_YEARLY_FLOW_SUBJECTS.has(
                          focusedSelfSubject
                        ))) ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.yearlyFlow}
                    />
                  ) : null;
                case 'tenYearFlow':
                  return reading.sectionsJson?.tenYearFlow &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_SHOW_TEN_YEAR_SUBJECTS.has(
                          focusedSelfSubject
                        ))) ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.tenYearFlow}
                    />
                  ) : null;
                case 'coreSignal':
                  return reading.sectionsJson?.coreSignal ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.coreSignal}
                    />
                  ) : null;
                case 'wealthFlow':
                  return reading.sectionsJson?.wealthFlow &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_WORK_MONEY_SUBJECTS.has(focusedSelfSubject))) ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.wealthFlow}
                    />
                  ) : null;
                case 'relationshipFlow':
                  return reading.sectionsJson?.relationshipFlow &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_RELATION_SUBJECTS.has(focusedSelfSubject))) ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.relationshipFlow}
                    />
                  ) : null;
                case 'pairDynamic':
                  return reading.sectionsJson?.pairDynamic ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.pairDynamic}
                    />
                  ) : null;
                case 'attractionPoint':
                  return reading.sectionsJson?.attractionPoint ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.attractionPoint}
                    />
                  ) : null;
                case 'conflictTrigger':
                  return reading.sectionsJson?.conflictTrigger ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.conflictTrigger}
                    />
                  ) : null;
                case 'communicationTip':
                  return reading.sectionsJson?.communicationTip ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.communicationTip}
                    />
                  ) : null;
                case 'relationshipLens':
                  return reading.sectionsJson?.relationshipLens &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_RELATION_SUBJECTS.has(focusedSelfSubject))) &&
                    reading.sectionsJson.relationshipLens !==
                      reading.sectionsJson.relationshipFlow ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.relationshipLens}
                    />
                  ) : null;
                case 'careerMoneyLens':
                  return reading.sectionsJson?.careerMoneyLens &&
                    (!showFocusedSelfLayout ||
                      (focusedSelfSubject !== null &&
                        SELF_WORK_MONEY_SUBJECTS.has(focusedSelfSubject))) &&
                    reading.sectionsJson.careerMoneyLens !==
                      reading.sectionsJson.wealthFlow ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.careerMoneyLens}
                    />
                  ) : null;
                case 'timingHint':
                  return reading.sectionsJson?.timingHint ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.timingHint}
                    />
                  ) : null;
                case 'caution':
                  return reading.sectionsJson?.caution ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.caution}
                    />
                  ) : null;
                case 'actions':
                  return actions.length > 0 ? (
                    <section
                      id={sectionId}
                      key={sectionKey}
                      className="theme-reading-section scroll-mt-24 space-y-1"
                    >
                      <h2 className="text-sm font-semibold">{sectionTitle}</h2>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {actions.map((action, index) => (
                          <li key={`${action}-${index}`}>
                            {index + 1}. {action}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null;
                case 'reflectionQuestion':
                  return reading.sectionsJson?.reflectionQuestion ? (
                    <TextSection
                      key={sectionKey}
                      id={sectionId}
                      title={sectionTitle}
                      text={reading.sectionsJson.reflectionQuestion}
                    />
                  ) : null;
                default:
                  return null;
              }
            })}
          </CardContent>
        </Card>
      ) : null}

      {status ? (
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog
        open={openDeleteDialog}
        onOpenChange={(open) => {
          setOpenDeleteDialog(open);
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
            이 해석 기록을 삭제할까요?
            <span className="font-semibold">
              {' '}
              {reading?.targetLabel ?? '선택한 해석'}
            </span>
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
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
        open={deletingReading}
        mode={reading?.readingType ?? 'SELF'}
        theme="timing"
        icon="sparkles"
        title="해석 기록을 조용히 정리하고 있어요."
        description="삭제가 끝나면 다시 운을 읽는 화면으로 돌아갑니다."
        messages={[
          '지금 보던 해석의 자리를 조용히 정리하고 있어요.',
          '목록의 흐름도 함께 맞추고 있어요.'
        ]}
      />
    </main>
  );
}
