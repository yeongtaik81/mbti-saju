import type { SelfSubjectType } from '@/lib/saju/constants';
import type { ScenarioCode } from '@/lib/saju/scenarios';

export type SelfScenarioContentProfile = {
  summaryAngle: string;
  overviewAngle: string;
  narrativeAngle: string;
  lensAngle: string;
  relationshipAngle?: string;
  wealthAngle?: string;
  timingAngle: string;
  cautionAngle: string;
  evidenceAngle: string;
  softRiskAngle?: string;
  reflectionQuestion?: string;
};

const DEFAULT_SELF_PROFILE: Record<
  SelfSubjectType,
  SelfScenarioContentProfile
> = {
  BASIC: {
    summaryAngle:
      '이번 풀이는 지금 삶 전체를 흔드는 축이 무엇인지부터 넓게 정리하는 데 초점을 둡니다.',
    overviewAngle:
      '한 부분만 떼어 보기보다, 일과 관계와 생활 리듬이 한꺼번에 어디로 기울고 있는지 먼저 읽는 편이 정확합니다.',
    narrativeAngle:
      '기본 해석은 사건 하나를 맞히는 풀이보다, 지금의 내가 왜 이런 리듬으로 흔들리고 버티는지를 길게 설명해 주는 풀이라야 합니다.',
    lensAngle:
      '전체 해석에서는 강한 기운을 어디에 써야 하는지와 약한 축을 무엇으로 보완해야 하는지를 같이 봐야 합니다.',
    timingAngle:
      '지금은 큰 결론보다 내 삶 전체의 방향을 다시 정리해도 되는 시기인지가 더 중요합니다.',
    cautionAngle:
      '기본 해석에서는 답을 빨리 고르기보다, 반복해서 힘이 빠지는 생활 패턴을 놓치지 않는 태도가 중요합니다.',
    evidenceAngle:
      '이번 질문에서는 특정 고민 하나보다, 전체 삶의 방향을 오래 설명해 주는 축이 무엇인지부터 읽어야 합니다.'
  },
  LIFETIME_FLOW: {
    summaryAngle:
      '이번 풀이는 한 시기의 기복보다, 평생 반복될 강점과 오래 끌수록 지치는 패턴을 구분하는 데 초점을 둡니다.',
    overviewAngle:
      '평생 총운은 “언제 좋아지느냐”보다 “어떤 방식으로 살 때 복이 오래 남느냐”를 읽어야 정확합니다.',
    narrativeAngle:
      '지금 눈앞의 성과보다, 오래 반복할수록 단단해지는 선택과 반복할수록 기운이 마르는 선택을 나눠 보는 풀이가 필요합니다.',
    lensAngle:
      '긴 흐름에서는 재능보다 지속 방식이 더 중요하므로, 내 삶에서 계속 통했던 리듬을 중심으로 읽어야 합니다.',
    timingAngle:
      '이 질문에서는 오늘의 성패보다 앞으로 몇 해를 어떤 결로 밀고 갈지가 더 중요합니다.',
    cautionAngle:
      '장기 흐름을 본다고 해서 현재 결정을 미루기만 하면 오히려 방향 감각이 흐려질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 한 번의 호재보다, 오래 반복될수록 강해지는 선택과 반복할수록 닳는 선택을 함께 봐야 합니다.'
  },
  ROMANCE: {
    summaryAngle:
      '이번 풀이는 좋아질지 말지보다, 지금 내 감정이 어떤 관계에서 편안하게 이어질 수 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '연애 고민은 상대의 마음을 단정하기보다, 내 감정 속도와 관계 감당력이 실제로 어디까지 가 있는지를 먼저 읽어야 합니다.',
    narrativeAngle:
      '같은 연애군 안에서도 재회, 연락, 고백, 일반 연애운은 질문의 중심이 다르기 때문에 무엇을 판단해야 하는지부터 갈라서 읽어야 합니다.',
    lensAngle:
      '연애 풀이에서는 설렘의 크기와 실제로 이어질 수 있는 관계 리듬을 분리해서 보는 태도가 중요합니다.',
    relationshipAngle:
      '관계 쪽에서는 감정의 온도, 말의 속도, 기대하는 가까움의 정도가 어디서 어긋나는지를 먼저 봐야 합니다.',
    timingAngle:
      '연애 질문은 날짜 하나보다, 감정이 흔들리는 때와 관계가 편안하게 이어지는 때를 구분할수록 정확해집니다.',
    cautionAngle:
      '연애 고민에서는 기대와 사실이 섞이는 순간 풀이도 금방 흐려지므로, 내가 바라는 장면과 실제 신호를 분리해야 합니다.',
    evidenceAngle:
      '이번 질문에서는 설렘 자체보다, 관계가 이어질 여지와 내가 감당할 수 있는 리듬을 함께 읽어야 합니다.'
  },
  MARRIAGE: {
    summaryAngle:
      '이번 풀이는 결혼 성사 여부보다, 오래 함께 살아도 덜 지치고 더 안정될 관계의 조건을 읽는 데 초점을 둡니다.',
    overviewAngle:
      '배우자운은 감정보다 생활 리듬, 책임감, 돈과 시간 기준이 실제로 맞는지를 함께 봐야 정확합니다.',
    narrativeAngle:
      '좋은 관계인지보다, 같이 살 때 어떤 장면에서 안심하고 어떤 장면에서 금방 지치는지를 읽는 풀이가 더 현실적입니다.',
    lensAngle:
      '결혼운은 상대를 빨리 정하는 질문이 아니라, 내가 어떤 관계 구조에서 오래 편안한지를 확인하는 질문에 가깝습니다.',
    relationshipAngle:
      '관계 쪽에서는 사랑의 크기보다 역할 기대와 생활 감각이 어디서 맞고 어긋나는지가 더 중요합니다.',
    timingAngle:
      '배우자운은 만남 시기 하나보다, 지금 내 삶이 함께 살 준비를 얼마나 감당할 수 있는지가 더 중요합니다.',
    cautionAngle:
      '외로움이나 주변 속도 때문에 기준을 낮추면 관계 안에서 더 오래 흔들릴 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 상대 조건보다, 오래 함께 살 때 실제로 편안할 생활 리듬이 무엇인지 봐야 합니다.'
  },
  CAREER: {
    summaryAngle:
      '이번 풀이는 직업명이 아니라, 어떤 방식으로 일할 때 강점이 또렷해지고 어떤 환경에서 기운이 빨리 새는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '커리어 고민은 같은 일/직업 카테고리라도 직업운, 적성, 이직 타이밍이 서로 다른 질문이므로 판단 기준부터 갈라야 합니다.',
    narrativeAngle:
      '일이 잘되느냐보다, 지금 내 방식이 맞는 자리인지, 오래 갈 방향인지, 움직일 때인지의 초점이 먼저 분리되어야 합니다.',
    lensAngle:
      '커리어 풀이에서는 잘하고 싶은 마음보다 어떤 결과를 반복해서 낼 수 있는 구조인지가 더 중요합니다.',
    wealthAngle:
      '일과 돈 흐름은 붙어 있지만, 이 질문에서는 수익보다 일 방식과 자리의 적합성을 먼저 읽어야 정확합니다.',
    timingAngle:
      '직업 질문은 조급함이 커질 때보다, 내가 보여 줄 결과와 버틸 생활 리듬이 함께 정리됐을 때 더 선명해집니다.',
    cautionAngle:
      '커리어 고민에서는 막막함을 능력 부족으로 받아들이기보다, 지금 맞지 않는 구조를 정확히 짚는 태도가 더 중요합니다.',
    evidenceAngle:
      '이번 질문에서는 “무슨 일을 하느냐”보다 “어떤 방식으로 일할 때 힘이 붙느냐”를 먼저 읽어야 합니다.'
  },
  WEALTH: {
    summaryAngle:
      '이번 풀이는 많이 벌 수 있느냐보다, 돈이 붙는 방식과 새는 방식이 어떻게 다른지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '재물 고민은 같은 돈 카테고리 안에서도 전체 재물운, 축적, 누수 원인이 서로 다른 질문이므로 해석 포인트를 갈라야 합니다.',
    narrativeAngle:
      '재물운은 수입 크기만이 아니라, 감정 소비와 관계 소비, 유지 구조까지 같이 봐야 실제 체감과 맞습니다.',
    lensAngle:
      '돈 풀이에서는 버는 재능과 지키는 습관을 분리해서 읽을수록 더 정확합니다.',
    wealthAngle:
      '이 질문에서는 수입 확대, 축적 구조, 누수 원인 중 무엇을 먼저 고쳐야 하는지부터 분명히 하는 편이 좋습니다.',
    timingAngle:
      '돈 문제는 큰 기회보다, 지출과 판단이 흔들리는 시기를 먼저 구분할수록 결과가 안정됩니다.',
    cautionAngle:
      '재물 고민에서는 불안을 핑계로 감으로 움직이기 시작하면 흐름을 더 빨리 놓칠 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 돈이 들어오는 길만이 아니라, 남는 방식과 새는 틈이 동시에 어떻게 움직이는지 봐야 합니다.'
  },
  RELATIONSHIPS: {
    summaryAngle:
      '이번 풀이는 좋은 사람을 고르는 문제보다, 어떤 관계가 나를 살리고 어떤 관계가 나를 빠르게 닳게 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '인간관계 고민은 전체 관계운과 손절 타이밍처럼 비슷해 보여도 판단해야 할 지점이 완전히 다릅니다.',
    narrativeAngle:
      '누가 맞는지보다, 내 에너지가 어디서 살아나고 어디서 흐려지는지부터 읽어야 관계 판단이 선명해집니다.',
    lensAngle:
      '관계 풀이에서는 정답보다 거리, 빈도, 부탁, 경계가 어디서 무너지는지를 먼저 봐야 합니다.',
    relationshipAngle:
      '관계 쪽에서는 편안함과 피로감이 함께 생기는 지점을 구분해 보는 편이 가장 현실적입니다.',
    timingAngle:
      '인간관계 질문은 감정이 오른 날보다, 내가 덜 지친 상태에서 선을 말할 수 있는 때가 언제인지가 더 중요합니다.',
    cautionAngle:
      '좋은 사람이 되려는 마음만 앞서면 관계 해석이 흐려지고, 필요한 경계도 늦어지기 쉽습니다.',
    evidenceAngle:
      '이번 질문에서는 누가 더 나쁘냐보다, 이 관계를 유지할수록 내 기운이 살아나는지 닳는지를 먼저 봐야 합니다.'
  },
  FAMILY: {
    summaryAngle:
      '이번 풀이는 가족을 더 잘 챙기는 방법보다, 가족 안에서 반복되는 기대와 피로가 어디서 생기는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '가족 고민은 전체 가족운과 부모와의 관계처럼 비슷해 보여도, 읽어야 할 장면과 말의 방향이 다릅니다.',
    narrativeAngle:
      '가족 관계는 애정이 없는 문제가 아니라, 가까워서 설명이 줄어들고 기대가 커지는 구조를 읽어야 정확합니다.',
    lensAngle:
      '가족 풀이에서는 누가 더 옳은지보다, 어떤 역할 기대가 내 마음을 무겁게 만드는지를 먼저 보는 편이 좋습니다.',
    relationshipAngle:
      '가족 쪽에서는 사랑과 부담이 동시에 올라오는 지점을 분리해서 봐야 말의 순서가 잡힙니다.',
    timingAngle:
      '가족 질문은 감정이 가장 오른 때보다, 대화를 짧고 분명하게 끝낼 수 있는 구간을 잡는 편이 낫습니다.',
    cautionAngle:
      '익숙함 때문에 참기만 하면 결국 더 크게 터질 수 있어, 가족일수록 선을 조용히 말하는 태도가 필요합니다.',
    evidenceAngle:
      '이번 질문에서는 애정의 크기보다, 반복되는 기대 역할과 거리 조절 패턴을 먼저 읽어야 합니다.'
  },
  YEAR_MONTH_DAY_FORTUNE: {
    summaryAngle:
      '이번 풀이는 장기 계획보다, 지금 시기의 리듬 속에서 무엇을 밀고 무엇을 아껴야 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '시기 질문은 단순히 좋고 나쁨보다, 어느 구간에서 속도를 올리고 어느 구간에서 실수를 줄여야 하는지 보는 편이 정확합니다.',
    narrativeAngle:
      '단기 운은 큰 사건보다 시작 순서, 체력 배분, 감정 관리처럼 하루와 한 달의 운영 방식에 더 크게 반응합니다.',
    lensAngle:
      '시기 풀이에서는 운세를 기다리기보다, 지금 붙는 타이밍과 피해야 할 타이밍을 실제 생활에 연결해야 합니다.',
    timingAngle:
      '이 질문에서는 정확한 날짜보다, 지금의 리듬을 덜 망치는 움직임이 무엇인지 읽는 편이 더 중요합니다.',
    cautionAngle:
      '시기 해석을 핑계로 모든 결정을 미루면 오히려 흐름을 놓치기 쉬우니, 작게라도 바로 연결해야 합니다.',
    evidenceAngle:
      '이번 질문에서는 지금 시기의 힘이 어디에 붙고 어디에서 빠지는지를 생활 장면으로 읽어야 합니다.'
  },
  DAEUN: {
    summaryAngle:
      '이번 풀이는 지금 10년 운이 삶의 무게중심을 어디로 옮기는지 읽는 데 초점을 둡니다.',
    overviewAngle:
      '대운 해석은 사건을 맞히기보다, 지금 몇 년 동안 기준을 무엇으로 다시 세워야 하는지 보는 편이 정확합니다.',
    narrativeAngle:
      '대운은 현재의 불편을 설명하는 동시에, 앞으로 오래 가져가야 할 방향도 같이 보여 주는 흐름입니다.',
    lensAngle:
      '이 질문에서는 한 번의 선택보다, 지금 10년 안에 굳혀야 할 습관과 줄여야 할 방식이 무엇인지 읽는 편이 더 중요합니다.',
    timingAngle:
      '대운은 오늘의 기분보다, 지금 몇 해를 어떤 자세로 통과하느냐가 더 중요합니다.',
    cautionAngle:
      '대운을 이유로 삶 전체를 뒤엎으려 하기보다, 방향을 선명하게 만드는 작은 정리가 먼저 필요합니다.',
    evidenceAngle:
      '이번 질문에서는 지금 10년이 내 삶의 어느 축을 키우고 어느 축을 접으라고 말하는지를 봐야 합니다.'
  },
  LUCK_UP: {
    summaryAngle:
      '이번 풀이는 기운을 바꾸는 특별한 비법보다, 지금 사주가 실제로 살아나는 생활 기준을 찾는 데 초점을 둡니다.',
    overviewAngle:
      '개운법은 상징적인 행위보다, 반복 가능한 루틴과 말투와 공간 정리처럼 생활 안에서 붙는 변화가 더 중요합니다.',
    narrativeAngle:
      '좋은 운은 기다리는 것이 아니라, 내 강한 기운이 실제 행동으로 이어질 수 있게 생활 구조를 조정할 때 더 빨리 붙습니다.',
    lensAngle:
      '개운 풀이에서는 없는 것을 억지로 만들기보다, 원래 있는 힘을 덜 새게 하는 습관을 먼저 정해야 합니다.',
    timingAngle:
      '개운은 결심한 날 한 번보다 같은 시간과 같은 순서를 반복할 수 있을 때 체감이 커집니다.',
    cautionAngle:
      '좋은 기운을 바란다고 하면서 생활을 그대로 두면 체감도 쉽게 흐려질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 무엇을 믿느냐보다, 어떤 생활 습관이 내 기운을 실제로 살리는지를 봐야 합니다.'
  }
};

