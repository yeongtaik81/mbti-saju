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
    expect(draft.sectionsJson.wealthFlow).toContain(archetype!.label);
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
    expect(draft.sectionsJson.subjectLens).toContain(archetype!.label);
    expect(draft.sectionsJson.sajuEvidence?.length ?? 0).toBeGreaterThanOrEqual(
      4
    );
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
    expect(draft.sectionsJson.wealthFlow).toContain('일의 방식');
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
    expect(draft.sectionsJson.wealthFlow).toContain('다음 자리');
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
    expect(draft.sectionsJson.overview).toContain(archetype!.label);
    expect(draft.sectionsJson.pairDynamic).toBeTruthy();
    expect(draft.sectionsJson.communicationTip).toBeTruthy();
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
