import { describe, expect, it } from 'vitest';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import {
  createCompatibilityGenerationInput,
  createSelfGenerationInput
} from './fixtures';

describe('rule based saju draft', () => {
  it('assigns a wealth archetype and reflects it in the wealth flow', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH'),
      'rule-only'
    );

    const archetype = draft.internalMetadata.subjectArchetypes?.user;

    expect(archetype).toBeDefined();
    expect(archetype?.code).toBeTruthy();
    expect(draft.sectionsJson.wealthFlow).toContain(archetype!.description);
    expect(draft.sectionsJson.actions).toHaveLength(3);
  });

  it('applies a self scenario overlay for basic readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('BASIC', 'INFJ', 'SELF_BASIC'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('기본 해석');
    expect(draft.sectionsJson.subjectLens).toContain(
      '가장 오래 설명해 주는 결'
    );
    expect(draft.sectionsJson.currentDaewoon).toContain('기본 힘');
    expect(draft.sectionsJson.yearlyFlow).toContain('전체 방향');
    expect(draft.sectionsJson.actions[0]).toContain('가장 믿고 가도 되는 강점');
  });

  it('applies a self scenario overlay for lifetime flow readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('LIFETIME_FLOW', 'INFJ', 'SELF_LIFETIME_FLOW'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('평생 총운');
    expect(draft.sectionsJson.subjectLens).toContain(
      '내 삶에서 어떤 결이 계속 살아남는지'
    );
    expect(draft.sectionsJson.currentDaewoon).toContain('현재 위치');
    expect(draft.sectionsJson.tenYearFlow).toContain(
      '어떤 방식으로 오래 쌓아 갈 때'
    );
    expect(draft.summary).not.toContain('성향인');
    expect(draft.sectionsJson.overview).not.toContain('성향인');
    expect(draft.sectionsJson.narrativeFlow?.startsWith('INFJ 성향인')).toBe(
      false
    );
    expect(draft.sectionsJson.timingHint?.startsWith('INFJ 성향인')).toBe(
      false
    );
    expect(draft.sectionsJson.caution?.startsWith('INFJ 성향인')).toBe(false);
    expect(draft.sectionsJson.actions[0]).toContain('계속 잘됐던 방식');
  });

  it('applies a self scenario overlay for daeun readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('DAEUN', 'INFJ', 'SELF_DAEUN'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('현재 대운');
    expect(draft.sectionsJson.subjectLens).toContain(
      '무엇을 다지고 무엇을 줄여야'
    );
    expect(draft.sectionsJson.currentDaewoon).toContain('현재 대운');
    expect(draft.sectionsJson.tenYearFlow).toContain('다음 흐름의 바탕');
    expect(draft.summary).not.toContain('성향인');
    expect(draft.sectionsJson.overview).not.toContain('성향인');
    expect(draft.sectionsJson.narrativeFlow?.startsWith('INFJ 성향인')).toBe(
      false
    );
    expect(draft.sectionsJson.timingHint?.startsWith('INFJ 성향인')).toBe(
      false
    );
    expect(draft.sectionsJson.caution?.startsWith('INFJ 성향인')).toBe(false);
    expect(draft.sectionsJson.actions[0]).toContain('꼭 굳히고 싶은 기준');
  });

  it('applies a self scenario overlay for luck-up readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('LUCK_UP', 'INFJ', 'SELF_LUCK_UP'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('개운법');
    expect(draft.sectionsJson.subjectLens).toContain('생활 리듬');
    expect(draft.sectionsJson.yearlyFlow).toContain('반복 가능한 한두 가지');
    expect(draft.sectionsJson.timingHint).toContain('같은 시간과 같은 순서');
    expect(draft.sectionsJson.actions[0]).toContain('개운 루틴');
  });

  it('applies a self scenario overlay for wealth leak readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH', 'INFJ', 'SELF_WEALTH_LEAK'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('돈이 새는 이유');
    expect(draft.sectionsJson.narrativeFlow).toContain(
      '모르는 사이 빠져나가는 돈'
    );
    expect(draft.sectionsJson.actions[0]).toContain('지난 7일 지출');
  });

  it('applies a self scenario overlay for reconciliation readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE', 'INFJ', 'SELF_LOVE_RECONCILIATION'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('재회 가능성');
    expect(draft.sectionsJson.subjectLens).toContain('막혔던 패턴');
    expect(draft.sectionsJson.relationshipFlow).toContain('재회 가능성');
    expect(draft.sectionsJson.actions[0]).toContain('달라져야 할 점');
  });

  it('applies a self scenario overlay for contact return readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE', 'INFJ', 'SELF_LOVE_CONTACT_RETURN'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('다시 연락 올까');
    expect(draft.sectionsJson.subjectLens).toContain('어떤 태도로 받아야');
    expect(draft.sectionsJson.relationshipFlow).toContain('다시 연락 올까');
    expect(draft.sectionsJson.actions[0]).toContain('반응 방식');
  });

  it('applies a self scenario overlay for yearly fortune readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput(
        'YEAR_MONTH_DAY_FORTUNE',
        'INFJ',
        'SELF_YEARLY_FORTUNE'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('올해 운');
    expect(draft.sectionsJson.subjectLens).toContain('밀어도 되는 영역');
    expect(draft.sectionsJson.yearlyFlow).toContain('한두 가지를 선명하게');
    expect(draft.sectionsJson.tenYearFlow).toContain('방향을 정리하는 해');
    expect(draft.sectionsJson.timingHint).toContain('상반기와 하반기');
    expect(draft.sectionsJson.actions[0]).toContain('밀고 싶은 영역');
  });

  it('applies a self scenario overlay for general wealth readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH', 'INFJ', 'SELF_WEALTH_GENERAL'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('재물운');
    expect(draft.sectionsJson.subjectLens).toContain('남기는 사람이 되는 흐름');
    expect(draft.sectionsJson.currentDaewoon).toContain('돈 기준');
    expect(draft.sectionsJson.yearlyFlow).toContain('돈이 오래 남는 구조');
    expect(draft.sectionsJson.wealthFlow).toContain(
      '수입보다 돈을 다루는 습관'
    );
    expect(draft.sectionsJson.actions[0]).toContain('들어오는 길 1개');
  });

  it('assigns a career archetype and keeps the subject lens populated', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('CAREER'),
      'rule-only'
    );

    const archetype = draft.internalMetadata.subjectArchetypes?.user;

    expect(archetype).toBeDefined();
    expect(draft.sectionsJson.subjectLens).toContain(archetype!.description);
    expect(draft.sectionsJson.sajuEvidence?.length ?? 0).toBeGreaterThanOrEqual(
      4
    );
  });

  it('keeps focused romance scenarios distinct from each other', () => {
    const reconciliation = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE', 'INFJ', 'SELF_LOVE_RECONCILIATION'),
      'rule-only'
    );
    const contactReturn = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE', 'INFJ', 'SELF_LOVE_CONTACT_RETURN'),
      'rule-only'
    );
    const confessionTiming = buildRuleBasedDraft(
      createSelfGenerationInput(
        'ROMANCE',
        'INFJ',
        'SELF_LOVE_CONFESSION_TIMING'
      ),
      'rule-only'
    );

    expect(reconciliation.summary).not.toEqual(contactReturn.summary);
    expect(contactReturn.summary).not.toEqual(confessionTiming.summary);
    expect(reconciliation.summary).toContain(
      '다시 만나도 덜 다칠 구조가 생겼는지'
    );
    expect(contactReturn.summary).toContain(
      '연락 뒤 관계가 다시 편안해질 여지'
    );
    expect(confessionTiming.summary).toContain(
      '고백 뒤의 어색함까지 감당할 관계 온도'
    );
    expect(reconciliation.sectionsJson.subjectLens).toContain(
      '반가움과 안정 가능성'
    );
    expect(contactReturn.sectionsJson.subjectLens).toContain(
      '연락을 받는 순간'
    );
    expect(confessionTiming.sectionsJson.subjectLens).toContain(
      '관계가 감당할 수 있는 타이밍'
    );
    expect(reconciliation.sectionsJson.actions[0]).toContain(
      '다시 이어지고 싶은 이유'
    );
    expect(contactReturn.sectionsJson.actions[0]).toContain('반응 방식');
    expect(confessionTiming.sectionsJson.actions[0]).toContain('고백 전');
    expect(reconciliation.sectionsJson.overview).toContain(
      '이전의 끊긴 이유가 지금은 달라질 수 있는지'
    );
    expect(contactReturn.sectionsJson.overview).toContain(
      '연락이 닿았을 때 내가 어떻게 받아야 덜 흔들리는지'
    );
    expect(confessionTiming.sectionsJson.overview).toContain(
      '관계 온도, 상대의 반응 여지, 고백 후 이어질 리듬'
    );
    expect(reconciliation.sectionsJson.narrativeFlow).toContain(
      '다시 보고 싶은 마음과 다시 버틸 수 있는 마음'
    );
    expect(contactReturn.sectionsJson.narrativeFlow).toContain(
      '연락 유무가 하루 리듬을 좌우하지 않게'
    );
    expect(confessionTiming.sectionsJson.narrativeFlow).toContain(
      '마음을 빨리 확인받고 싶은 조급함'
    );
    expect(reconciliation.sectionsJson.coreSignal).toContain(
      '다시 만나도 괜찮을 조건'
    );
    expect(contactReturn.sectionsJson.coreSignal).toContain('반응선');
    expect(confessionTiming.sectionsJson.coreSignal).toContain(
      '관계가 감당할 수 있는 속도'
    );
    expect(reconciliation.sectionsJson.caution).toContain(
      '재회 판단에서는 반가움이 기준'
    );
    expect(contactReturn.sectionsJson.caution).toContain(
      '연락 기다림은 침묵에 의미'
    );
    expect(confessionTiming.sectionsJson.caution).toContain(
      '고백 고민은 불안을 빨리 끝내고 싶은 마음'
    );
    expect(reconciliation.sectionsJson.timingHint).toContain(
      '예전보다 다른 말 순서'
    );
    expect(contactReturn.sectionsJson.timingHint).toContain(
      '내가 흔들리지 않을 시간대'
    );
    expect(confessionTiming.sectionsJson.timingHint).toContain(
      '고백 뒤의 어색함'
    );
    expect(reconciliation.sectionsJson.relationshipFlow).toContain(
      '예전과 다른 경계와 대화 순서'
    );
    expect(contactReturn.sectionsJson.relationshipFlow).toContain(
      '답장 횟수보다 말이 다시 편안해지는 속도'
    );
    expect(confessionTiming.sectionsJson.relationshipFlow).toContain(
      '상대가 부담 없이 한 걸음 더 들어올 여유'
    );
    expect(reconciliation.sectionsJson.reflectionQuestion).toContain(
      '다시 만나고 싶은 마음'
    );
    expect(contactReturn.sectionsJson.reflectionQuestion).toContain(
      '연락이 온다면'
    );
    expect(confessionTiming.sectionsJson.reflectionQuestion).toContain(
      '지금의 고백'
    );
    expect(
      reconciliation.sectionsJson.sajuEvidence?.length ?? 0
    ).toBeGreaterThanOrEqual(5);
  });

  it('keeps focused work and money scenarios distinct from each other', () => {
    const aptitude = buildRuleBasedDraft(
      createSelfGenerationInput('CAREER', 'INFJ', 'SELF_CAREER_APTITUDE'),
      'rule-only'
    );
    const jobChange = buildRuleBasedDraft(
      createSelfGenerationInput('CAREER', 'INFJ', 'SELF_CAREER_JOB_CHANGE'),
      'rule-only'
    );
    const accumulation = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH', 'INFJ', 'SELF_WEALTH_ACCUMULATION'),
      'rule-only'
    );
    const leak = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH', 'INFJ', 'SELF_WEALTH_LEAK'),
      'rule-only'
    );

    expect(aptitude.summary).not.toEqual(jobChange.summary);
    expect(accumulation.summary).not.toEqual(leak.summary);
    expect(aptitude.summary).toContain(
      '반복할수록 실력이 붙고 체력이 남는 일 구조'
    );
    expect(jobChange.summary).toContain(
      '다음 자리에서 어떤 결과를 낼 사람인지'
    );
    expect(accumulation.summary).toContain('들어온 돈이 자동으로 남는 구조');
    expect(leak.summary).toContain(
      '피로와 감정이 어떤 순간 소비 버튼으로 번지는지'
    );
    expect(leak.summary).toContain('새는 장면 한두 개를 먼저 막는 쪽');
    expect(leak.summary).not.toContain('성향인');
    expect(aptitude.sectionsJson.subjectLens).toContain(
      '흥미와 체력과 결과 방식'
    );
    expect(jobChange.sectionsJson.subjectLens).toContain('떠나고 싶다');
    expect(accumulation.sectionsJson.wealthFlow).toContain('오래 남는지');
    expect(leak.sectionsJson.wealthFlow).toContain('패턴이 더 중요');
    expect(aptitude.sectionsJson.overview).toContain(
      '반복할수록 내 장점이 더 또렷해지는 일'
    );
    expect(jobChange.sectionsJson.overview).toContain(
      '다음 자리에서 어떤 성과 방식으로 살아날지'
    );
    expect(accumulation.sectionsJson.overview).toContain(
      '유지 기준과 자동으로 남는 구조'
    );
    expect(leak.sectionsJson.overview).toContain(
      '피로, 관계, 충동, 죄책감이 소비로 번지는 구조'
    );
    expect(leak.sectionsJson.overview).not.toContain('성향인');
    expect(leak.summary).not.toEqual(leak.sectionsJson.overview);
    expect(aptitude.sectionsJson.narrativeFlow).toContain(
      '성과 압박이 아니라 반복 실험'
    );
    expect(jobChange.sectionsJson.narrativeFlow).toContain(
      '떠날 이유보다 다음 자리 문장을 먼저 세우는 편'
    );
    expect(accumulation.sectionsJson.narrativeFlow).toContain(
      '수입 크기보다 유지 구조를 먼저 점검'
    );
    expect(leak.sectionsJson.narrativeFlow).toContain(
      '피로와 소비를 한 줄로 묶기 쉬운 때'
    );
    expect(aptitude.sectionsJson.coreSignal).toContain(
      '반복할수록 기운이 붙는 일 방식'
    );
    expect(jobChange.sectionsJson.coreSignal).toContain('옮겨도 되는 조건');
    expect(accumulation.sectionsJson.coreSignal).toContain('오래 남는 구조');
    expect(leak.sectionsJson.coreSignal).toContain(
      '왜 돈이 자꾸 새는지의 패턴'
    );
    expect(jobChange.sectionsJson.caution).toContain(
      '현재 피로가 다음 자리의 현실 조건'
    );
    expect(leak.sectionsJson.caution).toContain(
      '필요한 지출과 불안을 달래는 소비'
    );
    expect(jobChange.sectionsJson.timingHint).toContain(
      '다음 자리에서 보여 줄 결과를 짧게 말할 수 있을 때'
    );
    expect(leak.sectionsJson.timingHint).toContain('감정이 덜 올라온 낮 시간');
    expect(aptitude.sectionsJson.wealthFlow).toContain(
      '반복할수록 기운이 남고 결과가 쌓이는 일 방식'
    );
    expect(jobChange.sectionsJson.wealthFlow).toContain(
      '다음 자리에서 보여 줄 결과와 버틸 생활 리듬'
    );
    expect(accumulation.sectionsJson.wealthFlow).toContain(
      '자동으로 남게 만드는 구조'
    );
    expect(leak.sectionsJson.wealthFlow).toContain(
      '어떤 상황과 감정에서 지출 버튼'
    );
    expect(aptitude.sectionsJson.actions[0]).toContain('에너지가 남는 일');
    expect(jobChange.sectionsJson.actions[0]).toContain('다음 자리');
    expect(leak.sectionsJson.actions[0]).toContain('생각 없이 나간 돈');
    expect(aptitude.sectionsJson.reflectionQuestion).toContain(
      '반복할수록 체력이 남고'
    );
    expect(jobChange.sectionsJson.reflectionQuestion).toContain(
      '떠나고 싶은 이유'
    );
    expect(leak.sectionsJson.reflectionQuestion).toContain('감정 트리거');
  });

  it('applies a self scenario overlay for general career readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('CAREER', 'INFJ', 'SELF_CAREER_GENERAL'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('직업운');
    expect(draft.sectionsJson.subjectLens).toContain('오래 가는지');
    expect(draft.sectionsJson.currentDaewoon).toContain(
      '내 방식이 통하는 자리'
    );
    expect(draft.sectionsJson.yearlyFlow).toContain('잘하는 것을 더 또렷하게');
    expect(draft.sectionsJson.wealthFlow).toContain('직업 흐름');
    expect(draft.sectionsJson.actions[0]).toContain('잘되는 방식');
  });

  it('applies a self scenario overlay for job change readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('CAREER', 'INFJ', 'SELF_CAREER_JOB_CHANGE'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('이직 타이밍');
    expect(draft.sectionsJson.currentDaewoon).toContain('다음 자리');
    expect(draft.sectionsJson.yearlyFlow).toContain('원하는 조건');
    expect(draft.sectionsJson.wealthFlow).toContain('버틸 생활 리듬');
    expect(draft.sectionsJson.caution).toContain('떠나는 이유');
    expect(draft.sectionsJson.actions[0]).toContain('다음 자리');
  });

  it('keeps romance readings specialized and narrative rich', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE'),
      'rule-only'
    );

    expect(draft.internalMetadata.subjectArchetypes?.user).toBeDefined();
    expect(draft.sectionsJson.relationshipFlow).toBeTruthy();
    expect(draft.sectionsJson.timingHint).toBeTruthy();
    expect(draft.summary).toContain('연애운');
  });

  it('applies a self scenario overlay for general love readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('ROMANCE', 'INFJ', 'SELF_LOVE_GENERAL'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('내 연애운');
    expect(draft.sectionsJson.subjectLens).toContain('어떤 속도와 온도');
    expect(draft.sectionsJson.yearlyFlow).toContain('자연스럽게 이어지는 사람');
    expect(draft.sectionsJson.relationshipFlow).toContain('오래 편안한 관계');
    expect(draft.sectionsJson.actions[0]).toContain('끌리는 관계');
  });

  it('applies a self scenario overlay for marriage readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('MARRIAGE', 'INFJ', 'SELF_MARRIAGE_GENERAL'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('결혼운/배우자운');
    expect(draft.sectionsJson.subjectLens).toContain('가장 안정되고');
    expect(draft.sectionsJson.currentDaewoon).toContain('생활 리듬');
    expect(draft.sectionsJson.yearlyFlow).toContain('기준을 정리하는 힘');
    expect(draft.sectionsJson.relationshipFlow).toContain('생활 감각');
    expect(draft.sectionsJson.actions[0]).toContain('오래 함께 살 때');
  });

  it('assigns a compatibility archetype and produces compatibility sections', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput('LOVER'),
      'rule-only'
    );

    const archetype = draft.internalMetadata.subjectArchetypes?.compatibility;

    expect(archetype).toBeDefined();
    expect(draft.sectionsJson.overview).toContain(archetype!.description);
    expect(draft.sectionsJson.pairDynamic).toBeTruthy();
    expect(draft.sectionsJson.communicationTip).toBeTruthy();
  });

  it('keeps focused compatibility romance scenarios distinct from each other', () => {
    const ex = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'LOVER',
        'INFJ',
        'ENTJ',
        'COMPAT_ROMANCE_EX'
      ),
      'rule-only'
    );
    const leftOnRead = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ENTP',
        'COMPAT_ROMANCE_LEFT_ON_READ'
      ),
      'rule-only'
    );
    const friendToLover = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INTP',
        'ISFJ',
        'COMPAT_ROMANCE_FRIEND_TO_LOVER'
      ),
      'rule-only'
    );

    expect(ex.summary).not.toEqual(leftOnRead.summary);
    expect(leftOnRead.summary).not.toEqual(friendToLover.summary);
    expect(ex.sectionsJson.actions[0]).toContain('달라져야 할 점');
    expect(leftOnRead.sectionsJson.actions[0]).toContain('답장 속도');
    expect(friendToLover.sectionsJson.actions[0]).toContain(
      '친구로 남기고 싶은'
    );
    expect(ex.sectionsJson.overview).toContain(
      '예전에 막혔던 패턴이 지금은 달라질 수 있는지'
    );
    expect(leftOnRead.sectionsJson.overview).toContain(
      '답장 압박, 대화 템포, 관계 정의 부담'
    );
    expect(friendToLover.sectionsJson.overview).toContain(
      '감정선을 한 단계 올릴 수 있는지'
    );
    expect(ex.sectionsJson.coreSignal).toContain('다시 이어져도 괜찮을 구조');
    expect(leftOnRead.sectionsJson.coreSignal).toContain('연락 템포 차이');
    expect(friendToLover.sectionsJson.coreSignal).toContain(
      '친구의 편안함이 설렘으로 자랄 여지'
    );
    expect(ex.sectionsJson.caution).toContain(
      '재회 궁합은 추억이 현실 판단을 덮는 순간'
    );
    expect(leftOnRead.sectionsJson.caution).toContain(
      '읽씹 궁합은 답장 속도 하나가 관계 전체의 의미'
    );
    expect(friendToLover.sectionsJson.caution).toContain(
      '친구에서 연인 흐름은 편안함을 잃고 싶지 않은 마음'
    );
    expect(ex.sectionsJson.timingHint).toContain(
      '예전과 다른 기준을 말할 수 있을 때'
    );
    expect(leftOnRead.sectionsJson.timingHint).toContain(
      '편한 시간대와 말 길이'
    );
    expect(friendToLover.sectionsJson.timingHint).toContain(
      '둘만의 결이 조금 더 선명해질 때'
    );
    expect(ex.sectionsJson.relationshipFlow).toContain('예전과 다른 회복 순서');
    expect(leftOnRead.sectionsJson.relationshipFlow).toContain(
      '연락 템포와 압박감'
    );
    expect(friendToLover.sectionsJson.relationshipFlow).toContain(
      '편안함이 이미 설렘의 긴장'
    );
    expect(ex.sectionsJson.reflectionQuestion).toContain(
      '다시 만나고 싶은 이유'
    );
    expect(leftOnRead.sectionsJson.reflectionQuestion).toContain('답장 속도');
    expect(friendToLover.sectionsJson.reflectionQuestion).toContain(
      '친구로 남기 위한 것'
    );
  });

  it('keeps focused compatibility work scenarios distinct from each other', () => {
    const boss = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MANAGER_MEMBER',
        'ISTJ',
        'ENFP',
        'COMPAT_WORK_BOSS'
      ),
      'rule-only'
    );
    const difficultBoss = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MANAGER_MEMBER',
        'INFJ',
        'ESTJ',
        'COMPAT_WORK_DIFFICULT_BOSS'
      ),
      'rule-only'
    );
    const businessPartner = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'BUSINESS_PARTNER',
        'INTJ',
        'ENTJ',
        'COMPAT_WORK_BUSINESS_PARTNER'
      ),
      'rule-only'
    );

    expect(boss.summary).not.toEqual(difficultBoss.summary);
    expect(difficultBoss.summary).not.toEqual(businessPartner.summary);
    expect(boss.sectionsJson.actions[0]).toContain('보고 기준');
    expect(difficultBoss.sectionsJson.actions[0]).toContain('되물을 기준');
    expect(businessPartner.sectionsJson.actions[0]).toContain('수익 배분');
    expect(boss.sectionsJson.overview).toContain(
      '보고 방식, 우선순위 언어, 중간 공유 리듬'
    );
    expect(difficultBoss.sectionsJson.overview).toContain(
      '지시 방식과 우선순위 언어가 얼마나 불분명한지'
    );
    expect(businessPartner.sectionsJson.overview).toContain(
      '권한, 수익 배분, 철수 기준'
    );
    expect(boss.sectionsJson.coreSignal).toContain('보고 주기와 기대 문장');
    expect(difficultBoss.sectionsJson.coreSignal).toContain(
      '기준 차이가 반복 피로'
    );
    expect(businessPartner.sectionsJson.coreSignal).toContain(
      '역할과 책임 경계'
    );
    expect(boss.sectionsJson.caution).toContain(
      '상사 궁합은 눈치로 맞추려는 습관'
    );
    expect(difficultBoss.sectionsJson.caution).toContain(
      '까다로운 상사 궁합은 감정 소모를 참는 일'
    );
    expect(businessPartner.sectionsJson.caution).toContain(
      '동업 궁합은 신뢰감이 클수록 돈과 철수 기준'
    );
    expect(boss.sectionsJson.timingHint).toContain('중간 공유와 우선순위 확인');
    expect(difficultBoss.sectionsJson.timingHint).toContain(
      '되물을 기준을 짧게'
    );
    expect(businessPartner.sectionsJson.timingHint).toContain(
      '초반에 역할과 돈 기준을 적어 둘 수 있을 때'
    );
    expect(boss.sectionsJson.wealthFlow).toContain(
      '보고 타이밍, 우선순위, 완료 기준'
    );
    expect(difficultBoss.sectionsJson.wealthFlow).toContain(
      '애매한 요청이 어디서부터 반복 소모'
    );
    expect(businessPartner.sectionsJson.wealthFlow).toContain(
      '권한, 수익 배분, 손실 통제 기준'
    );
    expect(boss.sectionsJson.reflectionQuestion).toContain('보고 기준');
    expect(difficultBoss.sectionsJson.reflectionQuestion).toContain(
      '업무 기준 문장'
    );
    expect(businessPartner.sectionsJson.reflectionQuestion).toContain(
      '책임 경계'
    );
  });

  it('applies a compatibility scenario overlay for left-on-read readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ENTP',
        'COMPAT_ROMANCE_LEFT_ON_READ'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('읽씹하는 그 사람');
    expect(draft.sectionsJson.narrativeFlow).toContain('답장');
    expect(draft.sectionsJson.subjectLens).toContain('읽씹');
    expect(draft.sectionsJson.pairDynamic).toContain('답장 템포');
    expect(draft.sectionsJson.communicationTip).toContain('답장 속도');
  });

  it('applies a romance-specific overlay for ex readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'LOVER',
        'INFJ',
        'ENTJ',
        'COMPAT_ROMANCE_EX'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('전연인');
    expect(draft.sectionsJson.subjectLens).toContain('전연인 궁합');
    expect(draft.sectionsJson.conflictTrigger).toContain('같은 패턴');
    expect(draft.sectionsJson.communicationTip).toContain('무엇이 달라져야');
  });

  it('applies a work-specific overlay for difficult boss readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MANAGER_MEMBER',
        'INFJ',
        'ESTJ',
        'COMPAT_WORK_DIFFICULT_BOSS'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('까다로운 상사');
    expect(draft.sectionsJson.subjectLens).toContain('상사 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('업무 기준');
    expect(draft.sectionsJson.communicationTip).toContain(
      '무엇을, 언제까지, 어떤 기준으로'
    );
  });

  it('applies a work-specific overlay for boss readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MANAGER_MEMBER',
        'ISTJ',
        'ENFP',
        'COMPAT_WORK_BOSS'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('상사와 궁합');
    expect(draft.sectionsJson.subjectLens).toContain('상사와 궁합');
    expect(draft.sectionsJson.currentDaewoon).toContain('기준 확인');
    expect(draft.sectionsJson.yearlyFlow).toContain('중간 공유');
    expect(draft.sectionsJson.pairDynamic).toContain('위아래 역할');
    expect(draft.sectionsJson.communicationTip).toContain('중간 공유');
    expect(draft.sectionsJson.timingHint).toContain('보고 타이밍');
    expect(draft.sectionsJson.wealthFlow).toContain('보고 타이밍');
  });

  it('applies a romance-specific overlay for ghosted readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ENFP',
        'COMPAT_ROMANCE_GHOSTED'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('연락 끊긴 썸');
    expect(draft.sectionsJson.subjectLens).toContain('연락이 끊긴 썸');
    expect(draft.sectionsJson.pairDynamic).toContain('답장 부담');
    expect(draft.sectionsJson.communicationTip).toContain('안부 전해');
  });

  it('applies a romance-specific overlay for blind-date readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ESTP',
        'COMPAT_ROMANCE_BLIND_DATE'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('소개팅 상대');
    expect(draft.sectionsJson.subjectLens).toContain('소개팅 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('두 번째 대화');
    expect(draft.sectionsJson.communicationTip).toContain('오늘 반가웠어요');
  });

  it('applies a romance-specific overlay for crush readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ESTP',
        'COMPAT_ROMANCE_CRUSH'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('짝사랑 상대');
    expect(draft.sectionsJson.subjectLens).toContain('가까워졌을 때 관계 리듬');
    expect(draft.sectionsJson.attractionPoint).toContain('자꾸 눈이 가는 이유');
    expect(draft.sectionsJson.communicationTip).toContain('가벼운 공통 화제');
  });

  it('applies a romance-specific overlay for friend-to-lover readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INTP',
        'ISFJ',
        'COMPAT_ROMANCE_FRIEND_TO_LOVER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('친구에서 연인 가능성');
    expect(draft.sectionsJson.subjectLens).toContain('친구에서 연인 가능성');
    expect(draft.sectionsJson.conflictTrigger).toContain('친구의 언어');
    expect(draft.sectionsJson.communicationTip).toContain('진지한 문장');
  });

  it('applies a friend-specific overlay for cut-off 고민 readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'INFJ',
        'ISFP',
        'COMPAT_FRIEND_CUT_OFF'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('손절 고민하는 친구');
    expect(draft.sectionsJson.subjectLens).toContain('손절 고민');
    expect(draft.sectionsJson.conflictTrigger).toContain('작은 무례');
    expect(draft.sectionsJson.communicationTip).toContain('관계의 선');
  });

  it('applies a friend-specific overlay for best friend readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'INFJ',
        'ISFP',
        'COMPAT_FRIEND_BEST'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('베스트 친구');
    expect(draft.sectionsJson.subjectLens).toContain('회복할 힘');
    expect(draft.sectionsJson.pairDynamic).toContain('편안함');
    expect(draft.sectionsJson.communicationTip).toContain('작을 때 바로');
  });

  it('applies a self scenario overlay for cut-off timing readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput(
        'RELATIONSHIPS',
        'INFJ',
        'SELF_RELATIONSHIP_CUT_OFF'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('손절 타이밍');
    expect(draft.sectionsJson.subjectLens).toContain('더 지치고 흐려지는지');
    expect(draft.sectionsJson.currentDaewoon).toContain('관계 기준');
    expect(draft.sectionsJson.yearlyFlow).toContain('덜 지치는 관계');
    expect(draft.sectionsJson.relationshipFlow).toContain('거리 조절인지');
    expect(draft.sectionsJson.actions[0]).toContain('괜찮은 선');
  });

  it('applies a self scenario overlay for general relationship readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput(
        'RELATIONSHIPS',
        'INFJ',
        'SELF_RELATIONSHIP_GENERAL'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('인간관계운');
    expect(draft.sectionsJson.subjectLens).toContain('내 기운을 지키는 거리');
    expect(draft.sectionsJson.yearlyFlow).toContain('오래 갈 관계');
    expect(draft.sectionsJson.relationshipFlow).toContain('덜 지치는 관계');
    expect(draft.sectionsJson.actions[0]).toContain('편해지는 사람');
  });

  it('applies a self scenario overlay for general family readings', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('FAMILY', 'INFJ', 'SELF_FAMILY_GENERAL'),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('가족운');
    expect(draft.sectionsJson.subjectLens).toContain('역할 기대');
    expect(draft.sectionsJson.yearlyFlow).toContain('선을 다시 정리');
    expect(draft.sectionsJson.relationshipFlow).toContain('가까울수록 설명');
    expect(draft.sectionsJson.actions[0]).toContain('지키고 싶은 선');
  });

  it('applies a work-specific overlay for business partner readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'BUSINESS_PARTNER',
        'INTJ',
        'ENTJ',
        'COMPAT_WORK_BUSINESS_PARTNER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('사업 파트너');
    expect(draft.sectionsJson.subjectLens).toContain('동업 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('역할 분담');
    expect(draft.sectionsJson.communicationTip).toContain(
      '돈, 역할, 철수 기준'
    );
    expect(draft.sectionsJson.wealthFlow).toContain('권한, 수익 배분');
    expect(draft.sectionsJson.narrativeFlow?.startsWith('MBTI로 보면')).toBe(
      false
    );
    expect(draft.sectionsJson.relationshipFlow?.startsWith('MBTI로 보면')).toBe(
      false
    );
    expect(draft.sectionsJson.timingHint?.startsWith('MBTI로 보면')).toBe(
      false
    );
    expect(draft.sectionsJson.caution?.startsWith('MBTI로 보면')).toBe(false);
  });

  it('applies a work-specific overlay for coworker readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'COWORKER',
        'INTJ',
        'ENTJ',
        'COMPAT_WORK_COWORKER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('직장 동료');
    expect(draft.sectionsJson.subjectLens).toContain('시작과 마감');
    expect(draft.sectionsJson.pairDynamic).toContain('중간 공유');
    expect(draft.sectionsJson.communicationTip).toContain('기준을 먼저 맞추는');
  });

  it('applies a family-specific overlay for mother-daughter readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'ISFJ',
        'ENFP',
        'COMPAT_FAMILY_MOTHER_DAUGHTER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('엄마와 딸');
    expect(draft.sectionsJson.subjectLens).toContain('엄마와 딸 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('기대와 간섭');
    expect(draft.sectionsJson.communicationTip).toContain(
      '스스로 해 보고 싶어'
    );
  });

  it('applies a family-specific overlay for parent-child readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'ISFJ',
        'ENFP',
        'COMPAT_FAMILY_PARENT_CHILD'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('부모와 자식');
    expect(draft.sectionsJson.subjectLens).toContain('돌봄과 간섭의 선');
    expect(draft.sectionsJson.pairDynamic).toContain('기대 역할');
    expect(draft.sectionsJson.communicationTip).toContain('현재 상태를 먼저');
  });

  it('applies a family-specific overlay for mother-in-law readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'ISFJ',
        'ESTJ',
        'COMPAT_FAMILY_MOTHER_IN_LAW'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('시어머니와 며느리');
    expect(draft.sectionsJson.subjectLens).toContain('시어머니와 며느리 궁합');
    expect(draft.sectionsJson.conflictTrigger).toContain('간섭이나 평가');
    expect(draft.sectionsJson.communicationTip).toContain(
      '가능한 선과 어려운 선'
    );
  });

  it('applies a romance-specific overlay for flirting readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFJ',
        'ENFP',
        'COMPAT_ROMANCE_FLIRTING'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('썸타는 사이');
    expect(draft.sectionsJson.subjectLens).toContain('감정 속도');
    expect(draft.sectionsJson.pairDynamic).toContain('속도 차이');
    expect(draft.sectionsJson.communicationTip).toContain('짧은 대화');
  });

  it('applies a compatibility overview overlay for basic readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'BASIC',
        'INFJ',
        'ENFP',
        'COMPAT_BASIC'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('기본 궁합');
    expect(draft.summary).toContain('두 사람이 편안해지는 리듬');
    expect(draft.summary.startsWith('기본 궁합: MBTI로 보면')).toBe(false);
    expect(draft.sectionsJson.overview.startsWith('MBTI로 보면')).toBe(false);
    expect(draft.sectionsJson.subjectLens).toContain('함께 있을 때 편안해지는');
    expect(draft.sectionsJson.actions[0]).toBeTruthy();
  });

  it('applies a romance-specific overlay for current lover readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'LOVER',
        'INFJ',
        'ENFP',
        'COMPAT_ROMANCE_LOVER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('연인');
    expect(draft.sectionsJson.subjectLens).toContain('현재 연인 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('애정이 분명한');
    expect(draft.sectionsJson.communicationTip).toContain('생활 문장');
  });

  it('applies a romance-specific overlay for marriage partner readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MARRIED',
        'INFJ',
        'ENFP',
        'COMPAT_ROMANCE_MARRIAGE_PARTNER'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('결혼 상대');
    expect(draft.sectionsJson.subjectLens).toContain('결혼 상대 궁합');
    expect(draft.sectionsJson.pairDynamic).toContain('생활 기준이 다르면');
    expect(draft.sectionsJson.communicationTip).toContain('돈, 시간, 가족');
  });

  it('applies a romance-specific overlay for married readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'MARRIED',
        'INFJ',
        'ENFP',
        'COMPAT_ROMANCE_MARRIED'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('부부');
    expect(draft.summary).not.toContain('MBTI로 보면');
    expect(draft.sectionsJson.subjectLens).toContain('부부 궁합');
    expect(draft.summary).toContain('같이 사는 속도와 애정 표현 방식');
    expect(draft.sectionsJson.overview).toContain('다시 가까워지는지');
    expect(draft.sectionsJson.subjectLens).toContain('애정 표현 온도');
    expect(draft.sectionsJson.pairDynamic).toContain('회복 방식');
    expect(draft.sectionsJson.conflictTrigger).toContain('집안일·돈의 서운함');
    expect(draft.sectionsJson.communicationTip).toContain('서운한 지점 1개');
  });

  it('applies a misc overlay for idol readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'CRUSH',
        'INFP',
        'ENFJ',
        'COMPAT_MISC_IDOL'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('아이돌과 나');
    expect(draft.sectionsJson.subjectLens).toContain('아이돌 궁합');
    expect(draft.sectionsJson.attractionPoint).toContain('끌리는 이유');
    expect(draft.sectionsJson.communicationTip).toContain('대화법보다');
  });

  it('applies a friend-specific overlay for travel readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'INFJ',
        'ISFP',
        'COMPAT_FRIEND_TRAVEL'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('여행 메이트');
    expect(draft.sectionsJson.subjectLens).toContain(
      '체력, 시간 감각, 즉흥 일정'
    );
    expect(draft.sectionsJson.pairDynamic).toContain('이동과 선택');
    expect(draft.sectionsJson.communicationTip).toContain(
      '꼭 정할 것과 현장에서 정할 것'
    );
  });

  it('applies a friend-specific overlay for roommate readings', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput(
        'FRIEND',
        'INFJ',
        'ISFP',
        'COMPAT_FRIEND_ROOMMATE'
      ),
      'rule-only'
    );

    expect(draft.sectionsJson.storyTitle).toContain('룸메이트');
    expect(draft.sectionsJson.subjectLens).toContain('생활 소음');
    expect(draft.sectionsJson.conflictTrigger).toContain('작은 소음');
    expect(draft.sectionsJson.communicationTip).toContain(
      '청소, 손님, 취침 시간'
    );
  });
});
