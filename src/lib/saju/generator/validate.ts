import type {
  LlmCandidate,
  LlmReviewResult,
  SajuGenerationInput,
  SajuSections
} from './types';

const SELF_RELATION_SCENARIOS = new Set([
  'SELF_LOVE_GENERAL',
  'SELF_LOVE_RECONCILIATION',
  'SELF_LOVE_CONTACT_RETURN',
  'SELF_LOVE_CONFESSION_TIMING',
  'SELF_MARRIAGE_GENERAL',
  'SELF_RELATIONSHIP_GENERAL',
  'SELF_RELATIONSHIP_CUT_OFF',
  'SELF_FAMILY_GENERAL',
  'SELF_FAMILY_PARENTS'
]);

const SELF_WORK_MONEY_SCENARIOS = new Set([
  'SELF_CAREER_GENERAL',
  'SELF_CAREER_APTITUDE',
  'SELF_CAREER_JOB_CHANGE',
  'SELF_WEALTH_GENERAL',
  'SELF_WEALTH_ACCUMULATION',
  'SELF_WEALTH_LEAK'
]);

function isNonBasicSelfScenario(input: SajuGenerationInput): boolean {
  return (
    input.readingType === 'SELF' &&
    Boolean(input.scenarioCode) &&
    input.scenarioCode !== 'SELF_BASIC'
  );
}

const COMPAT_RELATION_SCENARIOS = new Set([
  'COMPAT_BASIC',
  'COMPAT_ROMANCE_FLIRTING',
  'COMPAT_ROMANCE_LOVER',
  'COMPAT_ROMANCE_MARRIAGE_PARTNER',
  'COMPAT_ROMANCE_MARRIED',
  'COMPAT_ROMANCE_EX',
  'COMPAT_ROMANCE_CRUSH',
  'COMPAT_ROMANCE_BLIND_DATE',
  'COMPAT_ROMANCE_FRIEND_TO_LOVER',
  'COMPAT_ROMANCE_GHOSTED',
  'COMPAT_ROMANCE_LEFT_ON_READ',
  'COMPAT_FRIEND_BEST',
  'COMPAT_FRIEND_CUT_OFF',
  'COMPAT_FRIEND_TRAVEL',
  'COMPAT_FRIEND_ROOMMATE',
  'COMPAT_FAMILY_MOTHER_DAUGHTER',
  'COMPAT_FAMILY_PARENT_CHILD',
  'COMPAT_FAMILY_MOTHER_IN_LAW'
]);

const COMPAT_WORK_SCENARIOS = new Set([
  'COMPAT_WORK_COWORKER',
  'COMPAT_WORK_BOSS',
  'COMPAT_WORK_DIFFICULT_BOSS',
  'COMPAT_WORK_BUSINESS_PARTNER',
  'COMPAT_WORK_WORK_DUMPER'
]);

const COMPAT_SIGNAL_SCENARIOS = new Set([
  ...COMPAT_RELATION_SCENARIOS,
  ...COMPAT_WORK_SCENARIOS,
  'COMPAT_MISC_IDOL'
]);

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

function shouldAvoidMbtiForwardOpening(input: SajuGenerationInput): boolean {
  if (isNonBasicSelfScenario(input)) {
    return true;
  }

  return input.readingType === 'COMPATIBILITY' && Boolean(input.scenarioCode);
}

