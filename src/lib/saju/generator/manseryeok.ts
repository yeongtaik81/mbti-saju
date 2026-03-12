import {
  calculateFourPillars,
  getEarthlyBranchElement,
  getHeavenlyStemElement,
  getHeavenlyStemYinYang,
  lunarToSolar,
  solarToLunar,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type Pillar
} from 'manseryeok';
import type { BirthInfo } from './types';

const FIVE_ELEMENTS: readonly FiveElement[] = ['목', '화', '토', '금', '수'];
const HEAVENLY_STEMS: readonly HeavenlyStem[] = [
  '갑',
  '을',
  '병',
  '정',
  '무',
  '기',
  '경',
  '신',
  '임',
  '계'
];
const EARTHLY_BRANCHES: readonly EarthlyBranch[] = [
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
];

const SOLAR_TERM_BASE = [
  5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678,
  21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36,
  7.18, 21.94
] as const;

const ELEMENT_THEME: Record<
  FiveElement,
  {
    noun: string;
    phrase: string;
  }
> = {
  목: {
    noun: '성장력',
    phrase: '판을 넓히고 성장시키는 힘'
  },
  화: {
    noun: '표현력',
    phrase: '드러내고 빛을 모으는 힘'
  },
  토: {
    noun: '안정감',
    phrase: '정리하고 균형을 잡는 힘'
  },
  금: {
    noun: '기준감',
    phrase: '기준을 세우고 결실을 고르는 힘'
  },
  수: {
    noun: '유연함',
    phrase: '흐름을 읽고 연결하는 힘'
  }
};

type ParsedBirthDate = {
  year: number;
  month: number;
  day: number;
};

type ParsedBirthTime = {
  hour: number;
  minute: number;
};

export type ManseryeokProfile = {
  pillars: {
    yearString: string;
    monthString: string;
    dayString: string;
    hourString: string;
  };
  visibleStems: {
    year: HeavenlyStem;
    month: HeavenlyStem;
    day: HeavenlyStem;
    hour: HeavenlyStem | null;
  };
  visibleBranches: {
    year: EarthlyBranch;
    month: EarthlyBranch;
    day: EarthlyBranch;
    hour: EarthlyBranch | null;
  };
  dayMaster: {
    stem: HeavenlyStem;
    element: FiveElement;
    yinYang: '양' | '음';
  };
  elementCount: Record<FiveElement, number>;
  ratioText: string;
  strongElement: FiveElement;
  weakElement: FiveElement;
  solarDate: ParsedBirthDate;
  lunarDate: ParsedBirthDate & { isLeapMonth: boolean };
};

export type DaewoonSummary = {
  tenYearFlow: string;
  currentDaewoon: string;
  yearlyFlow: string;
  currentTheme: string;
};

function parseBirthDate(birthDate: string): ParsedBirthDate {
  const [yearRaw = '1984', monthRaw = '01', dayRaw = '01'] =
    birthDate.split('-');
  return {
    year: Number.parseInt(yearRaw, 10),
    month: Number.parseInt(monthRaw, 10),
    day: Number.parseInt(dayRaw, 10)
  };
}

function parseBirthTime(
  birthTime: string | null,
  birthTimeUnknown: boolean
): ParsedBirthTime {
  if (birthTimeUnknown || !birthTime) {
    return { hour: 12, minute: 0 };
  }

  const [hourRaw = '12', minuteRaw = '00'] = birthTime.split(':');
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  return {
    hour: Number.isFinite(hour) ? hour : 12,
    minute: Number.isFinite(minute) ? minute : 0
  };
}

function pillarToString(pillar: Pillar): string {
  return `${pillar.heavenlyStem}${pillar.earthlyBranch}`;
}

