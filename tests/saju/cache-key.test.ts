import { describe, expect, it } from 'vitest';
import {
  buildCompatibilityReadingCacheKey,
  buildSelfReadingCacheKey,
  resolveReadingPeriodContext
} from '@/lib/saju/cache-key';

describe('saju cache key', () => {
  it('uses a yearly period for non-daily subjects', () => {
    const period = resolveReadingPeriodContext(
      'BASIC',
      new Date('2026-03-06T12:00:00+09:00')
    );

    expect(period.scope).toBe('YEARLY');
    expect(period.periodKey).toBe('y:2026');
    expect(period.referenceDate).toBe('2026-03-06');
  });

  it('uses a daily period for year/month/day fortune readings', () => {
    const period = resolveReadingPeriodContext(
      'YEAR_MONTH_DAY_FORTUNE',
      new Date('2026-03-06T12:00:00+09:00')
    );

    expect(period.scope).toBe('DAILY');
    expect(period.periodKey).toBe('y:2026|m:2026-03|d:2026-03-06');
    expect(period.referenceDate).toBe('2026-03-06');
  });

  it('returns the same self cache key for the same canonical input', () => {
    const period = resolveReadingPeriodContext(
      'WEALTH',
      new Date('2026-03-06T12:00:00+09:00')
    );
    const input = {
      readingType: 'SELF' as const,
      subjectType: 'WEALTH',
      period: {
        scope: period.scope,
        periodKey: period.periodKey
      },
      self: {
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR' as const,
        isLeapMonth: false,
        gender: 'FEMALE' as const,
        mbtiType: 'INFJ' as const
      }
    };

    expect(buildSelfReadingCacheKey(input)).toBe(
      buildSelfReadingCacheKey(input)
    );
  });

  it('changes cache keys when the period or partner input changes', () => {
    const yearly2026 = resolveReadingPeriodContext(
      'BASIC',
      new Date('2026-03-06T12:00:00+09:00')
    );
    const yearly2027 = resolveReadingPeriodContext(
      'BASIC',
      new Date('2027-03-06T12:00:00+09:00')
    );

    const self2026 = buildSelfReadingCacheKey({
      readingType: 'SELF',
      subjectType: 'BASIC',
      period: {
        scope: yearly2026.scope,
        periodKey: yearly2026.periodKey
      },
      self: {
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'INFJ'
      }
    });

    const self2027 = buildSelfReadingCacheKey({
      readingType: 'SELF',
      subjectType: 'BASIC',
      period: {
        scope: yearly2027.scope,
        periodKey: yearly2027.periodKey
      },
      self: {
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'INFJ'
      }
    });

    const compatibilityA = buildCompatibilityReadingCacheKey({
      readingType: 'COMPATIBILITY',
      subjectType: 'LOVER',
      period: {
        scope: yearly2026.scope,
        periodKey: yearly2026.periodKey
      },
      self: {
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'INFJ'
      },
      partner: {
        birthDate: '1988-11-21',
        birthTime: '18:30',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'MALE',
        mbtiType: 'ENTP'
      }
    });

    const compatibilityB = buildCompatibilityReadingCacheKey({
      readingType: 'COMPATIBILITY',
      subjectType: 'LOVER',
      period: {
        scope: yearly2026.scope,
        periodKey: yearly2026.periodKey
      },
      self: {
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'INFJ'
      },
      partner: {
        birthDate: '1988-11-21',
        birthTime: '18:30',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'MALE',
        mbtiType: 'ISFP'
      }
    });

    expect(self2026).not.toBe(self2027);
    expect(compatibilityA).not.toBe(compatibilityB);
  });
});
