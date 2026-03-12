import { MbtiTestMode, MbtiType, Prisma, SignupSource } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAccount } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { badRequest, serverError, unauthorized } from '@/lib/utils/http';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DAY_FILTER_VALUES = ['7', '14', '30', '90'] as const;

const MBTI_FOCUS_VALUES = [
  'ALL_ACTIVITY',
  'GUEST_VISITORS',
  'MEMBER_VISITORS',
  'GUEST_COMPLETIONS',
  'MEMBER_COMPLETIONS',
  'MINI_RESULTS',
  'FULL_RESULTS',
  'SIGNUPS'
] as const;

type MbtiFocus = (typeof MBTI_FOCUS_VALUES)[number];

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

function getFocusLabel(focus: MbtiFocus): string {
  switch (focus) {
    case 'GUEST_VISITORS':
      return '비로그인 접속';
    case 'MEMBER_VISITORS':
      return '로그인 접속';
    case 'GUEST_COMPLETIONS':
      return '비로그인 검사 완료';
    case 'MEMBER_COMPLETIONS':
      return '로그인 검사 완료';
    case 'MINI_RESULTS':
      return '미니 테스트 결과';
    case 'FULL_RESULTS':
      return '정식 테스트 결과';
    case 'SIGNUPS':
      return '무료 MBTI 가입';
    case 'ALL_ACTIVITY':
    default:
      return '전체 MBTI 활동';
  }
}

function getEventLabel(event: {
  eventType: 'PAGE_VIEW' | 'RESULT_VIEWED' | 'RESULT_SAVED';
  isAuthenticated: boolean;
  testType: 'MINI' | 'FULL' | null;
}): string {
  if (event.eventType === 'PAGE_VIEW') {
    return event.isAuthenticated ? '로그인 접속' : '비로그인 접속';
  }

  if (event.eventType === 'RESULT_VIEWED') {
    if (event.testType === 'MINI') {
      return '미니 테스트 결과 확인';
    }
    if (event.testType === 'FULL') {
      return '정식 테스트 결과 확인';
    }
    return '검사 결과 확인';
  }

  return '결과 저장';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminAccount = await getAdminSessionAccount(request);
  if (!adminAccount) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const focus = (request.nextUrl.searchParams.get('focus') ??
    'ALL_ACTIVITY') as MbtiFocus;
  const rawDays = request.nextUrl.searchParams.get('days');
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(
    request.nextUrl.searchParams.get('pageSize'),
    PAGE_SIZE
  );
  const periodDays = DAY_FILTER_VALUES.includes(
    (rawDays ?? '14') as (typeof DAY_FILTER_VALUES)[number]
  )
    ? Number.parseInt(rawDays ?? '14', 10)
    : null;

  if (!page || !pageSize || pageSize > MAX_PAGE_SIZE || !periodDays) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  if (!MBTI_FOCUS_VALUES.includes(focus)) {
    return badRequest('입력값 검증에 실패했습니다.');
  }

  try {
    const periodStart = new Date();
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (periodDays - 1));

    if (focus === 'SIGNUPS') {
      const where: Prisma.UserWhereInput = {
        signupSource: SignupSource.MBTI_FREE,
        createdAt: {
          gte: periodStart
        },
        ...(q
          ? {
              OR: [
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
                },
                ...(Object.values(MbtiType).includes(
                  q.toUpperCase() as MbtiType
                )
                  ? [
                      {
                        mbtiProfile: {
                          is: {
                            mbtiType: q.toUpperCase() as MbtiType
                          }
                        }
                      }
                    ]
                  : [])
              ]
            }
          : {})
      };

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
            createdAt: true,
            profile: {
              select: {
                name: true
              }
            },
            mbtiProfile: {
              select: {
                mbtiType: true,
                sourceType: true
              }
            }
          }
        })
      ]);

      return NextResponse.json({
        focus,
        focusLabel: getFocusLabel(focus),
        days: periodDays,
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        entries: users.map((user) => ({
          kind: 'SIGNUP',
          id: user.id,
          createdAt: user.createdAt.toISOString(),
          email: user.email,
          userId: user.id,
          name: user.profile?.name ?? null,
          mbtiType: user.mbtiProfile?.mbtiType ?? null,
          sourceType: user.mbtiProfile?.sourceType ?? null,
          label: '무료 MBTI 가입'
        }))
      });
    }

    const where: Prisma.MbtiEngagementEventWhereInput = {
      createdAt: {
        gte: periodStart
      },
      ...(q
        ? {
            OR: [
              {
                user: {
                  is: {
                    email: {
                      contains: q,
                      mode: 'insensitive'
                    }
                  }
                }
              },
              ...(Object.values(MbtiType).includes(q.toUpperCase() as MbtiType)
                ? [
                    {
                      mbtiType: q.toUpperCase() as MbtiType
                    }
                  ]
                : [])
            ]
          }
        : {})
    };

    switch (focus) {
      case 'GUEST_VISITORS':
        where.eventType = 'PAGE_VIEW';
        where.isAuthenticated = false;
        break;
      case 'MEMBER_VISITORS':
        where.eventType = 'PAGE_VIEW';
        where.isAuthenticated = true;
        break;
      case 'GUEST_COMPLETIONS':
        where.eventType = 'RESULT_VIEWED';
        where.isAuthenticated = false;
        break;
      case 'MEMBER_COMPLETIONS':
        where.eventType = 'RESULT_VIEWED';
        where.isAuthenticated = true;
        break;
      case 'MINI_RESULTS':
        where.eventType = 'RESULT_VIEWED';
        where.testType = MbtiTestMode.MINI;
        break;
      case 'FULL_RESULTS':
        where.eventType = 'RESULT_VIEWED';
        where.testType = MbtiTestMode.FULL;
        break;
      case 'ALL_ACTIVITY':
      default:
        break;
    }

    const [totalCount, events] = await Promise.all([
      prisma.mbtiEngagementEvent.count({ where }),
      prisma.mbtiEngagementEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          eventType: true,
          isAuthenticated: true,
          sessionId: true,
          testType: true,
          mbtiType: true,
          pagePath: true,
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      focus,
      focusLabel: getFocusLabel(focus),
      days: periodDays,
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      entries: events.map((event) => ({
        kind: 'EVENT',
        id: event.id,
        createdAt: event.createdAt.toISOString(),
        email: event.user?.email ?? null,
        userId: event.user?.id ?? null,
        sessionId: event.sessionId,
        isAuthenticated: event.isAuthenticated,
        eventType: event.eventType,
        testType: event.testType,
        mbtiType: event.mbtiType,
        pagePath: event.pagePath,
        label: getEventLabel(event)
      }))
    });
  } catch {
    return serverError();
  }
}
