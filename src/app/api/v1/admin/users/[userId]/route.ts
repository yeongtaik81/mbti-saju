import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { getScenarioLabel } from '@/lib/saju/scenarios';
import { notFound, unauthorized, serverError } from '@/lib/utils/http';

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

export async function GET(
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: true,
        mbtiProfile: {
          select: {
            mbtiType: true,
            sourceType: true,
            updatedAt: true
          }
        },
        wallet: {
          select: {
            balance: true
          }
        },
        _count: {
          select: {
            partners: true,
            readings: true,
            generationFailures: true,
            mockPaymentTransactions: true
          }
        }
      }
    });

    if (!user) {
      return notFound('사용자를 찾을 수 없습니다.');
    }

    const [
      chargedReadingCount,
      recentReadings,
      recentFailures,
      recentPayments,
      recentWalletAdjustments
    ] = await Promise.all([
      prisma.sajuReading.count({
        where: {
          userId,
          chargeStatus: 'CHARGED'
        }
      }),
      prisma.sajuReading.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          chargeStatus: true,
          cacheHit: true,
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
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          readingType: true,
          subjectType: true,
          stage: true,
          reasonCode: true,
          reasonMessage: true
        }
      }),
      prisma.mockPaymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          createdAt: true
        }
      }),
      prisma.adminWalletAdjustment.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
      })
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        profile: user.profile
          ? {
              name: user.profile.name,
              birthDateTime: user.profile.birthDateTime.toISOString(),
              birthDate: user.profile.birthDate,
              birthTime: user.profile.birthTime,
              isBirthTimeUnknown: user.profile.isBirthTimeUnknown,
              birthCalendarType: user.profile.birthCalendarType,
              isLeapMonth: user.profile.isLeapMonth,
              birthCountryType: user.profile.birthCountryType,
              birthCountry: user.profile.birthCountry,
              birthPlace: user.profile.birthPlace,
              gender: user.profile.gender,
              updatedAt: user.profile.updatedAt.toISOString()
            }
          : null,
        mbtiProfile: user.mbtiProfile
          ? {
              mbtiType: user.mbtiProfile.mbtiType,
              sourceType: user.mbtiProfile.sourceType,
              updatedAt: user.mbtiProfile.updatedAt.toISOString()
            }
          : null,
        walletBalance: user.wallet?.balance ?? 0,
        stats: {
          partnerCount: user._count.partners,
          readingCount: user._count.readings,
          chargedReadingCount,
          failureCount: user._count.generationFailures,
          paymentCount: user._count.mockPaymentTransactions
        },
        recentReadings: recentReadings.map((reading) => ({
          id: reading.id,
          createdAt: reading.createdAt.toISOString(),
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
          createdAt: payment.createdAt.toISOString()
        })),
        recentWalletAdjustments: recentWalletAdjustments.map((adjustment) => ({
          id: adjustment.id,
          amount: adjustment.amount,
          balanceBefore: adjustment.balanceBefore,
          balanceAfter: adjustment.balanceAfter,
          reason: adjustment.reason,
          createdAt: adjustment.createdAt.toISOString(),
          adminEmail: adjustment.adminUser.email
        }))
      }
    });
  } catch {
    return serverError();
  }
}
