import {
  COMPATIBILITY_RELATION_LABEL,
  type CompatibilityRelationType,
  SELF_SUBJECT_LABEL,
  type SelfSubjectType
} from '@/lib/saju/constants';

export type ReadingMode = 'SELF' | 'COMPATIBILITY';

export type ScenarioCategoryCode =
  | 'SELF_TIMING'
  | 'SELF_LOVE'
  | 'SELF_CAREER'
  | 'SELF_WEALTH'
  | 'SELF_RELATIONSHIP'
  | 'COMPAT_ROMANCE'
  | 'COMPAT_FRIEND'
  | 'COMPAT_WORK'
  | 'COMPAT_FAMILY'
  | 'COMPAT_MISC';

export type ScenarioCode =
  | 'SELF_BASIC'
  | 'SELF_LIFETIME_FLOW'
  | 'SELF_DAEUN'
  | 'SELF_YEARLY_FORTUNE'
  | 'SELF_DAILY_FORTUNE'
  | 'SELF_LUCK_UP'
  | 'SELF_LOVE_GENERAL'
  | 'SELF_LOVE_RECONCILIATION'
  | 'SELF_LOVE_CONTACT_RETURN'
  | 'SELF_LOVE_CONFESSION_TIMING'
  | 'SELF_MARRIAGE_GENERAL'
  | 'SELF_CAREER_GENERAL'
  | 'SELF_CAREER_APTITUDE'
  | 'SELF_CAREER_JOB_CHANGE'
  | 'SELF_WEALTH_GENERAL'
  | 'SELF_WEALTH_ACCUMULATION'
  | 'SELF_WEALTH_LEAK'
  | 'SELF_RELATIONSHIP_GENERAL'
  | 'SELF_RELATIONSHIP_CUT_OFF'
  | 'SELF_FAMILY_GENERAL'
  | 'SELF_FAMILY_PARENTS'
  | 'COMPAT_ROMANCE_FLIRTING'
  | 'COMPAT_ROMANCE_EX'
  | 'COMPAT_ROMANCE_CRUSH'
  | 'COMPAT_ROMANCE_BLIND_DATE'
  | 'COMPAT_ROMANCE_FRIEND_TO_LOVER'
  | 'COMPAT_ROMANCE_GHOSTED'
  | 'COMPAT_ROMANCE_LEFT_ON_READ'
  | 'COMPAT_FRIEND_BEST'
  | 'COMPAT_FRIEND_CUT_OFF'
  | 'COMPAT_FRIEND_TRAVEL'
  | 'COMPAT_FRIEND_ROOMMATE'
  | 'COMPAT_WORK_COWORKER'
  | 'COMPAT_WORK_BOSS'
  | 'COMPAT_WORK_DIFFICULT_BOSS'
  | 'COMPAT_WORK_BUSINESS_PARTNER'
  | 'COMPAT_WORK_WORK_DUMPER'
  | 'COMPAT_FAMILY_MOTHER_DAUGHTER'
  | 'COMPAT_FAMILY_PARENT_CHILD'
  | 'COMPAT_FAMILY_MOTHER_IN_LAW'
  | 'COMPAT_MISC_IDOL';

export type ScenarioOption = {
  code: ScenarioCode;
  mode: ReadingMode;
  categoryCode: ScenarioCategoryCode;
  categoryLabel: string;
  label: string;
  description: string;
  legacySubjectType: SelfSubjectType | CompatibilityRelationType;
};

export type ScenarioLoadingTheme =
  | 'timing'
  | 'love'
  | 'career'
  | 'wealth'
  | 'relationship'
  | 'friend'
  | 'work'
  | 'family'
  | 'idol';

export type ScenarioLoadingIcon =
  | 'sparkles'
  | 'calendar'
  | 'heart'
  | 'clock'
  | 'heartCrack'
  | 'message'
  | 'send'
  | 'briefcase'
  | 'banknote'
  | 'users'
  | 'house'
  | 'star'
  | 'handshake';

export type ScenarioLoadingMotion =
  | 'gentle'
  | 'pulse'
  | 'drift'
  | 'focus'
  | 'sparkle';

export type ScenarioLoadingIllustration =
  | 'romance-flirting'
  | 'romance-ex'
  | 'romance-crush'
  | 'romance-blind-date'
  | 'romance-friends-to-lovers'
  | 'romance-ghosted'
  | 'romance-left-on-read';

export type ScenarioLoadingMeta = {
  theme: ScenarioLoadingTheme;
  icon: ScenarioLoadingIcon;
  motion: ScenarioLoadingMotion;
  illustration?: ScenarioLoadingIllustration;
  title: string;
  messages: string[];
};

