import type { MbtiType } from '@prisma/client';
import {
  getHeavenlyStemElement,
  getHeavenlyStemYinYang,
  type EarthlyBranch,
  type HeavenlyStem
} from 'manseryeok';
import {
  calculateDaewoonSummary,
  calculateManseryeokProfile
} from './manseryeok';
import type { BirthInfo } from './types';

const GENERATING_CYCLE = ['목', '화', '토', '금', '수'] as const;
const CONTROLLING_TARGET: Record<string, string> = {
  목: '토',
  화: '금',
  토: '수',
  금: '목',
  수: '화'
};
const HIDDEN_STEMS_BY_BRANCH: Record<EarthlyBranch, HeavenlyStem[]> = {
  자: ['계'],
  축: ['기', '계', '신'],
  인: ['갑', '병', '무'],
  묘: ['을'],
  진: ['무', '을', '계'],
  사: ['병', '무', '경'],
  오: ['정', '기'],
  미: ['기', '정', '을'],
  신: ['경', '임', '무'],
  유: ['신'],
  술: ['무', '신', '정'],
  해: ['임', '갑']
};
const EARTHLY_BRANCH_ORDER: readonly EarthlyBranch[] = [
  '자',
  '축',
  '인',
  '묘',
  '진',
  '사',
  '오',
  '미',
  '신',
  '유',
  '술',
  '해'
] as const;
const TWELVE_UNSEONG_ORDER = [
  '장생',
  '목욕',
  '관대',
  '건록',
  '제왕',
  '쇠',
  '병',
  '사',
  '묘',
  '절',
  '태',
  '양'
] as const;
const TWELVE_UNSEONG_START_BRANCH: Record<HeavenlyStem, EarthlyBranch> = {
  갑: '해',
  을: '오',
  병: '인',
  정: '유',
  무: '인',
  기: '유',
  경: '사',
  신: '자',
  임: '신',
  계: '묘'
};

export type MbtiAdvice = {
  strength: string;
  blindSpot: string;
  bestAction: string;
  timingStyle: string;
  cautionStyle: string;
  reflectionStyle: string;
  relationshipStyle: string;
  moneyStyle: string;
};

export type SajuRoleKey =
  | 'companion'
  | 'resource'
  | 'output'
  | 'wealth'
  | 'authority';

export type SajuRoleProfile = Record<
  SajuRoleKey,
  {
    element: string;
    count: number;
    label: string;
  }
>;

export type SajuBalanceProfile = {
  dayMasterStrength: 'STRONG' | 'WEAK' | 'BALANCED';
  scores: {
    support: number;
    drain: number;
    net: number;
  };
  seasonSupport: {
    monthBranch: EarthlyBranch;
    monthElement: string;
    roleKey: SajuRoleKey;
    label: string;
  };
  rootProfile: {
    supportRoots: number;
    drainRoots: number;
    rootedBranches: string[];
  };
  yongsin: {
    element: string;
    roleKey: SajuRoleKey;
    label: string;
  };
  heesin: {
    element: string;
    roleKey: SajuRoleKey;
    label: string;
  };
  gisin: {
    element: string;
    roleKey: SajuRoleKey;
    label: string;
  };
};

export type SajuTenGodKey =
  | '비견'
  | '겁재'
  | '식신'
  | '상관'
  | '편재'
  | '정재'
  | '편관'
  | '정관'
  | '편인'
  | '정인';

export type SajuTenGodEntry = {
  pillarKey: 'year' | 'month' | 'hour';
  pillarLabel: '연간' | '월간' | '시간';
  stem: HeavenlyStem;
  element: string;
  yinYang: '양' | '음';
  tenGod: SajuTenGodKey;
};

export type SajuTenGodProfile = {
  visible: SajuTenGodEntry[];
  dominant: Array<{
    tenGod: SajuTenGodKey;
    count: number;
    pillarLabels: string[];
  }>;
  monthLeader: SajuTenGodEntry;
};

