import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { setAccessTokenCookie } from '@/lib/auth/cookie';
import { signInRequestSchema } from '@/lib/validators/auth';
import { verifyPassword } from '@/lib/auth/password';
import { issueAccessToken } from '@/lib/auth/jwt';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await request.json()) as unknown;
    const payload = signInRequestSchema.parse(raw);
    const email = payload.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        credential: true
      }
    });

    if (!user?.credential) {
      return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatched = await verifyPassword(
      payload.password,
      user.credential.passwordHash
    );
    if (!passwordMatched) {
      return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const token = await issueAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      }
    });

    return setAccessTokenCookie(response, token);
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}