const SCENARIO_CATEGORY_DESCRIPTION: Record<ScenarioCategoryCode, string> = {
  SELF_TIMING: '타고난 사주와 지금 들어온 운을 먼저 봅니다.',
  SELF_LOVE: '마음의 방향과 다시 이어질 여지를 봅니다.',
  SELF_CAREER: '일이 붙는 자리와 움직일 때를 봅니다.',
  SELF_WEALTH: '돈이 붙는 길과 새는 틈을 봅니다.',
  SELF_RELATIONSHIP: '덜 지치고 오래 가는 거리를 봅니다.',
  COMPAT_ROMANCE: '끌림의 온도와 이어지는 속도를 봅니다.',
  COMPAT_FRIEND: '편안함과 거리감의 균형을 봅니다.',
  COMPAT_WORK: '함께 일할 때 맞는 기준과 어긋나는 지점을 봅니다.',
  COMPAT_FAMILY: '가까울수록 생기는 기대와 거리를 봅니다.',
  COMPAT_MISC: '왜 강하게 끌리는지와 무엇을 닮고 싶은지 봅니다.'
};

const SCENARIO_CATEGORY_LOADING_META: Record<
  ScenarioCategoryCode,
  ScenarioLoadingMeta
> = {
  SELF_TIMING: {
    theme: 'timing',
    icon: 'sparkles',
    motion: 'drift',
    title: '사주를 세우고 지금의 운을 읽고 있어요.',
    messages: [
      '타고난 사주와 지금 들어온 운을 함께 보고 있어요.',
      '오행의 결을 천천히 맞춰 보고 있어요.',
      '당신에게 맞는 말로 차분히 풀어내고 있어요.',
      '지금 밀어도 되는 방향과 아껴야 할 힘을 함께 보고 있어요.'
    ]
  },
  SELF_LOVE: {
    theme: 'love',
    icon: 'heart',
    motion: 'pulse',
    title: '마음의 방향과 연애 흐름을 함께 보고 있어요.',
    messages: [
      '지금 마음이 어디로 기울고 있는지 살피고 있어요.',
      '감정의 속도와 표현 타이밍을 같이 읽고 있어요.',
      '지금 관계에서 놓치기 쉬운 결을 보고 있어요.',
      '서두르지 않아도 흐름이 붙는 지점을 함께 보고 있어요.'
    ]
  },
  SELF_CAREER: {
    theme: 'career',
    icon: 'briefcase',
    motion: 'focus',
    title: '일에서 힘이 붙는 방향을 찾고 있어요.',
    messages: [
      '잘하는 방식이 어디에서 오래 가는지 보고 있어요.',
      '지금 움직여야 할지, 더 다져야 할지 함께 보고 있어요.',
      '당신의 강점이 결과로 이어지는 흐름을 읽고 있어요.',
      '무리해서 버티는 자리보다 힘이 붙는 자리를 먼저 가려 보고 있어요.'
    ]
  },
  SELF_WEALTH: {
    theme: 'wealth',
    icon: 'banknote',
    motion: 'gentle',
    title: '돈의 흐름을 차분히 읽고 있어요.',
    messages: [
      '돈이 붙는 길과 새는 길을 함께 보고 있어요.',
      '지금 돈을 지키는 기준을 살피고 있어요.',
      '작은 습관이 돈의 흐름을 어떻게 바꾸는지 보고 있어요.',
      '숫자보다 먼저 돈의 결이 어디서 달라지는지 살피고 있어요.'
    ]
  },
  SELF_RELATIONSHIP: {
    theme: 'relationship',
    icon: 'users',
    motion: 'gentle',
    title: '사람 사이의 거리와 온도를 살피고 있어요.',
    messages: [
      '덜 지치고 오래 가는 관계의 결을 보고 있어요.',
      '마음이 무거워지는 지점을 천천히 읽고 있어요.',
      '지금 필요한 거리와 말의 순서를 정리하고 있어요.',
      '관계를 지키는 힘과 쉬어야 할 지점을 함께 가려 보고 있어요.'
    ]
  },
  COMPAT_ROMANCE: {
    theme: 'love',
    icon: 'message',
    motion: 'pulse',
    title: '두 사람의 흐름을 겹쳐 보며 궁합을 풀이하고 있어요.',
    messages: [
      '서로 잘 맞는 점과 어긋나는 지점을 살펴보고 있어요.',
      '관계의 온도와 흐름을 차분히 맞춰 보고 있어요.',
      '두 사람 사이에 남은 여지와 속도를 함께 읽고 있어요.',
      '같은 마음도 다르게 들리는 순간을 함께 가려 보고 있어요.'
    ]
  },
  COMPAT_FRIEND: {
    theme: 'friend',
    icon: 'users',
    motion: 'gentle',
    title: '편안함과 거리감 사이의 균형을 보고 있어요.',
    messages: [
      '이 관계가 오래 가는 합인지 차분히 보고 있어요.',
      '가까워질수록 어긋나는 지점을 함께 살피고 있어요.',
      '둘 사이에 자연스럽게 맞는 거리감을 읽고 있어요.',
      '편안함이 오래 가려면 무엇이 필요한지 함께 보고 있어요.'
    ]
  },
  COMPAT_WORK: {
    theme: 'work',
    icon: 'briefcase',
    motion: 'focus',
    title: '함께 일할 때의 호흡과 기준을 보고 있어요.',
    messages: [
      '어디에서 잘 맞고 어디에서 부딪히는지 살피고 있어요.',
      '일의 속도와 보고 방식이 맞는지 함께 보고 있어요.',
      '같이 일할 때 덜 소모되는 결을 읽고 있어요.',
      '같이 가도 되는 판인지 먼저 선을 그어 보고 있어요.'
    ]
  },
  COMPAT_FAMILY: {
    theme: 'family',
    icon: 'house',
    motion: 'drift',
    title: '가까운 사이일수록 생기는 기대와 거리를 보고 있어요.',
    messages: [
      '사랑과 걱정이 어떻게 다르게 들리는지 살피고 있어요.',
      '서로 덜 상처받는 말의 순서를 함께 보고 있어요.',
      '이 관계에 필요한 거리감을 차분히 읽고 있어요.',
      '가까워서 더 조심해야 할 결을 함께 가려 보고 있어요.'
    ]
  },
  COMPAT_MISC: {
    theme: 'idol',
    icon: 'star',
    motion: 'sparkle',
    title: '왜 강하게 끌리는지와 닮고 싶은 결을 보고 있어요.',
    messages: [
      '이 사람이 주는 에너지가 어디에 닿는지 보고 있어요.',
      '정서적으로 어떤 결이 맞물리는지 살피고 있어요.',
      '왜 이 관계가 오래 마음에 남는지 읽고 있어요.',
      '닮고 싶은 힘이 지금 내 삶 어디를 건드리는지 함께 보고 있어요.'
    ]
  }
};

