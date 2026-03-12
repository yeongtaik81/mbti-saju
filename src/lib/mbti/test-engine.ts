export type MbtiTestType = 'MINI' | 'FULL';
export type MbtiQuestionOptionId = 'A' | 'B';
type MbtiDimension = 'EI' | 'SN' | 'TF' | 'JP';
type MbtiPole = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

export const MBTI_TYPE_VALUES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP'
] as const;

export type MbtiTypeValue = (typeof MBTI_TYPE_VALUES)[number];

type MbtiQuestionOption = {
  id: MbtiQuestionOptionId;
  text: string;
  pole: MbtiPole;
};

type MbtiQuestion = {
  id: string;
  dimension: MbtiDimension;
  prompt: string;
  options: [MbtiQuestionOption, MbtiQuestionOption];
};

export type PublicMbtiQuestion = {
  id: string;
  prompt: string;
  options: Array<{
    id: MbtiQuestionOptionId;
    text: string;
  }>;
};

export type MbtiTestAnswer = {
  questionId: string;
  optionId: MbtiQuestionOptionId;
};

const MINI_QUESTIONS: MbtiQuestion[] = [
  {
    id: 'mini-lite-ei-1',
    dimension: 'EI',
    prompt: '처음 만난 사람들과 있을 때 나는',
    options: [
      { id: 'A', text: '먼저 말을 걸고 분위기를 만든다.', pole: 'E' },
      { id: 'B', text: '분위기를 파악한 뒤 자연스럽게 대화한다.', pole: 'I' }
    ]
  },
  {
    id: 'mini-lite-ei-2',
    dimension: 'EI',
    prompt: '아이디어가 떠오르면 나는',
    options: [
      { id: 'A', text: '바로 공유해 반응을 보며 다듬는다.', pole: 'E' },
      { id: 'B', text: '혼자 정리한 뒤 완성도 있게 공유한다.', pole: 'I' }
    ]
  },
  {
    id: 'mini-lite-ei-3',
    dimension: 'EI',
    prompt: '휴식이 필요할 때 나는',
    options: [
      { id: 'A', text: '사람을 만나며 기분을 환기한다.', pole: 'E' },
      { id: 'B', text: '혼자만의 시간으로 에너지를 회복한다.', pole: 'I' }
    ]
  },
  {
    id: 'mini-lite-sn-1',
    dimension: 'SN',
    prompt: '새로운 일을 맡으면 먼저',
    options: [
      { id: 'A', text: '실행 가능한 단계와 리스크를 확인한다.', pole: 'S' },
      { id: 'B', text: '전체 방향과 장기 가능성을 그려본다.', pole: 'N' }
    ]
  },
  {
    id: 'mini-lite-sn-2',
    dimension: 'SN',
    prompt: '설명을 들을 때 더 집중되는 것은',
    options: [
      { id: 'A', text: '구체적 예시와 실제 절차', pole: 'S' },
      { id: 'B', text: '핵심 개념과 숨은 맥락', pole: 'N' }
    ]
  },
  {
    id: 'mini-lite-sn-3',
    dimension: 'SN',
    prompt: '반복되는 업무를 할 때 나는',
    options: [
      { id: 'A', text: '정확도를 높이며 안정적으로 처리한다.', pole: 'S' },
      { id: 'B', text: '더 나은 방식이 있는지 개선점을 찾는다.', pole: 'N' }
    ]
  },
  {
    id: 'mini-lite-tf-1',
    dimension: 'TF',
    prompt: '중요한 결정을 내릴 때 나는',
    options: [
      { id: 'A', text: '기준의 일관성과 논리적 타당성을 우선한다.', pole: 'T' },
      { id: 'B', text: '사람과 관계에 미칠 영향을 우선한다.', pole: 'F' }
    ]
  },
  {
    id: 'mini-lite-tf-2',
    dimension: 'TF',
    prompt: '피드백을 줄 때 나는',
    options: [
      { id: 'A', text: '핵심 개선점을 명확하게 전달한다.', pole: 'T' },
      { id: 'B', text: '상대가 받아들이기 쉽도록 표현을 조절한다.', pole: 'F' }
    ]
  },
  {
    id: 'mini-lite-tf-3',
    dimension: 'TF',
    prompt: '갈등 상황에서 더 중요한 것은',
    options: [
      { id: 'A', text: '사실 정리와 해결 방안 도출', pole: 'T' },
      { id: 'B', text: '감정 정리와 관계 회복', pole: 'F' }
    ]
  },
  {
    id: 'mini-lite-jp-1',
    dimension: 'JP',
    prompt: '일정 관리를 할 때 나는',
    options: [
      { id: 'A', text: '계획을 세워 체크하며 진행한다.', pole: 'J' },
      { id: 'B', text: '상황 변화에 맞춰 유연하게 조정한다.', pole: 'P' }
    ]
  },
  {
    id: 'mini-lite-jp-2',
    dimension: 'JP',
    prompt: '마감이 있는 과제는',
    options: [
      { id: 'A', text: '초반부터 나눠서 처리한다.', pole: 'J' },
      { id: 'B', text: '막판 집중으로 처리하는 편이다.', pole: 'P' }
    ]
  },
  {
    id: 'mini-lite-jp-3',
    dimension: 'JP',
    prompt: '주말 계획을 세울 때 나는',
    options: [
      { id: 'A', text: '일정을 미리 확정해 두는 편이다.', pole: 'J' },
      { id: 'B', text: '큰 틀만 정하고 그때그때 정한다.', pole: 'P' }
    ]
  }
];

