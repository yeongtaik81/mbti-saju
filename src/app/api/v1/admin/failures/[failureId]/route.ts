import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import { notFound, unauthorized, serverError } from '@/lib/utils/http';

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      failureId: string;
    }>;
  }
): Promise<NextResponse> {
  const adminAccount = await getAdminSessionAccount(request);
  if (!adminAccount) {
    return unauthorized();
  }

  try {
    const { failureId } = await context.params;

    const failure = await prisma.sajuGenerationFailure.findUnique({
      where: { id: failureId },
      select: {
        id: true,
        createdAt: true,
        readingType: true,
        subjectType: true,
        cacheKey: true,
        periodScope: true,
        periodKey: true,
        stage: true,
        reasonCode: true,
        reasonMessage: true,
        detailJson: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!failure) {
      return notFound('실패 로그를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      failure: {
        id: failure.id,
        createdAt: failure.createdAt.toISOString(),
        readingType: failure.readingType,
        subjectType: failure.subjectType,
        subjectLabel: getScenarioLabel(
          failure.readingType,
          failure.subjectType
        ),
        cacheKey: failure.cacheKey,
        periodScope: failure.periodScope,
        periodKey: failure.periodKey,
        stage: failure.stage,
        reasonCode: failure.reasonCode,
        reasonMessage: failure.reasonMessage,
        detailJson: failure.detailJson,
        user: {
          id: failure.user.id,
          email: failure.user.email,
          role: failure.user.role
        }
      }
    });
  } catch {
    return serverError();
  }
}
