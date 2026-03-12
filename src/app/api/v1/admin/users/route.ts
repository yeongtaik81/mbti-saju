import { NextRequest, NextResponse } from 'next/server';
import { MbtiType, Prisma, SignupSource, UserRole } from '@prisma/client';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(
  value: string | null,
  fallback: number
): number | null {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminAccount = await getAdminSessionAccount(request);
  if (!adminAccount) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const role = request.nextUrl.searchParams.get('role');
  const profile = request.nextUrl.searchParams.get('profile');
  const mbti = request.nextUrl.searchParams.get('mbti');
  const wallet = request.nextUrl.searchParams.get('wallet');
  const signupSource = request.nextUrl.searchParams.get('signupSource');
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(
    request.nextUrl.searchParams.get('pageSize'),
    PAGE_SIZE
  );

  if (!page || !pageSize || pageSize > MAX_PAGE_SIZE) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (role && !Object.values(UserRole).includes(role as UserRole)) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (profile && profile !== 'COMPLETE' && profile !== 'INCOMPLETE') {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (mbti && mbti !== 'COMPLETE' && mbti !== 'INCOMPLETE') {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (wallet && wallet !== 'POSITIVE' && wallet !== 'ZERO') {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (
    signupSource &&
    signupSource !== 'DIRECT' &&
    signupSource !== 'MBTI_FREE'
  ) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  const where: Prisma.UserWhereInput = {
    ...(q
      ? (() => {
          const qUpper = q.toUpperCase();
          const orFilters: Prisma.UserWhereInput[] = [
            {
              email: {
                contains: q,
                mode: 'insensitive'
              }
            },
            {
              profile: {
                is: {
                  name: {
                    contains: q,
                    mode: 'insensitive'
                  }
                }
              }
            }
          ];

          if (Object.values(MbtiType).includes(qUpper as MbtiType)) {
            orFilters.push({
              mbtiProfile: {
                is: {
                  mbtiType: qUpper as MbtiType
                }
              }
            });
          }

          return {
            OR: orFilters
          };
        })()
      : {}),
    ...(role ? { role: role as UserRole } : {}),
    ...(profile === 'COMPLETE' ? { profile: { isNot: null } } : {}),
    ...(profile === 'INCOMPLETE' ? { profile: null } : {}),
    ...(mbti === 'COMPLETE' ? { mbtiProfile: { isNot: null } } : {}),
    ...(mbti === 'INCOMPLETE' ? { mbtiProfile: null } : {}),
    ...(signupSource ? { signupSource: signupSource as SignupSource } : {}),
    ...(wallet === 'POSITIVE'
      ? {
          wallet: {
            is: {
              balance: { gt: 0 }
            }
          }
        }
      : {}),
    ...(wallet === 'ZERO'
      ? {
          OR: [
            { wallet: null },
            {
              wallet: {
                is: {
                  balance: { lte: 0 }
                }
              }
            }
          ]
        }
      : {})
  };

  try {
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          role: true,
          signupSource: true,
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
          },
          _count: {
            select: {
              readings: true,
              generationFailures: true,
              partners: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        name: user.profile?.name ?? null,
        hasProfile: Boolean(user.profile),
        mbtiType: user.mbtiProfile?.mbtiType ?? null,
        signupSource: user.signupSource,
        walletBalance: user.wallet?.balance ?? 0,
        stats: {
          readingCount: user._count.readings,
          failureCount: user._count.generationFailures,
          partnerCount: user._count.partners
        }
      }))
    });
  } catch {
    return serverError();
  }
}