const SCENARIO_LOADING_OVERRIDES: Partial<
  Record<ScenarioCode, Partial<ScenarioLoadingMeta>>
> = {
  SELF_YEARLY_FORTUNE: {
    icon: 'calendar',
    motion: 'drift',
    title: '올해 들어온 운을 한 장씩 넘겨 보고 있어요.',
    messages: [
      '올해 밀어도 되는 영역과 아껴야 할 힘을 함께 보고 있어요.',
      '계절이 바뀌듯 분위기가 달라지는 시점을 읽고 있어요.',
      '올해의 흐름을 당신의 생활 리듬에 맞춰 풀고 있어요.',
      '올해 어떤 장면에서 힘이 붙는지 더 가까이 보고 있어요.'
    ]
  },
  SELF_DAILY_FORTUNE: {
    icon: 'calendar',
    motion: 'drift',
    title: '오늘의 리듬을 가볍게 짚어보고 있어요.',
    messages: [
      '지금 힘을 써도 되는 시간대를 읽고 있어요.',
      '오늘은 어디에 힘을 아껴야 하는지 보고 있어요.',
      '하루가 덜 꼬이게 움직일 포인트를 살피고 있어요.'
    ]
  },
  SELF_WEALTH_GENERAL: {
    icon: 'banknote',
    motion: 'gentle',
    title: '돈이 붙는 길과 새는 길을 함께 보고 있어요.',
    messages: [
      '돈을 많이 버는 문제보다 오래 남기는 흐름을 읽고 있어요.',
      '지금 지켜야 할 기준이 무엇인지 살피고 있어요.',
      '돈이 편안하게 굴러가는 습관을 함께 보고 있어요.',
      '작게 굴려도 단단해지는 길이 무엇인지 함께 살피고 있어요.'
    ]
  },
  SELF_CAREER_GENERAL: {
    icon: 'briefcase',
    motion: 'focus',
    title: '일에서 내 힘이 가장 잘 살아나는 자리를 보고 있어요.',
    messages: [
      '지금 자리에서 밀어야 할 강점을 먼저 살피고 있어요.',
      '오래 가는 방식과 빨리 지치는 방식을 함께 보고 있어요.',
      '당신의 성향에 맞는 일의 리듬을 정리하고 있어요.',
      '억지로 버티는 자리와 힘이 붙는 자리를 함께 가려 보고 있어요.'
    ]
  },
  SELF_CAREER_JOB_CHANGE: {
    icon: 'briefcase',
    motion: 'focus',
    title: '다음 자리로 옮겨도 되는 시점인지 보고 있어요.',
    messages: [
      '떠나는 이유와 원하는 조건을 분리해서 살피고 있어요.',
      '지금은 옮길 때인지, 먼저 다질 때인지 보고 있어요.',
      '다음 자리에서 더 잘 맞을 결을 찾아보고 있어요.'
    ]
  },
  SELF_LOVE_RECONCILIATION: {
    icon: 'heart',
    motion: 'pulse',
    title: '다시 이어질 수 있는 마음의 여지를 살피고 있어요.',
    messages: [
      '감정보다 반복되던 패턴이 달라질 수 있는지 보고 있어요.',
      '다시 만나도 덜 아프게 이어질 수 있는지 살피고 있어요.',
      '붙잡아야 할 마음과 놓아야 할 미련을 함께 보고 있어요.',
      '그리움과 다시 만날 준비가 같은 마음인지도 함께 살피고 있어요.'
    ]
  },
  SELF_LOVE_CONTACT_RETURN: {
    icon: 'clock',
    motion: 'drift',
    title: '다시 연락이 닿을 흐름이 남아 있는지 보고 있어요.',
    messages: [
      '기다림이 맞는지, 먼저 움직일 때인지 함께 보고 있어요.',
      '연락이 와도 흔들리지 않을 중심을 먼저 살피고 있어요.',
      '답보다 관계의 흐름을 먼저 읽고 있어요.',
      '먼저 움직여도 되는 숨구멍이 남아 있는지 함께 보고 있어요.'
    ]
  },
  SELF_LOVE_CONFESSION_TIMING: {
    icon: 'send',
    motion: 'pulse',
    title: '마음을 꺼내기 좋은 타이밍을 살피고 있어요.',
    messages: [
      '지금은 마음을 보일 때인지 더 지켜볼 때인지 보고 있어요.',
      '고백보다 관계의 온도가 먼저 맞는지 살피고 있어요.',
      '말의 순서와 타이밍을 함께 읽고 있어요.',
      '관계가 한 걸음 넘어갈 준비가 되었는지 함께 보고 있어요.'
    ]
  },
  COMPAT_ROMANCE_LEFT_ON_READ: {
    icon: 'clock',
    motion: 'drift',
    illustration: 'romance-left-on-read',
    title: '답이 늦어진 관계의 흐름을 읽고 있어요.',
    messages: [
      '말보다 침묵이 길어진 이유를 보고 있어요.',
      '다시 말이 이어질 여지가 있는지 살피고 있어요.',
      '답장 속도보다 관계의 온도를 먼저 읽고 있어요.',
      '조급함보다 흐름을 다시 여는 틈을 함께 찾고 있어요.'
    ]
  },
  COMPAT_ROMANCE_GHOSTED: {
    icon: 'heartCrack',
    motion: 'drift',
    illustration: 'romance-ghosted',
    title: '끊긴 듯한 관계의 실마리를 살피고 있어요.',
    messages: [
      '흐름이 왜 멈췄는지 차분히 보고 있어요.',
      '다시 이어지려면 무엇이 달라져야 하는지 살피고 있어요.',
      '기대와 부담이 어디서 엇갈렸는지 읽고 있어요.',
      '놓아야 할 기대와 붙잡을 수 있는 실마리를 함께 가려 보고 있어요.'
    ]
  },
  COMPAT_WORK_BOSS: {
    icon: 'briefcase',
    motion: 'focus',
    title: '상사와 맞는 보고 리듬을 읽고 있어요.',
    messages: [
      '언제 중간 공유를 해야 덜 꼬이는지 보고 있어요.',
      '일의 기준을 맞추는 말의 순서를 살피고 있어요.',
      '위아래 역할이 편안하게 맞물리는 포인트를 읽고 있어요.',
      '상대가 안심하는 보고 방식이 무엇인지 함께 보고 있어요.'
    ]
  },
  COMPAT_WORK_DIFFICULT_BOSS: {
    icon: 'briefcase',
    motion: 'focus',
    title: '까다로운 상사와 덜 부딪히는 흐름을 보고 있어요.',
    messages: [
      '상대의 기준과 내 속도가 어디서 엇갈리는지 보고 있어요.',
      '감정보다 일의 기준을 먼저 맞추는 포인트를 살피고 있어요.',
      '같이 일할 때 덜 소모되는 거리감을 읽고 있어요.'
    ]
  },
  COMPAT_WORK_BUSINESS_PARTNER: {
    icon: 'handshake',
    motion: 'focus',
    title: '같이 벌고 같이 책임질 때의 결을 보고 있어요.',
    messages: [
      '누가 앞서고 누가 받쳐야 오래 가는지 살피고 있어요.',
      '역할과 책임이 섞일 때 어디서 꼬이는지 보고 있어요.',
      '함께 갈 수 있는 속도와 경계를 차분히 읽고 있어요.',
      '같이 커질 판인지 여기서 선을 그어야 할지 함께 살피고 있어요.'
    ]
  },
  COMPAT_MISC_IDOL: {
    icon: 'star',
    motion: 'sparkle',
    title: '왜 이 사람에게 강하게 끌리는지 보고 있어요.',
    messages: [
      '닮고 싶은 결이 어디에 닿는지 살피고 있어요.',
      '이 사람이 주는 에너지가 내 마음 어디를 움직이는지 보고 있어요.',
      '팬심이 오래 가는 이유를 차분히 읽고 있어요.',
      '닮고 싶은 힘이 지금 내 삶 어디와 닿는지도 함께 보고 있어요.'
    ]
  },
  COMPAT_ROMANCE_FLIRTING: {
    illustration: 'romance-flirting'
  },
  COMPAT_ROMANCE_EX: {
    illustration: 'romance-ex'
  },
  COMPAT_ROMANCE_CRUSH: {
    illustration: 'romance-crush'
  },
  COMPAT_ROMANCE_BLIND_DATE: {
    illustration: 'romance-blind-date'
  },
  COMPAT_ROMANCE_FRIEND_TO_LOVER: {
    illustration: 'romance-friends-to-lovers'
  }
};

