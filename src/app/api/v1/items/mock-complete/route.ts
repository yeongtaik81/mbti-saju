import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { mockCompleteSchema } from '@/lib/validators/item';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const raw = (await request.json()) as unknown;
    const payload = mockCompleteSchema.parse(raw);

    const duplicated = await prisma.mockPaymentTransaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: sessionUser.userId,
          idempotencyKey: payload.idempotencyKey
        }
      }
    });

    if (duplicated) {
      const wallet = await prisma.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      });

      return NextResponse.json({
        success: true,
        duplicate: true,
        idempotencyKey: payload.idempotencyKey,
        balance: wallet?.balance ?? 0
      });
    }

    const wallet = await prisma.$transaction(async (transaction) => {
      await transaction.mockPaymentTransaction.create({
        data: {
          userId: sessionUser.userId,
          idempotencyKey: payload.idempotencyKey,
          amount: payload.amount
        }
      });

      return transaction.sajuItemWallet.upsert({
        where: { userId: sessionUser.userId },
        update: {
          balance: {
            increment: payload.amount
          }
        },
        create: {
          userId: sessionUser.userId,
          balance: payload.amount
        }
      });
    });

    return NextResponse.json({
      success: true,
      duplicate: false,
      idempotencyKey: payload.idempotencyKey,
      balance: wallet.balance
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const wallet = await prisma.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      });

      return NextResponse.json({
        success: true,
        duplicate: true,
        balance: wallet?.balance ?? 0
      });
    }

    return serverError();
  }
}
