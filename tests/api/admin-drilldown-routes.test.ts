import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import { createSelfGenerationInput } from '../saju/fixtures';

const { prismaMock, getAdminSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn()
    },
    sajuReading: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    sajuGenerationFailure: {
      findMany: vi.fn()
    },
    mockPaymentTransaction: {
      findMany: vi.fn()
    },
    adminWalletAdjustment: {
      findMany: vi.fn()
    }
  },
  getAdminSessionAccountMock: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionAccount: getAdminSessionAccountMock
}));

import { GET as getAdminUserDetailRoute } from '@/app/api/v1/admin/users/[userId]/route';
import { GET as getAdminReadingDetailRoute } from '@/app/api/v1/admin/readings/[readingId]/route';

describe('admin drilldown routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for admin user detail when not authenticated as admin', async () => {
    getAdminSessionAccountMock.mockResolvedValue(null);

    const response = await getAdminUserDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/users/user-1'),
      {
        params: Promise.resolve({ userId: 'user-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns user detail for admins', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      createdAt: new Date('2026-03-10T09:00:00+09:00'),
      profile: {
        name: '사용자',
        birthDateTime: new Date('1984-03-05T11:00:00+09:00'),
        birthDate: '1984-03-05',
        birthTime: '11:00',
        isBirthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        birthCountryType: 'KOREA',
        birthCountry: null,
        birthPlace: '서울',
        gender: 'FEMALE',
        updatedAt: new Date('2026-03-10T09:10:00+09:00')
      },
      mbtiProfile: {
        mbtiType: 'INTP',
        sourceType: 'FULL_TEST',
        updatedAt: new Date('2026-03-10T09:20:00+09:00')
      },
      wallet: {
        balance: 3
      },
      _count: {
        partners: 2,
        readings: 5,
        generationFailures: 1,
        mockPaymentTransactions: 2
      }
    });
    prismaMock.sajuReading.count.mockResolvedValue(4);
    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        id: 'reading-1',
        createdAt: new Date('2026-03-10T10:00:00+09:00'),
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        chargeStatus: 'CHARGED',
        cacheHit: false,
        firstPartner: { name: '내 정보' },
        partner: { name: '팀장님' }
      }
    ]);
    prismaMock.sajuGenerationFailure.findMany.mockResolvedValue([
      {
        id: 'failure-1',
        createdAt: new Date('2026-03-10T11:00:00+09:00'),
        readingType: 'SELF',
        subjectType: 'SELF_YEARLY_FORTUNE',
        stage: 'LLM_RENDER',
        reasonCode: 'LLM_RENDER_FAILED',
        reasonMessage: 'render failed'
      }
    ]);
    prismaMock.mockPaymentTransaction.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        amount: 1,
        createdAt: new Date('2026-03-10T12:00:00+09:00')
      }
    ]);
    prismaMock.adminWalletAdjustment.findMany.mockResolvedValue([
      {
        id: 'adjustment-1',
        amount: 1,
        balanceBefore: 2,
        balanceAfter: 3,
        reason: '운영 보정',
        createdAt: new Date('2026-03-10T12:30:00+09:00'),
        adminUser: {
          email: 'admin@example.com'
        }
      }
    ]);

    const response = await getAdminUserDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/users/user-1'),
      {
        params: Promise.resolve({ userId: 'user-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      walletBalance: 3,
      stats: {
        partnerCount: 2,
        readingCount: 5,
        chargedReadingCount: 4,
        failureCount: 1,
        paymentCount: 2
      }
    });
    expect(json.user.recentReadings[0]).toMatchObject({
      id: 'reading-1',
      subjectLabel: '상사와 궁합',
      targetLabel: '내 정보 · 팀장님'
    });
    expect(json.user.recentWalletAdjustments[0]).toMatchObject({
      id: 'adjustment-1',
      amount: 1,
      balanceBefore: 2,
      balanceAfter: 3,
      reason: '운영 보정',
      adminEmail: 'admin@example.com'
    });
  });

  it('returns admin reading detail for admins', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH'),
      'rule-only'
    );

    prismaMock.sajuReading.findUnique.mockResolvedValue({
      id: 'reading-1',
      readingType: 'SELF',
      subjectType: 'SELF_WEALTH_GENERAL',
      chargeStatus: 'CHARGED',
      itemCost: 1,
      cacheHit: true,
      cacheKey: 'cache-1',
      createdAt: new Date('2026-03-06T12:00:00+09:00'),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER'
      },
      firstPartner: null,
      partner: null,
      result: null,
      cache: {
        resultJson: {
          summary: 'cached summary',
          sectionsJson: {
            overview: 'cached overview',
            coreSignal: 'cached core'
          }
        },
        metadataJson: draft.internalMetadata,
        ruleVersion: 'rule-v1',
        templateVersion: 'template-v1',
        promptVersion: 'prompt-v1',
        modelVersion: 'model-v1'
      }
    });

    const response = await getAdminReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/readings/reading-1'),
      {
        params: Promise.resolve({ readingId: 'reading-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reading).toEqual(
      expect.objectContaining({
        id: 'reading-1',
        subjectType: 'SELF_WEALTH_GENERAL',
        targetLabel: '내 정보',
        summary: 'cached summary',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER'
        },
        sajuData: expect.objectContaining({
          user: expect.objectContaining({
            pillars: expect.objectContaining({
              yearString: expect.any(String)
            })
          })
        })
      })
    );
  });
});
