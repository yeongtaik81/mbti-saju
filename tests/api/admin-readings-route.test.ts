import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    sajuReading: {
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

import { GET } from '@/app/api/v1/admin/readings/route';

describe('GET /api/v1/admin/readings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    getSessionAccountMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/readings')
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns paginated readings for admins', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.sajuReading.count.mockResolvedValue(21);
    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        id: 'reading-1',
        createdAt: new Date('2026-03-10T10:15:00+09:00'),
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        chargeStatus: 'CHARGED',
        cacheHit: false,
        itemCost: 1,
        user: {
          id: 'user-1',
          email: 'user@example.com'
        },
        firstPartner: { name: '내 정보' },
        partner: { name: '팀장님' }
      }
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/readings?page=2&readingType=COMPATIBILITY&chargeStatus=CHARGED&cacheHit=false&q=%ED%8C%80%EC%9E%A5'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.sajuReading.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          readingType: 'COMPATIBILITY',
          chargeStatus: 'CHARGED',
          cacheHit: false
        })
      })
    );
    expect(prismaMock.sajuReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20
      })
    );
    expect(json).toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 20,
        totalCount: 21,
        totalPages: 2,
        readings: [
          expect.objectContaining({
            id: 'reading-1',
            subjectLabel: '상사와 궁합',
            targetLabel: '내 정보 · 팀장님',
            user: {
              id: 'user-1',
              email: 'user@example.com'
            }
          })
        ]
      })
    );
  });
});
