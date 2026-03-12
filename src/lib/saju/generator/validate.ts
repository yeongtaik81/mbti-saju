import type {
  LlmCandidate,
  LlmReviewResult,
  SajuGenerationInput,
  SajuSections
} from './types';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractLeadSentence(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return undefined;
  }

  const sentenceMatch = normalized.match(
    /^.+?(?:[.!?](?=\s|$)|다\.(?=\s|$)|요\.(?=\s|$)|니다\.(?=\s|$))/
  );
  return sentenceMatch?.[0]?.trim() ?? normalized;
}

function hasMbtiForwardOpening(text: string | undefined): boolean {
  if (!text) {
    return false;
  }

  const opening = extractLeadSentence(text) ?? normalizeText(text).slice(0, 48);
  return (
    opening.includes('MBTI') ||
    opening.includes('성향') ||
    opening.includes('기질') ||
    /(?:^|[^A-Z])(ENFJ|ENTJ|ENFP|ENTP|ESFJ|ESTJ|ESFP|ESTP|INFJ|INTJ|INFP|INTP|ISFJ|ISTJ|ISFP|ISTP)(?:[^A-Z]|$)/.test(
      opening
    )
  );
}

function ensureMbtiLead(
  candidate: string | null | undefined,
  draft: string | null | undefined
): string | undefined {
  const resolved = pickText(candidate, draft);
  if (!resolved) {
    return undefined;
  }

  if (hasMbtiForwardOpening(resolved)) {
    return resolved;
  }

  const lead = extractLeadSentence(draft ?? undefined);
  if (!lead || !hasMbtiForwardOpening(lead)) {
    return resolved;
  }

  if (normalizeText(resolved).startsWith(normalizeText(lead))) {
    return resolved;
  }

  return `${lead} ${resolved}`.trim();
}

export function isLlmCandidate(value: unknown): value is LlmCandidate {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const target = value as {
    summary?: unknown;
    sectionsJson?: {
      overview?: unknown;
      coreSignal?: unknown;
      caution?: unknown;
      actions?: unknown;
      reflectionQuestion?: unknown;
      storyTitle?: unknown;
      sajuEvidence?: unknown;
      sajuBasis?: unknown;
      subjectLens?: unknown;
      narrativeFlow?: unknown;
      tenYearFlow?: unknown;
      currentDaewoon?: unknown;
      yearlyFlow?: unknown;
      wealthFlow?: unknown;
      relationshipFlow?: unknown;
      pairDynamic?: unknown;
      attractionPoint?: unknown;
      conflictTrigger?: unknown;
      communicationTip?: unknown;
      relationshipLens?: unknown;
      careerMoneyLens?: unknown;
      timingHint?: unknown;
    };
  };

  const hasOptionalEvidence =
    !target.sectionsJson ||
    target.sectionsJson.sajuEvidence === undefined ||
    target.sectionsJson.sajuEvidence === null ||
    (Array.isArray(target.sectionsJson.sajuEvidence) &&
      target.sectionsJson.sajuEvidence.every(
        (item) => typeof item === 'string'
      ));

  const hasOptionalStrings =
    (!target.sectionsJson ||
      target.sectionsJson.storyTitle === undefined ||
      target.sectionsJson.storyTitle === null ||
      typeof target.sectionsJson.storyTitle === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.subjectLens === undefined ||
      target.sectionsJson.subjectLens === null ||
      typeof target.sectionsJson.subjectLens === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.sajuBasis === undefined ||
      target.sectionsJson.sajuBasis === null ||
      typeof target.sectionsJson.sajuBasis === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.narrativeFlow === undefined ||
      target.sectionsJson.narrativeFlow === null ||
      typeof target.sectionsJson.narrativeFlow === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.tenYearFlow === undefined ||
      target.sectionsJson.tenYearFlow === null ||
      typeof target.sectionsJson.tenYearFlow === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.currentDaewoon === undefined ||
      target.sectionsJson.currentDaewoon === null ||
      typeof target.sectionsJson.currentDaewoon === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.yearlyFlow === undefined ||
      target.sectionsJson.yearlyFlow === null ||
      typeof target.sectionsJson.yearlyFlow === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.wealthFlow === undefined ||
      target.sectionsJson.wealthFlow === null ||
      typeof target.sectionsJson.wealthFlow === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.relationshipFlow === undefined ||
      target.sectionsJson.relationshipFlow === null ||
      typeof target.sectionsJson.relationshipFlow === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.pairDynamic === undefined ||
      target.sectionsJson.pairDynamic === null ||
      typeof target.sectionsJson.pairDynamic === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.attractionPoint === undefined ||
      target.sectionsJson.attractionPoint === null ||
      typeof target.sectionsJson.attractionPoint === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.conflictTrigger === undefined ||
      target.sectionsJson.conflictTrigger === null ||
      typeof target.sectionsJson.conflictTrigger === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.communicationTip === undefined ||
      target.sectionsJson.communicationTip === null ||
      typeof target.sectionsJson.communicationTip === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.relationshipLens === undefined ||
      target.sectionsJson.relationshipLens === null ||
      typeof target.sectionsJson.relationshipLens === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.careerMoneyLens === undefined ||
      target.sectionsJson.careerMoneyLens === null ||
      typeof target.sectionsJson.careerMoneyLens === 'string') &&
    (!target.sectionsJson ||
      target.sectionsJson.timingHint === undefined ||
      target.sectionsJson.timingHint === null ||
      typeof target.sectionsJson.timingHint === 'string');

  return (
    typeof target.summary === 'string' &&
    typeof target.sectionsJson?.overview === 'string' &&
    typeof target.sectionsJson?.coreSignal === 'string' &&
    typeof target.sectionsJson?.caution === 'string' &&
    Array.isArray(target.sectionsJson?.actions) &&
    target.sectionsJson.actions.every((item) => typeof item === 'string') &&
    typeof target.sectionsJson?.reflectionQuestion === 'string' &&
    hasOptionalEvidence &&
    hasOptionalStrings
  );
}

