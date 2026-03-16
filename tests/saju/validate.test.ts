import { describe, expect, it } from 'vitest';
import type { LlmCandidate } from '@/lib/saju/generator';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import {
  finalizeContent,
  isLlmCandidate,
  isLlmReviewResult,
  validateFinalGuard,
  validateGeneratedCandidate
} from '@/lib/saju/generator/validate';
import {
  createCompatibilityGenerationInput,
  createSelfGenerationInput
} from './fixtures';

function createValidCandidate(overrides?: Partial<LlmCandidate>): LlmCandidate {
  return {
    summary:
      '이 요약은 충분히 길고 사주 해석의 흐름과 핵심 판단을 담도록 구성한 기본 후보입니다.',
    sectionsJson: {
      overview:
        '전체 흐름을 읽으면 지금의 결은 차분히 모으고 필요한 때에 힘을 쓰는 방향으로 정리됩니다. 큰 무리 없이 리듬을 맞출수록 결과가 단단해집니다.',
      coreSignal:
        '핵심 신호는 기운의 강약이 한쪽으로 과하게 치우치지 않도록 중심을 유지하는 데 있습니다. 타이밍을 서두르지 않는 편이 유리합니다.',
      caution:
        '과한 확장보다 현재 리듬을 지키는 편이 좋고, 관계와 지출에서 속도를 조금 낮추면 흔들림을 줄일 수 있습니다.',
      actions: ['첫 행동', '둘째 행동', '셋째 행동'],
      reflectionQuestion: '지금 가장 먼저 다져야 할 기준은 무엇인가요?',
      sajuEvidence: ['근거 하나', '근거 둘', '근거 셋', '근거 넷'],
      sajuBasis:
        '일간과 월지, 오행 분포를 함께 읽어 지금의 사주 바탕을 정리했습니다.',
      subjectLens:
        '현재 주제는 재물 흐름을 지키면서도 확장 여지를 살피는 방향으로 읽힙니다. 이번 질문에서는 무엇을 늘릴지보다 어떤 판단 기준을 먼저 세워야 하는지가 더 중요한 포인트로 작동합니다.',
      narrativeFlow:
        '이야기 흐름은 서두르지 않는 축적과 때를 보는 움직임이 핵심입니다. 지금은 크게 벌리기보다 먼저 기준을 세우고, 그 기준이 실제 생활 안에서 반복될 수 있도록 작은 선택을 정리하는 편이 훨씬 유리합니다.',
      tenYearFlow:
        '10년 흐름은 기반을 먼저 다지고 이후 확장으로 이어지는 구조입니다.',
      currentDaewoon:
        '현재 대운은 외부 확장보다 내부 정비가 먼저 필요한 구간입니다.',
      yearlyFlow:
        '올해 흐름은 상반기보다 하반기에 결실이 모이는 쪽으로 읽힙니다.',
      wealthFlow:
        '재물과 일의 흐름은 한 번에 크게 넓히기보다 새는 구간을 막고 안정적인 루트를 먼저 다지는 쪽이 더 맞습니다. 특히 역할 분담과 책임 경계를 미리 정리할수록 실제 성과와 관계 안정이 함께 따라오는 구조로 읽힙니다.',
      relationshipFlow:
        '관계 흐름은 강한 주장보다 기대치를 맞추는 방식이 유리합니다. 서로의 리듬과 말의 순서를 먼저 맞추고, 감정이 올라오기 전에 선을 짧게 정리해 두면 오해가 길어지지 않고 회복도 훨씬 빨라집니다.',
      pairDynamic:
        '두 사람의 흐름은 역할이 또렷하게 나뉠수록 장점이 크게 살아나는 타입입니다. 각자 잘하는 지점을 분리해 움직이면 감정 소모보다 신뢰와 결과가 함께 쌓이기 쉬운 구조입니다.',
      attractionPoint:
        '서로 다른 장점이 맞물리며 끌림이 생기는 지점이 분명합니다. 한쪽의 추진력과 다른 한쪽의 정리력이 이어질 때 이 궁합의 체감 장점이 훨씬 또렷하게 살아납니다.',
      conflictTrigger:
        '기대하는 속도와 설명 방식이 다를 때 작은 오해가 빠르게 쌓일 수 있습니다. 특히 애매한 부탁이나 확인되지 않은 기대가 반복되면 관계보다 억울함이 먼저 커질 가능성이 큽니다.',
      communicationTip:
        '감정 해명보다 기준과 기대치를 짧게 먼저 맞추는 편이 좋습니다. 무엇을 언제까지 어떤 방식으로 원하는지 문장으로 맞추면 관계 피로와 해석 차이를 크게 줄일 수 있습니다.',
      timingHint:
        '지금은 빠른 결정보다 확인 과정을 거친 움직임이 더 잘 맞습니다.'
    },
    ...overrides
  };
}