export type SajuHiddenTenGodProfile = {
  visible: Array<{
    pillarKey: 'year' | 'month' | 'day' | 'hour';
    pillarLabel: '연지' | '월지' | '일지' | '시지';
    branch: EarthlyBranch;
    hiddenStems: Array<{
      stem: HeavenlyStem;
      element: string;
      yinYang: '양' | '음';
      tenGod: SajuTenGodKey;
    }>;
  }>;
  dominant: Array<{
    tenGod: SajuTenGodKey;
    count: number;
    pillarLabels: string[];
  }>;
  monthBranch: {
    pillarKey: 'month';
    pillarLabel: '월지';
    branch: EarthlyBranch;
    hiddenStems: Array<{
      stem: HeavenlyStem;
      element: string;
      yinYang: '양' | '음';
      tenGod: SajuTenGodKey;
    }>;
  };
};

export type SajuUnseongStage = (typeof TWELVE_UNSEONG_ORDER)[number];

export type SajuUnseongProfile = {
  visible: Array<{
    pillarKey: 'year' | 'month' | 'day' | 'hour';
    pillarLabel: '연지' | '월지' | '일지' | '시지';
    branch: EarthlyBranch;
    stage: SajuUnseongStage;
  }>;
  monthLeader: {
    pillarKey: 'month';
    pillarLabel: '월지';
    branch: EarthlyBranch;
    stage: SajuUnseongStage;
  };
  tone: 'RISE' | 'PEAK' | 'DECLINE' | 'RESET';
};

export type FiveElementSummary = {
  basisLine: string;
  strongElement: string;
  weakElement: string;
  ratioText: string;
  elementCount: Record<string, number>;
  pillars: {
    yearString: string;
    monthString: string;
    dayString: string;
    hourString: string;
  };
  dayMaster: {
    stem: string;
    element: string;
    yinYang: string;
  };
  roleProfile: SajuRoleProfile;
  balanceProfile: SajuBalanceProfile;
  tenGodProfile: SajuTenGodProfile;
  hiddenTenGodProfile: SajuHiddenTenGodProfile;
  unseongProfile: SajuUnseongProfile;
};

export type TimeFlowSummary = {
  tenYearFlow: string;
  currentDaewoon: string;
  yearlyFlow: string;
  currentTheme: string;
};

export function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickBySeed(
  seed: number,
  values: string[],
  offset: number
): string {
  const index = (seed + offset * 13) % values.length;
  return values[index] ?? values[0] ?? '';
}

function getGeneratingIndex(element: string): number {
  return GENERATING_CYCLE.findIndex((candidate) => candidate === element);
}

function getGeneratedElement(element: string): string {
  const index = getGeneratingIndex(element);
  if (index < 0) {
    return '토';
  }

  return GENERATING_CYCLE[(index + 1) % GENERATING_CYCLE.length] ?? '토';
}

function getResourceElement(element: string): string {
  const index = getGeneratingIndex(element);
  if (index < 0) {
    return '수';
  }

  return (
    GENERATING_CYCLE[
      (index - 1 + GENERATING_CYCLE.length) % GENERATING_CYCLE.length
    ] ?? '수'
  );
}

function getWealthElement(element: string): string {
  return CONTROLLING_TARGET[element] ?? '토';
}

function getAuthorityElement(element: string): string {
  return (
    Object.entries(CONTROLLING_TARGET).find(
      ([, target]) => target === element
    )?.[0] ?? '금'
  );
}

function getTenGod(
  dayMasterStem: HeavenlyStem,
  targetStem: HeavenlyStem
): SajuTenGodKey {
  const dayElement = getHeavenlyStemElement(dayMasterStem);
  const targetElement = getHeavenlyStemElement(targetStem);
  const samePolarity =
    getHeavenlyStemYinYang(dayMasterStem) ===
    getHeavenlyStemYinYang(targetStem);

  if (dayElement === targetElement) {
    return samePolarity ? '비견' : '겁재';
  }

  if (getGeneratedElement(dayElement) === targetElement) {
    return samePolarity ? '식신' : '상관';
  }

  if (getWealthElement(dayElement) === targetElement) {
    return samePolarity ? '편재' : '정재';
  }

  if (getAuthorityElement(dayElement) === targetElement) {
    return samePolarity ? '편관' : '정관';
  }

  return samePolarity ? '편인' : '정인';
}

