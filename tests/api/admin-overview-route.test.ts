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
    sajuReading: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    sajuGenerationFailure: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    sajuItemWallet: {
      count: vi.fn()
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

import { GET } from '@/app/api/v1/admin/overview/route';

describe('GET /api/v1/admin/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    getSessionAccountMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/overview')
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
      new NextRequest('http://localhost:4000/api/v1/admin/overview')
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('관리자만 볼 수 있는 페이지입니다.');
  });

  it('returns aggregate admin overview data for admins', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.user.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prismaMock.userProfile.count.mockResolvedValue(8);
    prismaMock.mbtiProfile.count.mockResolvedValue(7);
    prismaMock.sajuReading.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(17);
    prismaMock.sajuGenerationFailure.count.mockResolvedValue(2);
    prismaMock.sajuItemWallet.count.mockResolvedValue(5);
    prismaMock.mockPaymentTransaction.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(3);

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        createdAt: new Date('2026-03-10T09:30:00+09:00'),
        profile: { name: '사용자' },
        mbtiProfile: { mbtiType: 'INTP' },
        wallet: { balance: 2 }
      }
    ]);

    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        id: 'reading-1',
        createdAt: new Date('2026-03-10T10:15:00+09:00'),
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        chargeStatus: 'CHARGED',
        cacheHit: false,
        user: { email: 'user@example.com' },
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
        reasonMessage: 'render failed',
        user: { email: 'user@example.com' }
      }
    ]);

    prismaMock.mockPaymentTransaction.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        amount: 1,
        createdAt: new Date('2026-03-10T12:00:00+09:00'),
        user: { email: 'user@example.com' }
      }
    ]);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/overview')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toEqual({
      userCount: 12,
      adminCount: 1,
      onboardedCount: 8,
      mbtiCompletedCount: 7,
      mbtiFreeSignupCount: 2,
      readingCount: 25,
      reading24hCount: 4,
      chargedReadingCount: 17,
      failure24hCount: 2,
      positiveWalletCount: 5,
      paymentCount: 9,
      payment24hCount: 3
    });
    expect(json.recentUsers[0]).toMatchObject({
      email: 'user@example.com',
      role: 'USER',
      name: '사용자',
      hasProfile: true,
      mbtiType: 'INTP',
      walletBalance: 2
    });
    expect(json.recentReadings[0]).toMatchObject({
      id: 'reading-1',
      userEmail: 'user@example.com',
      subjectLabel: '상사와 궁합',
      targetLabel: '내 정보 · 팀장님',
      chargeStatus: 'CHARGED',
      cacheHit: false
    });
    expect(json.recentFailures[0]).toMatchObject({
      id: 'failure-1',
      userEmail: 'user@example.com',
      stage: 'LLM_RENDER',
      reasonCode: 'LLM_RENDER_FAILED',
      subjectLabel: '올해 운'
    });
    expect(json.recentPayments[0]).toMatchObject({
      id: 'payment-1',
      amount: 1,
      userEmail: 'user@example.com'
    });
  });
});
