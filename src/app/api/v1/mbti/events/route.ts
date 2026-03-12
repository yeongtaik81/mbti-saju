import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import {
  setMbtiVisitorCookie,
  MBTI_VISITOR_COOKIE_NAME
} from '@/lib/auth/cookie';
import { prisma } from '@/lib/db/prisma';
import { mbtiEngagementEventSchema } from '@/lib/validators/mbti';
import { badRequest, serverError } from '@/lib/utils/http';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await request.json()) as unknown;
    const payload = mbtiEngagementEventSchema.parse(raw);
    const sessionUser = await getSessionUser(request);
    const existingVisitorId = request.cookies.get(
      MBTI_VISITOR_COOKIE_NAME
    )?.value;
    const visitorId = existingVisitorId ?? randomUUID();

    await prisma.mbtiEngagementEvent.create({
      data: {
        userId: sessionUser?.userId ?? null,
        sessionId: visitorId,
        isAuthenticated: Boolean(sessionUser),
        eventType: payload.eventType,
        testType: payload.testType,
        mbtiType: payload.mbtiType,
        pagePath: payload.pagePath
      }
    });

    const response = NextResponse.json({ ok: true });

    if (!existingVisitorId) {
      return setMbtiVisitorCookie(response, visitorId);
    }

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}