function getRoleKeyFromTenGod(tenGod: SajuTenGodKey): SajuRoleKey {
  switch (tenGod) {
    case '비견':
    case '겁재':
      return 'companion';
    case '편인':
    case '정인':
      return 'resource';
    case '식신':
    case '상관':
      return 'output';
    case '편재':
    case '정재':
      return 'wealth';
    case '편관':
    case '정관':
      return 'authority';
    default:
      return 'resource';
  }
}

function getRoleKeyByElement(
  dayMasterElement: string,
  targetElement: string
): SajuRoleKey {
  if (dayMasterElement === targetElement) {
    return 'companion';
  }

  if (getResourceElement(dayMasterElement) === targetElement) {
    return 'resource';
  }

  if (getGeneratedElement(dayMasterElement) === targetElement) {
    return 'output';
  }

  if (getWealthElement(dayMasterElement) === targetElement) {
    return 'wealth';
  }

  return 'authority';
}

function getTwelveUnseongStage(
  dayMasterStem: HeavenlyStem,
  targetBranch: EarthlyBranch
): SajuUnseongStage {
  const startBranch = TWELVE_UNSEONG_START_BRANCH[dayMasterStem];
  const startIndex = EARTHLY_BRANCH_ORDER.findIndex(
    (branch) => branch === startBranch
  );
  const targetIndex = EARTHLY_BRANCH_ORDER.findIndex(
    (branch) => branch === targetBranch
  );
  const isYangDayMaster = getHeavenlyStemYinYang(dayMasterStem) === '양';
  const stageIndex = isYangDayMaster
    ? (((targetIndex - startIndex) % EARTHLY_BRANCH_ORDER.length) +
        EARTHLY_BRANCH_ORDER.length) %
      EARTHLY_BRANCH_ORDER.length
    : (((startIndex - targetIndex) % EARTHLY_BRANCH_ORDER.length) +
        EARTHLY_BRANCH_ORDER.length) %
      EARTHLY_BRANCH_ORDER.length;

  return TWELVE_UNSEONG_ORDER[stageIndex] ?? '태';
}

function buildRoleProfile(summary: {
  dayMasterElement: string;
  elementCount: Record<string, number>;
}): SajuRoleProfile {
  const companionElement = summary.dayMasterElement;
  const resourceElement = getResourceElement(summary.dayMasterElement);
  const outputElement = getGeneratedElement(summary.dayMasterElement);
  const wealthElement = getWealthElement(summary.dayMasterElement);
  const authorityElement = getAuthorityElement(summary.dayMasterElement);

  return {
    companion: {
      element: companionElement,
      count: summary.elementCount[companionElement] ?? 0,
      label: '비겁'
    },
    resource: {
      element: resourceElement,
      count: summary.elementCount[resourceElement] ?? 0,
      label: '인성'
    },
    output: {
      element: outputElement,
      count: summary.elementCount[outputElement] ?? 0,
      label: '식상'
    },
    wealth: {
      element: wealthElement,
      count: summary.elementCount[wealthElement] ?? 0,
      label: '재성'
    },
    authority: {
      element: authorityElement,
      count: summary.elementCount[authorityElement] ?? 0,
      label: '관성'
    }
  };
}

