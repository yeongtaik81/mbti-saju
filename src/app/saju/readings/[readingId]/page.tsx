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

function TextSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="theme-reading-section space-y-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </section>
  );
}

const DETAIL_SECTION_TITLE = {
  overview: '타고난 사주와 지금의 운',
  sajuBasis: '사주의 바탕',
  sajuEvidence: '오행과 운',
  narrativeFlow: '현재 운의 해석',
  subjectLens: '먼저 볼 점',
  tenYearFlow: '앞으로 10년 운',
  currentDaewoon: '현재 대운',
  yearlyFlow: '올해 운',
  coreSignal: '지금 읽어야 할 핵심',
  wealthFlow: '돈의 흐름',
  relationshipFlow: '관계의 흐름',
  pairDynamic: '두 사람의 흐름',
  attractionPoint: '서로 잘 맞는 점',
  conflictTrigger: '엇갈리기 쉬운 점',
  communicationTip: '잘 통하는 말',
  relationshipLens: '관계에서 볼 점',
  careerMoneyLens: '일과 재물에서 볼 점',
  timingHint: '지금 움직이기 좋은 때',
  caution: '조심하면 좋은 점',
  actions: '지금 해볼 실천',
  reflectionQuestion: '한 번 더 생각해볼 질문'
} as const;

type DetailSectionKey = keyof typeof DETAIL_SECTION_TITLE;

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

function getFocusedSelfSectionOrder(
  subjectType: SelfSubjectType
): DetailSectionKey[] {
  switch (subjectType) {
    case 'CAREER':
      return [
        'narrativeFlow',
        'wealthFlow',
        'subjectLens',
        'yearlyFlow',
        'currentDaewoon',
        'timingHint',
        'caution',
        'actions'
      ];
    case 'WEALTH':
      return [
        'narrativeFlow',
        'wealthFlow',
        'subjectLens',
        'yearlyFlow',
        'currentDaewoon',
        'timingHint',
        'caution',
        'actions'
      ];
    case 'ROMANCE':
    case 'MARRIAGE':
    case 'RELATIONSHIPS':
    case 'FAMILY':
      return [
        'narrativeFlow',
        'relationshipFlow',
        'subjectLens',
        'yearlyFlow',
        'currentDaewoon',
        'timingHint',
        'caution',
        'actions'
      ];
    case 'LIFETIME_FLOW':
      return [
        'narrativeFlow',
        'currentDaewoon',
        'yearlyFlow',
        'tenYearFlow',
        'subjectLens',
        'timingHint',
        'caution',
        'actions',
        'reflectionQuestion'
      ];
    case 'DAEUN':
      return [
        'narrativeFlow',
        'currentDaewoon',
        'tenYearFlow',
        'subjectLens',
        'timingHint',
        'caution',
        'actions'
      ];
    case 'YEAR_MONTH_DAY_FORTUNE':
      return [
        'narrativeFlow',
        'yearlyFlow',
        'timingHint',
        'caution',
        'actions'
      ];
    case 'LUCK_UP':
      return [
        'narrativeFlow',
        'subjectLens',
        'actions',
        'yearlyFlow',
        'currentDaewoon',
        'caution'
      ];
    case 'BASIC':
    default:
      return BASIC_SELF_SECTION_ORDER;
  }
}

