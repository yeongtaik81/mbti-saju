import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  evaluateMbtiTest,
  getPublicMbtiQuestions,
  MbtiTestType
} from '@/lib/mbti/test-engine';
import { mbtiTestSubmitSchema } from '@/lib/validators/mbti';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

const TEST_TYPE: MbtiTestType = 'FULL';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  return NextResponse.json({
    testType: TEST_TYPE,
    questions: getPublicMbtiQuestions(TEST_TYPE)
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const raw = (await request.json()) as unknown;
    const payload = mbtiTestSubmitSchema.parse(raw);
    const result = evaluateMbtiTest(TEST_TYPE, payload.answers);

    const saved = await prisma.mbtiProfile.upsert({
      where: { userId: sessionUser.userId },
      update: {
        mbtiType: result.mbtiType,
        sourceType: 'FULL_TEST',
        decidedAt: new Date()
      },
      create: {
        userId: sessionUser.userId,
        mbtiType: result.mbtiType,
        sourceType: 'FULL_TEST'
      }
    });

    return NextResponse.json({
      mbti: {
        mbtiType: saved.mbtiType,
        sourceType: saved.sourceType,
        decidedAt: saved.decidedAt.toISOString()
      },
      score: {
        totalQuestions: result.totalQuestions,
        answeredQuestions: result.answeredQuestions,
        poleScore: result.poleScore
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    if (error instanceof Error) {
      return badRequest(error.message);
    }

    return serverError();
  }
}
