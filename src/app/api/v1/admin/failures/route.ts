import { GenerationFailureStage, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

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
  const adminAccount = await getAdminSessionAccount(request);
  if (!adminAccount) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const stage = request.nextUrl.searchParams.get('stage');
  const readingType = request.nextUrl.searchParams.get('readingType');
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(
    request.nextUrl.searchParams.get('pageSize'),
    PAGE_SIZE
  );

  if (!page || !pageSize || pageSize > MAX_PAGE_SIZE) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (
    stage &&
    !Object.values(GenerationFailureStage).includes(
      stage as GenerationFailureStage
    )
  ) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (
    readingType &&
    readingType !== 'SELF' &&
    readingType !== 'COMPATIBILITY'
  ) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  const readingTypeFilter =
    readingType === 'SELF' || readingType === 'COMPATIBILITY'
      ? readingType
      : undefined;

  const where: Prisma.SajuGenerationFailureWhereInput = {
    ...(stage ? { stage: stage as GenerationFailureStage } : {}),
    ...(readingTypeFilter ? { readingType: readingTypeFilter } : {}),
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
              reasonCode: {
                contains: q,
                mode: 'insensitive'
              }
            },
            {
              reasonMessage: {
                contains: q,
                mode: 'insensitive'
              }
            }
          ]
        }
      : {})
  };

  try {
    const [totalCount, failures] = await Promise.all([
      prisma.sajuGenerationFailure.count({ where }),
      prisma.sajuGenerationFailure.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          stage: true,
          reasonCode: true,
          reasonMessage: true,
          cacheKey: true,
          user: {
            select: {
              id: true,
              email: true
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
      failures: failures.map((failure) => ({
        id: failure.id,
        createdAt: failure.createdAt.toISOString(),
        readingType: failure.readingType,
        subjectType: failure.subjectType,
        subjectLabel: getScenarioLabel(
          failure.readingType,
          failure.subjectType
        ),
        stage: failure.stage,
        reasonCode: failure.reasonCode,
        reasonMessage: failure.reasonMessage,
        cacheKey: failure.cacheKey,
        user: {
          id: failure.user.id,
          email: failure.user.email
        }
      }))
    });
  } catch {
    return serverError();
  }
}