describe('saju validate helpers', () => {
  it('recognizes valid LLM candidate and review payloads', () => {
    expect(isLlmCandidate(createValidCandidate())).toBe(true);
    expect(
      isLlmReviewResult({
        approved: true,
        issues: [],
        score: 0.91
      })
    ).toBe(true);
  });

  it('rejects malformed LLM candidate payloads', () => {
    expect(
      isLlmCandidate({
        summary: 'short',
        sectionsJson: {
          overview: 'ok',
          coreSignal: 'ok',
          caution: 'ok',
          actions: ['a', 'b'],
          reflectionQuestion: 'q'
        }
      })
    ).toBe(true);

    expect(
      isLlmCandidate({
        summary: 'bad candidate',
        sectionsJson: {
          overview: 'ok',
          coreSignal: 'ok',
          caution: 'ok',
          actions: ['a', 1],
          reflectionQuestion: 'q'
        }
      })
    ).toBe(false);
    expect(isLlmReviewResult({ approved: true, issues: 'bad', score: 1 })).toBe(
      false
    );
  });

  it('flags missing required sections for self readings', () => {
    const candidate = createValidCandidate({
      sectionsJson: {
        ...createValidCandidate().sectionsJson,
        actions: ['하나', '둘'],
        sajuEvidence: ['근거 하나'],
        sajuBasis: undefined,
        subjectLens: undefined,
        wealthFlow: undefined,
        currentDaewoon: undefined,
        yearlyFlow: undefined,
        timingHint: undefined
      }
    });

    const issues = validateGeneratedCandidate(
      createSelfGenerationInput('WEALTH'),
      candidate
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        '사주 근거 섹션이 비어 있습니다.',
        '사주 근거 요약이 충분하지 않습니다.',
        '시기 해석 섹션이 충분하지 않습니다.',
        '재물 흐름 섹션이 비어 있습니다.',
        '실행 가이드는 정확히 3개여야 합니다.',
        '주제별 해석 렌즈가 비어 있습니다.'
      ])
    );
  });

  it('flags missing compatibility-only sections', () => {
    const candidate = createValidCandidate({
      sectionsJson: {
        ...createValidCandidate().sectionsJson,
        pairDynamic: undefined,
        conflictTrigger: undefined,
        communicationTip: undefined
      }
    });

    const issues = validateGeneratedCandidate(
      createCompatibilityGenerationInput('LOVER'),
      candidate
    );

    expect(issues).toContain('궁합 전용 섹션이 충분하지 않습니다.');
  });

  it('accepts dense compatibility candidates without additional issues', () => {
    const issues = validateGeneratedCandidate(
      createCompatibilityGenerationInput(
        'BUSINESS_PARTNER',
        'INTJ',
        'ENTJ',
        'COMPAT_WORK_BUSINESS_PARTNER'
      ),
      createValidCandidate()
    );

    expect(issues).toEqual([]);
  });

  it('keeps focused compatibility drafts inside the stricter validation bar', () => {
    const leftOnReadInput = createCompatibilityGenerationInput(
      'CRUSH',
      'INFJ',
      'ENTP',
      'COMPAT_ROMANCE_LEFT_ON_READ'
    );
    const businessPartnerInput = createCompatibilityGenerationInput(
      'BUSINESS_PARTNER',
      'INTJ',
      'ENTJ',
      'COMPAT_WORK_BUSINESS_PARTNER'
    );

    const leftOnReadDraft = buildRuleBasedDraft(leftOnReadInput, 'rule-only');
    const businessPartnerDraft = buildRuleBasedDraft(
      businessPartnerInput,
      'rule-only'
    );

    expect(
      validateGeneratedCandidate(leftOnReadInput, leftOnReadDraft)
    ).toEqual([]);
    expect(
      validateGeneratedCandidate(businessPartnerInput, businessPartnerDraft)
    ).toEqual([]);
  });

  it('keeps basic compatibility drafts inside the validation bar', () => {
    const basicInput = createCompatibilityGenerationInput(
      'BASIC',
      'INFJ',
      'ENFP',
      'COMPAT_BASIC'
    );
    const basicDraft = buildRuleBasedDraft(basicInput, 'rule-only');

    expect(validateGeneratedCandidate(basicInput, basicDraft)).toEqual([]);
  });

  it('flags mbti-forward openings for basic compatibility too', () => {
    const candidate = createValidCandidate({
      summary:
        'MBTI로 보면 두 사람은 비슷한 방식으로 생각하는 편이라 기본 궁합도 무난합니다.',
      sectionsJson: {
        ...createValidCandidate().sectionsJson,
        overview:
          'MBTI로 보면 두 사람은 비슷한 방식으로 생각하는 편이라 기본 궁합도 무난합니다. 관계의 결을 더 보면 안정적입니다.'
      }
    });

    const issues = validateGeneratedCandidate(
      createCompatibilityGenerationInput(
        'BASIC',
        'INFJ',
        'ENFP',
        'COMPAT_BASIC'
      ),
      candidate
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        '요약이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '먼저 읽을 결론이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '요약과 먼저 읽을 결론의 시작 문장이 너무 비슷합니다.'
      ])
    );
  });

  it('flags too-short final content and fills blanks from draft when finalizing', () => {
    const tooShort = createValidCandidate({
      summary: '짧음',
      sectionsJson: {
        ...createValidCandidate().sectionsJson,
        overview: '너무 짧음',
        coreSignal: '짧음'
      }
    });

    expect(validateFinalGuard(tooShort)).toEqual(
      expect.arrayContaining([
        '요약 길이가 너무 짧습니다.',
        '전체 흐름 섹션이 너무 짧습니다.',
        '핵심 포인트 섹션이 너무 짧습니다.'
      ])
    );

    const draft = createValidCandidate();
    const candidate: LlmCandidate = {
      summary: '  ',
      sectionsJson: {
        ...draft.sectionsJson,
        overview: '  ',
        actions: ['둘째 행동', '넷째 행동'],
        sajuEvidence: ['근거 넷']
      }
    };

    const finalized = finalizeContent(
      createSelfGenerationInput('WEALTH'),
      candidate,
      draft
    );

    expect(finalized.summary).toBe(draft.summary);
    expect(finalized.sectionsJson.overview).toBe(draft.sectionsJson.overview);
    expect(finalized.sectionsJson.actions).toEqual([
      '둘째 행동',
      '넷째 행동',
      '첫 행동'
    ]);
    expect(finalized.sectionsJson.sajuEvidence).toEqual([
      '근거 넷',
      '근거 하나',
      '근거 둘',
      '근거 셋'
    ]);
  });

  it('restores mbti-first openings only for basic self readings', () => {
    const input = createSelfGenerationInput('BASIC');
    const draft = buildRuleBasedDraft(input, 'rule-only');
    const candidate: LlmCandidate = {
      summary:
        '기본 해석: 지금은 강점과 약점의 균형을 먼저 정리할수록 전체 흐름이 안정됩니다. MBTI로 보면 User님은 사람의 마음과 목표를 함께 보는 균형감이 강합니다.',
      sectionsJson: {
        ...draft.sectionsJson,
        overview:
          '지금의 기본 흐름은 강점과 약점을 함께 정리할 때 더 안정적으로 이어집니다. MBTI로 보면 User님은 사람의 마음과 목표를 함께 보는 균형감이 강합니다.',
        narrativeFlow:
          '요즘 중요한 것은 전체 삶의 흐름을 생활 안에서 어떻게 정리하느냐입니다. INFJ 성향답게 타이밍을 살피는 편이지만 지금은 기준을 먼저 세우는 편이 더 유리합니다.',
        wealthFlow:
          '재물은 새는 구간을 막고 안정적인 루트를 넓히는 쪽이 맞습니다. MBTI로 보면 User님은 돈과 일에서는 기준을 세운 뒤 깊게 파고드는 편입니다.',
        timingHint:
          '지금은 빠른 결정보다 확인 과정을 거친 움직임이 더 잘 맞습니다. MBTI로 보면 User님은 타이밍을 살피는 편입니다.',
        caution:
          '지출과 관계가 한꺼번에 얽히면 판단이 잠깐 급해질 수 있습니다. MBTI로 보면 User님은 좋은 관계를 지키려다 내 기준이 흐려질 수 있습니다.'
      }
    };

    const finalized = finalizeContent(input, candidate, draft);

    expect(
      finalized.summary.startsWith('기본 해석: INFJ 성향인 User님은')
    ).toBe(true);
    expect(
      finalized.sectionsJson.overview.startsWith('INFJ 성향인 User님은')
    ).toBe(true);
    expect(
      finalized.sectionsJson.narrativeFlow?.startsWith('INFJ 성향인 User님은')
    ).toBe(true);
    expect(
      finalized.sectionsJson.wealthFlow?.startsWith('INFJ 성향인 User님은')
    ).toBe(true);
    expect(
      finalized.sectionsJson.timingHint?.startsWith('INFJ 성향인 User님은')
    ).toBe(true);
    expect(
      finalized.sectionsJson.caution?.startsWith('INFJ 성향인 User님은')
    ).toBe(true);
  });

  it('keeps non-basic self sections question-led even if llm reintroduces mbti openings', () => {
    const input = createSelfGenerationInput(
      'LIFETIME_FLOW',
      'INFJ',
      'SELF_LIFETIME_FLOW'
    );
    const draft = buildRuleBasedDraft(input, 'rule-only');
    const candidate: LlmCandidate = {
      summary:
        'INFJ 성향인 User님은 혼자서도 방향을 정리하는 힘이 강합니다. 평생 총운의 결론은 생활 리듬을 다지는 쪽입니다.',
      sectionsJson: {
        ...draft.sectionsJson,
        overview:
          'INFJ 성향인 User님은 혼자서도 방향을 정리하는 힘이 강합니다. 평생 총운은 어떻게 오래 잘 풀릴지 보는 질문입니다.',
        narrativeFlow:
          'INFJ 성향인 User님은 눈앞의 사실과 컨디션을 확인하며 움직일 때 실수가 줄어듭니다. 지금 몇 년은 방향 재정렬의 가치가 큽니다.',
        timingHint:
          'INFJ 성향인 User님은 눈앞의 사실과 컨디션을 확인하며 움직일 때 실수가 줄어듭니다. 중요한 결정은 오전에 하는 편이 좋습니다.',
        caution:
          'INFJ 성향인 User님은 배려가 앞서 결정을 미루거나 선을 흐릴 수 있습니다. 장기 질문일수록 현재 결정을 미루지 마세요.'
      }
    };

    const finalized = finalizeContent(input, candidate, draft);

    expect(finalized.summary).toBe(draft.summary);
    expect(finalized.sectionsJson.overview).toBe(draft.sectionsJson.overview);
    expect(finalized.sectionsJson.narrativeFlow).toBe(
      draft.sectionsJson.narrativeFlow
    );
    expect(finalized.sectionsJson.timingHint).toBe(
      draft.sectionsJson.timingHint
    );
    expect(finalized.sectionsJson.caution).toBe(draft.sectionsJson.caution);
  });

  it('keeps focused self summary and overview question-led even if llm reintroduces mbti openings', () => {
    const input = createSelfGenerationInput(
      'WEALTH',
      'INFJ',
      'SELF_WEALTH_LEAK'
    );
    const draft = buildRuleBasedDraft(input, 'rule-only');
    const candidate: LlmCandidate = {
      summary:
        'INFJ 성향인 User님은 주변 분위기를 먼저 살피는 편이라 내 소비 점검이 늦어질 수 있습니다. 이번 해석은 돈이 왜 새는지부터 봅니다.',
      sectionsJson: {
        ...draft.sectionsJson,
        overview:
          'INFJ 성향인 User님은 사람과 상황을 먼저 읽는 편입니다. 이번 질문은 왜 멈춰야 할 장면에서 결제가 이어지는지를 보는 쪽이 핵심입니다.'
      }
    };

    const finalized = finalizeContent(input, candidate, draft);

    expect(finalized.summary).toBe(draft.summary);
    expect(finalized.sectionsJson.overview).toBe(draft.sectionsJson.overview);
    expect(finalized.summary.startsWith('INFJ 성향인')).toBe(false);
    expect(finalized.sectionsJson.overview.startsWith('INFJ 성향인')).toBe(
      false
    );
  });

  it('flags mbti-forward openings and duplicated openings for focused scenarios', () => {
    const input = createSelfGenerationInput(
      'WEALTH',
      'INFJ',
      'SELF_WEALTH_LEAK'
    );
    const candidate = createValidCandidate({
      summary:
        'INFJ 성향인 User님은 감정을 먼저 읽는 편이라 지출 점검이 뒤로 밀릴 수 있습니다. 이번 질문은 돈이 왜 새는지를 봅니다.',
      sectionsJson: {
        ...createValidCandidate().sectionsJson,
        overview:
          'INFJ 성향인 User님은 감정을 먼저 읽는 편이라 지출 점검이 뒤로 밀릴 수 있습니다. 이번 질문은 돈이 왜 새는지를 봅니다.',
        narrativeFlow:
          'INFJ 성향인 User님은 감정을 먼저 읽는 편이라 소비의 장면을 뒤늦게 정리하기 쉽습니다. 지금은 왜 새는지의 패턴을 읽는 일이 먼저입니다.',
        timingHint:
          'INFJ 성향인 User님은 타이밍을 살피는 편이라 결정을 미루기 쉽습니다. 이번에는 새는 장면을 빨리 끊는 쪽이 중요합니다.',
        caution:
          'INFJ 성향인 User님은 좋은 마음 때문에 기준을 늦게 세우기 쉽습니다. 돈이 새는 이유를 관계 탓으로만 넘기지 마세요.'
      }
    });

    const issues = validateGeneratedCandidate(input, candidate);

    expect(issues).toEqual(
      expect.arrayContaining([
        '요약이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '먼저 읽을 결론이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '요약과 먼저 읽을 결론의 시작 문장이 너무 비슷합니다.',
        '풀이 본문이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '타이밍 섹션이 아직 MBTI 소개 문장으로 먼저 열립니다.',
        '주의 섹션이 아직 MBTI 소개 문장으로 먼저 열립니다.'
      ])
    );
  });
});
