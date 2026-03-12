import {
  type CompatibilityRelationType,
  type SelfSubjectType
} from '@/lib/saju/constants';
import type { SubjectContext } from './types';

export const SELF_SUBJECT_CONTEXT: Record<SelfSubjectType, SubjectContext> = {
  BASIC: {
    focus: '전반 흐름의 균형 회복',
    storyline:
      '판을 한 번에 뒤집기보다, 생활 리듬을 정돈할수록 전체 운이 살아납니다.',
    softRisk: '여러 영역을 동시에 잡으려다 체력이 먼저 떨어질 수 있습니다',
    firstAction:
      '이번 주 핵심 목표를 1개만 정하고, 나머지는 보조 과제로 내려두기',
    relationHint:
      '가까운 사람과의 대화에서는 결론보다 현재 상태 공유를 먼저 시작하세요.',
    workMoneyHint:
      '일과 재물은 같은 뿌리입니다. 일정을 정리하면 지출도 같이 안정됩니다.',
    timingHint:
      '새로운 시작은 월초보다 컨디션이 올라오는 요일에 맞추는 편이 유리합니다.',
    reflectionQuestion:
      '지금 삶의 균형을 가장 무너뜨리는 요소 1가지는 무엇인가요?'
  },
  LIFETIME_FLOW: {
    focus: '중장기 궤도 점검',
    storyline:
      '지금은 단기 성과보다 3~5년 뒤를 위한 방향 수정이 더 큰 보답을 주는 시기입니다.',
    softRisk: '당장 보이는 성과가 적다고 방향 자체를 의심할 수 있습니다',
    firstAction: '5년 뒤 원하는 모습 3줄을 쓰고, 올해 할 행동 1개로 압축하기',
    relationHint:
      '장기 계획은 혼자 품기보다 신뢰하는 1명에게 말로 꺼내면 실행력이 커집니다.',
    workMoneyHint:
      '커리어 선택은 연봉보다 지속 가능성을 기준으로 볼 때 운의 저항이 줄어듭니다.',
    timingHint: '중요한 전환 결정은 피곤한 밤보다 오전 집중 시간에 정리하세요.',
    reflectionQuestion:
      '지금의 선택이 3년 뒤의 나를 돕는 선택인지 스스로 확신할 수 있나요?'
  },
  ROMANCE: {
    focus: '연애 감정선의 건강한 흐름',
    storyline:
      '관계의 속도보다 감정의 온도를 맞출 때 진짜 안정감이 만들어집니다.',
    softRisk: '확신을 빨리 얻고 싶은 마음에 상대의 리듬을 놓칠 수 있습니다',
    firstAction:
      '감정 표현 전, 내가 원하는 관계 방향을 한 문장으로 먼저 정리하기',
    relationHint:
      '감정은 솔직하게, 기대치는 구체적으로 전달할수록 오해가 줄어듭니다.',
    workMoneyHint:
      '연애 스트레스가 업무 집중을 흔들 수 있으니 하루 경계 시간을 분리해 두세요.',
    timingHint:
      '중요한 고백/대화는 피곤한 시간대를 피하고 여유 있는 시간에 진행하세요.',
    reflectionQuestion: '나는 사랑받고 싶은 방식과 사랑을 주는 방식이 같은가요?'
  },
  MARRIAGE: {
    focus: '결혼/배우자 관계의 실질 안정',
    storyline:
      '감정도 중요하지만, 함께 사는 호흡을 맞출수록 관계가 더 오래 갑니다.',
    softRisk: '서로 배려하다 중요한 기준을 말하지 못한 채 쌓아둘 수 있습니다',
    firstAction: '생활/재정/시간 기준 3가지를 짧게 맞춰 보기',
    relationHint:
      '갈등이 생기면 누가 맞는지보다 앞으로 어떻게 맞춰 갈지를 먼저 이야기하세요.',
    workMoneyHint:
      '배우자운은 재정 습관과 연결됩니다. 공통 목표 자금의 이름을 붙여보세요.',
    timingHint:
      '주요 결정은 감정이 올라온 직후보다 하루 뒤에 확정하는 편이 안정적입니다.',
    reflectionQuestion:
      '우리가 같은 미래를 보고 있다는 신호는 무엇으로 확인할 수 있나요?'
  },
  CAREER: {
    focus: '직업운/적성의 실전 전개',
    storyline:
      '지금은 이것저것 넓히기보다, 내가 가장 잘하는 일을 또렷하게 보여줄 때입니다.',
    softRisk: '잘하고 싶은 마음이 커서 우선순위가 분산될 수 있습니다',
    firstAction:
      '내 강점이 가장 잘 보이는 업무 1개를 선택해 이번 주 결과물로 남기기',
    relationHint:
      '직장 대화에서는 감정보다 기준/기한/결과 순서로 말하면 신뢰가 빠르게 쌓입니다.',
    workMoneyHint: '커리어운은 반복 가능한 성과를 만들 때 크게 확장됩니다.',
    timingHint:
      '중요 보고/제안은 오전 시간대에 먼저 던지는 편이 반응이 좋습니다.',
    reflectionQuestion:
      '내가 잘하는 일과 인정받는 일이 지금 얼마나 겹치고 있나요?'
  },
  WEALTH: {
    focus: '재물 흐름의 정리',
    storyline:
      '큰 행운 한 번보다 새는 구멍을 막는 습관이 돈의 체력을 만들 시기입니다.',
    softRisk: '단기 수익 기대가 커지면 무리한 선택으로 이어지기 쉽습니다',
    firstAction:
      '고정 지출에서 즉시 줄일 항목 1개를 정하고 자동 이체를 조정하기',
    relationHint:
      '돈 이야기는 감정이 상하기 쉬우니 숫자 기준으로 합의하는 습관이 중요합니다.',
    workMoneyHint:
      '지금은 크게 벌리기보다 들어온 돈을 안정시키는 쪽이 더 맞습니다.',
    timingHint:
      '지출 점검은 감정 소비가 많은 저녁보다 낮 시간에 하는 것이 정확합니다.',
    reflectionQuestion:
      '지금의 소비 중 3개월 뒤에도 나를 돕는 지출은 무엇인가요?'
  },
  RELATIONSHIPS: {
    focus: '인간관계 운의 피로도 관리',
    storyline:
      '사람을 넓히는 시기보다, 내 에너지를 지켜줄 관계를 정리하는 시기입니다.',
    softRisk: '거절을 미루다 관계 피로가 누적될 수 있습니다',
    firstAction:
      '관계별 에너지 소모도를 기록하고 경계가 필요한 관계 1개 설정하기',
    relationHint:
      '좋은 사람이 되려는 태도보다, 솔직하고 일관된 태도가 더 오래 갑니다.',
    workMoneyHint:
      '관계 스트레스는 생산성과 연결됩니다. 회복 루틴을 먼저 확보해 두세요.',
    timingHint:
      '어려운 대화는 문자보다 음성/대면으로 짧게 정리하는 편이 유리합니다.',
    reflectionQuestion: '나는 누구와 있을 때 가장 나다운 에너지가 살아나나요?'
  },
  FAMILY: {
    focus: '가족운의 안정과 거리 조절',
    storyline:
      '가족운은 정답을 맞추는 관계가 아니라, 안전한 대화를 만드는 관계입니다.',
    softRisk: '익숙함 때문에 감정을 생략해 오해가 깊어질 수 있습니다',
    firstAction:
      '가족과 이번 주 15분 대화 시간을 정하고, 요청 1개만 분명히 말하기',
    relationHint:
      '가족일수록 설명이 필요합니다. 당연함을 줄이고 맥락을 한 번 더 전하세요.',
    workMoneyHint:
      '가족 이슈를 미뤄두면 일 집중도가 떨어지니 작은 합의부터 먼저 진행하세요.',
    timingHint: '감정이 예민한 날은 결론보다 분위기 회복을 우선하세요.',
    reflectionQuestion:
      '가족에게 바라는 점을 비난 없이 전달한다면 어떤 문장이 될까요?'
  },
  YEAR_MONTH_DAY_FORTUNE: {
    focus: '단기 흐름(연/월/일) 최적화',
    storyline:
      '큰 계획보다 오늘의 선택 품질이 운의 방향을 빠르게 바꾸는 시기입니다.',
    softRisk: '하루 컨디션에 따라 판단이 크게 흔들릴 수 있습니다',
    firstAction:
      '오늘 반드시 끝낼 1가지를 오전에 먼저 완료하고 나머지를 배치하기',
    relationHint:
      '단기 운이 불안한 날은 중요한 관계 대화를 하루 미루는 것도 전략입니다.',
    workMoneyHint: '단기 성과는 속도보다 실수율 관리가 핵심입니다.',
    timingHint: '오늘 운은 시작 2시간의 집중력에서 갈립니다.',
    reflectionQuestion: '오늘 하나만 바꾼다면 내일이 달라질 행동은 무엇인가요?'
  },
  DAEUN: {
    focus: '대운 흐름 해석',
    storyline:
      '지금은 운의 결을 읽고 생활 구조를 바꾸면 긴 흐름이 훨씬 부드러워지는 시기입니다.',
    softRisk: '대운을 핑계로 현재의 선택을 미루면 흐름을 놓칠 수 있습니다',
    firstAction:
      '지금 대운에서 가장 키워야 할 습관 1개와 줄여야 할 습관 1개를 적기',
    relationHint:
      '대운이 바뀔수록 관계의 거리감도 달라질 수 있으니 붙잡기보다 조율에 집중하세요.',
    workMoneyHint:
      '대운 해석은 일·돈 구조를 장기적으로 다시 짜는 데 특히 유용합니다.',
    timingHint:
      '대운 전환기의 결정은 빠른 결론보다 충분한 검토 후 실행이 유리합니다.',
    reflectionQuestion: '지금 대운이 내게 요구하는 삶의 태도 변화는 무엇인가요?'
  },
  LUCK_UP: {
    focus: '개운 습관 설계',
    storyline:
      '운은 기다리는 것이 아니라 생활 리듬과 선택을 조정하며 끌어오는 것입니다.',
    softRisk: '좋은 기운을 바라면서도 실제 행동은 바꾸지 않을 수 있습니다',
    firstAction: '아침 루틴 1개와 저녁 정리 루틴 1개를 오늘부터 고정하기',
    relationHint:
      '운을 바꾸려면 사람을 바꾸기보다 대화 태도를 바꾸는 것이 먼저입니다.',
    workMoneyHint:
      '개운은 거창한 의식보다 일정·지출·수면 같은 반복 구조를 정리할 때 빨라집니다.',
    timingHint: '아침 첫 루틴을 고정하면 하루 운의 밀도가 확실히 달라집니다.',
    reflectionQuestion:
      '내가 당장 바꿀 수 있는 생활 습관 중 운의 흐름을 가장 크게 바꿀 것은 무엇인가요?'
  }
};

