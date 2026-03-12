import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    userProfile: {
      count: vi.fn()
    },
    mbtiProfile: {
      count: vi.fn()
    },
    mbtiEngagementEvent: {
      findMany: vi.fn()
    },
    sajuReading: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    sajuGenerationFailure: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    mockPaymentTransaction: {
      count: vi.fn(),
      findMany: vi.fn()
    }
  },
  getSessionAccountMock: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/admin', () => ({
  getSessionAccount: getSessionAccountMock
}));

import { GET } from '@/app/api/v1/admin/stats/route';

describe('GET /api/v1/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    getSessionAccountMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/stats')
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when the user is not an admin', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER'
    });

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/stats')
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('관리자만 볼 수 있는 페이지입니다.');
  });

  it('returns aggregated stats for admins', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.user.count.mockResolvedValueOnce(12).mockResolvedValueOnce(1);
    prismaMock.userProfile.count.mockResolvedValue(8);
    prismaMock.mbtiProfile.count.mockResolvedValue(7);
    prismaMock.sajuReading.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(17)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(10);
    prismaMock.sajuGenerationFailure.count.mockResolvedValue(4);
    prismaMock.mockPaymentTransaction.count.mockResolvedValue(9);
    prismaMock.mbtiEngagementEvent.findMany
      .mockResolvedValueOnce([
        {
          eventType: 'PAGE_VIEW',
          isAuthenticated: false,
          sessionId: 'anon-1',
          userId: null,
          testType: null,
          createdAt: new Date('2026-03-09T09:00:00+09:00')
        },
        {
          eventType: 'PAGE_VIEW',
          isAuthenticated: true,
          sessionId: 'session-2',
          userId: 'user-2',
          testType: null,
          createdAt: new Date('2026-03-09T10:00:00+09:00')
        },
        {
          eventType: 'RESULT_VIEWED',
          isAuthenticated: false,
          sessionId: 'anon-1',
          userId: null,
          testType: 'MINI',
          createdAt: new Date('2026-03-09T11:00:00+09:00')
        },
        {
          eventType: 'RESULT_VIEWED',
          isAuthenticated: true,
          sessionId: 'session-2',
          userId: 'user-2',
          testType: 'FULL',
          createdAt: new Date('2026-03-10T11:00:00+09:00')
        },
        {
          eventType: 'RESULT_SAVED',
          isAuthenticated: true,
          sessionId: 'session-2',
          userId: 'user-2',
          testType: 'FULL',
          createdAt: new Date('2026-03-10T11:10:00+09:00')
        }
      ])
      .mockResolvedValueOnce([
        {
          eventType: 'PAGE_VIEW',
          isAuthenticated: false,
          sessionId: 'anon-1',
          userId: null,
          testType: null,
          createdAt: new Date('2026-03-09T09:00:00+09:00')
        },
        {
          eventType: 'RESULT_VIEWED',
          isAuthenticated: false,
          sessionId: 'anon-1',
          userId: null,
          testType: 'MINI',
          createdAt: new Date('2026-03-09T11:00:00+09:00')
        }
      ]);

    prismaMock.user.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-09T10:00:00+09:00')
      }
    ]);
    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-09T11:00:00+09:00'),
        readingType: 'SELF',
        subjectType: 'SELF_YEARLY_FORTUNE',
        chargeStatus: 'CHARGED',
        cacheHit: false
      },
      {
        createdAt: new Date('2026-03-10T11:00:00+09:00'),
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        chargeStatus: 'SKIPPED_DUPLICATE',
        cacheHit: true
      }
    ]);
    prismaMock.sajuGenerationFailure.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-10T12:00:00+09:00'),
        readingType: 'SELF',
        subjectType: 'SELF_YEARLY_FORTUNE',
        stage: 'LLM_RENDER'
      }
    ]);
    prismaMock.mockPaymentTransaction.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-10T13:00:00+09:00'),
        amount: 2
      }
    ]);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/stats')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toEqual({
      userCount: 12,
      onboardedCount: 8,
      mbtiCompletedCount: 7,
      mbtiFreeSignupCount: 1,
      readingCount: 25,
      chargedReadingCount: 17,
      duplicateReuseCount: 8,
      cacheHitCount: 10,
      cacheReuseRate: 40,
      failureCount: 4,
      paymentCount: 9
    });
    expect(json.period).toEqual(
      expect.objectContaining({
        days: 14,
        readingCount: 2,
        cacheHitCount: 1,
        cacheReuseRate: 50
      })
    );
    expect(json.mbti).toEqual({
      summary: {
        guestVisitors: 1,
        memberVisitors: 1,
        guestCompletions: 1,
        memberCompletions: 1,
        miniCompletions: 1,
        fullCompletions: 1,
        savedResults: 1,
        signupCount: 1,
        dropOffCount: 0,
        dropOffRate: 0,
        signupConversionRate: 100
      },
      period: {
        days: 14,
        guestVisitors: 1,
        memberVisitors: 0,
        guestCompletions: 1,
        memberCompletions: 0,
        miniCompletions: 1,
        fullCompletions: 0,
        savedResults: 0,
        signupCount: 1,
        dropOffCount: 0,
        dropOffRate: 0,
        signupConversionRate: 100
      }
    });
    expect(json.mixes.readingTypes).toEqual([
      { key: 'SELF', label: '사주', count: 1 },
      { key: 'COMPATIBILITY', label: '궁합', count: 1 }
    ]);
    expect(json.mixes.failureStages).toEqual([
      { stage: 'LLM_RENDER', count: 1 }
    ]);
    expect(json.topScenarios).toEqual([
      {
        readingType: 'SELF',
        subjectType: 'SELF_YEARLY_FORTUNE',
        label: '올해 운',
        count: 1
      },
      {
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        label: '상사와 궁합',
        count: 1
      }
    ]);
    expect(json.daily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '03/09',
          users: 1,
          readings: 1,
          chargedReadings: 1,
          mbtiPageViews: 1,
          mbtiResultViews: 1,
          mbtiMiniResults: 1,
          mbtiFullResults: 0,
          mbtiSignups: 1
        }),
        expect.objectContaining({
          label: '03/10',
          readings: 1,
          failures: 1,
          payments: 1,
          paymentAmount: 2,
          cacheHits: 1,
          duplicateReuses: 1
        })
      ])
    );
  });
});
