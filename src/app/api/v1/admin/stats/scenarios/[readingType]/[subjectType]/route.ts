import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized
} from '@/lib/utils/http';

function toTargetLabel(reading: {
  readingType: 'SELF' | 'COMPATIBILITY';
  firstPartner: { name: string } | null;
  partner: { name: string } | null;
}): string {
  if (reading.readingType === 'SELF') {
    return reading.firstPartner?.name ?? '내 정보';
  }

  return `${reading.firstPartner?.name ?? '내 정보'} · ${reading.partner?.name ?? '내 정보'}`;
}

type Params = {
  params: Promise<{
    readingType: string;
    subjectType: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const sessionAccount = await getSessionAccount(request);
  if (!sessionAccount) {
    return unauthorized();
  }

  if (sessionAccount.role !== 'ADMIN') {
    return forbidden('관리자만 볼 수 있는 페이지입니다.');
  }

  const resolvedParams = await params;
  const readingType = resolvedParams.readingType;
  const subjectType = resolvedParams.subjectType;

  if (readingType !== 'SELF' && readingType !== 'COMPATIBILITY') {
    return badRequest('잘못된 읽기 유형입니다.');
  }

  const rawDays = request.nextUrl.searchParams.get('days');
  const periodDays =
    rawDays === '7' || rawDays === '14' || rawDays === '30' || rawDays === '90'
      ? Number.parseInt(rawDays, 10)
      : 14;

  try {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (periodDays - 1));

    const where = {
      readingType,
      subjectType
    } as const;

    const [
      totalReadingCount,
      totalChargedCount,
      totalDuplicateCount,
      totalCacheHitCount,
      totalFailureCount,
      periodReadingCount,
      periodChargedCount,
      periodDuplicateCount,
      periodCacheHitCount,
      periodFailureCount,
      recentReadings,
      recentFailures
    ] = await Promise.all([
      prisma.sajuReading.count({ where }),
      prisma.sajuReading.count({
        where: {
          ...where,
          chargeStatus: 'CHARGED'
        }
      }),
      prisma.sajuReading.count({
        where: {
          ...where,
          chargeStatus: 'SKIPPED_DUPLICATE'
        }
      }),
      prisma.sajuReading.count({
        where: {
          ...where,
          cacheHit: true
        }
      }),
      prisma.sajuGenerationFailure.count({ where }),
      prisma.sajuReading.count({
        where: {
          ...where,
          createdAt: { gte: periodStart }
        }
      }),
      prisma.sajuReading.count({
        where: {
          ...where,
          chargeStatus: 'CHARGED',
          createdAt: { gte: periodStart }
        }
      }),
      prisma.sajuReading.count({
        where: {
          ...where,
          chargeStatus: 'SKIPPED_DUPLICATE',
          createdAt: { gte: periodStart }
        }
      }),
      prisma.sajuReading.count({
        where: {
          ...where,
          cacheHit: true,
          createdAt: { gte: periodStart }
        }
      }),
      prisma.sajuGenerationFailure.count({
        where: {
          ...where,
          createdAt: { gte: periodStart }
        }
      }),
      prisma.sajuReading.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          chargeStatus: true,
          cacheHit: true,
          user: {
            select: {
              id: true,
              email: true
            }
          },
          firstPartner: {
            select: {
              name: true
            }
          },
          partner: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.sajuGenerationFailure.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          stage: true,
          reasonCode: true,
          reasonMessage: true,
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      })
    ]);

    if (totalReadingCount === 0 && totalFailureCount === 0) {
      return notFound('아직 이 시나리오 데이터가 없습니다.');
    }

    return NextResponse.json({
      readingType,
      subjectType,
      label: getScenarioLabel(readingType, subjectType),
      summary: {
        totalReadingCount,
        totalChargedCount,
        totalDuplicateCount,
        totalCacheHitCount,
        totalCacheReuseRate:
          totalReadingCount > 0
            ? Math.round((totalCacheHitCount / totalReadingCount) * 1000) / 10
            : 0,
        totalFailureCount
      },
      period: {
        days: periodDays,
        from: periodStart.toISOString(),
        to: now.toISOString(),
        readingCount: periodReadingCount,
        chargedCount: periodChargedCount,
        duplicateCount: periodDuplicateCount,
        cacheHitCount: periodCacheHitCount,
        cacheReuseRate:
          periodReadingCount > 0
            ? Math.round((periodCacheHitCount / periodReadingCount) * 1000) / 10
            : 0,
        failureCount: periodFailureCount
      },
      recentReadings: recentReadings.map((reading) => ({
        id: reading.id,
        createdAt: reading.createdAt.toISOString(),
        chargeStatus: reading.chargeStatus,
        cacheHit: reading.cacheHit,
        targetLabel: toTargetLabel({
          readingType,
          firstPartner: reading.firstPartner,
          partner: reading.partner
        }),
        user: reading.user
      })),
      recentFailures: recentFailures.map((failure) => ({
        id: failure.id,
        createdAt: failure.createdAt.toISOString(),
        stage: failure.stage,
        reasonCode: failure.reasonCode,
        reasonMessage: failure.reasonMessage,
        user: failure.user
      }))
    });
  } catch {
    return serverError();
  }
}
