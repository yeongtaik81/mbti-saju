import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    sajuReading: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    sajuGenerationFailure: {
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

import { GET } from '@/app/api/v1/admin/stats/scenarios/[readingType]/[subjectType]/route';

describe('GET /api/v1/admin/stats/scenarios/[readingType]/[subjectType]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    getSessionAccountMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/stats/scenarios/SELF/SELF_YEARLY_FORTUNE'
      ),
      {
        params: Promise.resolve({
          readingType: 'SELF',
          subjectType: 'SELF_YEARLY_FORTUNE'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns drilldown stats for admins', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.sajuReading.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.sajuGenerationFailure.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        id: 'reading-1',
        createdAt: new Date('2026-03-10T10:00:00+09:00'),
        chargeStatus: 'CHARGED',
        cacheHit: false,
        user: {
          id: 'user-1',
          email: 'user@example.com'
        },
        firstPartner: {
          name: '내 정보'
        },
        partner: null
      }
    ]);
    prismaMock.sajuGenerationFailure.findMany.mockResolvedValue([
      {
        id: 'failure-1',
        createdAt: new Date('2026-03-10T11:00:00+09:00'),
        stage: 'LLM_RENDER',
        reasonCode: 'LLM_RENDER_FAILED',
        reasonMessage: 'render failed',
        user: {
          id: 'user-1',
          email: 'user@example.com'
        }
      }
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/stats/scenarios/SELF/SELF_YEARLY_FORTUNE?days=30'
      ),
      {
        params: Promise.resolve({
          readingType: 'SELF',
          subjectType: 'SELF_YEARLY_FORTUNE'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.label).toBe('올해 운');
    expect(json.summary).toEqual({
      totalReadingCount: 10,
      totalChargedCount: 7,
      totalDuplicateCount: 3,
      totalCacheHitCount: 4,
      totalCacheReuseRate: 40,
      totalFailureCount: 2
    });
    expect(json.period).toEqual(
      expect.objectContaining({
        days: 30,
        readingCount: 2,
        chargedCount: 1,
        duplicateCount: 1,
        cacheHitCount: 1,
        cacheReuseRate: 50,
        failureCount: 1
      })
    );
    expect(json.recentReadings[0]).toMatchObject({
      id: 'reading-1',
      targetLabel: '내 정보',
      user: {
        id: 'user-1',
        email: 'user@example.com'
      }
    });
    expect(json.recentFailures[0]).toMatchObject({
      id: 'failure-1',
      stage: 'LLM_RENDER',
      reasonCode: 'LLM_RENDER_FAILED'
    });
  });
});