export function isLlmReviewResult(value: unknown): value is LlmReviewResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const target = value as {
    approved?: unknown;
    issues?: unknown;
    score?: unknown;
  };

  return (
    typeof target.approved === 'boolean' &&
    typeof target.score === 'number' &&
    Array.isArray(target.issues) &&
    target.issues.every((item) => typeof item === 'string')
  );
}

export function validateGeneratedCandidate(
  input: SajuGenerationInput,
  candidate: LlmCandidate
): string[] {
  const issues: string[] = [];
  const sections = candidate.sectionsJson;

  if (!sections.sajuBasis) {
    issues.push('사주 근거 섹션이 비어 있습니다.');
  }

  if (!sections.sajuEvidence || sections.sajuEvidence.length < 3) {
    issues.push('사주 근거 요약이 충분하지 않습니다.');
  }

  if (
    !sections.currentDaewoon ||
    !sections.yearlyFlow ||
    !sections.timingHint
  ) {
    issues.push('시기 해석 섹션이 충분하지 않습니다.');
  }

  if (!sections.wealthFlow) {
    issues.push('재물 흐름 섹션이 비어 있습니다.');
  }

  if (sections.actions.length !== 3) {
    issues.push('실행 가이드는 정확히 3개여야 합니다.');
  }

  if (input.readingType === 'SELF' && !sections.subjectLens) {
    issues.push('주제별 해석 렌즈가 비어 있습니다.');
  }

  if (input.readingType === 'COMPATIBILITY') {
    if (
      !sections.pairDynamic ||
      !sections.conflictTrigger ||
      !sections.communicationTip
    ) {
      issues.push('궁합 전용 섹션이 충분하지 않습니다.');
    }
  }

  return issues;
}

export function validateFinalGuard(candidate: LlmCandidate): string[] {
  const issues: string[] = [];

  if (candidate.summary.trim().length < 20) {
    issues.push('요약 길이가 너무 짧습니다.');
  }

  if (candidate.sectionsJson.overview.trim().length < 40) {
    issues.push('전체 흐름 섹션이 너무 짧습니다.');
  }

  if (candidate.sectionsJson.coreSignal.trim().length < 40) {
    issues.push('핵심 포인트 섹션이 너무 짧습니다.');
  }

  return issues;
}

function pickText(
  candidate: string | null | undefined,
  fallback: string | null | undefined
): string | undefined {
  const normalized = candidate?.trim();
  if (normalized) {
    return normalized;
  }
  return fallback ?? undefined;
}

