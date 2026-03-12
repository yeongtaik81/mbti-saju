import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn()
    },
    userProfile: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  },
  getSessionUserMock: vi.fn()
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: getSessionUserMock
}));

import { GET, PATCH, POST } from '@/app/api/v1/onboarding/route';

function createProfileRecord(overrides: Record<string, unknown> = {}) {
  return {
    name: '홍길동',
    birthDateTime: new Date('1984-03-05T12:00:00.000Z'),
    birthDate: '1984-03-05',
    birthTime: '12:00',
    isBirthTimeUnknown: false,
    birthCalendarType: 'SOLAR' as const,
    isLeapMonth: false,
    birthCountryType: 'KOREA' as const,
    birthCountry: '대한민국',
    gender: 'FEMALE' as const,
    ...overrides
  };
}

function createJsonRequest(
  url: string,
  method: 'POST' | 'PATCH',
  payload: object
): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json'
    }
  });
}

describe('onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com'
    });
  });

  it('returns onboarding, mbti, and wallet state for the current user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      profile: createProfileRecord(),
      mbtiProfile: {
        mbtiType: 'INFJ',
        sourceType: 'DIRECT',
        decidedAt: new Date('2026-03-06T12:00:00+09:00')
      },
      wallet: {
        balance: 2
      }
    });

    const response = await GET(
      new NextRequest('http://localhost:4000/api/v1/onboarding')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.onboarding).toEqual(
      expect.objectContaining({
        name: '홍길동',
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthCountryType: 'KOREA',
        birthCountry: '대한민국'
      })
    );
    expect(json.mbti).toEqual(
      expect.objectContaining({
        mbtiType: 'INFJ',
        sourceType: 'DIRECT'
      })
    );
    expect(json.itemBalance).toBe(2);
  });

  it('rejects invalid onboarding creation payloads', async () => {
    const response = await POST(
      createJsonRequest('http://localhost:4000/api/v1/onboarding', 'POST', {
        name: '홍길동',
        birthDate: '1984-03-05',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates onboarding and mbti data', async () => {
    const userProfileUpsert = vi.fn().mockResolvedValue({});
    const mbtiProfileUpsert = vi.fn().mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          userProfile: {
            upsert: userProfileUpsert
          },
          mbtiProfile: {
            upsert: mbtiProfileUpsert
          }
        })
    );

    const response = await POST(
      createJsonRequest('http://localhost:4000/api/v1/onboarding', 'POST', {
        name: '홍길동',
        birthDate: '1984-03-05',
        birthTime: '12:00',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'INFJ'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({ success: true });
    expect(userProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: expect.objectContaining({
          birthCountryType: 'KOREA',
          birthCountry: '대한민국',
          birthPlace: '대한민국'
        })
      })
    );
    expect(mbtiProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-1',
          mbtiType: 'INFJ',
          sourceType: 'DIRECT'
        })
      })
    );
  });

  it('patches onboarding using existing profile defaults', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(createProfileRecord());
    const userProfileUpsert = vi.fn().mockResolvedValue({});
    const mbtiProfileUpsert = vi.fn().mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          userProfile: {
            upsert: userProfileUpsert
          },
          mbtiProfile: {
            upsert: mbtiProfileUpsert
          }
        })
    );

    const response = await PATCH(
      createJsonRequest('http://localhost:4000/api/v1/onboarding', 'PATCH', {
        name: '김영희',
        mbtiType: 'ENFP'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(userProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          name: '김영희',
          birthDate: '1984-03-05',
          birthTime: '12:00'
        })
      })
    );
    expect(mbtiProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          mbtiType: 'ENFP',
          sourceType: 'DIRECT'
        })
      })
    );
  });

  it('rejects invalid merged patch payloads', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      createJsonRequest('http://localhost:4000/api/v1/onboarding', 'PATCH', {
        mbtiType: 'INFJ'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