const FULL_BASE_QUESTIONS: MbtiQuestion[] = [
  {
    id: 'full-ei-1',
    dimension: 'EI',
    prompt: '새로운 모임에서 나는 보통',
    options: [
      { id: 'A', text: '먼저 말을 걸며 분위기를 연다.', pole: 'E' },
      { id: 'B', text: '상황을 지켜본 뒤 필요한 대화를 한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-2',
    dimension: 'EI',
    prompt: '긴 하루를 보낸 뒤 회복 방식은',
    options: [
      { id: 'A', text: '사람들과 대화하며 에너지를 얻는다.', pole: 'E' },
      { id: 'B', text: '혼자 쉬면서 에너지를 충전한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-3',
    dimension: 'EI',
    prompt: '의견을 정리할 때 나는',
    options: [
      { id: 'A', text: '말하면서 생각을 정리한다.', pole: 'E' },
      { id: 'B', text: '생각을 정리한 후 말한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-sn-1',
    dimension: 'SN',
    prompt: '새 프로젝트를 시작하면 먼저',
    options: [
      { id: 'A', text: '현실적인 일정과 자원을 확인한다.', pole: 'S' },
      { id: 'B', text: '전체 방향과 가능성을 상상한다.', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-2',
    dimension: 'SN',
    prompt: '설명을 들을 때 더 집중되는 것은',
    options: [
      { id: 'A', text: '구체적 예시와 실제 절차', pole: 'S' },
      { id: 'B', text: '핵심 개념과 숨은 의미', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-3',
    dimension: 'SN',
    prompt: '문제를 보면 나는',
    options: [
      { id: 'A', text: '검증된 방법부터 적용한다.', pole: 'S' },
      { id: 'B', text: '새로운 접근을 먼저 떠올린다.', pole: 'N' }
    ]
  },
  {
    id: 'full-tf-1',
    dimension: 'TF',
    prompt: '중요한 결정을 내릴 때 나는',
    options: [
      { id: 'A', text: '논리와 기준의 일관성을 우선한다.', pole: 'T' },
      { id: 'B', text: '사람과 관계에 미칠 영향을 우선한다.', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-2',
    dimension: 'TF',
    prompt: '피드백을 줄 때 나는',
    options: [
      { id: 'A', text: '직접적으로 개선점을 말한다.', pole: 'T' },
      { id: 'B', text: '상대 감정을 고려해 표현을 조절한다.', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-3',
    dimension: 'TF',
    prompt: '갈등 상황에서 더 중요한 것은',
    options: [
      { id: 'A', text: '합리적인 기준과 사실 정리', pole: 'T' },
      { id: 'B', text: '감정 정리와 관계 회복', pole: 'F' }
    ]
  },
  {
    id: 'full-jp-1',
    dimension: 'JP',
    prompt: '일정을 운영할 때 나는',
    options: [
      { id: 'A', text: '미리 계획하고 계획대로 진행한다.', pole: 'J' },
      { id: 'B', text: '상황에 맞춰 유연하게 조정한다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-2',
    dimension: 'JP',
    prompt: '마감이 있는 과제는',
    options: [
      { id: 'A', text: '초반부터 나눠서 처리한다.', pole: 'J' },
      { id: 'B', text: '막판 집중으로 처리하는 편이다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-3',
    dimension: 'JP',
    prompt: '여행 계획에서 나는',
    options: [
      { id: 'A', text: '동선과 예약을 미리 확정한다.', pole: 'J' },
      { id: 'B', text: '큰 틀만 정하고 현지에서 정한다.', pole: 'P' }
    ]
  }
];

const FULL_QUESTIONS: MbtiQuestion[] = [
  ...FULL_BASE_QUESTIONS,
  {
    id: 'full-ei-4',
    dimension: 'EI',
    prompt: '협업 중 아이디어가 떠오르면',
    options: [
      { id: 'A', text: '바로 공유해 반응을 본다.', pole: 'E' },
      { id: 'B', text: '조금 더 다듬어 공유한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-5',
    dimension: 'EI',
    prompt: '주말 약속이 연달아 잡히면',
    options: [
      { id: 'A', text: '즐겁고 에너지가 난다.', pole: 'E' },
      { id: 'B', text: '중간에 혼자만의 시간이 필요하다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-6',
    dimension: 'EI',
    prompt: '회의에서 나는 주로',
    options: [
      { id: 'A', text: '말을 주도하며 참여한다.', pole: 'E' },
      { id: 'B', text: '핵심 순간에 집중해서 발언한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-sn-4',
    dimension: 'SN',
    prompt: '업무 보고를 준비할 때',
    options: [
      { id: 'A', text: '현황 수치와 근거를 먼저 정리한다.', pole: 'S' },
      { id: 'B', text: '인사이트와 개선 방향을 먼저 정리한다.', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-5',
    dimension: 'SN',
    prompt: '학습할 때 더 선호하는 방식은',
    options: [
      { id: 'A', text: '단계별 실습과 반복', pole: 'S' },
      { id: 'B', text: '원리 이해 후 응용', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-6',
    dimension: 'SN',
    prompt: '상대의 말을 들을 때',
    options: [
      { id: 'A', text: '말 그대로의 사실에 집중한다.', pole: 'S' },
      { id: 'B', text: '의도와 맥락을 읽으려 한다.', pole: 'N' }
    ]
  },
  {
    id: 'full-tf-4',
    dimension: 'TF',
    prompt: '팀 내 기준을 정할 때',
    options: [
      { id: 'A', text: '누구에게나 동일한 기준을 둔다.', pole: 'T' },
      { id: 'B', text: '개인 상황을 반영해 조정한다.', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-5',
    dimension: 'TF',
    prompt: '동료가 실수했을 때 나는',
    options: [
      { id: 'A', text: '재발 방지 프로세스를 먼저 정리한다.', pole: 'T' },
      { id: 'B', text: '상대 상태를 먼저 살피고 말한다.', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-6',
    dimension: 'TF',
    prompt: '갈등 조율 시 더 신경 쓰는 것은',
    options: [
      { id: 'A', text: '객관적 합의점 도출', pole: 'T' },
      { id: 'B', text: '서로의 감정 소화', pole: 'F' }
    ]
  },
  {
    id: 'full-jp-4',
    dimension: 'JP',
    prompt: '업무 도구를 사용할 때',
    options: [
      { id: 'A', text: '정해진 체계로 분류하고 관리한다.', pole: 'J' },
      { id: 'B', text: '필요할 때마다 유연하게 정리한다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-5',
    dimension: 'JP',
    prompt: '예상치 못한 변경 요청이 오면',
    options: [
      { id: 'A', text: '우선순위를 다시 정해 계획을 재배치한다.', pole: 'J' },
      { id: 'B', text: '즉시 대응하면서 흐름에 맞춘다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-6',
    dimension: 'JP',
    prompt: '할 일 목록은',
    options: [
      { id: 'A', text: '완료 체크가 분명할 때 마음이 편하다.', pole: 'J' },
      { id: 'B', text: '리스트보다 상황 흐름이 더 중요하다.', pole: 'P' }
    ]
  },
  {
    id: 'full-ei-7',
    dimension: 'EI',
    prompt: '낯선 환경에 도착했을 때 나는',
    options: [
      {
        id: 'A',
        text: '주변 사람과 먼저 소통하며 분위기를 익힌다.',
        pole: 'E'
      },
      { id: 'B', text: '혼자 상황을 파악한 뒤 필요한 대화를 한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-8',
    dimension: 'EI',
    prompt: '생각을 정리할 시간이 필요할 때',
    options: [
      { id: 'A', text: '대화하며 아이디어를 확장한다.', pole: 'E' },
      { id: 'B', text: '혼자 집중해 구조를 만든다.', pole: 'I' }
    ]
  },
  {
    id: 'full-ei-9',
    dimension: 'EI',
    prompt: '행사나 모임이 끝난 후 나는',
    options: [
      { id: 'A', text: '여운이 남아 더 이야기하고 싶다.', pole: 'E' },
      { id: 'B', text: '조용히 쉬면서 에너지를 회복한다.', pole: 'I' }
    ]
  },
  {
    id: 'full-sn-7',
    dimension: 'SN',
    prompt: '새로운 제안을 검토할 때 먼저 보는 것은',
    options: [
      { id: 'A', text: '실행 가능한 단계와 리스크', pole: 'S' },
      { id: 'B', text: '장기적 가능성과 확장성', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-8',
    dimension: 'SN',
    prompt: '설명서를 읽을 때 나는',
    options: [
      { id: 'A', text: '순서와 세부 조건을 꼼꼼히 확인한다.', pole: 'S' },
      { id: 'B', text: '핵심 원리를 파악하고 큰 흐름을 잡는다.', pole: 'N' }
    ]
  },
  {
    id: 'full-sn-9',
    dimension: 'SN',
    prompt: '같은 일을 반복하면 나는',
    options: [
      { id: 'A', text: '정확도를 높이며 안정적으로 수행한다.', pole: 'S' },
      { id: 'B', text: '새로운 방식으로 개선점을 찾는다.', pole: 'N' }
    ]
  },
  {
    id: 'full-tf-7',
    dimension: 'TF',
    prompt: '의사결정 회의에서 더 신뢰하는 기준은',
    options: [
      { id: 'A', text: '데이터와 논리적 타당성', pole: 'T' },
      { id: 'B', text: '구성원 공감과 팀 분위기', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-8',
    dimension: 'TF',
    prompt: '누군가 도움을 요청하면 나는',
    options: [
      { id: 'A', text: '문제 해결 방법을 먼저 제시한다.', pole: 'T' },
      { id: 'B', text: '마음을 먼저 공감하고 접근한다.', pole: 'F' }
    ]
  },
  {
    id: 'full-tf-9',
    dimension: 'TF',
    prompt: '평가 피드백을 받을 때 더 만족스러운 것은',
    options: [
      { id: 'A', text: '명확한 기준과 개선 포인트', pole: 'T' },
      { id: 'B', text: '노력과 맥락을 이해해 주는 표현', pole: 'F' }
    ]
  },
  {
    id: 'full-jp-7',
    dimension: 'JP',
    prompt: '장기 프로젝트를 진행할 때 나는',
    options: [
      { id: 'A', text: '중간 마일스톤을 미리 정해 관리한다.', pole: 'J' },
      { id: 'B', text: '상황 변화에 맞춰 방향을 유연하게 조정한다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-8',
    dimension: 'JP',
    prompt: '여유 시간이 생기면 나는',
    options: [
      { id: 'A', text: '미뤄둔 일을 정리해 두는 편이다.', pole: 'J' },
      { id: 'B', text: '그때 하고 싶은 일을 따라 움직인다.', pole: 'P' }
    ]
  },
  {
    id: 'full-jp-9',
    dimension: 'JP',
    prompt: '일정이 바뀌는 상황에서 나는',
    options: [
      { id: 'A', text: '새 계획을 빠르게 세워 안정감을 찾는다.', pole: 'J' },
      { id: 'B', text: '흐름을 타며 즉흥적으로 대응한다.', pole: 'P' }
    ]
  }
];

const QUESTIONS_BY_TYPE: Record<MbtiTestType, MbtiQuestion[]> = {
  MINI: MINI_QUESTIONS,
  FULL: FULL_QUESTIONS
};

const TIE_BREAKER: Record<MbtiDimension, MbtiPole> = {
  EI: 'I',
  SN: 'N',
  TF: 'F',
  JP: 'J'
};

const DIMENSION_POLES: Record<MbtiDimension, [MbtiPole, MbtiPole]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P']
};

function getQuestionsByType(type: MbtiTestType): MbtiQuestion[] {
  return QUESTIONS_BY_TYPE[type];
}

export function getPublicMbtiQuestions(
  type: MbtiTestType
): PublicMbtiQuestion[] {
  return getQuestionsByType(type).map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text
    }))
  }));
}

export function evaluateMbtiTest(
  type: MbtiTestType,
  answers: MbtiTestAnswer[]
): {
  mbtiType: MbtiTypeValue;
  totalQuestions: number;
  answeredQuestions: number;
  poleScore: Record<MbtiPole, number>;
} {
  const questions = getQuestionsByType(type);
  const questionMap = new Map(
    questions.map((question) => [question.id, question])
  );
  const answeredQuestionIdSet = new Set<string>();

  if (answers.length !== questions.length) {
    throw new Error('모든 문항에 답변해 주세요.');
  }

  const poleScore: Record<MbtiPole, number> = {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0
  };

  for (const answer of answers) {
    if (answeredQuestionIdSet.has(answer.questionId)) {
      throw new Error('중복 답변이 있습니다.');
    }
    answeredQuestionIdSet.add(answer.questionId);

    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new Error('유효하지 않은 문항이 포함되어 있습니다.');
    }

    const selectedOption = question.options.find(
      (option) => option.id === answer.optionId
    );
    if (!selectedOption) {
      throw new Error('유효하지 않은 답변이 포함되어 있습니다.');
    }

    poleScore[selectedOption.pole] += 1;
  }

  const dimensions: MbtiDimension[] = ['EI', 'SN', 'TF', 'JP'];
  const letters = dimensions.map((dimension) => {
    const [leftPole, rightPole] = DIMENSION_POLES[dimension];
    const leftScore = poleScore[leftPole];
    const rightScore = poleScore[rightPole];

    if (leftScore > rightScore) {
      return leftPole;
    }
    if (rightScore > leftScore) {
      return rightPole;
    }
    return TIE_BREAKER[dimension];
  });

  return {
    mbtiType: letters.join('') as MbtiTypeValue,
    totalQuestions: questions.length,
    answeredQuestions: answers.length,
    poleScore
  };
}