const SCENARIO_OPTIONS: readonly ScenarioOption[] = [
  {
    code: 'SELF_BASIC',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '기본 해석',
    description: '타고난 사주와 지금 들어온 운의 방향을 함께 봅니다.',
    legacySubjectType: 'BASIC'
  },
  {
    code: 'SELF_LIFETIME_FLOW',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '평생 총운',
    description: '평생에 걸쳐 반복되는 큰 운의 결을 봅니다.',
    legacySubjectType: 'LIFETIME_FLOW'
  },
  {
    code: 'SELF_DAEUN',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '현재 대운',
    description: '지금 10년 운이 삶의 방향을 어떻게 바꾸는지 봅니다.',
    legacySubjectType: 'DAEUN'
  },
  {
    code: 'SELF_YEARLY_FORTUNE',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '올해 운',
    description: '올해 들어온 운이 어디를 밝히는지 봅니다.',
    legacySubjectType: 'YEAR_MONTH_DAY_FORTUNE'
  },
  {
    code: 'SELF_DAILY_FORTUNE',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '오늘 운',
    description: '오늘의 리듬과 힘을 써야 할 때를 봅니다.',
    legacySubjectType: 'YEAR_MONTH_DAY_FORTUNE'
  },
  {
    code: 'SELF_LUCK_UP',
    mode: 'SELF',
    categoryCode: 'SELF_TIMING',
    categoryLabel: '기본/시기',
    label: '개운법',
    description: '지금 운을 살리는 생활 기준과 태도를 봅니다.',
    legacySubjectType: 'LUCK_UP'
  },
  {
    code: 'SELF_LOVE_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_LOVE',
    categoryLabel: '연애',
    label: '내 연애운',
    description: '지금 내 마음이 어디로 흐르는지와 연애의 결을 봅니다.',
    legacySubjectType: 'ROMANCE'
  },
  {
    code: 'SELF_LOVE_RECONCILIATION',
    mode: 'SELF',
    categoryCode: 'SELF_LOVE',
    categoryLabel: '연애',
    label: '재회 가능성',
    description: '다시 이어질 수 있는 흐름과 달라져야 할 지점을 봅니다.',
    legacySubjectType: 'ROMANCE'
  },
  {
    code: 'SELF_LOVE_CONTACT_RETURN',
    mode: 'SELF',
    categoryCode: 'SELF_LOVE',
    categoryLabel: '연애',
    label: '다시 연락 올까',
    description: '연락이 다시 닿을 여지와 기다림의 방향을 봅니다.',
    legacySubjectType: 'ROMANCE'
  },
  {
    code: 'SELF_LOVE_CONFESSION_TIMING',
    mode: 'SELF',
    categoryCode: 'SELF_LOVE',
    categoryLabel: '연애',
    label: '고백 타이밍',
    description: '마음을 꺼내도 되는 타이밍과 관계의 온도를 봅니다.',
    legacySubjectType: 'ROMANCE'
  },
  {
    code: 'SELF_MARRIAGE_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_LOVE',
    categoryLabel: '연애',
    label: '결혼운/배우자운',
    description: '오래 편안한 관계와 배우자 흐름을 봅니다.',
    legacySubjectType: 'MARRIAGE'
  },
  {
    code: 'SELF_CAREER_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_CAREER',
    categoryLabel: '일/직업',
    label: '직업운',
    description: '지금 일에서 강점이 살아나는 방향을 봅니다.',
    legacySubjectType: 'CAREER'
  },
  {
    code: 'SELF_CAREER_APTITUDE',
    mode: 'SELF',
    categoryCode: 'SELF_CAREER',
    categoryLabel: '일/직업',
    label: '적성',
    description: '잘 맞는 일과 오래 가는 일 스타일을 봅니다.',
    legacySubjectType: 'CAREER'
  },
  {
    code: 'SELF_CAREER_JOB_CHANGE',
    mode: 'SELF',
    categoryCode: 'SELF_CAREER',
    categoryLabel: '일/직업',
    label: '이직 타이밍',
    description: '지금 옮길 때인지 더 다져야 할 때인지 봅니다.',
    legacySubjectType: 'CAREER'
  },
  {
    code: 'SELF_WEALTH_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_WEALTH',
    categoryLabel: '돈',
    label: '재물운',
    description: '돈이 들어오고 남는 흐름을 전체로 봅니다.',
    legacySubjectType: 'WEALTH'
  },
  {
    code: 'SELF_WEALTH_ACCUMULATION',
    mode: 'SELF',
    categoryCode: 'SELF_WEALTH',
    categoryLabel: '돈',
    label: '돈이 모이는 흐름',
    description: '돈이 붙고 오래 남는 방식을 봅니다.',
    legacySubjectType: 'WEALTH'
  },
  {
    code: 'SELF_WEALTH_LEAK',
    mode: 'SELF',
    categoryCode: 'SELF_WEALTH',
    categoryLabel: '돈',
    label: '돈이 새는 이유',
    description: '모르는 사이 빠져나가는 돈의 패턴을 봅니다.',
    legacySubjectType: 'WEALTH'
  },
  {
    code: 'SELF_RELATIONSHIP_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_RELATIONSHIP',
    categoryLabel: '인간관계/가족',
    label: '인간관계운',
    description: '사람과의 거리와 신뢰가 붙는 방식을 봅니다.',
    legacySubjectType: 'RELATIONSHIPS'
  },
  {
    code: 'SELF_RELATIONSHIP_CUT_OFF',
    mode: 'SELF',
    categoryCode: 'SELF_RELATIONSHIP',
    categoryLabel: '인간관계/가족',
    label: '손절 타이밍',
    description: '지금은 거리 조절이 필요한지, 정리가 필요한지 봅니다.',
    legacySubjectType: 'RELATIONSHIPS'
  },
  {
    code: 'SELF_FAMILY_GENERAL',
    mode: 'SELF',
    categoryCode: 'SELF_RELATIONSHIP',
    categoryLabel: '인간관계/가족',
    label: '가족운',
    description: '가족 안에서 내 역할과 감정의 흐름을 봅니다.',
    legacySubjectType: 'FAMILY'
  },
  {
    code: 'SELF_FAMILY_PARENTS',
    mode: 'SELF',
    categoryCode: 'SELF_RELATIONSHIP',
    categoryLabel: '인간관계/가족',
    label: '부모와의 관계',
    description: '부모와의 거리감과 말이 닿는 방식을 봅니다.',
    legacySubjectType: 'FAMILY'
  },
  {
    code: 'COMPAT_ROMANCE_FLIRTING',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '썸타는 사이',
    description: '감정의 온도와 관계가 붙는 속도를 봅니다.',
    legacySubjectType: 'CRUSH'
  },
  {
    code: 'COMPAT_ROMANCE_EX',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '전연인',
    description: '헤어진 뒤 남은 감정과 다시 붙는 패턴을 봅니다.',
    legacySubjectType: 'LOVER'
  },
  {
    code: 'COMPAT_ROMANCE_CRUSH',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '짝사랑 상대',
    description: '왜 끌리는지와 관계가 자라기 쉬운지를 봅니다.',
    legacySubjectType: 'CRUSH'
  },
  {
    code: 'COMPAT_ROMANCE_BLIND_DATE',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '소개팅 상대',
    description: '첫 만남 뒤 자연스럽게 이어질 합을 봅니다.',
    legacySubjectType: 'CRUSH'
  },
  {
    code: 'COMPAT_ROMANCE_FRIEND_TO_LOVER',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '친구에서 연인 가능성',
    description: '편안함이 애정으로 넘어갈 수 있는지 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_ROMANCE_GHOSTED',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '연락 끊긴 썸',
    description: '흐름이 왜 끊겼는지와 다시 이어질 포인트를 봅니다.',
    legacySubjectType: 'CRUSH'
  },
  {
    code: 'COMPAT_ROMANCE_LEFT_ON_READ',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_ROMANCE',
    categoryLabel: '연애/썸',
    label: '읽씹하는 그 사람',
    description: '답장 템포와 감정 거리의 패턴을 봅니다.',
    legacySubjectType: 'CRUSH'
  },
  {
    code: 'COMPAT_FRIEND_BEST',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FRIEND',
    categoryLabel: '친구/인간관계',
    label: '베스트 친구',
    description: '편안함과 오래 가는 합을 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_FRIEND_CUT_OFF',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FRIEND',
    categoryLabel: '친구/인간관계',
    label: '손절 고민하는 친구',
    description: '지켜야 할 관계인지 거리 둘 관계인지 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_FRIEND_TRAVEL',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FRIEND',
    categoryLabel: '친구/인간관계',
    label: '여행 메이트',
    description: '같이 움직일 때 편안한지와 충돌 포인트를 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_FRIEND_ROOMMATE',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FRIEND',
    categoryLabel: '친구/인간관계',
    label: '룸메이트',
    description: '생활 리듬과 공간 감각의 합을 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_WORK_COWORKER',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_WORK',
    categoryLabel: '직장/사회',
    label: '직장 동료',
    description: '함께 일할 때 맞는 호흡과 갈등 포인트를 봅니다.',
    legacySubjectType: 'COWORKER'
  },
  {
    code: 'COMPAT_WORK_BOSS',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_WORK',
    categoryLabel: '직장/사회',
    label: '상사와 궁합',
    description: '지시와 보고의 결이 잘 맞는지 봅니다.',
    legacySubjectType: 'MANAGER_MEMBER'
  },
  {
    code: 'COMPAT_WORK_DIFFICULT_BOSS',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_WORK',
    categoryLabel: '직장/사회',
    label: '까다로운 상사',
    description: '덜 부딪히고 오래 가는 일의 방식을 봅니다.',
    legacySubjectType: 'MANAGER_MEMBER'
  },
  {
    code: 'COMPAT_WORK_BUSINESS_PARTNER',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_WORK',
    categoryLabel: '직장/사회',
    label: '사업 파트너',
    description: '역할 분담과 책임의 경계가 잘 맞는지 봅니다.',
    legacySubjectType: 'BUSINESS_PARTNER'
  },
  {
    code: 'COMPAT_WORK_WORK_DUMPER',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_WORK',
    categoryLabel: '직장/사회',
    label: '일 떠넘기는 동료',
    description: '피로가 쌓이는 패턴과 경계 지점을 봅니다.',
    legacySubjectType: 'COWORKER'
  },
  {
    code: 'COMPAT_FAMILY_MOTHER_DAUGHTER',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FAMILY',
    categoryLabel: '가족',
    label: '엄마와 딸',
    description: '가까울수록 생기는 감정 패턴과 거리의 결을 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_FAMILY_PARENT_CHILD',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FAMILY',
    categoryLabel: '가족',
    label: '부모와 자식',
    description: '보호와 기대의 균형이 어떻게 맞는지 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_FAMILY_MOTHER_IN_LAW',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_FAMILY',
    categoryLabel: '가족',
    label: '시어머니와 며느리',
    description: '기대 역할과 거리 두기 방식을 봅니다.',
    legacySubjectType: 'FRIEND'
  },
  {
    code: 'COMPAT_MISC_IDOL',
    mode: 'COMPATIBILITY',
    categoryCode: 'COMPAT_MISC',
    categoryLabel: '아이돌/팬',
    label: '아이돌과 나',
    description: '왜 강하게 끌리는지와 정서적 합을 봅니다.',
    legacySubjectType: 'CRUSH'
  }
] as const;