function getCompatibilitySectionOrder(subjectType: string): DetailSectionKey[] {
  if (subjectType.startsWith('COMPAT_WORK_')) {
    return [
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
    ];
  }

  if (subjectType.startsWith('COMPAT_FAMILY_')) {
    return [
      'subjectLens',
      'pairDynamic',
      'conflictTrigger',
      'communicationTip',
      'attractionPoint',
      'narrativeFlow',
      'currentDaewoon',
      'yearlyFlow',
      'tenYearFlow',
      'timingHint',
      'caution',
      'actions',
      'reflectionQuestion'
    ];
  }

  if (subjectType.startsWith('COMPAT_MISC_')) {
    return [
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
  }

  if (subjectType.startsWith('COMPAT_ROMANCE_')) {
    return [
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
    ];
  }

  if (subjectType.startsWith('COMPAT_FRIEND_')) {
    return [
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
    ];
  }

  return [
    'narrativeFlow',
    'subjectLens',
    'pairDynamic',
    'attractionPoint',
    'conflictTrigger',
    'communicationTip',
    'currentDaewoon',
    'yearlyFlow',
    'tenYearFlow',
    'timingHint',
    'caution',
    'actions',
    'reflectionQuestion'
  ];
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

const SELF_RELATION_SUBJECTS = new Set<SelfSubjectType>([
  'ROMANCE',
  'MARRIAGE',
  'RELATIONSHIPS',
  'FAMILY'
]);

const SELF_WORK_MONEY_SUBJECTS = new Set<SelfSubjectType>(['CAREER', 'WEALTH']);
const SELF_SHOW_TEN_YEAR_SUBJECTS = new Set<SelfSubjectType>([
  'LIFETIME_FLOW',
  'DAEUN'
]);
const SELF_SHOW_CURRENT_DAEUN_SUBJECTS = new Set<SelfSubjectType>([
  'LIFETIME_FLOW',
  'DAEUN',
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
      return '개운법 풀이';
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
    if (subjectType === 'COMPAT_ROMANCE_LEFT_ON_READ') {
      return '먼저 침묵이 길어진 이유부터 보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_GHOSTED') {
      return '먼저 흐름이 끊긴 지점부터 짚어보세요.';
    }

    if (subjectType === 'COMPAT_ROMANCE_EX') {
      return '다시 만나도 달라질 수 있는지부터 보세요.';
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

    return '이 관계에서 먼저 봐야 할 결부터 읽어보세요.';
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
  const primaryFlowTitle = focusedSelfSubject
    ? getFocusedPrimaryFlowTitle(reading?.subjectType ?? '', focusedSelfSubject)
    : '';

  const sectionOrder = useMemo<DetailSectionKey[]>(() => {
    if (!reading) {
      return BASIC_SELF_SECTION_ORDER;
    }

    if (reading.readingType === 'COMPATIBILITY') {
      return getCompatibilitySectionOrder(reading.subjectType);
    }

    if (focusedSelfSubject) {
      return getFocusedSelfSectionOrder(focusedSelfSubject);
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
      <main className="min-h-screen">
        <LoadingOverlay
          open
          mode="SELF"
          theme="timing"
          icon="sparkles"
          variant="folk"
          title="사주 풀이를 펼치고 있어요."
          description="타고난 사주와 지금 읽어야 할 운의 방향을 함께 불러오고 있어요."
          messages={[
            '지금의 운과 타고난 결을 나란히 정리하고 있어요.',
            '원국 데이터와 풀이의 방향을 함께 맞추고 있어요.'
          ]}
        />
      </main>
    );
  }

  return (
    <main className="theme-reading-paper mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <ThemedBrandLogo
            className="h-9 w-auto max-w-[180px] sm:h-10 sm:max-w-[220px]"
            width={220}
            height={66}
            priority
          />
          <h1 className="text-2xl font-bold">사주 풀이 보기</h1>
          <p className="text-sm text-muted-foreground">
            {readingIntroDescription}
          </p>
          <div className="theme-divider" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">MBTI 사주로 돌아가기</Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setOpenDeleteDialog(true)}
          >
            삭제하기
          </Button>
        </div>
      </header>

      {reading ? (
        <Card className="theme-card-ornament theme-reading-intro theme-surface">
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
              <Badge variant="outline">{reading.itemCost}복 사용</Badge>
              {reading.cacheHit ? (
                <Badge variant="outline">기존 해석 재사용</Badge>
              ) : null}
              <Badge variant="outline">
                {new Date(reading.createdAt).toLocaleString('ko-KR')}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              함께 본 대상: {reading.targetLabel}
            </p>

            {reading.sectionsJson?.storyTitle ? (
              <Badge variant="outline">{reading.sectionsJson.storyTitle}</Badge>
            ) : null}

            <SajuDataSection sajuData={reading.sajuData} />

            {sectionOrder.map((sectionKey) => {
              switch (sectionKey) {
                case 'overview':
                  return !showFocusedSelfLayout &&
                    reading.sectionsJson?.overview ? (
                    <TextSection
                      key={sectionKey}
                      title={DETAIL_SECTION_TITLE.overview}
                      text={reading.sectionsJson.overview}
                    />
                  ) : null;
                case 'sajuBasis':
                  return !showFocusedSelfLayout &&
                    reading.sectionsJson?.sajuBasis ? (
                    <TextSection
                      key={sectionKey}
                      title={DETAIL_SECTION_TITLE.sajuBasis}
                      text={reading.sectionsJson.sajuBasis}
                    />
                  ) : null;
                case 'sajuEvidence':
                  return !showFocusedSelfLayout &&
                    reading.sectionsJson?.sajuEvidence &&
                    Array.isArray(reading.sectionsJson.sajuEvidence) &&
                    reading.sectionsJson.sajuEvidence.length > 0 ? (
                    <section
                      key={sectionKey}
                      className="theme-reading-section space-y-1"
                    >
                      <h2 className="text-sm font-semibold">
                        {DETAIL_SECTION_TITLE.sajuEvidence}
                      </h2>
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
                      title={
                        focusedSelfSubject
                          ? getFocusedNarrativeTitle(
                              reading.subjectType,
                              focusedSelfSubject
                            )
                          : DETAIL_SECTION_TITLE.narrativeFlow
                      }
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
                        title={
                          reading.readingType === 'COMPATIBILITY'
                            ? getCompatibilityDetailTitle(
                                reading.subjectType,
                                'subjectLens'
                              )
                            : focusedSelfSubject
                              ? getFocusedSubjectLensTitle(
                                  reading.subjectType,
                                  focusedSelfSubject
                                )
                              : DETAIL_SECTION_TITLE.subjectLens
                        }
                        text={reading.sectionsJson.subjectLens}
                      />
                    );
                  }
                  return focusedSelfSubject ? (
                    <TextSection
                      key={sectionKey}
                      title={getFocusedSubjectLensTitle(
                        reading.subjectType,
                        focusedSelfSubject
                      )}
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
                      title={getCurrentDaewoonTitle(
                        reading.readingType,
                        reading.subjectType,
                        focusedSelfSubject
                      )}
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
                      title={getYearlyFlowTitle(
                        reading.readingType,
                        reading.subjectType,
                        focusedSelfSubject
                      )}
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
                      title={getTenYearFlowTitle(
                        reading.readingType,
                        reading.subjectType,
                        focusedSelfSubject
                      )}
                      text={reading.sectionsJson.tenYearFlow}
                    />
                  ) : null;
                case 'coreSignal':
                  return !showFocusedSelfLayout &&
                    reading.sectionsJson?.coreSignal ? (
                    <TextSection
                      key={sectionKey}
                      title={DETAIL_SECTION_TITLE.coreSignal}
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
                      title={
                        focusedSelfSubject
                          ? primaryFlowTitle || DETAIL_SECTION_TITLE.wealthFlow
                          : DETAIL_SECTION_TITLE.wealthFlow
                      }
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
                      title={
                        focusedSelfSubject
                          ? primaryFlowTitle ||
                            DETAIL_SECTION_TITLE.relationshipFlow
                          : DETAIL_SECTION_TITLE.relationshipFlow
                      }
                      text={reading.sectionsJson.relationshipFlow}
                    />
                  ) : null;
                case 'pairDynamic':
                  return reading.sectionsJson?.pairDynamic ? (
                    <TextSection
                      key={sectionKey}
                      title={
                        reading.readingType === 'COMPATIBILITY'
                          ? getCompatibilityDetailTitle(
                              reading.subjectType,
                              'pairDynamic'
                            )
                          : DETAIL_SECTION_TITLE.pairDynamic
                      }
                      text={reading.sectionsJson.pairDynamic}
                    />
                  ) : null;
                case 'attractionPoint':
                  return reading.sectionsJson?.attractionPoint ? (
                    <TextSection
                      key={sectionKey}
                      title={
                        reading.readingType === 'COMPATIBILITY'
                          ? getCompatibilityDetailTitle(
                              reading.subjectType,
                              'attractionPoint'
                            )
                          : DETAIL_SECTION_TITLE.attractionPoint
                      }
                      text={reading.sectionsJson.attractionPoint}
                    />
                  ) : null;
                case 'conflictTrigger':
                  return reading.sectionsJson?.conflictTrigger ? (
                    <TextSection
                      key={sectionKey}
                      title={
                        reading.readingType === 'COMPATIBILITY'
                          ? getCompatibilityDetailTitle(
                              reading.subjectType,
                              'conflictTrigger'
                            )
                          : DETAIL_SECTION_TITLE.conflictTrigger
                      }
                      text={reading.sectionsJson.conflictTrigger}
                    />
                  ) : null;
                case 'communicationTip':
                  return reading.sectionsJson?.communicationTip ? (
                    <TextSection
                      key={sectionKey}
                      title={
                        reading.readingType === 'COMPATIBILITY'
                          ? getCompatibilityDetailTitle(
                              reading.subjectType,
                              'communicationTip'
                            )
                          : DETAIL_SECTION_TITLE.communicationTip
                      }
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
                      title={DETAIL_SECTION_TITLE.relationshipLens}
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
                      title={DETAIL_SECTION_TITLE.careerMoneyLens}
                      text={reading.sectionsJson.careerMoneyLens}
                    />
                  ) : null;
                case 'timingHint':
                  return reading.sectionsJson?.timingHint ? (
                    <TextSection
                      key={sectionKey}
                      title={DETAIL_SECTION_TITLE.timingHint}
                      text={reading.sectionsJson.timingHint}
                    />
                  ) : null;
                case 'caution':
                  return reading.sectionsJson?.caution ? (
                    <TextSection
                      key={sectionKey}
                      title={DETAIL_SECTION_TITLE.caution}
                      text={reading.sectionsJson.caution}
                    />
                  ) : null;
                case 'actions':
                  return actions.length > 0 ? (
                    <section
                      key={sectionKey}
                      className="theme-reading-section space-y-1"
                    >
                      <h2 className="text-sm font-semibold">
                        {DETAIL_SECTION_TITLE.actions}
                      </h2>
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
                      title={DETAIL_SECTION_TITLE.reflectionQuestion}
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
