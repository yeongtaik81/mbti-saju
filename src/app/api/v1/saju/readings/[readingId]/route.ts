import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { toFrontendMetadata } from '@/lib/saju/generator/metadata-transform';
import type { SajuInternalMetadata } from '@/lib/saju/generator';
import { notFound, serverError, unauthorized } from '@/lib/utils/http';

function parseCachedResult(resultJson: Prisma.JsonValue): {
  summary: string;
  sectionsJson: Prisma.JsonValue;
} | null {
  if (!resultJson || typeof resultJson !== 'object') {
    return null;
  }

  const target = resultJson as {
    summary?: unknown;
    sectionsJson?: unknown;
  };

  if (typeof target.summary !== 'string' || target.sectionsJson === undefined) {
    return null;
  }

  return {
    summary: target.summary,
    sectionsJson: target.sectionsJson as Prisma.JsonValue
  };
}

function parseCachedMetadata(
  resultJson: Prisma.JsonValue
): SajuInternalMetadata | null {
  if (!resultJson || typeof resultJson !== 'object') {
    return null;
  }

  const target = resultJson as {
    metadata?: unknown;
  };

  if (!target.metadata || typeof target.metadata !== 'object') {
    return null;
  }

  return target.metadata as SajuInternalMetadata;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      readingId: string;
    }>;
  }
): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const params = await context.params;

    const reading = await prisma.sajuReading.findFirst({
      where: {
        id: params.readingId,
        userId: sessionUser.userId
      },
      include: {
        firstPartner: {
          select: {
            id: true,
            name: true,
            mbtiType: true
          }
        },
        partner: {
          select: {
            id: true,
            name: true,
            mbtiType: true
          }
        },
        result: true,
        cache: {
          select: {
            resultJson: true,
            metadataJson: true,
            ruleVersion: true,
            templateVersion: true,
            promptVersion: true,
            modelVersion: true
          }
        }
      }
    });

    if (!reading) {
      return notFound('사주 결과를 찾을 수 없습니다.');
    }

    const cached = reading.cache
      ? parseCachedResult(reading.cache.resultJson)
      : null;
    const cachedMetadata = reading.cache?.metadataJson
      ? (reading.cache.metadataJson as SajuInternalMetadata)
      : reading.cache
        ? parseCachedMetadata(reading.cache.resultJson)
        : null;
    const sajuData = toFrontendMetadata(cachedMetadata);
    const firstProfile = reading.firstPartner
      ? {
          source: 'PARTNER' as const,
          id: reading.firstPartner.id,
          name: reading.firstPartner.name,
          mbtiType: reading.firstPartner.mbtiType
        }
      : {
          source: 'SELF' as const,
          id: null,
          name: '내 정보',
          mbtiType: null
        };
    const secondProfile =
      reading.readingType === 'COMPATIBILITY'
        ? reading.partner
          ? {
              source: 'PARTNER' as const,
              id: reading.partner.id,
              name: reading.partner.name,
              mbtiType: reading.partner.mbtiType
            }
          : {
              source: 'SELF' as const,
              id: null,
              name: '내 정보',
              mbtiType: null
            }
        : null;

    return NextResponse.json({
      reading: {
        id: reading.id,
        readingType: reading.readingType,
        subjectType: reading.subjectType,
        chargeStatus: reading.chargeStatus,
        itemCost: reading.itemCost,
        cacheHit: reading.cacheHit,
        cacheKey: reading.cacheKey,
        createdAt: reading.createdAt.toISOString(),
        targetLabel:
          reading.readingType === 'SELF'
            ? firstProfile.name
            : `${firstProfile.name} · ${secondProfile?.name ?? '내 정보'}`,
        firstProfile,
        secondProfile,
        partner: reading.partner
          ? {
              id: reading.partner.id,
              name: reading.partner.name,
              mbtiType: reading.partner.mbtiType
            }
          : null,
        sajuData,
        summary: reading.result?.summary ?? cached?.summary ?? null,
        sectionsJson:
          reading.result?.sectionsJson ?? cached?.sectionsJson ?? null,
        versions: reading.cache
          ? {
              ruleVersion: reading.cache.ruleVersion,
              templateVersion: reading.cache.templateVersion,
              promptVersion: reading.cache.promptVersion,
              modelVersion: reading.cache.modelVersion
            }
          : null
      }
    });
  } catch {
    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      readingId: string;
    }>;
  }
): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const params = await context.params;

    const deleted = await prisma.sajuReading.deleteMany({
      where: {
        id: params.readingId,
        userId: sessionUser.userId
      }
    });

    if (deleted.count === 0) {
      return notFound('삭제할 사주 결과를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true
    });
  } catch {
    return serverError();
  }
}