const SCENARIO_MAP = new Map<ScenarioCode, ScenarioOption>(
  SCENARIO_OPTIONS.map((option) => [option.code, option])
);

const LEGACY_SELF_TO_SCENARIO: Record<SelfSubjectType, ScenarioCode> = {
  BASIC: 'SELF_BASIC',
  LIFETIME_FLOW: 'SELF_LIFETIME_FLOW',
  ROMANCE: 'SELF_LOVE_GENERAL',
  MARRIAGE: 'SELF_MARRIAGE_GENERAL',
  CAREER: 'SELF_CAREER_GENERAL',
  WEALTH: 'SELF_WEALTH_GENERAL',
  RELATIONSHIPS: 'SELF_RELATIONSHIP_GENERAL',
  FAMILY: 'SELF_FAMILY_GENERAL',
  YEAR_MONTH_DAY_FORTUNE: 'SELF_YEARLY_FORTUNE',
  DAEUN: 'SELF_DAEUN',
  LUCK_UP: 'SELF_LUCK_UP'
};

const LEGACY_COMPAT_TO_SCENARIO: Record<
  CompatibilityRelationType,
  ScenarioCode
> = {
  BASIC: 'COMPAT_ROMANCE_FLIRTING',
  LOVER: 'COMPAT_ROMANCE_EX',
  MARRIED: 'COMPAT_FAMILY_PARENT_CHILD',
  CRUSH: 'COMPAT_ROMANCE_CRUSH',
  FRIEND: 'COMPAT_FRIEND_BEST',
  COWORKER: 'COMPAT_WORK_COWORKER',
  MANAGER_MEMBER: 'COMPAT_WORK_BOSS',
  BUSINESS_PARTNER: 'COMPAT_WORK_BUSINESS_PARTNER'
};

