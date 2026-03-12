import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { setAccessTokenCookie } from '@/lib/auth/cookie';
import { signUpWithMbtiRequestSchema } from '@/lib/validators/auth';
import { hashPassword } from '@/lib/auth/password';
import { issueAccessToken } from '@/lib/auth/jwt';
import { badRequest, conflict, serverError } from '@/lib/utils/http';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await request.json()) as unknown;
    const payload = signUpWithMbtiRequestSchema.parse(raw);
    const email = payload.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return conflict('이미 가입된 이메일입니다.');
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        email,
        signupSource: payload.mbti ? 'MBTI_FREE' : 'DIRECT',
        credential: {
          create: {
            passwordHash
          }
        },
        wallet: {
          create: {
            balance: 0
          }
        },
        mbtiProfile: payload.mbti
          ? {
              create: {
                mbtiType: payload.mbti.mbtiType,
                sourceType: payload.mbti.sourceType
              }
            }
          : undefined
      }
    });

    const token = await issueAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email
        }
      },
      { status: 201 }
    );

    return setAccessTokenCookie(response, token);
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return conflict('이미 가입된 이메일입니다.');
    }

    return serverError();
  }
}