function buildRefinedBalanceProfile(summary: {
  dayMasterElement: string;
  roleProfile: SajuRoleProfile;
  tenGodProfile: SajuTenGodProfile;
  hiddenTenGodProfile: SajuHiddenTenGodProfile;
  visibleBranches: {
    month: EarthlyBranch;
  };
}): SajuBalanceProfile {
  const roleScores: Record<SajuRoleKey, number> = {
    companion: summary.roleProfile.companion.count,
    resource: summary.roleProfile.resource.count,
    output: summary.roleProfile.output.count,
    wealth: summary.roleProfile.wealth.count,
    authority: summary.roleProfile.authority.count
  };

  const visibleWeights: Record<'year' | 'month' | 'hour', number> = {
    year: 0.7,
    month: 1.4,
    hour: 0.6
  };
  for (const entry of summary.tenGodProfile.visible) {
    roleScores[getRoleKeyFromTenGod(entry.tenGod)] +=
      visibleWeights[entry.pillarKey] ?? 0.5;
  }

  const hiddenWeights: Record<'year' | 'month' | 'day' | 'hour', number> = {
    year: 0.35,
    month: 0.8,
    day: 0.6,
    hour: 0.4
  };
  let supportRoots = 0;
  let drainRoots = 0;
  const rootedBranches = new Set<string>();
  for (const entry of summary.hiddenTenGodProfile.visible) {
    for (const hiddenStem of entry.hiddenStems) {
      const roleKey = getRoleKeyFromTenGod(hiddenStem.tenGod);
      const weight = hiddenWeights[entry.pillarKey] ?? 0.4;
      roleScores[roleKey] += weight;

      if (roleKey === 'companion' || roleKey === 'resource') {
        supportRoots += 1;
        rootedBranches.add(entry.pillarLabel);
      } else {
        drainRoots += 1;
      }
    }
  }

  const monthElement =
    summary.hiddenTenGodProfile.monthBranch.hiddenStems[0]?.element ??
    summary.roleProfile.resource.element;
  const seasonRoleKey = getRoleKeyByElement(
    summary.dayMasterElement,
    monthElement
  );
  const seasonWeight =
    seasonRoleKey === 'companion' || seasonRoleKey === 'resource'
      ? 1.8
      : seasonRoleKey === 'output'
        ? 0.8
        : 1.4;
  roleScores[seasonRoleKey] += seasonWeight;

  const supportScore =
    roleScores.companion + roleScores.resource + supportRoots * 0.45;
  const drainScore =
    roleScores.output +
    roleScores.wealth +
    roleScores.authority +
    drainRoots * 0.25;
  const net = Number((supportScore - drainScore).toFixed(2));

  const strength = net >= 2.4 ? 'STRONG' : net <= -2.4 ? 'WEAK' : 'BALANCED';

  const favorableKeys: SajuRoleKey[] =
    strength === 'STRONG'
      ? ['output', 'wealth', 'authority']
      : strength === 'WEAK'
        ? ['resource', 'companion']
        : seasonRoleKey === 'companion' || seasonRoleKey === 'resource'
          ? ['output', 'wealth', 'authority']
          : ['resource', 'companion', 'output'];
  const cautionKeys: SajuRoleKey[] =
    strength === 'STRONG'
      ? ['companion', 'resource']
      : strength === 'WEAK'
        ? ['wealth', 'authority', 'output']
        : seasonRoleKey === 'companion' || seasonRoleKey === 'resource'
          ? ['companion', 'resource']
          : ['wealth', 'authority'];

  const favorableSorted = [...favorableKeys].sort(
    (left, right) => roleScores[left] - roleScores[right]
  );
  const cautionSorted = [...cautionKeys].sort(
    (left, right) => roleScores[right] - roleScores[left]
  );
  const yongsinKey = favorableSorted[0] ?? favorableKeys[0] ?? 'resource';
  const heesinKey =
    favorableSorted[1] ?? favorableSorted[0] ?? favorableKeys[1] ?? yongsinKey;
  const gisinKey = cautionSorted[0] ?? cautionKeys[0] ?? 'authority';

  return {
    dayMasterStrength: strength,
    scores: {
      support: Number(supportScore.toFixed(2)),
      drain: Number(drainScore.toFixed(2)),
      net
    },
    seasonSupport: {
      monthBranch: summary.visibleBranches.month,
      monthElement,
      roleKey: seasonRoleKey,
      label: summary.roleProfile[seasonRoleKey].label
    },
    rootProfile: {
      supportRoots,
      drainRoots,
      rootedBranches: [...rootedBranches]
    },
    yongsin: {
      element: summary.roleProfile[yongsinKey].element,
      roleKey: yongsinKey,
      label: summary.roleProfile[yongsinKey].label
    },
    heesin: {
      element: summary.roleProfile[heesinKey].element,
      roleKey: heesinKey,
      label: summary.roleProfile[heesinKey].label
    },
    gisin: {
      element: summary.roleProfile[gisinKey].element,
      roleKey: gisinKey,
      label: summary.roleProfile[gisinKey].label
    }
  };
}

