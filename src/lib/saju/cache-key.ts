import { createHash } from 'node:crypto';
import type {
  Gender,
  MbtiType,
  ReadingType,
  ReadingCacheScope
} from '@prisma/client';

const CACHE_KEY_VERSION = 'saju-cache-v24';

export type ReadingPeriodContext = {
  scope: ReadingCacheScope;
  periodKey: string;
  referenceDate: string;
};

type SelfCanonicalInput = {
  readingType: Extract<ReadingType, 'SELF'>;
  subjectType: string;
  period: {
    scope: ReadingCacheScope;
    periodKey: string;
  };
  self: {
    birthDate: string;
    birthTime: string | null;
    birthTimeUnknown: boolean;
    birthCalendarType: 'SOLAR' | 'LUNAR';
    isLeapMonth: boolean;
    gender: Gender;
    mbtiType: MbtiType | null;
  };
};

type CompatibilityCanonicalInput = {
  readingType: Extract<ReadingType, 'COMPATIBILITY'>;
  subjectType: string;
  period: {
    scope: ReadingCacheScope;
    periodKey: string;
  };
  self: {
    birthDate: string;
    birthTime: string | null;
    birthTimeUnknown: boolean;
    birthCalendarType: 'SOLAR' | 'LUNAR';
    isLeapMonth: boolean;
    gender: Gender;
    mbtiType: MbtiType | null;
  };
  partner: {
    birthDate: string;
    birthTime: string | null;
    birthTimeUnknown: boolean;
    birthCalendarType: 'SOLAR' | 'LUNAR';
    isLeapMonth: boolean;
    gender: Gender;
    mbtiType: MbtiType | null;
  };
};

function toHashKey(
  input: SelfCanonicalInput | CompatibilityCanonicalInput
): string {
  const canonicalJson = JSON.stringify({
    v: CACHE_KEY_VERSION,
    ...input
  });

  return createHash('sha256').update(canonicalJson).digest('hex');
}

function toReferenceDate(input?: Date): string {
  const target = input ?? new Date();
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveReadingPeriodContext(
  subjectType: string,
  now?: Date
): ReadingPeriodContext {
  const referenceDate = toReferenceDate(now);
  const [year, month] = referenceDate.split('-');
  const monthKey = `${year}-${month}`;

  if (subjectType === 'YEAR_MONTH_DAY_FORTUNE') {
    return {
      scope: 'DAILY',
      periodKey: `y:${year}|m:${monthKey}|d:${referenceDate}`,
      referenceDate
    };
  }

  return {
    scope: 'YEARLY',
    periodKey: `y:${year}`,
    referenceDate
  };
}

export function buildSelfReadingCacheKey(input: SelfCanonicalInput): string {
  return toHashKey(input);
}

export function buildCompatibilityReadingCacheKey(
  input: CompatibilityCanonicalInput
): string {
  return toHashKey(input);
}
