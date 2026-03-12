import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getAdminSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      count: vi.fn(),
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

import { GET as getAdminUsersRoute } from '@/app/api/v1/admin/users/route';

describe('admin users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated as admin', async () => {
    getAdminSessionAccountMock.mockResolvedValue(null);

    const response = await getAdminUsersRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/users')
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns paginated users for admins', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.user.count.mockResolvedValue(1);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        signupSource: 'MBTI_FREE',
        createdAt: new Date('2026-03-10T09:00:00+09:00'),
        profile: {
          name: '사용자'
        },
        mbtiProfile: {
          mbtiType: 'INTP'
        },
        wallet: {
          balance: 2
        },
        _count: {
          readings: 3,
          generationFailures: 1,
          partners: 2
        }
      }
    ]);

    const response = await getAdminUsersRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/users?q=user&role=USER&profile=COMPLETE&wallet=POSITIVE&signupSource=MBTI_FREE'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      page: 1,
      totalCount: 1,
      users: [
        {
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          signupSource: 'MBTI_FREE',
          name: '사용자',
          hasProfile: true,
          mbtiType: 'INTP',
          walletBalance: 2,
          stats: {
            readingCount: 3,
            failureCount: 1,
            partnerCount: 2
          }
        }
      ]
    });
    expect(prismaMock.user.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for invalid filters', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    const response = await getAdminUsersRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/users?wallet=MAYBE')
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });
});
