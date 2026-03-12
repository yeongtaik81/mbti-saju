import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    mbtiEngagementEvent: {
      create: vi.fn()
    }
  },
  getSessionUserMock: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: getSessionUserMock
}));

import { POST } from '@/app/api/v1/mbti/events/route';

describe('POST /api/v1/mbti/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks guest page views and sets visitor cookie', async () => {
    getSessionUserMock.mockResolvedValue(null);
    prismaMock.mbtiEngagementEvent.create.mockResolvedValue({});

    const request = new NextRequest(
      'http://localhost:4000/api/v1/mbti/events',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          eventType: 'PAGE_VIEW',
          pagePath: '/mbti'
        })
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(prismaMock.mbtiEngagementEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        isAuthenticated: false,
        eventType: 'PAGE_VIEW',
        pagePath: '/mbti'
      })
    });
    expect(response.headers.get('set-cookie')).toContain(
      'mbti_saju_mbti_visitor='
    );
  });

  it('tracks logged-in completions with the user id', async () => {
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER'
    });
    prismaMock.mbtiEngagementEvent.create.mockResolvedValue({});

    const request = new NextRequest(
      'http://localhost:4000/api/v1/mbti/events',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'mbti_saju_mbti_visitor=visitor-1'
        },
        body: JSON.stringify({
          eventType: 'RESULT_VIEWED',
          testType: 'FULL',
          mbtiType: 'INTP',
          pagePath: '/mbti'
        })
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(prismaMock.mbtiEngagementEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        sessionId: 'visitor-1',
        isAuthenticated: true,
        eventType: 'RESULT_VIEWED',
        testType: 'FULL',
        mbtiType: 'INTP',
        pagePath: '/mbti'
      }
    });
  });

  it('returns 400 for invalid payloads', async () => {
    getSessionUserMock.mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:4000/api/v1/mbti/events',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          eventType: 'UNKNOWN'
        })
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });
});
