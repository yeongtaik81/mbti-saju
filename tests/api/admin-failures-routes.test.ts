import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getAdminSessionAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    sajuGenerationFailure: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
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

import { GET as getAdminFailuresRoute } from '@/app/api/v1/admin/failures/route';
import { GET as getAdminFailureDetailRoute } from '@/app/api/v1/admin/failures/[failureId]/route';

describe('admin failures routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated as admin', async () => {
    getAdminSessionAccountMock.mockResolvedValue(null);

    const response = await getAdminFailuresRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/failures')
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns paginated failures for admins', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.sajuGenerationFailure.count.mockResolvedValue(1);
    prismaMock.sajuGenerationFailure.findMany.mockResolvedValue([
      {
        id: 'failure-1',
        createdAt: new Date('2026-03-10T10:00:00+09:00'),
        readingType: 'COMPATIBILITY',
        subjectType: 'COMPAT_WORK_BOSS',
        stage: 'LLM_RENDER',
        reasonCode: 'LLM_RENDER_FAILED',
        reasonMessage: 'render failed',
        cacheKey: 'cache-1',
        user: {
          id: 'user-1',
          email: 'user@example.com'
        }
      }
    ]);

    const response = await getAdminFailuresRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/failures?stage=LLM_RENDER&readingType=COMPATIBILITY'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      page: 1,
      totalCount: 1,
      failures: [
        {
          id: 'failure-1',
          readingType: 'COMPATIBILITY',
          subjectType: 'COMPAT_WORK_BOSS',
          subjectLabel: '상사와 궁합',
          stage: 'LLM_RENDER',
          reasonCode: 'LLM_RENDER_FAILED',
          cacheKey: 'cache-1',
          user: {
            id: 'user-1',
            email: 'user@example.com'
          }
        }
      ]
    });
  });

  it('returns failure detail for admins', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    prismaMock.sajuGenerationFailure.findUnique.mockResolvedValue({
      id: 'failure-1',
      createdAt: new Date('2026-03-10T10:00:00+09:00'),
      readingType: 'SELF',
      subjectType: 'SELF_YEARLY_FORTUNE',
      cacheKey: 'cache-1',
      periodScope: 'YEARLY',
      periodKey: '2026',
      stage: 'LLM_RENDER',
      reasonCode: 'LLM_RENDER_FAILED',
      reasonMessage: 'render failed',
      detailJson: {
        llmDebug: {
          failureType: 'TIMEOUT'
        }
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER'
      }
    });

    const response = await getAdminFailureDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/admin/failures/failure-1'),
      {
        params: Promise.resolve({ failureId: 'failure-1' })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failure).toMatchObject({
      id: 'failure-1',
      subjectLabel: '올해 운',
      periodScope: 'YEARLY',
      periodKey: '2026',
      detailJson: {
        llmDebug: {
          failureType: 'TIMEOUT'
        }
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER'
      }
    });
  });

  it('returns 400 for invalid failure filters', async () => {
    getAdminSessionAccountMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    const response = await getAdminFailuresRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/admin/failures?stage=UNKNOWN'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });
});
