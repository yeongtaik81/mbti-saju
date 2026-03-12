import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { adminWalletAdjustmentSchema } from '@/lib/validators/admin';
import {
  badRequest,
  notFound,
  unauthorized,
  serverError
} from '@/lib/utils/http';

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      userId: string;
    }>;
  }
): Promise<NextResponse> {
  const adminAccount = await getAdminSessionAccount(request);
  if (!adminAccount) {
    return unauthorized();
  }

  try {
    const { userId } = await context.params;
    const raw = (await request.json()) as unknown;
    const payload = adminWalletAdjustmentSchema.parse(raw);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        wallet: {
          select: {
            balance: true
          }
        }
      }
    });

    if (!targetUser) {
      return notFound('사용자를 찾을 수 없습니다.');
    }

    const currentBalance = targetUser.wallet?.balance ?? 0;
    const delta =
      payload.action === 'CHARGE' ? payload.amount : -payload.amount;
    const nextBalance = currentBalance + delta;

    if (nextBalance < 0) {
      return badRequest('차감할 복이 부족합니다.');
    }

    const result = await prisma.$transaction(async (transaction) => {
      const wallet = await transaction.sajuItemWallet.upsert({
        where: { userId },
        update: {
          balance: nextBalance
        },
        create: {
          userId,
          balance: nextBalance
        }
      });

      const adjustment = await transaction.adminWalletAdjustment.create({
        data: {
          adminUserId: adminAccount.userId,
          targetUserId: userId,
          amount: delta,
          balanceBefore: currentBalance,
          balanceAfter: nextBalance,
          reason: payload.reason
        },
        select: {
          id: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reason: true,
          createdAt: true,
          adminUser: {
            select: {
              email: true
            }
          }
        }
      });

      return {
        wallet,
        adjustment
      };
    });

    return NextResponse.json({
      success: true,
      balance: result.wallet.balance,
      adjustment: {
        id: result.adjustment.id,
        amount: result.adjustment.amount,
        balanceBefore: result.adjustment.balanceBefore,
        balanceAfter: result.adjustment.balanceAfter,
        reason: result.adjustment.reason,
        createdAt: result.adjustment.createdAt.toISOString(),
        adminEmail: result.adjustment.adminUser.email
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return serverError();
    }

    return serverError();
  }
}