function buildSolarTermDate(year: number, termIndex: number): Date {
  const century = Math.floor(year / 100);
  const yearInCentury = year % 100;
  const termCoeff = 0.2422;
  const leapYearAdjust =
    Math.floor(yearInCentury / 4) - Math.floor(century / 4);
  const base = SOLAR_TERM_BASE[termIndex] ?? SOLAR_TERM_BASE[0];
  const day = Math.floor(base + termCoeff * yearInCentury + leapYearAdjust);
  const month = Math.floor(termIndex / 2);
  return new Date(year, month, day, 0, 0, 0, 0);
}

function getSurroundingSolarTerms(target: Date): {
  previous: Date;
  next: Date;
} {
  const year = target.getFullYear();
  const candidates: Date[] = [];

  for (const candidateYear of [year - 1, year, year + 1]) {
    for (let index = 0; index < 24; index += 1) {
      candidates.push(buildSolarTermDate(candidateYear, index));
    }
  }

  candidates.sort((left, right) => left.getTime() - right.getTime());

  let previous = candidates[0] ?? target;
  let next = candidates[candidates.length - 1] ?? target;

  for (const candidate of candidates) {
    if (candidate.getTime() <= target.getTime()) {
      previous = candidate;
      continue;
    }

    next = candidate;
    break;
  }

  return { previous, next };
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getStemByIndex(index: number): HeavenlyStem {
  return HEAVENLY_STEMS[mod(index, HEAVENLY_STEMS.length)]!;
}

function getBranchByIndex(index: number): EarthlyBranch {
  return EARTHLY_BRANCHES[mod(index, EARTHLY_BRANCHES.length)]!;
}

function buildSexagenaryCycle(): Pillar[] {
  return Array.from({ length: 60 }, (_, index) => ({
    heavenlyStem: getStemByIndex(index),
    earthlyBranch: getBranchByIndex(index)
  }));
}

const SEXAGENARY_CYCLE = buildSexagenaryCycle();

function getCyclePillar(index: number): Pillar {
  return SEXAGENARY_CYCLE[mod(index, SEXAGENARY_CYCLE.length)]!;
}

function getPillarIndex(pillar: Pillar): number {
  return SEXAGENARY_CYCLE.findIndex(
    (candidate) =>
      candidate.heavenlyStem === pillar.heavenlyStem &&
      candidate.earthlyBranch === pillar.earthlyBranch
  );
}

function getFlowTheme(pillar: Pillar): string {
  const stemElement = getHeavenlyStemElement(pillar.heavenlyStem);
  const branchElement = getEarthlyBranchElement(pillar.earthlyBranch);

  if (stemElement === branchElement) {
    return `${stemElement} 기운이 짙어 ${ELEMENT_THEME[stemElement].noun}이 또렷해지는 흐름`;
  }

  return `${stemElement}의 ${ELEMENT_THEME[stemElement].noun}과 ${branchElement}의 ${ELEMENT_THEME[branchElement].noun}이 함께 움직이는 흐름`;
}

function getFlowDescription(pillar: Pillar): string {
  return `${pillarToString(pillar)}의 흐름이라 ${getFlowTheme(pillar)}입니다.`;
}

function calculateAge(referenceDate: string, birth: ParsedBirthDate): number {
  const [
    referenceYearRaw = '2026',
    referenceMonthRaw = '01',
    referenceDayRaw = '01'
  ] = referenceDate.split('-');
  const referenceYear = Number.parseInt(referenceYearRaw, 10);
  const referenceMonth = Number.parseInt(referenceMonthRaw, 10);
  const referenceDay = Number.parseInt(referenceDayRaw, 10);

  let age = referenceYear - birth.year;
  if (
    referenceMonth < birth.month ||
    (referenceMonth === birth.month && referenceDay < birth.day)
  ) {
    age -= 1;
  }

  return Math.max(0, age);
}

function shouldFlowForward(
  yearStem: HeavenlyStem,
  gender: BirthInfo['gender']
): boolean {
  const yinYang = getHeavenlyStemYinYang(yearStem);

  if (gender === 'MALE') {
    return yinYang === '양';
  }

  if (gender === 'FEMALE') {
    return yinYang === '음';
  }

  return yinYang === '양';
}

export function calculateManseryeokProfile(info: BirthInfo): ManseryeokProfile {
  const birthDate = parseBirthDate(info.birthDate);
  const birthTime = parseBirthTime(info.birthTime, info.birthTimeUnknown);

  const fourPillars = calculateFourPillars({
    year: birthDate.year,
    month: birthDate.month,
    day: birthDate.day,
    hour: birthTime.hour,
    minute: birthTime.minute,
    isLunar: info.birthCalendarType === 'LUNAR',
    isLeapMonth: info.birthCalendarType === 'LUNAR' ? info.isLeapMonth : false
  });

  const solarDate =
    info.birthCalendarType === 'LUNAR'
      ? lunarToSolar(
          birthDate.year,
          birthDate.month,
          birthDate.day,
          info.isLeapMonth
        )
      : birthDate;

  const lunarDate =
    info.birthCalendarType === 'LUNAR'
      ? { ...birthDate, isLeapMonth: info.isLeapMonth }
      : solarToLunar(birthDate.year, birthDate.month, birthDate.day);

  const counts: Record<FiveElement, number> = {
    목: 0,
    화: 0,
    토: 0,
    금: 0,
    수: 0
  };

  const pillars = info.birthTimeUnknown
    ? [fourPillars.year, fourPillars.month, fourPillars.day]
    : [fourPillars.year, fourPillars.month, fourPillars.day, fourPillars.hour];
  for (const pillar of pillars) {
    counts[getHeavenlyStemElement(pillar.heavenlyStem)] += 1;
    counts[getEarthlyBranchElement(pillar.earthlyBranch)] += 1;
  }

  const ranked = Object.entries(counts)
    .map(([element, count], index) => ({
      element: element as FiveElement,
      count,
      index
    }))
    .sort(
      (left, right) => right.count - left.count || left.index - right.index
    );

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const ratioText = FIVE_ELEMENTS.map((element) => {
    const count = counts[element];
    const ratio = total === 0 ? 0 : Math.round((count / total) * 100);
    return `${element} ${ratio}%`;
  }).join(' · ');

  return {
    pillars: {
      yearString: fourPillars.yearString,
      monthString: fourPillars.monthString,
      dayString: fourPillars.dayString,
      hourString: info.birthTimeUnknown ? '시주 미정' : fourPillars.hourString
    },
    visibleStems: {
      year: fourPillars.year.heavenlyStem,
      month: fourPillars.month.heavenlyStem,
      day: fourPillars.day.heavenlyStem,
      hour: info.birthTimeUnknown ? null : fourPillars.hour.heavenlyStem
    },
    visibleBranches: {
      year: fourPillars.year.earthlyBranch,
      month: fourPillars.month.earthlyBranch,
      day: fourPillars.day.earthlyBranch,
      hour: info.birthTimeUnknown ? null : fourPillars.hour.earthlyBranch
    },
    dayMaster: {
      stem: fourPillars.day.heavenlyStem,
      element: getHeavenlyStemElement(fourPillars.day.heavenlyStem),
      yinYang: getHeavenlyStemYinYang(fourPillars.day.heavenlyStem)
    },
    elementCount: counts,
    ratioText,
    strongElement: ranked[0]?.element ?? '토',
    weakElement: ranked[ranked.length - 1]?.element ?? '수',
    solarDate,
    lunarDate
  };
}

export function calculateDaewoonSummary(
  info: BirthInfo,
  referenceDate: string
): DaewoonSummary {
  const birthDate = parseBirthDate(info.birthDate);
  const birthTime = parseBirthTime(info.birthTime, info.birthTimeUnknown);
  const fourPillars = calculateFourPillars({
    year: birthDate.year,
    month: birthDate.month,
    day: birthDate.day,
    hour: birthTime.hour,
    minute: birthTime.minute,
    isLunar: info.birthCalendarType === 'LUNAR',
    isLeapMonth: info.birthCalendarType === 'LUNAR' ? info.isLeapMonth : false
  });

  const solarBirth =
    info.birthCalendarType === 'LUNAR'
      ? lunarToSolar(
          birthDate.year,
          birthDate.month,
          birthDate.day,
          info.isLeapMonth
        )
      : birthDate;

  const birthDateTime = new Date(
    solarBirth.year,
    solarBirth.month - 1,
    solarBirth.day,
    birthTime.hour,
    birthTime.minute,
    0,
    0
  );

  const flowForward = shouldFlowForward(
    fourPillars.year.heavenlyStem,
    info.gender
  );
  const surroundingTerms = getSurroundingSolarTerms(birthDateTime);
  const diffMs = flowForward
    ? surroundingTerms.next.getTime() - birthDateTime.getTime()
    : birthDateTime.getTime() - surroundingTerms.previous.getTime();
  const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0.1);
  const startAge = Math.max(1, Math.round(diffDays / 3));
  const age = calculateAge(referenceDate, solarBirth);

  const monthPillarIndex = getPillarIndex(fourPillars.month);
  const referenceBirthIndex = monthPillarIndex < 0 ? 0 : monthPillarIndex;
  const firstShift = flowForward ? 1 : -1;
  const firstPillar = getCyclePillar(referenceBirthIndex + firstShift);

  const [
    referenceYearRaw = '2026',
    referenceMonthRaw = '01',
    referenceDayRaw = '01'
  ] = referenceDate.split('-');
  const referencePillars = calculateFourPillars({
    year: Number.parseInt(referenceYearRaw, 10),
    month: Number.parseInt(referenceMonthRaw, 10),
    day: Number.parseInt(referenceDayRaw, 10),
    hour: 12,
    minute: 0
  });

  if (age < startAge) {
    return {
      tenYearFlow: `앞으로 첫 10년 운은 ${getFlowTheme(firstPillar)}입니다. ${startAge}세 전후부터 ${startAge + 9}세까지 이어질 가능성이 큽니다.`,
      currentDaewoon: `아직 첫 대운에 완전히 들어가기 전 준비 구간입니다. 첫 대운은 ${startAge}세 전후에 ${pillarToString(firstPillar)} 흐름으로 시작합니다.`,
      yearlyFlow: `${referenceYearRaw}년 세운은 ${referencePillars.yearString}입니다. ${getFlowDescription(referencePillars.year)}`,
      currentTheme: getFlowTheme(firstPillar)
    };
  }

  const cycleNumber = Math.floor((age - startAge) / 10) + 1;
  const cycleStartAge = startAge + (cycleNumber - 1) * 10;
  const cycleEndAge = cycleStartAge + 9;
  const currentShift = flowForward ? cycleNumber : -cycleNumber;
  const nextShift = flowForward ? cycleNumber + 1 : -(cycleNumber + 1);
  const currentPillar = getCyclePillar(referenceBirthIndex + currentShift);
  const nextPillar = getCyclePillar(referenceBirthIndex + nextShift);

  return {
    tenYearFlow: `지금 10년 운은 ${getFlowTheme(currentPillar)}입니다. 다음 10년은 ${getFlowTheme(nextPillar)} 쪽으로 무게가 옮겨갈 가능성이 큽니다.`,
    currentDaewoon: `현재 대운은 ${cycleStartAge}~${cycleEndAge}세 구간의 ${pillarToString(currentPillar)} 대운입니다. ${getFlowDescription(currentPillar)}`,
    yearlyFlow: `${referenceYearRaw}년 세운은 ${referencePillars.yearString}입니다. ${getFlowDescription(referencePillars.year)}`,
    currentTheme: getFlowTheme(currentPillar)
  };
}