function normalizeActions(
  actions: string[] | undefined,
  fallback: string[]
): string[] {
  const merged = [...(actions ?? []), ...fallback]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unique = Array.from(new Set(merged));

  const defaultActions = [
    '오늘의 핵심 목표 1개를 정하고 20분만 먼저 시작하세요.',
    '지출과 일정 중 가장 큰 누수 1개를 확인해 바로 조정하세요.',
    '가까운 사람과 기대치 1가지를 짧게 맞춰 보세요.'
  ];

  for (const fallbackAction of defaultActions) {
    if (unique.length >= 3) {
      break;
    }
    if (!unique.includes(fallbackAction)) {
      unique.push(fallbackAction);
    }
  }

  return unique.slice(0, 3);
}

function normalizeSajuEvidence(
  evidence: string[] | null | undefined,
  fallback: string[] | null | undefined
): string[] | undefined {
  const merged = [...(evidence ?? []), ...(fallback ?? [])]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const unique = Array.from(new Set(merged));
  if (unique.length === 0) {
    return undefined;
  }

  return unique.slice(0, 4);
}

export function finalizeContent(
  candidate: LlmCandidate,
  draft: LlmCandidate
): LlmCandidate {
  const sectionsJson: SajuSections = {
    ...draft.sectionsJson,
    ...candidate.sectionsJson,
    overview:
      ensureMbtiLead(
        candidate.sectionsJson.overview,
        draft.sectionsJson.overview
      ) ?? draft.sectionsJson.overview,
    coreSignal:
      pickText(
        candidate.sectionsJson.coreSignal,
        draft.sectionsJson.coreSignal
      ) ?? draft.sectionsJson.coreSignal,
    caution:
      ensureMbtiLead(
        candidate.sectionsJson.caution,
        draft.sectionsJson.caution
      ) ?? draft.sectionsJson.caution,
    reflectionQuestion:
      pickText(
        candidate.sectionsJson.reflectionQuestion,
        draft.sectionsJson.reflectionQuestion
      ) ?? draft.sectionsJson.reflectionQuestion,
    storyTitle: pickText(
      candidate.sectionsJson.storyTitle,
      draft.sectionsJson.storyTitle
    ),
    sajuEvidence: normalizeSajuEvidence(
      candidate.sectionsJson.sajuEvidence,
      draft.sectionsJson.sajuEvidence
    ),
    sajuBasis: pickText(
      candidate.sectionsJson.sajuBasis,
      draft.sectionsJson.sajuBasis
    ),
    subjectLens: pickText(
      candidate.sectionsJson.subjectLens,
      draft.sectionsJson.subjectLens
    ),
    narrativeFlow: ensureMbtiLead(
      candidate.sectionsJson.narrativeFlow,
      draft.sectionsJson.narrativeFlow
    ),
    tenYearFlow: pickText(
      candidate.sectionsJson.tenYearFlow,
      draft.sectionsJson.tenYearFlow
    ),
    currentDaewoon: pickText(
      candidate.sectionsJson.currentDaewoon,
      draft.sectionsJson.currentDaewoon
    ),
    yearlyFlow: pickText(
      candidate.sectionsJson.yearlyFlow,
      draft.sectionsJson.yearlyFlow
    ),
    wealthFlow: ensureMbtiLead(
      candidate.sectionsJson.wealthFlow,
      draft.sectionsJson.wealthFlow
    ),
    relationshipFlow: ensureMbtiLead(
      candidate.sectionsJson.relationshipFlow,
      draft.sectionsJson.relationshipFlow
    ),
    pairDynamic: pickText(
      candidate.sectionsJson.pairDynamic,
      draft.sectionsJson.pairDynamic
    ),
    attractionPoint: pickText(
      candidate.sectionsJson.attractionPoint,
      draft.sectionsJson.attractionPoint
    ),
    conflictTrigger: pickText(
      candidate.sectionsJson.conflictTrigger,
      draft.sectionsJson.conflictTrigger
    ),
    communicationTip: pickText(
      candidate.sectionsJson.communicationTip,
      draft.sectionsJson.communicationTip
    ),
    relationshipLens: pickText(
      candidate.sectionsJson.relationshipLens,
      draft.sectionsJson.relationshipLens
    ),
    careerMoneyLens: pickText(
      candidate.sectionsJson.careerMoneyLens,
      draft.sectionsJson.careerMoneyLens
    ),
    timingHint: ensureMbtiLead(
      candidate.sectionsJson.timingHint,
      draft.sectionsJson.timingHint
    ),
    actions: normalizeActions(
      candidate.sectionsJson.actions,
      draft.sectionsJson.actions
    )
  };

  return {
    summary: ensureMbtiLead(candidate.summary, draft.summary) ?? draft.summary,
    sectionsJson
  };
}
