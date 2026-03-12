import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import { forbidden, serverError, unauthorized } from '@/lib/utils/http';

function toTargetLabel(reading: {
  readingType: 'SELF' | 'COMPATIBILITY';
  firstPartner: { name: string } | null;
  partner: { name: string } | null;
}): string {
  if (reading.readingType === 'SELF') {
    return reading.firstPartner?.name ?? '내 정보';
  }

  return `${reading.firstPartner?.name ?? '내 정보'} · ${reading.partner?.name ?? '내 정보'}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionAccount = await getSessionAccount(request);
  if (!sessionAccount) {
    return unauthorized();
  }

  if (sessionAccount.role !== 'ADMIN') {
    return forbidden('관리자만 볼 수 있는 페이지입니다.');
  }

  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      userCount,
      adminCount,
      onboardedCount,
      mbtiCompletedCount,
      mbtiFreeSignupCount,
      readingCount,
      reading24hCount,
      chargedReadingCount,
      failure24hCount,
      positiveWalletCount,
      paymentCount,
      payment24hCount,
      recentUsers,
      recentReadings,
      recentFailures,
      recentPayments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.userProfile.count(),
      prisma.mbtiProfile.count(),
      prisma.user.count({
        where: {
          signupSource: 'MBTI_FREE'
        }
      }),
      prisma.sajuReading.count(),
      prisma.sajuReading.count({
        where: {
          createdAt: { gte: dayAgo }
        }
      }),
      prisma.sajuReading.count({
        where: {
          chargeStatus: 'CHARGED'
        }
      }),
      prisma.sajuGenerationFailure.count({
        where: {
          createdAt: { gte: dayAgo }
        }
      }),
      prisma.sajuItemWallet.count({
        where: {
          balance: { gt: 0 }
        }
      }),
      prisma.mockPaymentTransaction.count(),
      prisma.mockPaymentTransaction.count({
        where: {
          createdAt: { gte: dayAgo }
        }
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: {
            select: {
              name: true
            }
          },
          mbtiProfile: {
            select: {
              mbtiType: true
            }
          },
          wallet: {
            select: {
              balance: true
            }
          }
        }
      }),
      prisma.sajuReading.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          chargeStatus: true,
          cacheHit: true,
          user: {
            select: {
              email: true
            }
          },
          firstPartner: {
            select: {
              name: true
            }
          },
          partner: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.sajuGenerationFailure.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          stage: true,
          reasonCode: true,
          reasonMessage: true,
          user: {
            select: {
              email: true
            }
          }
        }
      }),
      prisma.mockPaymentTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          user: {
            select: {
              email: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      summary: {
        userCount,
        adminCount,
        onboardedCount,
        mbtiCompletedCount,
        mbtiFreeSignupCount,
        readingCount,
        reading24hCount,
        chargedReadingCount,
        failure24hCount,
        positiveWalletCount,
        paymentCount,
        payment24hCount
      },
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        name: user.profile?.name ?? null,
        hasProfile: Boolean(user.profile),
        mbtiType: user.mbtiProfile?.mbtiType ?? null,
        walletBalance: user.wallet?.balance ?? 0
      })),
      recentReadings: recentReadings.map((reading) => ({
        id: reading.id,
        createdAt: reading.createdAt.toISOString(),
        userEmail: reading.user.email,
        readingType: reading.readingType,
        subjectType: reading.subjectType,
        subjectLabel: getScenarioLabel(
          reading.readingType,
          reading.subjectType
        ),
        targetLabel: toTargetLabel(reading),
        chargeStatus: reading.chargeStatus,
        cacheHit: reading.cacheHit
      })),
      recentFailures: recentFailures.map((failure) => ({
        id: failure.id,
        createdAt: failure.createdAt.toISOString(),
        userEmail: failure.user.email,
        readingType: failure.readingType,
        subjectType: failure.subjectType,
        subjectLabel: getScenarioLabel(
          failure.readingType,
          failure.subjectType
        ),
        stage: failure.stage,
        reasonCode: failure.reasonCode,
        reasonMessage: failure.reasonMessage
      })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        createdAt: payment.createdAt.toISOString(),
        userEmail: payment.user.email
      }))
    });
  } catch {
    return serverError();
  }
}
