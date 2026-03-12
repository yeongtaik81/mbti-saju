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
      sajuEvidence: ['근거 하나', '근거 둘', '근거 셋'],
      sajuBasis:
        '일간과 월지, 오행 분포를 함께 읽어 지금의 사주 바탕을 정리했습니다.',
      subjectLens:
        '현재 주제는 재물 흐름을 지키면서도 확장 여지를 살피는 방향으로 읽힙니다.',
      narrativeFlow:
        '이야기 흐름은 서두르지 않는 축적과 때를 보는 움직임이 핵심입니다.',
      tenYearFlow:
        '10년 흐름은 기반을 먼저 다지고 이후 확장으로 이어지는 구조입니다.',
      currentDaewoon:
        '현재 대운은 외부 확장보다 내부 정비가 먼저 필요한 구간입니다.',
      yearlyFlow:
        '올해 흐름은 상반기보다 하반기에 결실이 모이는 쪽으로 읽힙니다.',
      wealthFlow:
        '재물 흐름은 새는 구간을 막고 안정적인 루트를 넓히는 쪽이 맞습니다.',
      relationshipFlow:
        '관계 흐름은 강한 주장보다 기대치를 맞추는 방식이 유리합니다.',
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

    const finalized = finalizeContent(candidate, draft);

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

  it('restores mbti-first openings when the llm moves mbti later in the sentence', () => {
    const input = createSelfGenerationInput('WEALTH');
    const draft = buildRuleBasedDraft(input, 'rule-only');
    const candidate: LlmCandidate = {
      summary:
        '재물운: 지금은 수입과 지출의 기준을 먼저 정리할수록 흐름이 안정됩니다. MBTI로 보면 User님은 사람의 마음과 목표를 함께 보는 균형감이 강합니다.',
      sectionsJson: {
        ...draft.sectionsJson,
        overview:
          '지금의 재물 흐름은 지출 기준과 수입 루트를 함께 정리할 때 더 안정적으로 이어집니다. MBTI로 보면 User님은 사람의 마음과 목표를 함께 보는 균형감이 강합니다.',
        narrativeFlow:
          '요즘 중요한 것은 재물의 흐름을 생활 안에서 어떻게 정리하느냐입니다. INFJ 성향답게 타이밍을 살피는 편이지만 지금은 기준을 먼저 세우는 편이 더 유리합니다.',
        wealthFlow:
          '재물은 새는 구간을 막고 안정적인 루트를 넓히는 쪽이 맞습니다. MBTI로 보면 User님은 돈과 일에서는 기준을 세운 뒤 깊게 파고드는 편입니다.',
        timingHint:
          '지금은 빠른 결정보다 확인 과정을 거친 움직임이 더 잘 맞습니다. MBTI로 보면 User님은 타이밍을 살피는 편입니다.',
        caution:
          '지출과 관계가 한꺼번에 얽히면 판단이 잠깐 급해질 수 있습니다. MBTI로 보면 User님은 좋은 관계를 지키려다 내 기준이 흐려질 수 있습니다.'
      }
    };

    const finalized = finalizeContent(candidate, draft);

    expect(finalized.summary.startsWith('재물운: INFJ 성향인 User님은')).toBe(
      true
    );
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
});
