import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { unauthorized, serverError } from '@/lib/utils/http';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const mbti = await prisma.mbtiProfile.findUnique({
      where: { userId: sessionUser.userId }
    });

    return NextResponse.json({
      mbti: mbti
        ? {
            mbtiType: mbti.mbtiType,
            sourceType: mbti.sourceType,
            decidedAt: mbti.decidedAt.toISOString()
          }
        : null
    });
  } catch {
    return serverError();
  }
}
