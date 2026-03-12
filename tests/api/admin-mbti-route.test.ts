import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getAdminSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    mbtiEngagementEvent: {
      count: vi.fn(),
      findMany: vi.fn()
    },
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

import { GET } from '@/app/api/v1/admin/mbti/route';

describe('GET /api/v1/admin/mbti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    getAdminSessionAccountMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/admin/mbti')
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns guest completion events', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.mbtiEngagementEvent.count.mockResolvedValue(1);
    prismaMock.mbtiEngagementEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        createdAt: new Date('2026-03-10T10:00:00+09:00'),
        eventType: 'RESULT_VIEWED',
        isAuthenticated: false,
        sessionId: 'anon-1',
        testType: 'MINI',
        mbtiType: 'INFP',
        pagePath: '/mbti',
        user: null
      }
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/mbti?focus=GUEST_COMPLETIONS'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.focus).toBe('GUEST_COMPLETIONS');
    expect(json.days).toBe(14);
    expect(json.entries).toEqual([
      expect.objectContaining({
        kind: 'EVENT',
        label: '미니 테스트 결과 확인',
        sessionId: 'anon-1',
        isAuthenticated: false,
        testType: 'MINI',
        mbtiType: 'INFP'
      })
    ]);
  });

  it('returns mbti free signup users', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.user.count.mockResolvedValue(1);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'mbti@example.com',
        createdAt: new Date('2026-03-10T11:00:00+09:00'),
        profile: {
          name: '테스터'
        },
        mbtiProfile: {
          mbtiType: 'ENTP',
          sourceType: 'MINI_TEST'
        }
      }
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/mbti?focus=SIGNUPS&days=30'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.focus).toBe('SIGNUPS');
    expect(json.days).toBe(30);
    expect(json.entries).toEqual([
      expect.objectContaining({
        kind: 'SIGNUP',
        label: '무료 MBTI 가입',
        email: 'mbti@example.com',
        userId: 'user-1',
        name: '테스터',
        mbtiType: 'ENTP',
        sourceType: 'MINI_TEST'
      })
    ]);
  });
});
