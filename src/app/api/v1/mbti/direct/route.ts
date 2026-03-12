import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { mbtiDirectSchema } from '@/lib/validators/onboarding';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const raw = (await request.json()) as unknown;
    const payload = mbtiDirectSchema.parse(raw);

    const result = await prisma.mbtiProfile.upsert({
      where: { userId: sessionUser.userId },
      update: {
        mbtiType: payload.mbtiType,
        sourceType: payload.sourceType,
        decidedAt: new Date()
      },
      create: {
        userId: sessionUser.userId,
        mbtiType: payload.mbtiType,
        sourceType: payload.sourceType
      }
    });

    return NextResponse.json({
      mbti: {
        mbtiType: result.mbtiType,
        sourceType: result.sourceType,
        decidedAt: result.decidedAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}
