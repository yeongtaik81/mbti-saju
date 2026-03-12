import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getAdminSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn()
    },
    sajuItemWallet: {
      upsert: vi.fn()
    },
    adminWalletAdjustment: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  },
  getAdminSessionAccountMock: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionAccount: getAdminSessionAccountMock
}));

import { POST as postAdminWalletAdjustmentRoute } from '@/app/api/v1/admin/users/[userId]/wallet-adjustments/route';

describe('admin wallet adjustments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated as admin', async () => {
    getAdminSessionAccountMock.mockResolvedValue(null);

    const response = await postAdminWalletAdjustmentRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/users/user-1/wallet-adjustments',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'CHARGE',
            amount: 1,
            reason: '운영 보정'
          })
        }
      ),
      {
        params: Promise.resolve({ userId: 'user-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when deduction would make balance negative', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      wallet: {
        balance: 0
      }
    });

    const response = await postAdminWalletAdjustmentRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/users/user-1/wallet-adjustments',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'DEDUCT',
            amount: 1,
            reason: '잘못 지급된 복 회수'
          })
        }
      ),
      {
        params: Promise.resolve({ userId: 'user-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('차감할 복이 부족합니다.');
  });

  it('creates charge adjustment and returns updated balance', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      wallet: {
        balance: 2
      }
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock as never)
    );
    prismaMock.sajuItemWallet.upsert.mockResolvedValue({
      balance: 4
    });
    prismaMock.adminWalletAdjustment.create.mockResolvedValue({
      id: 'adjustment-1',
      amount: 2,
      balanceBefore: 2,
      balanceAfter: 4,
      reason: '이벤트 보상',
      createdAt: new Date('2026-03-10T13:00:00+09:00'),
      adminUser: {
        email: 'admin@example.com'
      }
    });

    const response = await postAdminWalletAdjustmentRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/users/user-1/wallet-adjustments',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'CHARGE',
            amount: 2,
            reason: '이벤트 보상'
          })
        }
      ),
      {
        params: Promise.resolve({ userId: 'user-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      balance: 4,
      adjustment: {
        id: 'adjustment-1',
        amount: 2,
        balanceBefore: 2,
        balanceAfter: 4,
        reason: '이벤트 보상',
        adminEmail: 'admin@example.com'
      }
    });
  });
});