export const COMPATIBILITY_SUBJECT_CONTEXT: Record<
  CompatibilityRelationType,
  SubjectContext
> = {
  BASIC: {
    focus: '관계의 기본 합과 리듬',
    storyline:
      '잘 맞는 점은 살리고, 어긋나는 지점은 역할 분담으로 푸는 관계가 오래갑니다.',
    softRisk: '서로를 이해하려다 상대의 본래 속도를 바꾸려 들 수 있습니다',
    firstAction: '서로 기대하는 관계의 핵심 1가지를 말로 확인하기',
    relationHint:
      '감정은 따뜻하게, 기준은 분명하게 말할수록 관계가 편안해집니다.',
    workMoneyHint:
      '기본 궁합은 감정뿐 아니라 함께 지내는 방식도 같이 봐야 더 정확합니다.',
    timingHint: '중요한 합의는 감정이 잦아든 뒤 짧고 명확하게 정리하세요.',
    reflectionQuestion: '이 관계에서 내가 기대하는 안정감은 어떤 모습인가요?'
  },
  LOVER: {
    focus: '연인 궁합의 감정선과 애착 리듬',
    storyline: '좋아하는 마음보다 중요한 것은 감정의 속도를 맞추는 기술입니다.',
    softRisk: '사소한 서운함을 오래 묵히면 관계 해석이 왜곡될 수 있습니다',
    firstAction: '좋아하는 방식과 서운해지는 지점을 각각 1개씩 공유하기',
    relationHint:
      '연애는 정답보다 리듬입니다. 감정 표현 빈도를 맞추는 것이 핵심입니다.',
    workMoneyHint: '연애 갈등은 생활 리듬과 소비 습관 차이에서 자주 생깁니다.',
    timingHint: '갈등 대화는 늦은 밤보다 낮 시간대가 훨씬 부드럽게 풀립니다.',
    reflectionQuestion: '우리는 지금 같은 속도로 가까워지고 있나요?'
  },
  MARRIED: {
    focus: '부부 궁합의 생활 합',
    storyline:
      '감정이 좋아도 생활이 엇갈리면 지치고, 생활이 맞으면 마음도 오래 갑니다.',
    softRisk: '익숙함 때문에 중요한 기준을 합의 없이 넘길 수 있습니다',
    firstAction:
      '생활/가사/재정에서 가장 자주 부딪히는 항목 1개를 구조적으로 정리하기',
    relationHint: '부부는 마음만큼이나 생활 기준을 맞추는 일이 중요합니다.',
    workMoneyHint:
      '가정의 재정 구조와 역할 분담을 정리할수록 궁합이 안정됩니다.',
    timingHint: '민감한 주제는 식사 직후보다 여유 시간에 별도로 꺼내세요.',
    reflectionQuestion: '우리가 함께 살면서 가장 자주 놓치는 합의는 무엇인가요?'
  },
  CRUSH: {
    focus: '썸/짝사랑의 가능성과 해석',
    storyline:
      '관계의 신호를 읽는 감각과 조급함을 다루는 태도가 결과를 가릅니다.',
    softRisk: '상대의 작은 반응에 의미를 과하게 부여할 수 있습니다',
    firstAction:
      '상대의 신호를 해석하기보다 내가 보여줄 태도 1개를 먼저 정하기',
    relationHint:
      '확신을 서두르지 않고 대화의 온도를 천천히 맞추는 편이 좋습니다.',
    workMoneyHint:
      '감정이 커질수록 일상 균형이 깨질 수 있으니 생활 리듬을 먼저 지키세요.',
    timingHint:
      '메시지 템포를 맞추되, 관계 정의는 서두르지 않는 균형이 좋습니다.',
    reflectionQuestion:
      '지금 나는 상대를 보고 있나요, 내가 기대하는 환상을 보고 있나요?'
  },
  FRIEND: {
    focus: '친구 궁합의 편안함과 경계',
    storyline:
      '친구 관계는 서로의 방식이 다르더라도 존중이 유지되면 오래 갑니다.',
    softRisk: '편하다는 이유로 말의 선을 넘을 수 있습니다',
    firstAction: '고마웠던 점 1개와 서운했던 점 1개를 분리해 생각해 보기',
    relationHint:
      '좋은 친구 궁합은 비슷함보다 다름을 다루는 태도에서 갈립니다.',
    workMoneyHint:
      '친구와 돈/일이 섞일 때는 관계와 계약을 분리해서 보는 것이 안전합니다.',
    timingHint: '서운함은 오래 묵히지 말고 짧게, 구체적으로 전달하세요.',
    reflectionQuestion: '이 관계에서 나는 편안함과 예의를 함께 지키고 있나요?'
  },
  COWORKER: {
    focus: '직장 동료 궁합의 협업 효율',
    storyline: '업무 궁합은 친밀감보다 기준 정렬이 맞을 때 가장 강해집니다.',
    softRisk: '업무 방식 차이를 성격 문제로 해석할 수 있습니다',
    firstAction: '업무 기대치와 완료 기준을 먼저 문장으로 맞춰두기',
    relationHint: '일의 관계는 감정보다 기준 공유가 먼저입니다.',
    workMoneyHint: '협업 효율이 올라가면 성과와 평가도 같이 따라옵니다.',
    timingHint: '업무 조율은 일이 터진 뒤보다 시작 전에 합의할수록 유리합니다.',
    reflectionQuestion: '우리는 지금 같은 결과를 상상하고 일하고 있나요?'
  },
  MANAGER_MEMBER: {
    focus: '상사/부하 관계의 기대치 정렬',
    storyline:
      '직급 차이보다 기대치와 보고 방식의 합이 관계 만족도를 좌우합니다.',
    softRisk: '의도를 설명하지 않으면 통제/소극성으로 오해받기 쉽습니다',
    firstAction: '보고 방식과 피드백 방식을 1개만 명확히 합의하기',
    relationHint: '권한 차이가 있는 관계일수록 맥락 설명이 중요합니다.',
    workMoneyHint: '평가/성과는 결국 커뮤니케이션 리듬에서 갈립니다.',
    timingHint:
      '핵심 보고는 요약 먼저, 설명은 뒤에 붙이는 구조가 효과적입니다.',
    reflectionQuestion: '우리는 지금 서로에게 원하는 역할을 분명히 알고 있나요?'
  },
  BUSINESS_PARTNER: {
    focus: '동업 궁합의 역할과 책임',
    storyline:
      '좋은 동업은 친한 사이보다 역할과 책임을 분명히 나누는 관계입니다.',
    softRisk: '관계 신뢰만으로 약속을 넘기면 나중에 큰 부담이 생길 수 있습니다',
    firstAction: '권한, 수익 배분, 철수 조건 3가지를 문서로 정리하기',
    relationHint:
      '동업은 말보다 약속이 중요합니다. 정리된 기준이 관계를 지켜줍니다.',
    workMoneyHint: '수익보다 손실 통제 구조를 먼저 잡아야 오래 갑니다.',
    timingHint: '확장 결정은 분위기보다 수치 지표를 확인한 뒤 진행하세요.',
    reflectionQuestion: '우리는 잘될 때보다 흔들릴 때의 규칙을 정해 두었나요?'
  }
};