export const SELF_SCENARIO_CODES = SCENARIO_OPTIONS.filter(
  (option) => option.mode === 'SELF'
).map((option) => option.code) as ScenarioCode[];

export const COMPATIBILITY_SCENARIO_CODES = SCENARIO_OPTIONS.filter(
  (option) => option.mode === 'COMPATIBILITY'
).map((option) => option.code) as ScenarioCode[];

export function getScenarioOption(code: string): ScenarioOption | null {
  return SCENARIO_MAP.get(code as ScenarioCode) ?? null;
}

export function getScenarioLabel(
  readingType: ReadingMode,
  subjectType: string
): string {
  if (subjectType === 'COMPAT_MISC_PET') {
    return '삭제된 항목';
  }

  const scenario = getScenarioOption(subjectType);
  if (scenario && scenario.mode === readingType) {
    return scenario.label;
  }

  if (readingType === 'SELF' && subjectType in SELF_SUBJECT_LABEL) {
    return SELF_SUBJECT_LABEL[subjectType as SelfSubjectType];
  }

  if (
    readingType === 'COMPATIBILITY' &&
    subjectType in COMPATIBILITY_RELATION_LABEL
  ) {
    return COMPATIBILITY_RELATION_LABEL[
      subjectType as CompatibilityRelationType
    ];
  }

  return subjectType;
}