function hasTooSimilarOpening(
  first: string | undefined,
  second: string | undefined
): boolean {
  const firstLead = extractLeadSentence(first);
  const secondLead = extractLeadSentence(second);

  if (!firstLead || !secondLead) {
    return false;
  }

  const normalizedFirst = normalizeText(firstLead);
  const normalizedSecond = normalizeText(secondLead);
  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  const sharedPrefixLength = Math.min(
    20,
    normalizedFirst.length,
    normalizedSecond.length
  );
  if (sharedPrefixLength < 12) {
    return false;
  }

  return (
    normalizedFirst === normalizedSecond ||
    normalizedFirst.slice(0, sharedPrefixLength) ===
      normalizedSecond.slice(0, sharedPrefixLength)
  );
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
  const avoidMbtiForwardOpening = shouldAvoidMbtiForwardOpening(input);

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

  if (input.readingType === 'SELF') {
    if (!sections.narrativeFlow || sections.narrativeFlow.trim().length < 110) {
      issues.push('주제별 풀이 본문이 충분히 깊지 않습니다.');
    }

    if (!sections.subjectLens || sections.subjectLens.trim().length < 90) {
      issues.push('주제별 판단 렌즈가 충분히 구체적이지 않습니다.');
    }

    if (
      !sections.reflectionQuestion ||
      sections.reflectionQuestion.length < 20
    ) {
      issues.push('되짚어 볼 질문이 충분하지 않습니다.');
    }

    if (!sections.sajuEvidence || sections.sajuEvidence.length < 4) {
      issues.push('주제별 사주 근거가 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      SELF_RELATION_SCENARIOS.has(input.scenarioCode) &&
      (!sections.relationshipFlow ||
        sections.relationshipFlow.trim().length < 110)
    ) {
      issues.push('관계 고민 전용 흐름 풀이가 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      SELF_WORK_MONEY_SCENARIOS.has(input.scenarioCode) &&
      (!sections.wealthFlow || sections.wealthFlow.trim().length < 110)
    ) {
      issues.push('일/돈 고민 전용 흐름 풀이가 충분하지 않습니다.');
    }
  }

  if (avoidMbtiForwardOpening) {
    if (hasMbtiForwardOpening(candidate.summary)) {
      issues.push('요약이 아직 MBTI 소개 문장으로 먼저 열립니다.');
    }

    if (hasMbtiForwardOpening(sections.overview)) {
      issues.push('먼저 읽을 결론이 아직 MBTI 소개 문장으로 먼저 열립니다.');
    }

    if (hasTooSimilarOpening(candidate.summary, sections.overview)) {
      issues.push('요약과 먼저 읽을 결론의 시작 문장이 너무 비슷합니다.');
    }

    if (hasMbtiForwardOpening(sections.narrativeFlow)) {
      issues.push('풀이 본문이 아직 MBTI 소개 문장으로 먼저 열립니다.');
    }

    if (hasMbtiForwardOpening(sections.timingHint)) {
      issues.push('타이밍 섹션이 아직 MBTI 소개 문장으로 먼저 열립니다.');
    }

    if (hasMbtiForwardOpening(sections.caution)) {
      issues.push('주의 섹션이 아직 MBTI 소개 문장으로 먼저 열립니다.');
    }
  }

  if (input.readingType === 'COMPATIBILITY') {
    if (
      !sections.pairDynamic ||
      !sections.conflictTrigger ||
      !sections.communicationTip
    ) {
      issues.push('궁합 전용 섹션이 충분하지 않습니다.');
    }

    if (!sections.narrativeFlow || sections.narrativeFlow.trim().length < 110) {
      issues.push('궁합 풀이 본문이 충분히 깊지 않습니다.');
    }

    if (!sections.subjectLens || sections.subjectLens.trim().length < 90) {
      issues.push('궁합 판단 렌즈가 충분히 구체적이지 않습니다.');
    }

    if (
      !sections.reflectionQuestion ||
      sections.reflectionQuestion.length < 20
    ) {
      issues.push('궁합 되짚기 질문이 충분하지 않습니다.');
    }

    if (!sections.sajuEvidence || sections.sajuEvidence.length < 4) {
      issues.push('궁합 사주 근거가 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_SIGNAL_SCENARIOS.has(input.scenarioCode) &&
      (!sections.pairDynamic || sections.pairDynamic.trim().length < 80)
    ) {
      issues.push('궁합의 핵심 흐름 설명이 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_SIGNAL_SCENARIOS.has(input.scenarioCode) &&
      (!sections.communicationTip ||
        sections.communicationTip.trim().length < 80)
    ) {
      issues.push('궁합 대화 가이드가 충분히 구체적이지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_SIGNAL_SCENARIOS.has(input.scenarioCode) &&
      (!sections.attractionPoint || sections.attractionPoint.trim().length < 70)
    ) {
      issues.push('궁합의 끌림 포인트 설명이 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_RELATION_SCENARIOS.has(input.scenarioCode) &&
      (!sections.relationshipFlow ||
        sections.relationshipFlow.trim().length < 110)
    ) {
      issues.push('관계 궁합 전용 흐름 풀이가 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_RELATION_SCENARIOS.has(input.scenarioCode) &&
      (!sections.conflictTrigger || sections.conflictTrigger.trim().length < 80)
    ) {
      issues.push('관계 궁합의 충돌 포인트 설명이 충분하지 않습니다.');
    }

    if (
      input.scenarioCode &&
      COMPAT_WORK_SCENARIOS.has(input.scenarioCode) &&
      (!sections.wealthFlow || sections.wealthFlow.trim().length < 110)
    ) {
      issues.push('업무 궁합 전용 흐름 풀이가 충분하지 않습니다.');
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
  input: SajuGenerationInput,
  candidate: LlmCandidate,
  draft: LlmCandidate
): LlmCandidate {
  const mergeOpening = (
    section:
      | 'summary'
      | 'overview'
      | 'narrativeFlow'
      | 'wealthFlow'
      | 'relationshipFlow'
      | 'timingHint'
      | 'caution',
    candidateText: string | null | undefined,
    draftText: string | null | undefined
  ): string | undefined => {
    if (shouldAvoidMbtiForwardOpening(input)) {
      const resolved = pickText(candidateText, draftText);
      if (!resolved) {
        return undefined;
      }

      const shouldRejectMbtiOpening =
        section === 'summary' ||
        section === 'overview' ||
        section === 'narrativeFlow' ||
        section === 'timingHint' ||
        section === 'caution' ||
        (isNonBasicSelfScenario(input) &&
          (section === 'wealthFlow' || section === 'relationshipFlow'));

      if (
        shouldRejectMbtiOpening &&
        hasMbtiForwardOpening(resolved) &&
        draftText &&
        !hasMbtiForwardOpening(draftText)
      ) {
        return draftText;
      }

      return resolved;
    }

    return ensureMbtiLead(candidateText, draftText);
  };

  const sectionsJson: SajuSections = {
    ...draft.sectionsJson,
    ...candidate.sectionsJson,
    overview:
      mergeOpening(
        'overview',
        candidate.sectionsJson.overview,
        draft.sectionsJson.overview
      ) ?? draft.sectionsJson.overview,
    coreSignal:
      pickText(
        candidate.sectionsJson.coreSignal,
        draft.sectionsJson.coreSignal
      ) ?? draft.sectionsJson.coreSignal,
    caution:
      mergeOpening(
        'caution',
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
    narrativeFlow: mergeOpening(
      'narrativeFlow',
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
    wealthFlow: mergeOpening(
      'wealthFlow',
      candidate.sectionsJson.wealthFlow,
      draft.sectionsJson.wealthFlow
    ),
    relationshipFlow: mergeOpening(
      'relationshipFlow',
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
    timingHint: mergeOpening(
      'timingHint',
      candidate.sectionsJson.timingHint,
      draft.sectionsJson.timingHint
    ),
    actions: normalizeActions(
      candidate.sectionsJson.actions,
      draft.sectionsJson.actions
    )
  };

  return {
    summary:
      mergeOpening('summary', candidate.summary, draft.summary) ??
      draft.summary,
    sectionsJson
  };
}
