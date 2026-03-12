import type { ScenarioCode, ScenarioOption } from '@/lib/saju/scenarios';

export type ScenarioOverlay = {
  titleLabel: string;
  narrativeAddon?: string;
  subjectLensAddon?: string;
  compatibilityLensAddon?: string;
  currentDaewoonAddon?: string;
  yearlyFlowAddon?: string;
  tenYearFlowAddon?: string;
  timingAddon?: string;
  cautionAddon?: string;
  actionOverride?: string;
  wealthFlowAddon?: string;
  relationshipFlowAddon?: string;
  pairDynamicText?: string;
  attractionPointText?: string;
  conflictTriggerText?: string;
  communicationText?: string;
  communicationAddon?: string;
};

function buildCategoryBase(option: ScenarioOption): ScenarioOverlay {
  switch (option.categoryCode) {
    case 'SELF_TIMING':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 풀이는 '${option.label}'에 집중합니다. ${option.description}`,
        subjectLensAddon:
          '기간 자체를 맞히는 것보다, 이 시기에 무엇을 붙잡고 무엇을 줄여야 하는지 읽는 편이 더 정확합니다.',
        timingAddon:
          '같은 운이라도 생활 리듬을 어떻게 쓰느냐에 따라 체감은 크게 달라집니다.',
        cautionAddon:
          '시기 해석을 핑계로 결정을 미루기보다, 지금 할 수 있는 작은 조정부터 가져가는 편이 좋습니다.'
      };
    case 'SELF_LOVE':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 풀이는 '${option.label}'을 중심으로 읽습니다. ${option.description}`,
        subjectLensAddon:
          '감정의 크기만 보기보다, 관계가 편안하게 이어질 속도와 말의 순서를 같이 보는 편이 좋습니다.',
        timingAddon:
          '마음이 가장 커졌을 때보다, 생활 리듬이 조금 안정된 순간에 움직이는 편이 더 잘 맞습니다.',
        cautionAddon:
          '감정이 앞서면 사소한 신호에도 의미를 크게 싣기 쉬우니, 기대와 사실을 나눠서 보는 태도가 필요합니다.'
      };
    case 'SELF_CAREER':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 풀이는 '${option.label}'을 기준으로 일의 결을 읽습니다. ${option.description}`,
        subjectLensAddon:
          '잘하고 싶은 마음보다, 지금 내 강점이 가장 또렷하게 보이는 자리를 먼저 고르는 편이 유리합니다.',
        timingAddon:
          '일의 전환은 마음이 조급할 때보다 생활과 체력이 함께 버틸 수 있을 때 잡는 편이 낫습니다.',
        cautionAddon:
          '준비가 부족해서가 아니라 방향이 흐려져 힘이 새는 경우가 많으니, 보여줄 결과를 먼저 정해 두는 편이 좋습니다.'
      };
    case 'SELF_WEALTH':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 풀이는 '${option.label}'을 중심으로 돈의 흐름을 읽습니다. ${option.description}`,
        subjectLensAddon:
          '돈을 더 벌 수 있느냐보다, 지금 들어온 돈이 어떻게 머물고 어디서 새는지를 먼저 보는 편이 정확합니다.',
        timingAddon:
          '재물운은 큰 결정보다 반복되는 지출 습관과 점검 리듬에서 체감이 크게 갈립니다.',
        cautionAddon:
          '불안할수록 한 번에 크게 바꾸려 하기보다, 새는 구멍 1개를 먼저 막는 편이 훨씬 효과적입니다.'
      };
    case 'SELF_RELATIONSHIP':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 풀이는 '${option.label}'을 중심으로 관계의 결을 읽습니다. ${option.description}`,
        subjectLensAddon:
          '누가 맞는지보다, 내 에너지가 어디서 지치고 어디서 살아나는지를 먼저 보는 편이 좋습니다.',
        timingAddon:
          '어려운 관계일수록 감정이 가라앉은 뒤 짧고 분명하게 꺼내는 편이 더 맞습니다.',
        cautionAddon:
          '좋은 사람이 되려는 마음이 커질수록 내 기준이 흐려질 수 있어, 경계 문장을 먼저 준비해 두는 것이 필요합니다.'
      };
    case 'COMPAT_ROMANCE':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 궁합은 '${option.label}'이라는 상황을 전제로 읽습니다. ${option.description}`,
        subjectLensAddon:
          '상대 마음을 단정하기보다, 두 사람의 속도와 감정 표현 리듬이 실제로 이어질 수 있는지를 먼저 보는 편이 좋습니다.',
        timingAddon:
          '관계 진전은 감정이 가장 뜨거울 때보다 서로의 일상 템포가 맞을 때 훨씬 자연스럽습니다.',
        cautionAddon:
          '좋은 신호 하나에 너무 큰 기대를 싣거나, 나쁜 신호 하나로 관계 전체를 단정하지 않는 태도가 중요합니다.'
      };
    case 'COMPAT_FRIEND':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 궁합은 '${option.label}'이라는 상황에서 두 사람이 얼마나 편안한지 읽습니다. ${option.description}`,
        subjectLensAddon:
          '친한지 아닌지보다, 서로의 경계와 생활 리듬을 존중할 수 있는지가 더 중요합니다.',
        timingAddon:
          '친구 관계는 큰 대화 한 번보다 자주 오해를 줄이는 작은 확인이 더 잘 먹힙니다.',
        cautionAddon:
          '편하다는 이유로 설명을 생략하면 작은 서운함이 오래 남기 쉬우니, 짧게라도 먼저 말하는 편이 낫습니다.'
      };
    case 'COMPAT_WORK':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 궁합은 '${option.label}'이라는 업무 관계를 전제로 읽습니다. ${option.description}`,
        subjectLensAddon:
          '감정보다 역할, 기준, 기한이 먼저 맞는지를 보는 편이 실제 관계에 더 도움이 됩니다.',
        timingAddon:
          '업무 궁합은 문제 후 수습보다, 시작 전에 기준을 맞춰 둘 때 훨씬 편해집니다.',
        cautionAddon:
          '성격 문제로 받아들이기보다 일 방식 차이로 먼저 읽으면 피로를 크게 줄일 수 있습니다.'
      };
    case 'COMPAT_FAMILY':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 궁합은 '${option.label}' 관계를 중심으로 읽습니다. ${option.description}`,
        subjectLensAddon:
          '가족 관계는 애정의 크기보다 기대 역할과 거리 조절 방식이 더 크게 작동하는 경우가 많습니다.',
        timingAddon:
          '가까운 사이일수록 감정이 높은 날은 결론보다 분위기를 먼저 풀어 주는 편이 낫습니다.',
        cautionAddon:
          '익숙함에 기대어 설명을 줄이면 오해가 오래 남을 수 있어, 가까울수록 맥락을 한 번 더 말하는 편이 필요합니다.'
      };
    case 'COMPAT_MISC':
      return {
        titleLabel: option.label,
        narrativeAddon: `이번 궁합은 '${option.label}'의 끌림과 정서적 합을 중심으로 읽습니다. ${option.description}`,
        subjectLensAddon:
          '현실 관계의 규칙보다, 왜 끌리고 어디서 안정감을 얻는지에 초점을 맞추면 더 잘 읽힙니다.',
        timingAddon:
          '강한 끌림이 생기는 순간일수록 내가 기대하는 모습과 실제 관계의 결을 나눠 보는 편이 좋습니다.',
        cautionAddon:
          '좋아하는 마음만으로 모든 차이를 덮으려 하면 해석이 흐려질 수 있어, 내가 받는 감정과 실제 호흡을 함께 보는 편이 필요합니다.'
      };
  }
}

const SCENARIO_SPECIFIC: Partial<
  Record<ScenarioCode, Partial<ScenarioOverlay>>
> = {
  SELF_BASIC: {
    narrativeAddon:
      '이번 풀이는 타고난 사주의 바탕과 지금 가장 크게 작동하는 운을 한 자리에서 읽습니다.',
    subjectLensAddon:
      '기본 해석은 한 부분만 깊게 보기보다, 지금의 나를 가장 오래 설명해 주는 결이 무엇인지부터 보는 편이 정확합니다.',
    currentDaewoonAddon:
      '지금은 새 기회를 넓게 보는 것보다, 내 기본 힘이 어디서 가장 안정적으로 살아나는지 확인하는 시기로 읽는 편이 맞습니다.',
    yearlyFlowAddon:
      '올해는 전체 방향을 한 번 더 또렷하게 정리할수록, 일과 관계의 선택도 훨씬 덜 흔들립니다.',
    actionOverride:
      '지금 내 사주에서 가장 믿고 가도 되는 강점 1개를 먼저 적어 보기'
  },
  SELF_LIFETIME_FLOW: {
    narrativeAddon:
      '이번 풀이는 평생에 걸쳐 반복되는 강점과, 오래 반복될수록 더 조심해야 하는 패턴을 함께 읽습니다.',
    subjectLensAddon:
      '평생 총운은 한 번의 좋은 시기보다, 내 삶에서 어떤 결이 계속 살아남는지를 보는 데 더 가깝습니다.',
    currentDaewoonAddon:
      '지금 몇 해는 긴 흐름 속에서 현재 위치를 확인하는 구간이라, 앞으로의 방향을 정리하는 데 의미가 큽니다.',
    tenYearFlowAddon:
      '앞으로의 큰 흐름은 눈앞의 사건보다, 어떤 방식으로 오래 쌓아 갈 때 운이 더 크게 열리는지 보여 주는 편입니다.',
    actionOverride:
      '내 삶에서 계속 잘됐던 방식 1개와 반복해서 지쳤던 방식 1개를 나눠 적어 보기'
  },
  SELF_DAEUN: {
    narrativeAddon:
      '이번 풀이는 지금 10년 운이 삶의 무게중심을 어디로 옮기고 있는지 읽습니다.',
    subjectLensAddon:
      '대운은 사건을 맞히는 문제보다, 지금 몇 년 동안 무엇을 다지고 무엇을 줄여야 하는지를 보는 데 더 중요합니다.',
    currentDaewoonAddon:
      '현재 대운은 생활과 선택의 기준을 바꾸는 힘이 커서, 이 흐름을 어떻게 쓰느냐에 따라 체감 차이가 크게 납니다.',
    tenYearFlowAddon:
      '이 10년은 결과 하나보다 방향을 어떻게 굳히느냐가 더 중요하게 작동하고, 다음 흐름의 바탕도 여기서 만들어집니다.',
    actionOverride:
      '지금 10년 안에 꼭 굳히고 싶은 기준 1개를 한 문장으로 정리하기'
  },
  SELF_LOVE_GENERAL: {
    narrativeAddon:
      '이번 풀이는 연애가 잘 되느냐보다, 지금 내 마음이 어디로 향하고 어떤 관계 리듬에서 편안한지를 읽습니다.',
    subjectLensAddon:
      '내 연애운은 상대를 고르는 문제만이 아니라, 내가 어떤 속도와 온도에서 가장 덜 흔들리는지를 먼저 보는 편이 정확합니다.',
    yearlyFlowAddon:
      '올해는 감정이 커지는 사람보다, 관계가 자연스럽게 이어지는 사람을 구분하는 눈이 더 중요하게 작동합니다.',
    relationshipFlowAddon:
      '연애운은 설렘의 크기보다 관계가 이어지는 방식에서 더 또렷하게 드러납니다. 빨리 뜨거워지는 관계보다 오래 편안한 관계를 먼저 가려 보는 편이 좋습니다.',
    actionOverride:
      '지금 내가 끌리는 관계와 편안한 관계가 어떻게 다른지 한 줄씩 적어 보기'
  },
  SELF_LOVE_RECONCILIATION: {
    narrativeAddon:
      '이번 풀이는 다시 만날 수 있는지보다, 다시 만나도 같은 상처를 반복하지 않을 수 있는지를 함께 봅니다.',
    subjectLensAddon:
      '미련의 크기보다, 이전에 막혔던 패턴이 지금은 달라질 수 있는지를 먼저 보는 편이 정확합니다.',
    relationshipFlowAddon:
      '재회 가능성은 마음이 남아 있느냐보다, 다시 이어졌을 때 예전보다 덜 다치게 만날 수 있는지가 더 중요합니다.',
    cautionAddon:
      '반가움만으로 다시 붙으면 예전의 익숙한 상처도 함께 되살아나기 쉬우니, 달라질 부분을 먼저 보는 편이 낫습니다.',
    actionOverride:
      '다시 이어지고 싶은 이유 1개와 달라져야 할 점 1개를 따로 적어 보기'
  },
  SELF_LOVE_CONTACT_RETURN: {
    narrativeAddon:
      '이번 풀이는 연락이 오느냐 자체보다, 연락이 와도 관계가 다시 편안하게 이어질 결이 있는지를 봅니다.',
    subjectLensAddon:
      '연락의 유무보다, 연락이 왔을 때 내가 어떤 태도로 받아야 덜 흔들리는지를 먼저 정해 두는 편이 좋습니다.',
    relationshipFlowAddon:
      '다시 연락 올까라는 질문에는 기다림보다 리듬이 더 중요합니다. 상대의 속도에 끌려가기보다, 내가 흔들리지 않는 반응선부터 세워 두는 편이 정확합니다.',
    cautionAddon:
      '늦은 연락 하나에 의미를 크게 싣기보다, 말이 이어지는 방식과 편안함이 함께 돌아오는지를 같이 봐야 합니다.',
    actionOverride:
      '연락을 기다리는 대신, 내가 먼저 바꿀 수 있는 반응 방식 1개를 정하기'
  },
  SELF_LOVE_CONFESSION_TIMING: {
    narrativeAddon:
      '이번 풀이는 고백의 성공 여부보다, 마음을 전했을 때 관계가 자연스럽게 앞으로 갈 준비가 되어 있는지를 봅니다.',
    actionOverride: '고백 전 내가 바라는 관계를 한 문장으로 먼저 적어 보기'
  },
  SELF_CAREER_APTITUDE: {
    narrativeAddon:
      '이번 풀이는 잘 버는 일보다, 오래 해도 기운이 덜 닳고 실력이 쌓이는 일을 찾는 데 초점을 둡니다.',
    subjectLensAddon:
      '적성은 좋아 보이는 일이 아니라, 반복할수록 강점이 더 또렷해지는 일을 찾는 과정에 가깝습니다.'
  },
  SELF_CAREER_GENERAL: {
    narrativeAddon:
      '이번 풀이는 지금 내 일의 방향이 맞는지, 어디에서 강점이 살아나고 어디에서 힘이 새는지를 분명하게 읽습니다.',
    subjectLensAddon:
      '직업운은 일이 잘 풀리느냐보다, 지금의 내가 어떤 방식으로 일할 때 오래 가는지를 먼저 보는 편이 정확합니다.',
    currentDaewoonAddon:
      '지금 몇 해는 일을 더 늘리기보다, 내 방식이 통하는 자리를 선명하게 만드는 쪽이 더 중요합니다.',
    yearlyFlowAddon:
      '올해는 잘하는 것을 더 또렷하게 보여 주는 쪽이 유리하고, 맞지 않는 방식은 빠르게 정리할수록 훨씬 편해집니다.',
    tenYearFlowAddon:
      '앞으로 10년은 직업의 이름보다 일하는 방식의 축을 제대로 세우는지가 더 중요하게 작동합니다.',
    wealthFlowAddon:
      '직업운은 성과보다 일의 방식에서 먼저 드러나는 경우가 많습니다. 잘 맞는 방식이 선명해지면 결과는 그다음에 따라붙습니다.',
    cautionAddon:
      '지금은 능력이 부족해서보다 방향이 흐려져 힘이 분산되기 쉬우니, 잘해야 할 일을 늘리기보다 가장 맞는 방식부터 선명하게 잡는 편이 낫습니다.',
    actionOverride:
      '지금 일에서 잘되는 방식 1개와 버거운 방식 1개를 분리해서 적어 보기'
  },
  SELF_CAREER_JOB_CHANGE: {
    narrativeAddon:
      '이번 풀이는 무조건 옮기는 쪽보다, 지금 움직였을 때 생활과 체력이 함께 버틸 수 있는지를 먼저 읽습니다.',
    currentDaewoonAddon:
      '지금 흐름은 급하게 벗어나는 것보다, 다음 자리에서 어떤 방식으로 성과를 낼 수 있는지가 분명할 때 움직이는 편이 낫습니다.',
    yearlyFlowAddon:
      '올해는 답답함 때문에 결론을 내리기보다, 원하는 조건과 피하고 싶은 조건을 분리할수록 선택이 선명해집니다.',
    tenYearFlowAddon:
      '앞으로 10년은 한 번의 이직보다, 어떤 환경에서 오래 버틸 수 있는지를 알아 가는 과정이 더 중요합니다.',
    timingAddon:
      '이직은 답답함이 최고조일 때보다, 다음 자리에서 보여 줄 결과를 짧게 정리했을 때 잡는 편이 더 낫습니다.',
    wealthFlowAddon:
      '이직 타이밍은 마음이 떠났느냐보다, 다음 자리에서 내가 어떤 방식으로 성과를 낼 수 있는지가 분명한지를 먼저 봐야 합니다.',
    cautionAddon:
      '지금의 피로를 피하려고만 움직이면 같은 이유로 다시 지치기 쉬우니, 떠나는 이유와 원하는 조건을 분리해서 보는 편이 정확합니다.',
    actionOverride:
      '지금 회사에서 지키고 싶은 것 1개와 다음 자리에서 얻고 싶은 것 1개를 나눠 적기'
  },
  SELF_WEALTH_ACCUMULATION: {
    narrativeAddon:
      '이번 풀이는 돈을 얼마나 크게 벌 수 있느냐보다, 복이 붙은 돈을 오래 남기는 방식을 읽습니다.',
    actionOverride: '이번 달에 남길 돈의 이름을 정하고 자동 이체로 먼저 빼 두기'
  },
  SELF_WEALTH_GENERAL: {
    narrativeAddon:
      '이번 풀이는 막연히 돈복이 있느냐보다, 지금 돈이 어디서 붙고 어디서 힘없이 새는지를 분명하게 읽습니다.',
    subjectLensAddon:
      '재물운은 많이 버는 사람의 흐름과, 남기는 사람이 되는 흐름이 다를 수 있어 둘을 나눠 보는 편이 정확합니다.',
    currentDaewoonAddon:
      '지금 몇 해는 큰 승부보다 내 돈 기준을 세우는 시기로 읽는 편이 더 정확합니다.',
    yearlyFlowAddon:
      '올해는 수입 확대만 보기보다, 돈이 오래 남는 구조를 만드는 쪽이 더 큰 차이를 만듭니다.',
    tenYearFlowAddon:
      '앞으로 10년은 벌이의 크기보다 돈을 다루는 습관이 결과 차이를 더 크게 만들 가능성이 큽니다.',
    wealthFlowAddon:
      '재물운을 볼 때는 수입보다 돈을 다루는 습관이 먼저 보입니다. 크게 늘리기보다 기준을 세우는 쪽이 먼저 맞을 때가 분명히 있습니다.',
    cautionAddon:
      '돈 문제는 불안이 커질수록 감으로 움직이기 쉬우니, 이번 시기에는 숫자 기준을 짧게라도 적어 두는 편이 훨씬 안전합니다.',
    actionOverride:
      '이번 달 돈이 들어오는 길 1개와 새는 길 1개를 따로 적어 보기'
  },
  SELF_WEALTH_LEAK: {
    narrativeAddon:
      '이번 풀이는 수입 확대보다, 모르는 사이 빠져나가는 돈과 마음을 먼저 정리하는 데 집중합니다.',
    subjectLensAddon:
      '돈이 새는 이유는 숫자 문제만이 아니라 피로, 관계, 충동이 어떻게 소비로 이어지는지도 함께 봐야 합니다.',
    actionOverride: '지난 7일 지출에서 “생각 없이 나간 돈” 1가지만 바로 막기'
  },
  SELF_RELATIONSHIP_CUT_OFF: {
    narrativeAddon:
      '이번 풀이는 누군가를 바로 끊어내는 판단보다, 내 에너지를 지키기 위해 어디까지 선을 그어야 하는지를 봅니다.',
    subjectLensAddon:
      '손절 타이밍은 상대를 평가하는 문제보다, 이 관계를 유지할수록 내가 더 지치고 흐려지는지를 먼저 보는 편이 정확합니다.',
    currentDaewoonAddon:
      '지금 몇 해는 사람을 늘리는 것보다, 내 기운을 지키는 관계 기준을 세우는 일이 더 중요합니다.',
    yearlyFlowAddon:
      '올해는 억지로 맞춰 가기보다, 오래 지치는 관계와 덜 지치는 관계를 분리해 보는 편이 좋습니다.',
    relationshipFlowAddon:
      '손절 타이밍을 볼 때는 끊어야 하느냐보다, 지금 필요한 것이 거리 조절인지 완전한 정리인지를 구분하는 일이 먼저입니다.',
    cautionAddon:
      '미안함 때문에 너무 오래 버티면 결국 더 크게 터지기 쉬우니, 작은 선부터 먼저 긋는 편이 오히려 관계를 덜 다치게 합니다.',
    actionOverride:
      '지금 가장 지치는 관계 1개에 대해 “괜찮은 선” 한 문장을 미리 적어 두기'
  },
  SELF_FAMILY_PARENTS: {
    narrativeAddon:
      '이번 풀이는 부모와 더 가까워지는 방법보다, 덜 다치면서 오래 갈 수 있는 대화 거리를 찾는 데 초점을 둡니다.',
    actionOverride:
      '부모와의 대화에서 꼭 말하고 싶은 한 문장을 비난 없이 다시 써 보기'
  },
  SELF_RELATIONSHIP_GENERAL: {
    narrativeAddon:
      '이번 풀이는 누가 좋은 사람인지보다, 내가 어떤 관계 안에서 살아나고 어떤 관계 안에서 빨리 지치는지를 읽습니다.',
    subjectLensAddon:
      '인간관계운은 사람 수보다 내 기운을 지키는 거리와 말의 방식을 먼저 보는 편이 정확합니다.',
    yearlyFlowAddon:
      '올해는 새로운 인연을 늘리기보다, 오래 갈 관계와 줄여야 할 관계를 분리하는 힘이 더 중요하게 작동합니다.',
    relationshipFlowAddon:
      '관계운을 볼 때는 잘 맞는 사람보다 덜 지치는 관계를 먼저 찾는 편이 더 현실적입니다. 신뢰는 말의 양보다 거리 조절에서 먼저 드러나는 경우가 많습니다.',
    actionOverride:
      '요즘 만날수록 편해지는 사람 1명과 지치는 사람 1명을 구분해 적어 보기'
  },
  SELF_FAMILY_GENERAL: {
    narrativeAddon:
      '이번 풀이는 가족을 더 잘 챙기는 방법보다, 가족 안에서 반복되는 기대와 내 마음의 피로를 함께 읽습니다.',
    subjectLensAddon:
      '가족운은 애정의 크기보다 역할 기대와 거리 조절이 얼마나 자연스러운지가 더 크게 작동할 때가 많습니다.',
    yearlyFlowAddon:
      '올해는 가족 사이의 오래된 역할을 그대로 끌기보다, 내 생활 리듬에 맞는 선을 다시 정리하는 편이 더 중요합니다.',
    relationshipFlowAddon:
      '가족운은 잘 지내고 싶은 마음과 지치지 않고 싶은 마음이 같이 움직일 때 더 정확하게 읽힙니다. 가까울수록 설명을 한 번 더 붙이는 편이 훨씬 덜 다칩니다.',
    actionOverride:
      '가족 안에서 내가 꼭 지키고 싶은 선 1개를 짧게 문장으로 적어 보기'
  },
  SELF_DAILY_FORTUNE: {
    narrativeAddon:
      '이번 풀이는 오늘 하루의 기세를 읽고, 실수를 줄이는 선택 리듬을 잡는 데 집중합니다.',
    timingAddon:
      '오늘 운은 큰 결정보다 첫 두 시간의 컨디션과 시작 순서에서 체감이 크게 갈립니다.',
    actionOverride: '오늘 가장 중요한 일 1개를 오전 첫 블록에 먼저 배치하기'
  },
  SELF_LUCK_UP: {
    narrativeAddon:
      '이번 풀이는 좋은 기운을 끌어오는 비법보다, 지금 내 사주가 실제로 살아나는 생활 기준을 읽습니다.',
    subjectLensAddon:
      '개운법은 특별한 의식보다, 내 기운을 살리고 흐트러짐을 줄이는 생활 리듬을 먼저 맞추는 쪽이 더 효과적입니다.',
    yearlyFlowAddon:
      '올해는 크게 바꾸기보다, 반복 가능한 한두 가지를 정해 꾸준히 지킬 때 운의 체감이 더 빠르게 올라옵니다.',
    timingAddon:
      '개운은 마음먹은 날 한 번보다, 같은 시간과 같은 순서를 생활 안에 붙여 둘 때 훨씬 오래 갑니다.',
    actionOverride:
      '이번 주에 바로 지킬 개운 루틴 1개를 정하고 시간까지 함께 적어 두기'
  },
  SELF_YEARLY_FORTUNE: {
    narrativeAddon:
      '이번 풀이는 올해 전체의 기세를 읽고, 어디에 힘을 써야 덜 흔들리고 오래 가는지를 중심으로 봅니다.',
    subjectLensAddon:
      '올해 운은 좋은지 나쁜지를 하나로 나누기보다, 밀어도 되는 영역과 힘을 아껴야 하는 영역을 구분해 보는 편이 정확합니다.',
    yearlyFlowAddon:
      '올해는 모든 영역을 동시에 끌고 가기보다, 잘 붙는 한두 가지를 선명하게 살리는 편이 훨씬 유리합니다.',
    tenYearFlowAddon:
      '올해는 긴 흐름 안에서 방향을 정리하는 해로 보는 편이 맞고, 무리한 승부보다 기준을 세우는 쪽이 더 오래 갑니다.',
    timingAddon:
      '올해 운은 한 번의 대박보다 계절이 바뀌듯 서서히 체감되는 경우가 많아, 상반기와 하반기의 리듬 차이를 같이 보는 편이 좋습니다.',
    cautionAddon:
      '올해 흐름을 이유로 모든 선택을 미루기보다, 잘 되는 흐름에 맞춰 생활 기준을 먼저 정리하는 편이 실제 체감이 빠릅니다.',
    actionOverride:
      '올해 밀고 싶은 영역 1개와 무리하지 말아야 할 영역 1개를 따로 정해 보기'
  },
  SELF_MARRIAGE_GENERAL: {
    narrativeAddon:
      '이번 풀이는 결혼 자체의 성사보다, 어떤 관계와 어떤 생활 리듬에서 오래 편안할 수 있는지를 중심으로 봅니다.',
    subjectLensAddon:
      '배우자운은 만나는 시기만이 아니라, 내가 어떤 관계 안에서 가장 안정되고 덜 지치는지를 함께 보는 편이 정확합니다.',
    currentDaewoonAddon:
      '지금 몇 해는 사람을 빨리 정하기보다, 함께 살 때 편한 생활 리듬이 어떤 것인지 분명히 하는 일이 더 중요합니다.',
    yearlyFlowAddon:
      '올해는 관계의 속도보다 기준을 정리하는 힘이 더 중요하게 작동해, 서두르지 않을수록 오히려 더 선명하게 보일 수 있습니다.',
    tenYearFlowAddon:
      '앞으로 10년은 만남의 수보다, 오래 가는 관계를 고르는 눈이 더 크게 자라는 흐름일 수 있습니다.',
    relationshipFlowAddon:
      '결혼운을 볼 때는 상대의 조건보다 생활 감각, 책임감, 대화 리듬이 오래 맞을 수 있는지가 더 중요하게 드러납니다.',
    cautionAddon:
      '외로운 마음이나 주변 속도에 밀려 기준을 낮추면 관계 안에서 더 오래 흔들릴 수 있으니, 내 생활과 마음이 편한 기준을 먼저 세워 두는 편이 낫습니다.',
    actionOverride:
      '오래 함께 살 때 꼭 필요한 기준 2개와 양보 가능한 기준 1개를 적어 보기'
  },
  COMPAT_ROMANCE_EX: {
    narrativeAddon:
      '이번 궁합은 헤어진 뒤에도 남아 있는 감정이 왜 쉽게 정리되지 않는지, 그리고 다시 이어져도 같은 패턴이 반복될지를 함께 봅니다.',
    compatibilityLensAddon:
      '전연인 궁합은 다시 만날 수 있느냐보다, 다시 만나도 같은 이유로 지치지 않을 수 있는지를 먼저 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 감정이 완전히 끝났다기보다, 좋았던 부분과 힘들었던 부분이 같이 오래 남는 타입입니다. 그래서 끌림이 다시 살아나도, 예전 방식이 그대로면 익숙함만큼 상처도 빨리 되살아날 수 있습니다.',
    attractionPointText:
      '헤어진 뒤에도 계속 마음에 남는 이유는 서로에게 강하게 남는 결이 있었기 때문입니다. 좋았던 순간의 결이 선명할수록 다시 떠오르는 힘도 커서, 관계를 쉽게 잊지 못하는 경우가 많습니다.',
    conflictTriggerText:
      '예전의 상처를 충분히 정리하지 않은 채 반가움만으로 다시 가까워지면 같은 패턴이 빠르게 반복될 수 있습니다. “이번엔 다를 거야”라는 기대만으로 밀어붙이면 다시 지치는 속도도 빨라집니다.',
    communicationText:
      '다시 이어질 여지를 보려면 감정 확인보다, 예전과 무엇이 달라져야 하는지를 먼저 말하는 편이 좋습니다. 보고 싶었다는 말보다 “예전과 다르게 해 보고 싶은 점”을 짧게 꺼내는 방식이 훨씬 현실적입니다.'
  },
  COMPAT_ROMANCE_BLIND_DATE: {
    narrativeAddon:
      '이번 궁합은 첫인상의 끌림보다, 어색함이 풀린 뒤에도 대화가 이어질 결이 있는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '소개팅 궁합은 설렘 자체보다, 첫 만남 이후에도 말이 이어지고 생활 리듬이 겹칠 수 있는지를 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 첫인상보다 두 번째 대화에서 결이 드러나는 타입입니다. 처음엔 어색해 보여도 리듬이 맞으면 편안함이 빠르게 붙고, 반대로 첫인상은 좋아도 말의 방향이 다르면 금방 힘이 빠질 수 있습니다.',
    attractionPointText:
      '소개팅에서는 서로의 부족한 면을 보완해 줄 수 있다는 느낌이 매력으로 크게 다가옵니다. 그래서 겉으로 드러나는 취향보다 대화가 자연스럽게 이어지는지가 더 중요한 신호입니다.',
    conflictTriggerText:
      '상대를 빨리 판단하거나, 호감 신호를 너무 빨리 확인하려 들면 어색함이 오래갈 수 있습니다. 좋은 궁합도 초반 압박이 생기면 흐름이 금방 끊길 수 있습니다.',
    communicationText:
      '소개팅 후에는 감정 확인보다 “오늘 반가웠어요” 같은 짧고 편한 연결 문장이 더 잘 맞습니다. 질문을 한꺼번에 쏟기보다, 한 번에 한 주제씩 가볍게 이어가는 편이 훨씬 자연스럽습니다.'
  },
  COMPAT_ROMANCE_FRIEND_TO_LOVER: {
    narrativeAddon:
      '이번 궁합은 친구의 편안함이 연애의 설렘으로 자연스럽게 이어질 수 있는지를 중심으로 봅니다.',
    compatibilityLensAddon:
      '친구에서 연인 가능성은 호감의 유무보다, 지금의 편안함을 깨지 않고 감정선을 한 단계 올릴 수 있는지가 핵심입니다.',
    pairDynamicText:
      '이 관계는 이미 기본 신뢰가 있는 대신, 감정의 방향을 먼저 꺼내는 쪽이 부담을 크게 느낄 수 있는 타입입니다. 익숙함은 강점이지만, 관계 정의가 늦어지면 서로 다른 기대를 오래 안고 갈 수 있습니다.',
    attractionPointText:
      '친구일 때 편했던 이유가 연인으로도 이어질 가능성이 큽니다. 서로를 무리 없이 이해하는 힘이 있어, 감정만 맞으면 빠르게 안정되는 장점이 있습니다.',
    conflictTriggerText:
      '한쪽은 이미 달라진 감정을 느끼는데 다른 한쪽은 여전히 친구의 언어로만 반응하면 서운함이 커질 수 있습니다. 너무 오래 애매한 상태를 끌면 오히려 기존 편안함도 흐려질 수 있습니다.',
    communicationText:
      '이 관계는 갑작스러운 고백보다, 둘만의 시간을 조금 더 또렷하게 만드는 식의 변화가 잘 맞습니다. 장난처럼 넘기던 감정을 한 번쯤 진지한 문장으로 꺼내는 편이 흐름을 선명하게 만듭니다.'
  },
  COMPAT_ROMANCE_GHOSTED: {
    narrativeAddon:
      '이번 궁합은 흐름이 왜 끊겼는지와, 다시 이어진다면 어디에서부터 말을 붙여야 하는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '연락이 끊긴 썸은 호감의 유무보다 부담이 생긴 지점과 감정 속도의 차이를 먼저 읽어야 정확합니다.',
    pairDynamicText:
      '이 관계는 마음이 아예 없는 타입이라기보다, 가까워지는 속도와 답장 부담이 엇갈릴 때 쉽게 끊기는 타입입니다. 한쪽은 조금 더 확인하고 싶고, 한쪽은 이미 부담을 느끼면 흐름이 갑자기 멈춘 것처럼 보일 수 있습니다.',
    attractionPointText:
      '처음 붙을 때는 서로의 다른 템포가 오히려 신선하게 느껴졌을 가능성이 큽니다. 그래서 다시 이어질 여지는 감정의 크기보다, 부담을 덜고 다시 편안한 리듬을 만들 수 있는지에 달려 있습니다.',
    conflictTriggerText:
      '답장을 미루는 이유를 무관심으로 단정하거나, 관계를 확인하려는 마음을 압박으로 느끼는 순간 흐름이 더 멀어지기 쉽습니다. 끊긴 이유를 캐묻는 방식은 다시 연결될 실마리를 오히려 약하게 만들 수 있습니다.',
    communicationText:
      '다시 말을 붙일 때는 감정 확인보다, 부담 없는 상황 정리 한 문장으로 시작하는 편이 훨씬 낫습니다. “왜 그랬어?”보다 “문득 생각나서 안부 전해”처럼 가벼운 문장이 이 관계에는 더 잘 맞습니다.',
    actionOverride:
      '다시 말을 붙이고 싶다면 감정 확인보다 상황 정리 한 문장으로 먼저 시작하기'
  },
  COMPAT_ROMANCE_LEFT_ON_READ: {
    narrativeAddon:
      '이번 궁합은 답장 자체보다, 두 사람이 기대하는 연락 템포와 감정 거리감이 어디서 어긋나는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '읽씹처럼 보이는 상황은 호감의 유무만이 아니라 답장 압박, 대화 템포, 관계 정의에 대한 부담이 함께 얽히는 경우가 많습니다.',
    pairDynamicText:
      '이 관계는 마음의 크기보다 답장 템포와 기대치 차이에서 체감이 크게 갈리는 타입입니다. 호감이 있어도 표현 방식이 다르면 한쪽은 끊겼다고 느끼고, 한쪽은 아직 괜찮다고 느끼기 쉽습니다.',
    conflictTriggerText:
      '짧은 답장을 가볍게 여기는 쪽과 거리감으로 받아들이는 쪽이 만나면 작은 침묵도 크게 느껴질 수 있습니다. 기대하는 연락 리듬을 말하지 않으면 오해가 생각보다 오래 남습니다.',
    communicationText:
      '왜 답이 늦었는지 캐묻기보다, 편한 시간대와 답장 스타일을 먼저 맞추는 편이 이 관계에는 더 효과적입니다. 답장 속도 하나만으로 관계를 단정하기보다, 대화의 길이와 온도까지 같이 보는 편이 훨씬 정확합니다.'
  },
  COMPAT_FRIEND_CUT_OFF: {
    narrativeAddon:
      '이번 궁합은 친하냐 아니냐보다, 이 관계가 지금의 나를 살리는지 지치게 하는지를 먼저 보는 데 집중합니다.',
    compatibilityLensAddon:
      '손절 고민은 누가 더 나쁘냐보다, 이 관계를 유지할수록 내 기운이 살아나는지 닳는지를 먼저 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 애정과 의리가 남아 있어도, 생활 리듬과 기대치가 어긋나면 피로가 빠르게 쌓이는 타입입니다. 완전히 끊어야 하는 관계인지보다, 지금의 거리에서 버틸 수 있는 관계인지를 먼저 봐야 합니다.',
    attractionPointText:
      '처음에는 편안함이나 오래된 익숙함 때문에 쉽게 붙었을 가능성이 큽니다. 그래서 손절을 고민할 때도 좋은 기억 때문에 선을 더 늦게 긋는 경우가 많습니다.',
    conflictTriggerText:
      '내가 참고 있는 부분을 상대는 전혀 문제로 느끼지 않을 때 소모가 커지기 쉽습니다. 오래된 사이일수록 설명을 생략하기 쉬워, 작은 무례가 누적되면 한 번에 크게 터질 수 있습니다.',
    communicationText:
      '완전히 끊기 전에 관계의 선을 먼저 조정해 보는 편이 좋습니다. 자주 보는 빈도, 답장 속도, 부탁을 받아주는 범위를 분명히 하면 이 관계를 남길지 끊을지 더 선명하게 읽힙니다.'
  },
  COMPAT_FRIEND_TRAVEL: {
    narrativeAddon:
      '이번 궁합은 좋은 친구인지보다, 함께 움직일 때 생활 리듬과 즉흥성이 얼마나 맞는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '여행 메이트 궁합은 성격보다 체력, 시간 감각, 즉흥 일정에 대한 태도가 얼마나 맞는지를 먼저 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 평소엔 편해도 이동과 선택이 많아지면 진짜 합이 드러나는 타입입니다. 한쪽이 계획을 세우고 한쪽이 따라가는 흐름이 자연스러우면 편하지만, 둘 다 다른 속도로 움직이면 금방 지칠 수 있습니다.',
    attractionPointText:
      '함께 있어도 일정이 답답하지 않고, 돌발 상황에서도 웃으며 넘길 수 있다면 여행 궁합은 꽤 좋은 편입니다. 특히 체력과 쉬는 방식이 비슷하면 훨씬 덜 부딪힙니다.',
    conflictTriggerText:
      '맛집, 이동, 예산 같은 작은 선택이 계속 쌓이면 생각보다 예민해지기 쉽습니다. 평소엔 괜찮던 성향 차이도 여행에서는 피곤함과 함께 크게 느껴질 수 있습니다.',
    communicationText:
      '여행 전부터 모든 걸 맞추려 하기보다, 꼭 정할 것과 현장에서 정할 것을 먼저 나누는 편이 좋습니다. 쉬고 싶은 방식과 돈 쓰는 기준만 먼저 말해도 훨씬 덜 부딪힙니다.'
  },
  COMPAT_ROMANCE_FLIRTING: {
    narrativeAddon:
      '이번 궁합은 썸의 온도가 얼마나 자연스럽게 이어지는지, 그리고 누가 먼저 속도를 끌어올리는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '썸 궁합은 호감의 크기보다 감정 속도와 표현 리듬이 실제로 맞는지를 보는 편이 더 정확합니다.',
    pairDynamicText:
      '이 관계는 서로 끌리는 힘이 있어도 속도 차이가 나면 금방 애매해질 수 있는 타입입니다. 가벼운 설렘은 쉽게 붙지만, 관계를 한 단계 올리는 순간에는 누가 먼저 부담을 느끼는지가 중요하게 작동합니다.',
    attractionPointText:
      '썸이 잘 붙는 이유는 서로의 다른 결이 낯설지 않고 오히려 신선하게 느껴지기 때문입니다. 너무 닮은 관계보다 말이 이어질 여지가 있는 쪽이 더 오래 갑니다.',
    conflictTriggerText:
      '호감은 있는데 확인하려는 속도가 다르면 한쪽은 답답하고 한쪽은 부담스럽게 느끼기 쉽습니다. 관계를 빨리 정리하려 하면 오히려 자연스러운 리듬이 끊길 수 있습니다.',
    communicationText:
      '이 관계는 진지한 확인보다 가볍지만 꾸준한 연결이 더 잘 맞습니다. 큰 말 한 번보다 짧은 대화가 여러 번 이어질 때 흐름이 더 안정됩니다.'
  },
  COMPAT_FRIEND_BEST: {
    narrativeAddon:
      '이번 궁합은 친하다는 사실보다, 오래 봐도 편안함이 유지되는지와 서로의 선을 잘 지키는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '베스트 친구 궁합은 취향이 같은지보다, 서운함이 생겼을 때도 관계를 다시 회복할 힘이 있는지를 보는 편이 더 정확합니다.',
    pairDynamicText:
      '이 관계는 편안함이 큰 장점인 만큼, 작은 설명이 빠져도 금방 이해해 줄 거라 기대하기 쉬운 타입입니다. 잘 맞을 때는 누구보다 안정적이지만, 익숙함에 기대면 서운함이 오래 남을 수도 있습니다.',
    attractionPointText:
      '서로가 편한 속도를 잘 알아차릴 수 있다는 점이 가장 큰 강점입니다. 같이 있어도 힘을 덜 쓰게 되는 관계라면 오래 갈 가능성이 큽니다.',
    conflictTriggerText:
      '친한 사이일수록 작은 무심함을 설명 없이 넘기기 쉬워, 어느 순간 한쪽만 참고 있었다는 느낌이 커질 수 있습니다. 익숙함이 배려를 대신해 주지는 않습니다.',
    communicationText:
      '이 관계는 거창한 화해보다 짧고 정확한 말 한마디가 더 잘 맞습니다. 편한 사이라는 이유로 미루지 말고, 서운한 지점은 작을 때 바로 꺼내는 편이 더 오래 갑니다.'
  },
  COMPAT_WORK_COWORKER: {
    narrativeAddon:
      '이번 궁합은 친해질 수 있느냐보다, 함께 일할 때 속도와 기준이 얼마나 자연스럽게 맞는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '직장 동료 궁합은 성격보다 일의 시작과 마감, 공유 방식, 책임감의 결이 맞는지를 먼저 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 일의 속도와 중간 공유 방식이 맞으면 빠르게 편해지는 타입입니다. 반대로 역할이 애매하거나 서로 당연하게 여기는 기준이 다르면, 일 자체보다 협업 과정에서 더 피로해질 수 있습니다.',
    attractionPointText:
      '같이 일할 때 강점이 겹치기보다 보완될 때 훨씬 빛이 나는 관계입니다. 한쪽이 정리하고 한쪽이 밀어붙이는 식의 분담이 자연스럽다면 체감상 훨씬 편해집니다.',
    conflictTriggerText:
      '일을 비슷하게 잘해도 방식이 다르면 답답함이 커질 수 있습니다. 특히 중간 공유를 줄이거나 확인 없이 넘기면 작은 차이가 금방 억울함으로 바뀌기 쉽습니다.',
    communicationText:
      '이 관계는 친해지려 하기보다 일의 기준을 먼저 맞추는 편이 낫습니다. 언제 공유할지, 어디까지 각자 책임질지 짧게 합의하면 훨씬 덜 지칩니다.'
  },
  COMPAT_FRIEND_ROOMMATE: {
    narrativeAddon:
      '이번 궁합은 정서적 합보다, 공간 감각과 생활 루틴이 실제로 부딪히지 않는지를 더 중요하게 봅니다.',
    compatibilityLensAddon:
      '룸메이트 궁합은 친한지보다 생활 소음, 청소 기준, 혼자 있고 싶은 시간이 얼마나 맞는지를 먼저 보는 편이 더 정확합니다.',
    pairDynamicText:
      '이 관계는 감정적으로 잘 맞아도 생활 루틴이 다르면 금방 피로해질 수 있는 타입입니다. 반대로 말수가 조금 적어도 공간 감각이 비슷하면 오래 편안하게 지낼 가능성이 큽니다.',
    attractionPointText:
      '생활의 기본 박자가 비슷하면 작은 배려를 크게 설명하지 않아도 자연스럽게 이어질 수 있습니다. 청소, 수면, 귀가 시간의 결이 맞는다면 체감상 훨씬 수월합니다.',
    conflictTriggerText:
      '사적인 공간의 선이 다르거나 생활 기준을 말하지 않고 넘기면 사소한 습관도 예민하게 느껴질 수 있습니다. 특히 피곤한 날일수록 작은 소음과 어질러짐이 크게 다가오기 쉽습니다.',
    communicationText:
      '좋은 룸메이트 궁합은 감정 풀기보다 생활 합의를 먼저 세울 때 더 안정됩니다. 청소, 손님, 취침 시간처럼 자주 부딪히는 기준은 초반에 짧게라도 정해 두는 편이 좋습니다.'
  },
  COMPAT_ROMANCE_CRUSH: {
    narrativeAddon:
      '이번 궁합은 단순히 좋아하는 마음보다, 왜 자꾸 시선이 가고 관계가 실제로 자라기 쉬운지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '짝사랑 궁합은 상대 마음을 단정하기보다, 내가 끌리는 이유와 가까워졌을 때 관계 리듬이 자연스러운지를 먼저 보는 편이 정확합니다.',
    pairDynamicText:
      '이 관계는 혼자 마음이 커질 여지도 있지만, 실제로 가까워지면 의외로 말이 잘 이어질 수도 있는 타입입니다. 끌림의 강도와 현실 관계의 합을 분리해서 볼수록 훨씬 또렷하게 읽힙니다.',
    attractionPointText:
      '자꾸 눈이 가는 이유는 부족한 결을 채워 주거나, 닮고 싶은 분위기를 상대가 가지고 있기 때문일 가능성이 큽니다. 그래서 감정보다 이상형의 그림이 먼저 커질 수 있습니다.',
    conflictTriggerText:
      '마음이 클수록 작은 신호에 의미를 과하게 싣기 쉽고, 실제 대화가 적으면 기대가 혼자 자라기 쉽습니다. 상대를 읽기보다 상상 속 관계를 먼저 키우면 흐름이 흐려질 수 있습니다.',
    communicationText:
      '짝사랑은 확답을 서두르기보다 실제 대화와 반응을 조금씩 늘려 가는 쪽이 더 정확합니다. 먼저 가벼운 공통 화제를 만들고, 말이 편하게 이어지는지를 보는 편이 좋습니다.'
  },
  COMPAT_WORK_DIFFICULT_BOSS: {
    narrativeAddon:
      '이번 궁합은 상사를 바꾸는 방법보다, 덜 부딪히고 내 에너지를 덜 빼앗기는 일 방식을 찾는 데 초점을 둡니다.',
    compatibilityLensAddon:
      '상사 궁합은 호감보다 지시 방식, 보고 방식, 우선순위 언어가 맞는지가 더 중요합니다.',
    pairDynamicText:
      '이 관계는 성격보다 업무 기준을 누가 먼저 언어화하느냐에 따라 피로도가 크게 달라집니다. 맞출 수 있는 기준이 생기면 의외로 빠르게 편해질 수 있지만, 애매한 요청이 쌓이면 감정 소모가 커지기 쉽습니다.',
    conflictTriggerText:
      '알아서 해 주길 기대하는 요청과 빠진 설명이 반복되면 억울함과 압박이 함께 쌓이기 쉽습니다. 일 자체보다 해석의 차이에서 마찰이 커지는 관계입니다.',
    communicationText:
      '감정 해명보다 "무엇을, 언제까지, 어떤 기준으로"를 짧게 되묻는 방식이 가장 안전합니다. 기준·기한·우선순위를 먼저 맞추면 불필요한 소모를 크게 줄일 수 있습니다.'
  },
  COMPAT_WORK_BOSS: {
    narrativeAddon:
      '이번 궁합은 잘 보이기보다, 같이 일할 때 기준과 속도가 얼마나 맞는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '상사와 궁합은 감정적 호감보다 보고 방식, 우선순위 언어, 기대하는 속도가 맞는지가 더 중요합니다.',
    currentDaewoonAddon:
      '지금은 감정 설득보다 기준 확인이 훨씬 잘 먹히는 흐름이라, 역할과 우선순위를 먼저 맞추는 편이 안전합니다.',
    yearlyFlowAddon:
      '올해는 한 번의 큰 보고보다 중간 공유를 자주 가져가는 쪽이 관계 피로를 줄이는 데 더 유리합니다.',
    timingAddon:
      '상사와의 흐름은 일 자체보다 보고 타이밍에서 체감 차이가 크게 납니다. 늦게 설명하는 것보다 중간에 짧게 맞추는 편이 훨씬 유리합니다.',
    cautionAddon:
      '상대의 기준을 눈치로만 맞추려 하면 피로가 빨리 쌓이니, 확인해야 할 지점은 짧게라도 말로 남기는 편이 낫습니다.',
    pairDynamicText:
      '이 관계는 기본적으로 위아래 역할이 분명할수록 편해지는 타입입니다. 기준을 빨리 파악하면 안정적으로 갈 수 있지만, 눈치로 먼저 맞추려 들면 오히려 피로가 빨리 쌓일 수 있습니다.',
    attractionPointText:
      '일의 방향이 맞을 때는 배울 점이 많은 관계가 될 수 있습니다. 상사의 기준이 또렷하고 내 강점이 그 기준과 맞물리면, 생각보다 빠르게 신뢰가 붙는 흐름입니다.',
    conflictTriggerText:
      '보고의 타이밍이나 기대하는 완성도의 차이를 놓치면 일보다 해석에서 마찰이 커질 수 있습니다. 상사는 당연하다고 느끼는 기준을 나는 뒤늦게 알게 되는 순간 피로가 올라오기 쉽습니다.',
    communicationText:
      '이 관계에서는 감정 설명보다 중간 공유가 훨씬 중요합니다. 일이 끝난 뒤 설명하기보다, 중간에 한 번 더 방향을 확인하는 습관이 가장 잘 맞습니다.'
  },
  COMPAT_WORK_BUSINESS_PARTNER: {
    narrativeAddon:
      '이번 궁합은 친한지보다, 책임과 권한을 나눴을 때 서로의 강점이 실제 성과로 연결되는지를 중심으로 봅니다.',
    compatibilityLensAddon:
      '동업 궁합은 성격 합보다 돈, 역할, 의사결정 권한을 어떻게 나누는지가 훨씬 중요합니다.',
    pairDynamicText:
      '이 관계는 친밀감보다 역할 분담이 선명할 때 가장 강합니다. 한쪽이 열고 한쪽이 다지는 흐름이 맞으면 성과가 빨리 붙지만, 서로 다 잘하려 들면 오히려 책임 경계가 흐려질 수 있습니다.',
    attractionPointText:
      '서로에게 없는 장점을 보완해 줄 수 있다는 점이 가장 큰 강점입니다. 혼자 했다면 오래 걸릴 일을 둘이 하면 빨라지는 조합이라면, 이 궁합은 실제 일에서 체감 가치가 큽니다.',
    conflictTriggerText:
      '좋은 합이라도 돈, 역할, 철수 기준이 흐려지면 신뢰보다 억울함이 먼저 쌓일 수 있습니다. 특히 매출이 붙기 시작할 때 공과 사 경계가 흐려지면 관계가 급격히 거칠어질 수 있습니다.',
    communicationText:
      '좋은 합일수록 중요한 건 말보다 문장입니다. 돈, 역할, 철수 기준을 먼저 적어 두면 관계와 일 둘 다 더 오래 갑니다. 편한 사이일수록 계약서에 가까운 기준 문장을 남기는 편이 안전합니다.'
  },
  COMPAT_WORK_WORK_DUMPER: {
    narrativeAddon:
      '이번 궁합은 억울함을 풀어내는 것보다, 일이 어떻게 넘어오고 어디서부터 선을 그어야 하는지를 읽는 데 집중합니다.',
    actionOverride:
      '이번 주 맡은 일 중 내 책임과 상대 책임을 한 줄로 나눠 적어 보기'
  },
  COMPAT_FAMILY_MOTHER_DAUGHTER: {
    narrativeAddon:
      '이번 궁합은 가까움 속에서 기대와 서운함이 어떻게 엉키는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '엄마와 딸 궁합은 사랑의 크기보다 기대 역할, 말투, 거리 조절 방식이 어떻게 맞물리는지 보는 편이 더 정확합니다.',
    pairDynamicText:
      '이 관계는 누구보다 서로를 오래 생각하지만, 그만큼 기대와 간섭이 쉽게 섞이는 타입입니다. 가까움이 힘이 될 때는 누구보다 든든하지만, 경계가 흐려지면 작은 말도 크게 남을 수 있습니다.',
    attractionPointText:
      '서로를 오래 알고 있는 만큼 위기 때 가장 먼저 기대고 버티게 해 주는 힘이 큽니다. 생활 감각이나 책임감의 결이 맞으면 관계의 안정감은 생각보다 강합니다.',
    conflictTriggerText:
      '걱정의 말이 통제로 들리거나, 독립하려는 마음이 거리 두기로 오해될 때 상처가 깊어지기 쉽습니다. 익숙한 사이일수록 설명을 줄여도 알아줄 거라 기대하면 어긋남이 커질 수 있습니다.',
    communicationText:
      '이 관계는 감정이 오른 날 긴 대화로 풀기보다, 짧고 분명한 말로 맥락을 먼저 전하는 편이 좋습니다. “왜 나를 몰라줘?”보다 “이 부분은 내가 스스로 해 보고 싶어”처럼 선을 분명히 말하는 방식이 훨씬 덜 다칩니다.'
  },
  COMPAT_FAMILY_PARENT_CHILD: {
    narrativeAddon:
      '이번 궁합은 누가 더 사랑하느냐보다, 보호와 기대가 어떤 방식으로 오가고 있는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '부모와 자식 궁합은 가까움 자체보다, 돌봄과 간섭의 선이 어디서 엇갈리는지를 먼저 보는 편이 더 정확합니다.',
    pairDynamicText:
      '이 관계는 애정이 분명해도 기대 역할이 커지면 금방 답답해질 수 있는 타입입니다. 서로 위하는 마음은 크지만 표현 방식이 다르면 한쪽은 걱정으로, 한쪽은 간섭으로 느끼기 쉽습니다.',
    attractionPointText:
      '서로를 끝까지 챙기려는 마음이 있다는 점이 가장 큰 버팀목입니다. 말이 서툴러도 결정적인 순간에 서로를 놓지 않는 관계라면 기본 바탕은 꽤 단단한 편입니다.',
    conflictTriggerText:
      '잘되길 바라는 마음이 평가처럼 들리거나, 독립을 지지해 주지 않는다고 느끼는 순간 감정이 크게 상하기 쉽습니다. 가까운 사이일수록 설명 없이 역할을 기대하면 서운함이 오래 남습니다.',
    communicationText:
      '이 관계는 정답을 설득하기보다 현재 상태를 먼저 말해 주는 편이 낫습니다. 걱정, 기대, 부담을 한꺼번에 말하지 말고 하나씩 나눠 꺼내면 훨씬 덜 다칩니다.'
  },
  COMPAT_FAMILY_MOTHER_IN_LAW: {
    narrativeAddon:
      '이번 궁합은 누가 더 맞는지가 아니라, 기대 역할과 거리감이 어디서 부딪히는지를 읽는 데 초점을 둡니다.',
    compatibilityLensAddon:
      '시어머니와 며느리 궁합은 애정의 크기보다 기대 역할, 표현 방식, 선을 지키는 방식이 맞는지가 핵심입니다.',
    pairDynamicText:
      '이 관계는 가까워지려는 마음과 적당한 거리를 두려는 마음이 동시에 작동하는 타입입니다. 서로 잘 지내고 싶어도 기대 역할이 말보다 앞서면 작은 일도 쉽게 무거워질 수 있습니다.',
    attractionPointText:
      '생활 감각이나 책임감의 결이 맞을 때는 생각보다 든든한 편이 될 수 있습니다. 서로의 수고를 인정하는 말이 오가면 관계가 빠르게 부드러워질 여지가 있습니다.',
    conflictTriggerText:
      '좋은 뜻으로 한 말이 간섭이나 평가처럼 들릴 때 상처가 오래 남기 쉽습니다. 가족이라는 이유로 설명을 줄이면, 서운함이 쌓여도 바로 풀 기회를 놓치기 쉽습니다.',
    communicationText:
      '이 관계는 감정이 쌓인 뒤 한 번에 터뜨리기보다, 생활 기준을 짧게 분명히 말하는 편이 낫습니다. 예의를 지키되 무조건 맞추기보다, 가능한 선과 어려운 선을 차분히 구분하는 방식이 가장 덜 다칩니다.'
  },
  COMPAT_MISC_IDOL: {
    narrativeAddon:
      '이번 궁합은 현실 관계의 성사보다, 왜 이 사람에게 강하게 끌리고 어떤 정서적 보완을 얻는지를 중심으로 읽습니다.',
    compatibilityLensAddon:
      '아이돌 궁합은 실제 연애 가능성보다, 왜 이 사람에게 끌리고 어떤 에너지를 닮고 싶은지 읽는 데 더 의미가 있습니다.',
    pairDynamicText:
      '이 궁합은 현실 관계의 상호작용보다, 내가 이 사람에게서 받는 자극과 안정감을 읽을 때 더 정확합니다. 끌림의 방향을 보면 지금 내 안에서 더 키우고 싶은 기질도 함께 보입니다.',
    attractionPointText:
      '이 사람에게 강하게 끌리는 이유는 내가 잠재적으로 키우고 싶은 기질을 선명하게 비춰 주기 때문일 수 있습니다. 그래서 닮은 점보다 "내가 왜 이 모습에 힘을 얻는가"를 보는 편이 더 잘 맞습니다.',
    conflictTriggerText:
      '동경이 커질수록 실제 내 리듬과 비교하며 스스로를 조급하게 볼 수 있습니다. 좋아하는 마음이 커질수록 나를 깎아보는 방향으로 흐르지 않게 거리 조절이 필요합니다.',
    communicationText:
      '이 궁합은 대화법보다, 내가 어떤 순간에 힘을 얻고 어디까지 기대를 싣는지 돌아보는 편이 더 잘 맞습니다. 좋아하는 감정을 내 리듬을 살리는 방향으로 쓰면 이 궁합의 장점이 더 건강하게 살아납니다.'
  }
};

export function buildScenarioOverlay(
  scenario: ScenarioOption | null
): ScenarioOverlay | null {
  if (!scenario) {
    return null;
  }

  return {
    ...buildCategoryBase(scenario),
    ...SCENARIO_SPECIFIC[scenario.code]
  };
}