export function getScenarioResultTitle(
  readingType: ReadingMode,
  subjectType: string
): string {
  const scenario = getScenarioOption(subjectType);
  if (scenario && scenario.mode === readingType) {
    return readingType === 'SELF'
      ? `${scenario.label} 풀이`
      : `${scenario.label} 궁합`;
  }

  const label = getScenarioLabel(readingType, subjectType);
  return readingType === 'SELF' ? `${label} 풀이` : `${label} 궁합`;
}

export function getScenarioFallbackSummary(
  readingType: ReadingMode,
  subjectType: string
): string {
  const scenario = getScenarioOption(subjectType);
  if (scenario && scenario.mode === readingType) {
    return scenario.description;
  }

  const label = getScenarioLabel(readingType, subjectType);
  return readingType === 'SELF'
    ? `${label}을 중심으로 지금의 운을 읽은 풀이입니다.`
    : `${label}을 중심으로 두 사람 사이의 결을 읽은 궁합입니다.`;
}

export function getLegacySubjectTypeFromCode(
  code: string
): SelfSubjectType | CompatibilityRelationType | null {
  return getScenarioOption(code)?.legacySubjectType ?? null;
}

export function getScenarioCodeFromLegacy(
  readingType: ReadingMode,
  subjectType: string
): ScenarioCode | null {
  if (readingType === 'SELF' && subjectType in LEGACY_SELF_TO_SCENARIO) {
    return LEGACY_SELF_TO_SCENARIO[subjectType as SelfSubjectType];
  }

  if (
    readingType === 'COMPATIBILITY' &&
    subjectType in LEGACY_COMPAT_TO_SCENARIO
  ) {
    return LEGACY_COMPAT_TO_SCENARIO[subjectType as CompatibilityRelationType];
  }

  return null;
}

