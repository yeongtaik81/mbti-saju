import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import { forbidden, serverError, unauthorized } from '@/lib/utils/http';

type DayStat = {
  key: string;
  label: string;
  users: number;
  readings: number;
  chargedReadings: number;
  duplicateReuses: number;
  cacheHits: number;
  failures: number;
  payments: number;
  paymentAmount: number;
  mbtiPageViews: number;
  mbtiResultViews: number;
  mbtiMiniResults: number;
  mbtiFullResults: number;
  mbtiSignups: number;
};

type MbtiEventRow = {
  eventType: 'PAGE_VIEW' | 'RESULT_VIEWED' | 'RESULT_SAVED';
  isAuthenticated: boolean;
  sessionId: string;
  userId: string | null;
  testType: 'MINI' | 'FULL' | null;
  createdAt: Date;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDayLabel(date: Date): string {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDayStats(days: number, now: Date): DayStat[] {
  const today = startOfDay(now);
  const stats: DayStat[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    stats.push({
      key: toDayKey(date),
      label: toDayLabel(date),
      users: 0,
      readings: 0,
      chargedReadings: 0,
      duplicateReuses: 0,
      cacheHits: 0,
      failures: 0,
      payments: 0,
      paymentAmount: 0,
      mbtiPageViews: 0,
      mbtiResultViews: 0,
      mbtiMiniResults: 0,
      mbtiFullResults: 0,
      mbtiSignups: 0
    });
  }

  return stats;
}

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildMbtiStats(events: MbtiEventRow[], signupCount: number) {
  const guestVisitors = new Set<string>();
  const memberVisitors = new Set<string>();
  const guestCompletions = new Set<string>();
  const memberCompletions = new Set<string>();
  let miniCompletions = 0;
  let fullCompletions = 0;
  let savedResults = 0;

  for (const event of events) {
    if (event.eventType === 'PAGE_VIEW') {
      if (event.isAuthenticated && event.userId) {
        memberVisitors.add(event.userId);
      } else {
        guestVisitors.add(event.sessionId);
      }
    }

    if (event.eventType === 'RESULT_VIEWED') {
      if (event.isAuthenticated && event.userId) {
        memberCompletions.add(event.userId);
      } else {
        guestCompletions.add(event.sessionId);
      }

      if (event.testType === 'MINI') {
        miniCompletions += 1;
      }

      if (event.testType === 'FULL') {
        fullCompletions += 1;
      }
    }

    if (event.eventType === 'RESULT_SAVED') {
      savedResults += 1;
    }
  }

  const dropOffCount = Math.max(guestCompletions.size - signupCount, 0);

  return {
    guestVisitors: guestVisitors.size,
    memberVisitors: memberVisitors.size,
    guestCompletions: guestCompletions.size,
    memberCompletions: memberCompletions.size,
    miniCompletions,
    fullCompletions,
    savedResults,
    signupCount,
    dropOffCount,
    dropOffRate:
      guestCompletions.size > 0
        ? roundRate((dropOffCount / guestCompletions.size) * 100)
        : 0,
    signupConversionRate:
      guestCompletions.size > 0
        ? roundRate((signupCount / guestCompletions.size) * 100)
        : 0
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionAccount = await getSessionAccount(request);
  if (!sessionAccount) {
    return unauthorized();
  }

  if (sessionAccount.role !== 'ADMIN') {
    return forbidden('관리자만 볼 수 있는 페이지입니다.');
  }

  try {
    const now = new Date();
    const rawDays = request.nextUrl.searchParams.get('days');
    const periodDays =
      rawDays === '7' ||
      rawDays === '14' ||
      rawDays === '30' ||
      rawDays === '90'
        ? Number.parseInt(rawDays, 10)
        : 14;
    const today = startOfDay(now);
    const periodStart = new Date(today);
    periodStart.setDate(today.getDate() - (periodDays - 1));

    const [
      userCount,
      onboardedCount,
      mbtiCompletedCount,
      mbtiFreeSignupCount,
      readingCount,
      chargedReadingCount,
      duplicateReuseCount,
      cacheHitCount,
      failureCount,
      paymentCount,
      mbtiEvents,
      recentMbtiEvents,
      recentMbtiFreeSignups,
      recentUsers,
      recentReadings,
      recentFailures,
      recentPayments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userProfile.count(),
      prisma.mbtiProfile.count(),
      prisma.user.count({
        where: {
          signupSource: 'MBTI_FREE'
        }
      }),
      prisma.sajuReading.count(),
      prisma.sajuReading.count({
        where: {
          chargeStatus: 'CHARGED'
        }
      }),
      prisma.sajuReading.count({
        where: {
          chargeStatus: 'SKIPPED_DUPLICATE'
        }
      }),
      prisma.sajuReading.count({
        where: {
          cacheHit: true
        }
      }),
      prisma.sajuGenerationFailure.count(),
      prisma.mockPaymentTransaction.count(),
      prisma.mbtiEngagementEvent.findMany({
        select: {
          eventType: true,
          isAuthenticated: true,
          sessionId: true,
          userId: true,
          testType: true,
          createdAt: true
        }
      }),
      prisma.mbtiEngagementEvent.findMany({
        where: {
          createdAt: { gte: periodStart }
        },
        select: {
          eventType: true,
          isAuthenticated: true,
          sessionId: true,
          userId: true,
          testType: true,
          createdAt: true
        }
      }),
      prisma.user.findMany({
        where: {
          signupSource: 'MBTI_FREE',
          createdAt: { gte: periodStart }
        },
        select: {
          createdAt: true
        }
      }),
      prisma.user.findMany({
        where: {
          createdAt: { gte: periodStart }
        },
        select: {
          createdAt: true
        }
      }),
      prisma.sajuReading.findMany({
        where: {
          createdAt: { gte: periodStart }
        },
        select: {
          createdAt: true,
          readingType: true,
          subjectType: true,
          chargeStatus: true,
          cacheHit: true
        }
      }),
      prisma.sajuGenerationFailure.findMany({
        where: {
          createdAt: { gte: periodStart }
        },
        select: {
          createdAt: true,
          readingType: true,
          subjectType: true,
          stage: true
        }
      }),
      prisma.mockPaymentTransaction.findMany({
        where: {
          createdAt: { gte: periodStart }
        },
        select: {
          createdAt: true,
          amount: true
        }
      })
    ]);

    const dayStats = buildDayStats(periodDays, now);
    const dayMap = new Map(dayStats.map((entry) => [entry.key, entry]));

    for (const user of recentUsers) {
      const day = dayMap.get(toDayKey(user.createdAt));
      if (day) {
        day.users += 1;
      }
    }

    const topScenarioMap = new Map<
      string,
      {
        readingType: 'SELF' | 'COMPATIBILITY';
        subjectType: string;
        count: number;
      }
    >();

    const readingTypeCounts = {
      SELF: 0,
      COMPATIBILITY: 0
    };

    const failureStageMap = new Map<string, number>();

    for (const reading of recentReadings) {
      const day = dayMap.get(toDayKey(reading.createdAt));
      if (day) {
        day.readings += 1;
        if (reading.chargeStatus === 'CHARGED') {
          day.chargedReadings += 1;
        } else {
          day.duplicateReuses += 1;
        }
        if (reading.cacheHit) {
          day.cacheHits += 1;
        }
      }

      readingTypeCounts[reading.readingType] += 1;

      const scenarioKey = `${reading.readingType}:${reading.subjectType}`;
      const currentScenario = topScenarioMap.get(scenarioKey);
      if (currentScenario) {
        currentScenario.count += 1;
      } else {
        topScenarioMap.set(scenarioKey, {
          readingType: reading.readingType,
          subjectType: reading.subjectType,
          count: 1
        });
      }
    }

    for (const failure of recentFailures) {
      const day = dayMap.get(toDayKey(failure.createdAt));
      if (day) {
        day.failures += 1;
      }
      failureStageMap.set(
        failure.stage,
        (failureStageMap.get(failure.stage) ?? 0) + 1
      );
    }

    for (const payment of recentPayments) {
      const day = dayMap.get(toDayKey(payment.createdAt));
      if (day) {
        day.payments += 1;
        day.paymentAmount += payment.amount;
      }
    }

    for (const event of recentMbtiEvents) {
      const day = dayMap.get(toDayKey(event.createdAt));
      if (!day) {
        continue;
      }

      if (event.eventType === 'PAGE_VIEW') {
        day.mbtiPageViews += 1;
      }

      if (event.eventType === 'RESULT_VIEWED') {
        day.mbtiResultViews += 1;
        if (event.testType === 'MINI') {
          day.mbtiMiniResults += 1;
        }
        if (event.testType === 'FULL') {
          day.mbtiFullResults += 1;
        }
      }
    }

    for (const signup of recentMbtiFreeSignups) {
      const day = dayMap.get(toDayKey(signup.createdAt));
      if (day) {
        day.mbtiSignups += 1;
      }
    }

    const topScenarios = Array.from(topScenarioMap.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 10)
      .map((item) => ({
        readingType: item.readingType,
        subjectType: item.subjectType,
        label: getScenarioLabel(item.readingType, item.subjectType),
        count: item.count
      }));

    const failureStages = Array.from(failureStageMap.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([stage, count]) => ({
        stage,
        count
      }));

    const recentReadingCount = recentReadings.length;
    const recentCacheHitCount = recentReadings.filter(
      (reading) => reading.cacheHit
    ).length;
    const mbtiSummary = buildMbtiStats(mbtiEvents, mbtiFreeSignupCount);
    const mbtiPeriod = buildMbtiStats(
      recentMbtiEvents,
      recentMbtiFreeSignups.length
    );

    return NextResponse.json({
      summary: {
        userCount,
        onboardedCount,
        mbtiCompletedCount,
        mbtiFreeSignupCount,
        readingCount,
        chargedReadingCount,
        duplicateReuseCount,
        cacheHitCount,
        cacheReuseRate:
          readingCount > 0
            ? roundRate((cacheHitCount / readingCount) * 100)
            : 0,
        failureCount,
        paymentCount
      },
      mbti: {
        summary: mbtiSummary,
        period: {
          days: periodDays,
          ...mbtiPeriod
        }
      },
      period: {
        days: periodDays,
        from: periodStart.toISOString(),
        to: now.toISOString(),
        readingCount: recentReadingCount,
        cacheHitCount: recentCacheHitCount,
        cacheReuseRate:
          recentReadingCount > 0
            ? roundRate((recentCacheHitCount / recentReadingCount) * 100)
            : 0
      },
      mixes: {
        readingTypes: [
          { key: 'SELF', label: '사주', count: readingTypeCounts.SELF },
          {
            key: 'COMPATIBILITY',
            label: '궁합',
            count: readingTypeCounts.COMPATIBILITY
          }
        ],
        chargeStatuses: [
          { key: 'CHARGED', label: '복 차감', count: chargedReadingCount },
          {
            key: 'SKIPPED_DUPLICATE',
            label: '중복 재사용',
            count: duplicateReuseCount
          }
        ],
        failureStages
      },
      topScenarios,
      daily: dayStats
    });
  } catch {
    return serverError();
  }
}
