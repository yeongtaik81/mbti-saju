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
    const [wallet, history] = await Promise.all([
      prisma.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      }),
      prisma.mockPaymentTransaction.findMany({
        where: { userId: sessionUser.userId },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    return NextResponse.json({
      balance: wallet?.balance ?? 0,
      history: history.map((item) => ({
        id: item.id,
        amount: item.amount,
        createdAt: item.createdAt.toISOString()
      }))
    });
  } catch {
    return serverError();
  }
}