const SELF_SCENARIO_PROFILES: Partial<
  Record<ScenarioCode, SelfScenarioContentProfile>
> = {
  SELF_BASIC: DEFAULT_SELF_PROFILE.BASIC,
  SELF_LIFETIME_FLOW: DEFAULT_SELF_PROFILE.LIFETIME_FLOW,
  SELF_DAEUN: DEFAULT_SELF_PROFILE.DAEUN,
  SELF_YEARLY_FORTUNE: {
    ...DEFAULT_SELF_PROFILE.YEAR_MONTH_DAY_FORTUNE,
    summaryAngle:
      '이번 풀이는 올해 전체의 결 안에서 무엇을 밀고 무엇을 아껴야 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '올해 운은 한 해 전체의 기세가 어디에 붙는지, 어떤 영역은 힘을 아껴야 하는지부터 나눠 봐야 합니다.',
    narrativeAngle:
      '올해 질문에서는 모든 걸 동시에 잘하려 하기보다, 잘 붙는 영역 하나를 더 선명하게 키우는 쪽이 훨씬 중요합니다.',
    lensAngle:
      '올해 운은 좋은지 나쁜지를 하나로 판단하기보다, 밀어도 되는 영역과 줄여야 할 영역을 분리해 보는 질문입니다.',
    timingAngle:
      '올해 흐름은 상반기와 하반기의 결 차이를 같이 봐야 실제 선택이 덜 흔들립니다.',
    cautionAngle:
      '한 해 해석을 이유로 모든 결정을 미루기보다, 지금 붙는 흐름과 맞는 생활 기준을 먼저 세워야 합니다.',
    evidenceAngle:
      '이번 질문에서는 올해 무엇이 좋아질지보다, 어디에 힘을 써야 실제로 복이 남는지를 읽어야 합니다.'
  },
  SELF_DAILY_FORTUNE: {
    ...DEFAULT_SELF_PROFILE.YEAR_MONTH_DAY_FORTUNE,
    summaryAngle:
      '이번 풀이는 오늘 하루 안에서 실수를 줄이고 힘을 써야 할 한 지점을 읽는 데 초점을 둡니다.',
    overviewAngle:
      '오늘 운은 큰 사건보다 시작 두세 시간의 리듬, 감정 소모, 우선순위 선택에서 더 선명하게 드러납니다.',
    narrativeAngle:
      '오늘 질문에서는 무엇을 많이 할지보다, 무엇 하나를 먼저 끝내야 흐름이 풀리는지를 보는 편이 맞습니다.',
    lensAngle:
      '오늘 운은 기세를 타는 시간과 피해야 할 충동을 구분해 주는 실전용 질문에 가깝습니다.',
    timingAngle:
      '오늘은 어떤 시간대에 밀고 어떤 시간대에는 무리하지 않아야 하는지가 핵심입니다.',
    cautionAngle:
      '하루 운을 과하게 믿고 즉흥 판단을 늘리면 오히려 실수가 커질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 오늘 어디에 힘을 먼저 써야 하루 전체가 덜 꼬이는지를 읽어야 합니다.'
  },
  SELF_LUCK_UP: DEFAULT_SELF_PROFILE.LUCK_UP,
  SELF_LOVE_GENERAL: {
    ...DEFAULT_SELF_PROFILE.ROMANCE,
    summaryAngle:
      '이번 풀이는 지금 내 연애 감정이 어디로 기울고 어떤 관계 결에서 편안해지는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '내 연애운은 상대 하나를 맞히는 질문보다, 내가 어떤 사람과 어떤 속도에서 덜 흔들리는지를 먼저 읽어야 합니다.',
    narrativeAngle:
      '지금 끌리는 방향과 실제로 편안한 관계 방향이 다를 수 있으므로, 두 감정을 나눠 보는 풀이가 필요합니다.',
    lensAngle:
      '내 연애운 질문에서는 설렘이 큰 관계와 오래 편안한 관계를 분리해서 보는 태도가 중요합니다.',
    relationshipAngle:
      '관계 쪽에서는 누구를 만나느냐보다, 내가 어떤 말투와 거리에서 안심하는지가 핵심입니다.',
    timingAngle:
      '연애운은 감정이 가장 큰 순간보다, 생활 리듬이 덜 흔들리는 구간에서 더 정확하게 읽힙니다.',
    cautionAngle:
      '좋아하는 마음이 커질수록 상대 해석에만 매달리기 쉬우니, 내 감정 체력을 같이 봐야 합니다.',
    evidenceAngle:
      '이번 질문에서는 지금 내 마음이 어디로 흐르는지와, 그 감정이 실제 관계로 이어질 수 있는지를 함께 봐야 합니다.',
    softRiskAngle:
      '설렘이 큰 관계를 운명처럼 받아들이면 정작 오래 편안한 사람을 지나치기 쉽습니다',
    reflectionQuestion:
      '지금 내가 끌리는 관계와 오래 편안할 관계가 정말 같은 방향인가요?'
  },
  SELF_LOVE_RECONCILIATION: {
    ...DEFAULT_SELF_PROFILE.ROMANCE,
    summaryAngle:
      '이번 풀이는 다시 만날 수 있느냐보다, 다시 만나도 괜찮을 조건이 실제로 남아 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '재회 질문은 미련의 크기보다, 이전의 끊긴 이유가 지금은 달라질 수 있는지를 먼저 봐야 정확합니다.',
    narrativeAngle:
      '좋았던 장면이 남아 있는 것과 다시 관계를 감당할 준비가 된 것은 다른 문제이므로, 그 둘을 갈라서 읽어야 합니다.',
    lensAngle:
      '재회 가능성에서는 반가움과 안정 가능성을 분리해서 읽는 태도가 가장 중요합니다.',
    relationshipAngle:
      '관계 쪽에서는 다시 붙는 계기보다, 예전과 다른 대화 순서와 경계가 실제로 가능해졌는지를 먼저 봐야 합니다.',
    timingAngle:
      '재회는 연락 한 번보다 서로의 생활과 감정이 예전보다 덜 흔들리는 구간에서 실마리가 보입니다.',
    cautionAngle:
      '외로움이나 죄책감을 가능성으로 착각하면 다시 이어져도 같은 상처가 더 빨리 되살아날 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 다시 이어질 여지와 동시에, 다시 이어졌을 때 무엇이 반드시 달라져야 하는지를 함께 읽어야 합니다.',
    softRiskAngle:
      '그리움이 큰 날일수록 예전의 문제를 덜 중요하게 여기기 쉽습니다',
    reflectionQuestion:
      '다시 만나고 싶은 마음과 다시 만나도 안전한 관계인지에 대한 답이 같은가요?'
  },
  SELF_LOVE_CONTACT_RETURN: {
    ...DEFAULT_SELF_PROFILE.ROMANCE,
    summaryAngle:
      '이번 풀이는 연락이 오느냐 자체보다, 연락이 와도 관계가 다시 편안하게 이어질 수 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '다시 연락 질문은 기다림의 길이보다, 연락이 닿았을 때 내가 어떻게 받아야 덜 흔들리는지를 먼저 봐야 합니다.',
    narrativeAngle:
      '한 번의 답장보다 이후의 말 흐름이 중요하므로, 연락의 유무와 관계 회복 가능성을 따로 읽는 편이 맞습니다.',
    lensAngle:
      '이 질문에서는 연락을 받는 순간의 감정과, 그 이후 관계를 이어갈 체력을 분리해서 봐야 합니다.',
    relationshipAngle:
      '관계 쪽에서는 연락 빈도보다 말의 온도와 다시 편해지는 속도가 핵심입니다.',
    timingAngle:
      '연락 질문은 기다림의 날짜보다, 내가 흔들리지 않고 반응선을 지킬 수 있는 시기가 언제인지가 더 중요합니다.',
    cautionAngle:
      '늦은 연락 하나에 모든 의미를 싣기 시작하면 관계의 실제 결을 읽기 어려워집니다.',
    evidenceAngle:
      '이번 질문에서는 연락이 닿을 여지와 함께, 연락이 와도 관계가 다시 살아날 구조가 남아 있는지를 읽어야 합니다.',
    softRiskAngle:
      '늦게 온 연락 한 번에 관계 전체의 의미를 크게 덧씌우기 쉽습니다',
    reflectionQuestion:
      '연락이 온다면 반가움보다 먼저 확인해야 할 기준은 무엇인가요?'
  },
  SELF_LOVE_CONFESSION_TIMING: {
    ...DEFAULT_SELF_PROFILE.ROMANCE,
    summaryAngle:
      '이번 풀이는 고백 성공 확률보다, 지금 마음을 꺼냈을 때 관계가 자연스럽게 앞으로 갈 준비가 되어 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '고백 타이밍은 감정의 크기보다 관계 온도, 상대의 반응 여지, 고백 후 이어질 리듬을 먼저 봐야 정확합니다.',
    narrativeAngle:
      '좋아하는 마음을 말하는 순간보다, 고백 이후 어색해지지 않고 관계를 이어갈 흐름이 남아 있는지가 더 중요합니다.',
    lensAngle:
      '이 질문에서는 말할 용기와 관계가 감당할 수 있는 타이밍을 분리해서 읽는 태도가 필요합니다.',
    relationshipAngle:
      '관계 쪽에서는 표현의 진심도 중요하지만, 상대가 지금 어떤 속도로 가까워지고 있는지가 더 핵심입니다.',
    timingAngle:
      '고백은 마음이 가장 커졌을 때보다, 상대와의 리듬이 조금 안정돼 있을 때 훨씬 자연스럽게 붙습니다.',
    cautionAngle:
      '확답을 빨리 받고 싶은 조급함이 커지면, 실제보다 더 빠른 타이밍에 말을 꺼내기 쉽습니다.',
    evidenceAngle:
      '이번 질문에서는 고백의 용기보다, 고백 후에도 관계가 이어질 생활 리듬이 있는지를 먼저 읽어야 합니다.',
    softRiskAngle:
      '불안을 빨리 끝내고 싶은 마음이 관계가 감당할 속도보다 앞서기 쉽습니다',
    reflectionQuestion:
      '지금의 고백은 관계를 앞으로 보내는 말인가요, 내 불안을 빨리 덜고 싶은 말인가요?'
  },
  SELF_MARRIAGE_GENERAL: DEFAULT_SELF_PROFILE.MARRIAGE,
  SELF_CAREER_GENERAL: {
    ...DEFAULT_SELF_PROFILE.CAREER,
    summaryAngle:
      '이번 풀이는 지금 일 방향이 맞는지, 강점이 실제 결과로 이어지는 자리가 어디인지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '직업운 질문은 옮길지 말지보다, 지금 자리에서 힘이 붙는 방식과 새는 방식을 먼저 읽어야 합니다.',
    narrativeAngle:
      '지금 하는 일이 맞는지 보려면 성과보다 방식, 리듬, 피로도, 반복 가능성을 함께 읽어야 합니다.',
    lensAngle:
      '직업운에서는 업무 이름보다, 어떤 결과물을 만들 때 내 강점이 더 오래 살아나는지가 핵심입니다.',
    wealthAngle:
      '일과 수입은 붙어 있지만, 이 질문에서는 우선 “내 방식이 통하는 자리인가”를 먼저 확인해야 합니다.',
    timingAngle:
      '직업운은 빨리 결론내기보다, 지금 내 방식이 더 선명하게 보이는 구간을 잡을수록 정확해집니다.',
    cautionAngle:
      '답답함을 전부 실력 부족으로 받아들이면, 방향 문제를 놓친 채 더 무리하게 버티기 쉽습니다.',
    evidenceAngle:
      '이번 질문에서는 지금 일이 맞는지, 강점이 살아나는 환경인지, 힘이 어디서 새는지를 함께 읽어야 합니다.',
    softRiskAngle:
      '답답함을 실력 부족으로만 해석하면 맞지 않는 구조를 너무 오래 버틸 수 있습니다',
    reflectionQuestion:
      '지금 내 강점을 또렷하게 만드는 일과 흐리게 만드는 일은 각각 무엇인가요?'
  },
  SELF_CAREER_APTITUDE: {
    ...DEFAULT_SELF_PROFILE.CAREER,
    summaryAngle:
      '이번 풀이는 돈이 되는 일보다, 오래 해도 덜 닳고 실력이 계속 쌓이는 일의 결을 읽는 데 초점을 둡니다.',
    overviewAngle:
      '적성 질문은 좋아 보이는 일보다, 반복할수록 내 장점이 더 또렷해지는 일을 찾는 데 가깝습니다.',
    narrativeAngle:
      '한 번 잘한 일보다 오래 계속할 수 있는 방식이 무엇인지 읽어야 적성 풀이가 실제 삶에 맞습니다.',
    lensAngle:
      '적성에서는 흥미와 체력과 결과 방식이 함께 맞는 구조를 찾아야 합니다.',
    wealthAngle:
      '적성은 당장 돈이 되는지보다, 오래 할수록 성과와 신뢰가 같이 쌓이는 일인지가 더 중요합니다.',
    timingAngle:
      '적성 질문은 당장의 성과 압박에서 조금 떨어져 있을 때 더 정확하게 읽힙니다.',
    cautionAngle:
      '남들이 인정하는 일만 좇으면, 정작 오래 갈 내 방식은 자꾸 뒤로 밀릴 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 무엇을 좋아하느냐보다, 무엇을 반복할수록 강점이 더 선명해지는지를 읽어야 합니다.',
    softRiskAngle:
      '남들이 보기 좋은 일에 맞추다 보면 정작 오래 버틸 내 방식을 놓치기 쉽습니다',
    reflectionQuestion:
      '반복할수록 체력이 남고 실력이 쌓이는 일은 실제로 무엇인가요?'
  },
  SELF_CAREER_JOB_CHANGE: {
    ...DEFAULT_SELF_PROFILE.CAREER,
    summaryAngle:
      '이번 풀이는 답답해서 떠날지보다, 지금 움직였을 때 생활과 체력이 함께 버틸 수 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '이직 타이밍은 회사를 싫어하느냐보다, 다음 자리에서 어떤 성과 방식으로 살아날지를 먼저 봐야 정확합니다.',
    narrativeAngle:
      '지금의 피로와 다음 자리의 가능성을 분리해 읽어야, 감정적 탈출과 실제 전환을 구분할 수 있습니다.',
    lensAngle:
      '이직 질문에서는 “떠나고 싶다”와 “옮겨도 괜찮다”를 분리해서 읽는 태도가 필요합니다.',
    wealthAngle:
      '다음 자리 조건, 버틸 생활 리듬, 보여 줄 결과를 함께 정리해야 이직 해석이 실제 선택에 도움이 됩니다.',
    timingAngle:
      '이직은 답답함이 가장 큰 순간보다, 다음 자리에서 보여 줄 문장이 짧게 정리됐을 때 훨씬 정확합니다.',
    cautionAngle:
      '지금의 피로만 피하려고 움직이면, 같은 이유로 다시 지치기 쉬운 선택을 반복할 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 지금 떠나야 하는 이유와 더 다져야 하는 이유를 동시에 읽어야 합니다.',
    softRiskAngle:
      '지금의 피로를 빨리 끝내고 싶은 마음이 다음 자리의 현실 조건을 흐리기 쉽습니다',
    reflectionQuestion:
      '지금 떠나고 싶은 이유와 다음 자리에서 얻고 싶은 조건을 따로 말할 수 있나요?'
  },
  SELF_WEALTH_GENERAL: {
    ...DEFAULT_SELF_PROFILE.WEALTH,
    summaryAngle:
      '이번 풀이는 전체 재물 흐름 안에서 돈이 어디로 붙고 어디로 새는지를 넓게 읽는 데 초점을 둡니다.',
    overviewAngle:
      '재물운 전체 해석은 수입 운, 유지력, 지출 습관, 불안 소비를 한 자리에서 같이 봐야 정확합니다.',
    narrativeAngle:
      '돈 문제를 숫자 하나로 보지 말고, 들어오는 방식과 남기는 방식이 같은 방향인지 먼저 읽어야 합니다.',
    lensAngle:
      '전체 재물운에서는 버는 기회와 지키는 기준이 서로 어떻게 어긋나는지를 같이 보는 편이 좋습니다.',
    wealthAngle:
      '이 질문에서는 한 방보다, 현재 돈을 다루는 구조를 넓게 정리하는 일이 먼저입니다.',
    timingAngle:
      '전체 재물운은 큰 결정보다 지출과 판단이 흔들리는 시기를 구분할수록 체감이 커집니다.',
    cautionAngle:
      '돈을 크게 바꾸고 싶은 마음이 앞설수록, 정작 바로 막을 수 있는 작은 누수를 놓치기 쉽습니다.',
    evidenceAngle:
      '이번 질문에서는 수입 확대만이 아니라, 돈이 오래 남지 못하는 이유를 함께 읽어야 합니다.',
    softRiskAngle:
      '수입을 늘리고 싶은 마음이 커질수록 바로 막을 수 있는 작은 누수를 과소평가하기 쉽습니다',
    reflectionQuestion:
      '돈이 들어오는 길과 남는 길이 지금 같은 방향으로 움직이고 있나요?'
  },
  SELF_WEALTH_ACCUMULATION: {
    ...DEFAULT_SELF_PROFILE.WEALTH,
    summaryAngle:
      '이번 풀이는 더 버는 문제보다, 들어온 돈을 어떻게 오래 붙잡고 축적할 수 있는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '돈이 모이는 흐름은 수입 크기보다, 유지 기준과 자동으로 남는 구조를 만들 수 있는지가 더 중요합니다.',
    narrativeAngle:
      '축재 질문에서는 큰 기회 하나보다, 오래 반복 가능한 저축과 보관 방식이 무엇인지 읽는 편이 더 맞습니다.',
    lensAngle:
      '이 질문에서는 버는 힘과 모으는 힘을 분리해서 봐야, 왜 돈이 남지 않는지와 어떻게 남길지를 정확히 읽을 수 있습니다.',
    wealthAngle:
      '돈이 붙는 방향보다, 붙은 돈이 왜 오래 남는지와 어떤 구조에서 복이 쌓이는지가 핵심입니다.',
    timingAngle:
      '축적은 마음먹은 날보다 자동화와 기준표가 붙는 시점에서 실제 체감이 커집니다.',
    cautionAngle:
      '눈에 띄는 수익만 좇으면, 정작 오래 남을 돈의 속도는 더 늦어질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 돈이 들어오는 순간보다, 들어온 돈이 오래 머무는 조건을 읽어야 합니다.',
    softRiskAngle:
      '큰 수익 장면만 바라보다 자동으로 남게 만드는 구조를 뒤로 미루기 쉽습니다',
    reflectionQuestion:
      '지금 들어오는 돈 가운데 자동으로 남게 만들 수 있는 몫은 무엇인가요?'
  },
  SELF_WEALTH_LEAK: {
    ...DEFAULT_SELF_PROFILE.WEALTH,
    summaryAngle:
      '이번 풀이는 더 벌 수 있느냐보다, 모르는 사이 빠져나가는 돈과 마음의 습관을 읽는 데 초점을 둡니다.',
    overviewAngle:
      '돈이 새는 이유는 지출 항목만이 아니라 피로, 관계, 충동, 죄책감이 소비로 번지는 구조를 같이 봐야 합니다.',
    narrativeAngle:
      '누수 질문에서는 수입 부족과 구조 누수를 분리해 읽어야, 당장 막을 구멍이 선명해집니다.',
    lensAngle:
      '이 질문에서는 “왜 돈이 안 남지?”보다 “어떤 감정과 관계가 지출 버튼을 누르는지”를 먼저 봐야 합니다.',
    wealthAngle:
      '새는 돈은 금액보다 패턴이 더 중요하므로, 반복 지출이 어떤 상황에서 생기는지를 읽어야 합니다.',
    timingAngle:
      '누수는 소비 욕구가 커지는 시간대와 상황을 구분하는 순간부터 실제로 잡히기 시작합니다.',
    cautionAngle:
      '불안을 달래는 지출을 필요 비용으로 포장하기 시작하면 흐름을 더 오래 놓치기 쉽습니다.',
    evidenceAngle:
      '이번 질문에서는 어디서 돈이 빠져나가는지뿐 아니라, 왜 그 지출을 멈추기 어려운지도 함께 읽어야 합니다.',
    softRiskAngle: '피로와 죄책감이 올라오는 순간 소비를 합리화하기 쉽습니다',
    reflectionQuestion:
      '내 소비를 누르는 감정 트리거는 언제 가장 자주 올라오나요?'
  },
  SELF_RELATIONSHIP_GENERAL: {
    ...DEFAULT_SELF_PROFILE.RELATIONSHIPS,
    summaryAngle:
      '이번 풀이는 인간관계 전체 안에서 어떤 사람이 나를 살리고 어떤 장면이 나를 빨리 지치게 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '전체 관계운은 인연의 수보다, 내 에너지가 어디서 살아나고 어디서 흐려지는지 넓게 읽는 질문입니다.',
    narrativeAngle:
      '좋은 사람을 만나는 운보다, 지금 내 생활이 어떤 관계 구조를 감당할 수 있는지가 더 중요하게 작동합니다.',
    lensAngle:
      '관계운 질문에서는 잘 맞는 사람을 찾는 것과 내가 지키려는 선을 세우는 일을 같이 봐야 합니다.',
    relationshipAngle:
      '관계 쪽에서는 편한 사람과 믿을 수 있는 사람이 꼭 같지 않을 수 있으니, 두 기준을 나눠 읽는 편이 좋습니다.',
    timingAngle:
      '전체 관계운은 새로운 사람을 넓히는 때보다, 오래 갈 사람과 줄일 관계를 구분할 때 체감이 커집니다.',
    cautionAngle:
      '사람을 잃기 싫은 마음이 커질수록 내 기준이 흐려지고, 관계 피로는 더 오래 쌓일 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 관계의 수보다, 나를 살리는 연결과 나를 닳게 하는 연결을 먼저 읽어야 합니다.',
    softRiskAngle:
      '좋은 사람으로 남고 싶은 마음 때문에 지쳐도 괜찮다고 넘기기 쉽습니다',
    reflectionQuestion:
      '요즘 내 기운을 살리는 관계와 닳게 만드는 관계는 분명히 구분되고 있나요?'
  },
  SELF_RELATIONSHIP_CUT_OFF: {
    ...DEFAULT_SELF_PROFILE.RELATIONSHIPS,
    summaryAngle:
      '이번 풀이는 누군가를 바로 끊을지보다, 어디까지 선을 긋고 어디서부터 정리를 시작해야 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '손절 타이밍은 상대 평가보다, 이 관계를 유지할수록 내가 얼마나 흐려지고 지치는지를 먼저 봐야 합니다.',
    narrativeAngle:
      '완전한 절연과 거리 조절은 다른 선택이므로, 지금 내 질문이 어느 쪽인지부터 갈라서 읽어야 합니다.',
    lensAngle:
      '이 질문에서는 “끊어도 되나?”보다 “지금 내 기운을 지키려면 어디까지 선을 그어야 하나?”를 먼저 읽어야 합니다.',
    relationshipAngle:
      '관계 쪽에서는 반가움과 의리보다, 반복해서 에너지가 빠지는 장면과 경계가 무너지는 순간이 핵심입니다.',
    timingAngle:
      '손절 타이밍은 크게 터진 뒤보다, 작은 선을 조용히 말할 수 있을 때 더 정확하게 잡힙니다.',
    cautionAngle:
      '미안함만으로 너무 오래 버티면 결국 더 거칠게 끊어낼 가능성이 커질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 완전히 끊어야 하는지보다, 지금 필요한 것이 거리 조절인지 정리인지부터 읽어야 합니다.',
    softRiskAngle:
      '미안함이 커질수록 필요한 거리 조절을 단절과 같다고 느끼며 더 늦추기 쉽습니다',
    reflectionQuestion:
      '이 관계에서 정말 필요한 것은 단절인가요, 거리 조절인가요?'
  },
  SELF_FAMILY_GENERAL: {
    ...DEFAULT_SELF_PROFILE.FAMILY,
    summaryAngle:
      '이번 풀이는 가족 전체 안에서 어떤 기대와 역할이 나를 무겁게 하는지를 읽는 데 초점을 둡니다.',
    overviewAngle:
      '가족운 전체 질문은 특정 한 사람보다, 집안의 말투와 역할 분담과 거리감이 어떻게 굳어 있는지를 먼저 봐야 합니다.',
    narrativeAngle:
      '가족 관계는 사랑 유무보다 반복되는 역할 기대를 읽을 때 훨씬 정확해집니다.',
    lensAngle:
      '이 질문에서는 누가 더 챙기느냐보다, 내가 어디까지 책임을 떠안고 있는지를 먼저 읽어야 합니다.',
    relationshipAngle:
      '가족 쪽에서는 챙김과 간섭, 책임감과 죄책감이 어디서 섞이는지가 핵심입니다.',
    timingAngle:
      '가족운은 감정이 높을 때보다, 설명을 짧게 붙일 수 있는 구간에서 더 잘 풀립니다.',
    cautionAngle:
      '당연히 알아줄 거라는 기대가 커질수록 오히려 서운함이 길게 남을 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 누가 더 맞는지가 아니라, 집안에서 반복되는 기대 역할과 피로 구조를 읽어야 합니다.',
    softRiskAngle:
      '가족이니까 이해해 주겠지라는 마음이 설명해야 할 선을 더 늦추기 쉽습니다',
    reflectionQuestion: '가족 안에서 내가 반복해서 떠맡는 역할은 무엇인가요?'
  },
  SELF_FAMILY_PARENTS: {
    ...DEFAULT_SELF_PROFILE.FAMILY,
    summaryAngle:
      '이번 풀이는 부모와 더 가까워질지보다, 덜 다치고 더 오래 갈 수 있는 말의 거리와 기대의 선을 읽는 데 초점을 둡니다.',
    overviewAngle:
      '부모와의 관계는 사랑의 크기보다 죄책감, 걱정, 간섭, 독립 욕구가 어디서 부딪히는지를 먼저 봐야 합니다.',
    narrativeAngle:
      '부모 질문은 가족 전체와 달리, 오래 익숙한 말투와 기대가 어떻게 내 마음을 눌러 왔는지까지 읽어야 합니다.',
    lensAngle:
      '이 질문에서는 “효도해야 하나”보다 “내가 어떤 말을 들을 때 가장 무겁고 어떤 선이 필요하나”를 먼저 읽어야 합니다.',
    relationshipAngle:
      '부모와의 관계에서는 애정과 부담이 한 문장 안에 같이 들어오기 쉬우므로, 감정과 요청을 분리하는 태도가 중요합니다.',
    timingAngle:
      '부모 질문은 감정이 오른 직후보다, 짧은 말로도 선을 분명히 전할 수 있는 때가 훨씬 중요합니다.',
    cautionAngle:
      '오래 참은 말일수록 한 번에 다 꺼내려 하면 오히려 핵심 선이 흐려질 수 있습니다.',
    evidenceAngle:
      '이번 질문에서는 부모를 바꾸는 문제보다, 내가 덜 다치기 위해 어떤 대화 거리와 생활 선이 필요한지를 읽어야 합니다.',
    softRiskAngle:
      '이해받고 싶은 마음이 클수록 지켜야 할 선을 죄책감과 섞어 보기 쉽습니다',
    reflectionQuestion:
      '부모에게 이해받고 싶은 마음과 지키고 싶은 선이 어디서 충돌하나요?'
  }
};

export function getSelfScenarioContentProfile(
  scenarioCode: ScenarioCode | null | undefined,
  subjectType: SelfSubjectType
): SelfScenarioContentProfile {
  if (scenarioCode && scenarioCode in SELF_SCENARIO_PROFILES) {
    return SELF_SCENARIO_PROFILES[scenarioCode] as SelfScenarioContentProfile;
  }

  return DEFAULT_SELF_PROFILE[subjectType];
}
