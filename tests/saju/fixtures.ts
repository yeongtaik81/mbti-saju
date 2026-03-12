import type { MbtiType } from '@prisma/client';
import {
  buildCompatibilityReadingCacheKey,
  buildSelfReadingCacheKey,
  resolveReadingPeriodContext,
  type ReadingPeriodContext
} from '@/lib/saju/cache-key';
import {
  getScenarioCodeFromLegacy,
  type ScenarioCode
} from '@/lib/saju/scenarios';
import type { BirthInfo, SajuGenerationInput } from '@/lib/saju/generator';

const BASE_NOW = new Date('2026-03-06T12:00:00+09:00');

const BASE_USER_BIRTH: BirthInfo = {
  birthDate: '1984-03-05',
  birthTime: '12:00',
  birthTimeUnknown: false,
  birthCalendarType: 'SOLAR',
  isLeapMonth: false,
  gender: 'FEMALE'
};

const BASE_PARTNER_BIRTH: BirthInfo = {
  birthDate: '1988-11-21',
  birthTime: '18:30',
  birthTimeUnknown: false,
  birthCalendarType: 'SOLAR',
  isLeapMonth: false,
  gender: 'MALE'
};

function createSelfPeriodContext(
  subjectType: string,
  now = BASE_NOW
): ReadingPeriodContext {
  return resolveReadingPeriodContext(subjectType, now);
}

export function createSelfGenerationInput(
  subjectType:
    | 'BASIC'
    | 'LIFETIME_FLOW'
    | 'ROMANCE'
    | 'MARRIAGE'
    | 'CAREER'
    | 'WEALTH'
    | 'RELATIONSHIPS'
    | 'FAMILY'
    | 'YEAR_MONTH_DAY_FORTUNE'
    | 'DAEUN'
    | 'LUCK_UP',
  mbtiType: MbtiType | null = 'INFJ',
  scenarioCode: ScenarioCode | null = getScenarioCodeFromLegacy(
    'SELF',
    subjectType
  )
): SajuGenerationInput {
  const periodContext = createSelfPeriodContext(subjectType);
  const cacheKey = buildSelfReadingCacheKey({
    readingType: 'SELF',
    subjectType,
    period: {
      scope: periodContext.scope,
      periodKey: periodContext.periodKey
    },
    self: {
      birthDate: BASE_USER_BIRTH.birthDate,
      birthTime: BASE_USER_BIRTH.birthTime,
      birthTimeUnknown: BASE_USER_BIRTH.birthTimeUnknown,
      birthCalendarType: BASE_USER_BIRTH.birthCalendarType,
      isLeapMonth: BASE_USER_BIRTH.isLeapMonth,
      gender: BASE_USER_BIRTH.gender,
      mbtiType
    }
  });

  return {
    cacheKey,
    periodContext,
    readingType: 'SELF',
    subjectType,
    scenarioCode,
    userName: 'User',
    userMbtiType: mbtiType,
    userBirthInfo: BASE_USER_BIRTH
  };
}

export function createCompatibilityGenerationInput(
  subjectType:
    | 'BASIC'
    | 'LOVER'
    | 'MARRIED'
    | 'CRUSH'
    | 'FRIEND'
    | 'COWORKER'
    | 'MANAGER_MEMBER'
    | 'BUSINESS_PARTNER',
  userMbtiType: MbtiType | null = 'INFJ',
  partnerMbtiType: MbtiType | null = 'ENTP',
  scenarioCode: ScenarioCode | null = getScenarioCodeFromLegacy(
    'COMPATIBILITY',
    subjectType
  )
): SajuGenerationInput {
  const periodContext = createSelfPeriodContext(subjectType);
  const cacheKey = buildCompatibilityReadingCacheKey({
    readingType: 'COMPATIBILITY',
    subjectType,
    period: {
      scope: periodContext.scope,
      periodKey: periodContext.periodKey
    },
    self: {
      birthDate: BASE_USER_BIRTH.birthDate,
      birthTime: BASE_USER_BIRTH.birthTime,
      birthTimeUnknown: BASE_USER_BIRTH.birthTimeUnknown,
      birthCalendarType: BASE_USER_BIRTH.birthCalendarType,
      isLeapMonth: BASE_USER_BIRTH.isLeapMonth,
      gender: BASE_USER_BIRTH.gender,
      mbtiType: userMbtiType
    },
    partner: {
      birthDate: BASE_PARTNER_BIRTH.birthDate,
      birthTime: BASE_PARTNER_BIRTH.birthTime,
      birthTimeUnknown: BASE_PARTNER_BIRTH.birthTimeUnknown,
      birthCalendarType: BASE_PARTNER_BIRTH.birthCalendarType,
      isLeapMonth: BASE_PARTNER_BIRTH.isLeapMonth,
      gender: BASE_PARTNER_BIRTH.gender,
      mbtiType: partnerMbtiType
    }
  });

  return {
    cacheKey,
    periodContext,
    readingType: 'COMPATIBILITY',
    subjectType,
    scenarioCode,
    userName: 'User',
    userMbtiType: userMbtiType,
    userBirthInfo: BASE_USER_BIRTH,
    partnerName: 'Partner',
    partnerMbtiType,
    partnerBirthInfo: BASE_PARTNER_BIRTH
  };
}