export function normalizeScenarioCode(
  readingType: ReadingMode,
  input: string
): ScenarioCode | null {
  const direct = getScenarioOption(input);
  if (direct && direct.mode === readingType) {
    return direct.code;
  }

  return getScenarioCodeFromLegacy(readingType, input);
}

export function getScenarioCategories(mode: ReadingMode): Array<{
  code: ScenarioCategoryCode;
  label: string;
  description: string;
  options: ScenarioOption[];
}> {
  const filtered = SCENARIO_OPTIONS.filter((option) => option.mode === mode);
  const grouped = new Map<
    ScenarioCategoryCode,
    {
      code: ScenarioCategoryCode;
      label: string;
      description: string;
      options: ScenarioOption[];
    }
  >();

  for (const option of filtered) {
    const existing = grouped.get(option.categoryCode);
    if (existing) {
      existing.options.push(option);
      continue;
    }

    grouped.set(option.categoryCode, {
      code: option.categoryCode,
      label: option.categoryLabel,
      description: SCENARIO_CATEGORY_DESCRIPTION[option.categoryCode],
      options: [option]
    });
  }

  return Array.from(grouped.values());
}

export function getDefaultScenarioCode(mode: ReadingMode): ScenarioCode {
  return mode === 'SELF' ? 'SELF_BASIC' : 'COMPAT_ROMANCE_FLIRTING';
}

export function getScenarioLoadingMeta(
  code: string
): ScenarioLoadingMeta | null {
  const option = getScenarioOption(code);
  if (!option) {
    return null;
  }

  const categoryMeta = SCENARIO_CATEGORY_LOADING_META[option.categoryCode];
  const override = SCENARIO_LOADING_OVERRIDES[option.code];

  const messages = override?.messages ?? [
    `${option.label}에 담긴 운의 결을 먼저 읽고 있어요.`,
    ...categoryMeta.messages
  ];

  return {
    ...categoryMeta,
    ...override,
    messages
  };
}
