import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import {
  badRequest,
  forbidden,
  serverError,
  unauthorized
} from '@/lib/utils/http';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

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

function parsePositiveInt(
  value: string | null,
  fallback: number
): number | null {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionAccount = await getSessionAccount(request);
  if (!sessionAccount) {
    return unauthorized();
  }

  if (sessionAccount.role !== 'ADMIN') {
    return forbidden('관리자만 볼 수 있는 페이지입니다.');
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const readingType = request.nextUrl.searchParams.get('readingType');
  const chargeStatus = request.nextUrl.searchParams.get('chargeStatus');
  const cacheHit = request.nextUrl.searchParams.get('cacheHit');
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(
    request.nextUrl.searchParams.get('pageSize'),
    PAGE_SIZE
  );

  if (!page || !pageSize || pageSize > MAX_PAGE_SIZE) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (
    readingType &&
    readingType !== 'SELF' &&
    readingType !== 'COMPATIBILITY'
  ) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (
    chargeStatus &&
    chargeStatus !== 'CHARGED' &&
    chargeStatus !== 'SKIPPED_DUPLICATE'
  ) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (cacheHit && cacheHit !== 'true' && cacheHit !== 'false') {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  const readingTypeFilter =
    readingType === 'SELF' || readingType === 'COMPATIBILITY'
      ? readingType
      : undefined;
  const chargeStatusFilter =
    chargeStatus === 'CHARGED' || chargeStatus === 'SKIPPED_DUPLICATE'
      ? chargeStatus
      : undefined;

  const where: Prisma.SajuReadingWhereInput = {
    ...(readingTypeFilter ? { readingType: readingTypeFilter } : {}),
    ...(chargeStatusFilter ? { chargeStatus: chargeStatusFilter } : {}),
    ...(cacheHit ? { cacheHit: cacheHit === 'true' } : {}),
    ...(q
      ? {
          OR: [
            {
              user: {
                email: {
                  contains: q,
                  mode: 'insensitive'
                }
              }
            },
            {
              subjectType: {
                contains: q,
                mode: 'insensitive'
              }
            },
            {
              firstPartner: {
                is: {
                  name: {
                    contains: q,
                    mode: 'insensitive'
                  }
                }
              }
            },
            {
              partner: {
                is: {
                  name: {
                    contains: q,
                    mode: 'insensitive'
                  }
                }
              }
            }
          ]
        }
      : {})
  };

  try {
    const [totalCount, readings] = await Promise.all([
      prisma.sajuReading.count({ where }),
      prisma.sajuReading.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          chargeStatus: true,
          cacheHit: true,
          itemCost: true,
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
      })
    ]);

    return NextResponse.json({
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      readings: readings.map((reading) => ({
        id: reading.id,
        createdAt: reading.createdAt.toISOString(),
        readingType: reading.readingType,
        subjectType: reading.subjectType,
        subjectLabel: getScenarioLabel(
          reading.readingType,
          reading.subjectType
        ),
        chargeStatus: reading.chargeStatus,
        cacheHit: reading.cacheHit,
        itemCost: reading.itemCost,
        user: {
          id: reading.user.id,
          email: reading.user.email
        },
        targetLabel: toTargetLabel(reading)
      }))
    });
  } catch {
    return serverError();
  }
}