function buildTenGodProfile(summary: {
  dayMasterStem: HeavenlyStem;
  visibleStems: {
    year: HeavenlyStem;
    month: HeavenlyStem;
    hour: HeavenlyStem | null;
  };
}): SajuTenGodProfile {
  const entries: SajuTenGodEntry[] = [
    {
      pillarKey: 'year',
      pillarLabel: '연간',
      stem: summary.visibleStems.year,
      element: getHeavenlyStemElement(summary.visibleStems.year),
      yinYang: getHeavenlyStemYinYang(summary.visibleStems.year),
      tenGod: getTenGod(summary.dayMasterStem, summary.visibleStems.year)
    },
    {
      pillarKey: 'month',
      pillarLabel: '월간',
      stem: summary.visibleStems.month,
      element: getHeavenlyStemElement(summary.visibleStems.month),
      yinYang: getHeavenlyStemYinYang(summary.visibleStems.month),
      tenGod: getTenGod(summary.dayMasterStem, summary.visibleStems.month)
    },
    ...(summary.visibleStems.hour
      ? [
          {
            pillarKey: 'hour' as const,
            pillarLabel: '시간' as const,
            stem: summary.visibleStems.hour,
            element: getHeavenlyStemElement(summary.visibleStems.hour),
            yinYang: getHeavenlyStemYinYang(summary.visibleStems.hour),
            tenGod: getTenGod(summary.dayMasterStem, summary.visibleStems.hour)
          }
        ]
      : [])
  ];

  const counts = new Map<
    SajuTenGodKey,
    { count: number; pillarLabels: string[] }
  >();
  for (const entry of entries) {
    const current = counts.get(entry.tenGod);
    if (!current) {
      counts.set(entry.tenGod, { count: 1, pillarLabels: [entry.pillarLabel] });
      continue;
    }

    current.count += 1;
    current.pillarLabels.push(entry.pillarLabel);
  }

  const dominant = [...counts.entries()]
    .map(([tenGod, value]) => ({
      tenGod,
      count: value.count,
      pillarLabels: value.pillarLabels
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.tenGod.localeCompare(right.tenGod)
    );

  return {
    visible: entries,
    dominant,
    monthLeader:
      entries.find((entry) => entry.pillarKey === 'month') ?? entries[0]!
  };
}

function buildHiddenTenGodProfile(summary: {
  dayMasterStem: HeavenlyStem;
  visibleBranches: {
    year: EarthlyBranch;
    month: EarthlyBranch;
    day: EarthlyBranch;
    hour: EarthlyBranch | null;
  };
}): SajuHiddenTenGodProfile {
  const entries: SajuHiddenTenGodProfile['visible'] = [
    {
      pillarKey: 'year',
      pillarLabel: '연지',
      branch: summary.visibleBranches.year,
      hiddenStems: (
        HIDDEN_STEMS_BY_BRANCH[summary.visibleBranches.year] ?? []
      ).map((stem) => ({
        stem,
        element: getHeavenlyStemElement(stem),
        yinYang: getHeavenlyStemYinYang(stem),
        tenGod: getTenGod(summary.dayMasterStem, stem)
      }))
    },
    {
      pillarKey: 'month',
      pillarLabel: '월지',
      branch: summary.visibleBranches.month,
      hiddenStems: (
        HIDDEN_STEMS_BY_BRANCH[summary.visibleBranches.month] ?? []
      ).map((stem) => ({
        stem,
        element: getHeavenlyStemElement(stem),
        yinYang: getHeavenlyStemYinYang(stem),
        tenGod: getTenGod(summary.dayMasterStem, stem)
      }))
    },
    {
      pillarKey: 'day',
      pillarLabel: '일지',
      branch: summary.visibleBranches.day,
      hiddenStems: (
        HIDDEN_STEMS_BY_BRANCH[summary.visibleBranches.day] ?? []
      ).map((stem) => ({
        stem,
        element: getHeavenlyStemElement(stem),
        yinYang: getHeavenlyStemYinYang(stem),
        tenGod: getTenGod(summary.dayMasterStem, stem)
      }))
    },
    ...(summary.visibleBranches.hour
      ? [
          {
            pillarKey: 'hour' as const,
            pillarLabel: '시지' as const,
            branch: summary.visibleBranches.hour,
            hiddenStems: (
              HIDDEN_STEMS_BY_BRANCH[summary.visibleBranches.hour] ?? []
            ).map((stem) => ({
              stem,
              element: getHeavenlyStemElement(stem),
              yinYang: getHeavenlyStemYinYang(stem),
              tenGod: getTenGod(summary.dayMasterStem, stem)
            }))
          }
        ]
      : [])
  ];

  const counts = new Map<
    SajuTenGodKey,
    { count: number; pillarLabels: string[] }
  >();
  for (const entry of entries) {
    for (const hiddenStem of entry.hiddenStems) {
      const current = counts.get(hiddenStem.tenGod);
      if (!current) {
        counts.set(hiddenStem.tenGod, {
          count: 1,
          pillarLabels: [entry.pillarLabel]
        });
        continue;
      }

      current.count += 1;
      if (!current.pillarLabels.includes(entry.pillarLabel)) {
        current.pillarLabels.push(entry.pillarLabel);
      }
    }
  }

  const dominant = [...counts.entries()]
    .map(([tenGod, value]) => ({
      tenGod,
      count: value.count,
      pillarLabels: value.pillarLabels
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.tenGod.localeCompare(right.tenGod)
    );

  return {
    visible: entries,
    dominant,
    monthBranch: entries.find(
      (entry) => entry.pillarKey === 'month'
    ) as SajuHiddenTenGodProfile['monthBranch']
  };
}

function buildUnseongProfile(summary: {
  dayMasterStem: HeavenlyStem;
  visibleBranches: {
    year: EarthlyBranch;
    month: EarthlyBranch;
    day: EarthlyBranch;
    hour: EarthlyBranch | null;
  };
}): SajuUnseongProfile {
  const entries: SajuUnseongProfile['visible'] = [
    {
      pillarKey: 'year',
      pillarLabel: '연지',
      branch: summary.visibleBranches.year,
      stage: getTwelveUnseongStage(
        summary.dayMasterStem,
        summary.visibleBranches.year
      )
    },
    {
      pillarKey: 'month',
      pillarLabel: '월지',
      branch: summary.visibleBranches.month,
      stage: getTwelveUnseongStage(
        summary.dayMasterStem,
        summary.visibleBranches.month
      )
    },
    {
      pillarKey: 'day',
      pillarLabel: '일지',
      branch: summary.visibleBranches.day,
      stage: getTwelveUnseongStage(
        summary.dayMasterStem,
        summary.visibleBranches.day
      )
    },
    ...(summary.visibleBranches.hour
      ? [
          {
            pillarKey: 'hour' as const,
            pillarLabel: '시지' as const,
            branch: summary.visibleBranches.hour,
            stage: getTwelveUnseongStage(
              summary.dayMasterStem,
              summary.visibleBranches.hour
            )
          }
        ]
      : [])
  ];

  const monthLeader = (entries.find(
    (entry) => entry.pillarKey === 'month'
  ) as SajuUnseongProfile['monthLeader']) ?? {
    pillarKey: 'month',
    pillarLabel: '월지',
    branch: summary.visibleBranches.month,
    stage: getTwelveUnseongStage(
      summary.dayMasterStem,
      summary.visibleBranches.month
    )
  };

  const tone: SajuUnseongProfile['tone'] = ['장생', '관대'].includes(
    monthLeader.stage
  )
    ? 'RISE'
    : ['건록', '제왕'].includes(monthLeader.stage)
      ? 'PEAK'
      : ['쇠', '병', '사'].includes(monthLeader.stage)
        ? 'DECLINE'
        : 'RESET';

  return {
    visible: entries,
    monthLeader,
    tone
  };
}

export function buildMbtiAdvice(mbtiType: MbtiType | null): MbtiAdvice {
  if (!mbtiType) {
    return {
      strength: '본래의 호흡을 지키며 판단하는 힘',
      blindSpot: '익숙한 방식만 반복해 변화를 늦출 수 있는 점',
      bestAction: '오늘 중요한 선택 한 가지를 글로 적어 스스로 점검해 보세요.',
      timingStyle: '혼자 생각한 뒤 움직이는 방식이 더 편안합니다',
      cautionStyle:
        '생각이 많아질수록 결정 시점을 미루지 않는 연습이 필요합니다',
      reflectionStyle:
        '내가 편한 방식이 지금 상황에도 가장 좋은 방식인지 돌아보세요',
      relationshipStyle:
        '말을 아끼더라도 기대치는 분명히 전하는 편이 관계 안정에 좋습니다',
      moneyStyle: '큰 시도보다 현재의 흐름을 지키는 관리형 판단이 잘 맞습니다'
    };
  }

  const energy = mbtiType[0];
  const intuition = mbtiType[1];
  const decision = mbtiType[2];
  const lifestyle = mbtiType[3];

  const strength =
    energy === 'E'
      ? '사람과 기회를 연결하며 판을 움직이는 추진력'
      : '혼자서도 깊이 파고들며 방향을 정리하는 집중력';

  const blindSpot =
    decision === 'T'
      ? '정답을 빨리 찾으려다 마음의 온도를 놓칠 수 있는 점'
      : '배려가 앞서 결정을 미루거나 선을 흐릴 수 있는 점';

  const bestAction =
    lifestyle === 'J'
      ? '오늘의 핵심 우선순위를 1개만 고정하고 끝까지 완수해 보세요.'
      : '하고 싶은 일을 열어 두되, 마감 하나만 먼저 정해 실행해 보세요.';

  const timingStyle =
    intuition === 'N'
      ? '큰 흐름을 먼저 보고 움직일 때 리듬이 더 잘 살아납니다'
      : '눈앞의 사실과 컨디션을 확인하며 움직일 때 실수가 줄어듭니다';

  const cautionStyle =
    energy === 'E'
      ? '속도가 붙을수록 혼자 정리하는 시간을 의식적으로 넣는 편이 좋습니다'
      : '생각이 정리될 때까지 기다리다 타이밍을 놓치지 않도록 작은 행동부터 시작하세요';

  const reflectionStyle =
    intuition === 'N'
      ? '지금의 선택이 긴 흐름과도 맞는지 함께 돌아보면 좋습니다'
      : '지금 눈앞의 정보에만 갇히지 않았는지 한 걸음 물러서서 점검해 보세요';

  const relationshipStyle =
    decision === 'T'
      ? '기준을 말할 때 이유와 마음을 한 문장 더 붙이면 관계의 마찰이 줄어듭니다'
      : '공감 뒤에 내가 원하는 기준도 함께 말해야 관계가 더 안정됩니다';

  const moneyStyle =
    lifestyle === 'J'
      ? '예산과 계획을 먼저 세울수록 돈의 흐름을 안정적으로 다루는 힘이 커집니다'
      : '유연함은 장점이지만 지출 기준은 숫자로 고정해야 재물 흐름이 흐트러지지 않습니다';

  return {
    strength,
    blindSpot,
    bestAction,
    timingStyle,
    cautionStyle,
    reflectionStyle,
    relationshipStyle,
    moneyStyle
  };
}

export function buildFiveElementSummary(
  info: BirthInfo,
  _seedBase: string
): FiveElementSummary {
  void _seedBase;
  const manseryeok = calculateManseryeokProfile(info);
  const hourLabel = info.birthTimeUnknown
    ? '출생시각 미상'
    : (info.birthTime ?? '12:00');
  const calendarLabel =
    info.birthCalendarType === 'SOLAR'
      ? '양력'
      : info.isLeapMonth
        ? '음력(윤달)'
        : '음력';
  const hourBasis = info.birthTimeUnknown
    ? '출생시각은 미상으로 두고 년·월·일주 중심으로'
    : `${manseryeok.pillars.hourString}시까지 포함해`;
  const roleProfile = buildRoleProfile({
    dayMasterElement: manseryeok.dayMaster.element,
    elementCount: manseryeok.elementCount
  });
  const tenGodProfile = buildTenGodProfile({
    dayMasterStem: manseryeok.dayMaster.stem,
    visibleStems: {
      year: manseryeok.visibleStems.year,
      month: manseryeok.visibleStems.month,
      hour: manseryeok.visibleStems.hour
    }
  });
  const hiddenTenGodProfile = buildHiddenTenGodProfile({
    dayMasterStem: manseryeok.dayMaster.stem,
    visibleBranches: {
      year: manseryeok.visibleBranches.year,
      month: manseryeok.visibleBranches.month,
      day: manseryeok.visibleBranches.day,
      hour: manseryeok.visibleBranches.hour
    }
  });
  const unseongProfile = buildUnseongProfile({
    dayMasterStem: manseryeok.dayMaster.stem,
    visibleBranches: {
      year: manseryeok.visibleBranches.year,
      month: manseryeok.visibleBranches.month,
      day: manseryeok.visibleBranches.day,
      hour: manseryeok.visibleBranches.hour
    }
  });

  return {
    basisLine: `${calendarLabel} ${info.birthDate} ${hourLabel} 기준 만세력으로 세우면 ${hourBasis} ${manseryeok.pillars.yearString}년, ${manseryeok.pillars.monthString}월, ${manseryeok.pillars.dayString}일${info.birthTimeUnknown ? '' : `, ${manseryeok.pillars.hourString}시`}의 팔자가 나옵니다. 일간은 ${manseryeok.dayMaster.stem}${manseryeok.dayMaster.element}이며, 오행 분포는 ${manseryeok.ratioText}입니다.`,
    strongElement: manseryeok.strongElement,
    weakElement: manseryeok.weakElement,
    ratioText: manseryeok.ratioText,
    elementCount: manseryeok.elementCount,
    pillars: manseryeok.pillars,
    dayMaster: manseryeok.dayMaster,
    roleProfile,
    balanceProfile: buildRefinedBalanceProfile({
      dayMasterElement: manseryeok.dayMaster.element,
      roleProfile,
      tenGodProfile,
      hiddenTenGodProfile,
      visibleBranches: {
        month: manseryeok.visibleBranches.month
      }
    }),
    tenGodProfile,
    hiddenTenGodProfile,
    unseongProfile
  };
}

export function buildTimeFlow(
  info: BirthInfo,
  _seedBase: string,
  referenceDate: string
): TimeFlowSummary {
  void _seedBase;
  return calculateDaewoonSummary(info, referenceDate);
}

export function buildMbtiAppliedRules(
  mbtiType: MbtiType | null,
  label: string
): string[] {
  if (!mbtiType) {
    return [`${label}: MBTI 미입력으로 성향 보정 규칙은 최소 적용`];
  }

  const energyRule =
    mbtiType[0] === 'E'
      ? `${label}: E 성향 → 대화형 실행, 빠른 피드백 루프 권장`
      : `${label}: I 성향 → 집중형 실행, 독립 작업 블록 권장`;
  const perceiveRule =
    mbtiType[1] === 'N'
      ? `${label}: N 성향 → 장기 시나리오 기반 의사결정 보정`
      : `${label}: S 성향 → 현실 리스크 체크리스트 우선`;
  const decisionRule =
    mbtiType[2] === 'T'
      ? `${label}: T 성향 → 수치/사실 중심 커뮤니케이션 보정`
      : `${label}: F 성향 → 정서/관계 맥락 병행 커뮤니케이션 보정`;
  const lifestyleRule =
    mbtiType[3] === 'J'
      ? `${label}: J 성향 → 일정 고정형 실행 플랜 권장`
      : `${label}: P 성향 → 단계별 유연 플랜 + 마감 고정 권장`;

  return [energyRule, perceiveRule, decisionRule, lifestyleRule];
}
