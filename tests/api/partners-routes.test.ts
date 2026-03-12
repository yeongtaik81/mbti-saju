import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    partnerProfile: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
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

import { DELETE, PATCH } from '@/app/api/v1/partners/[partnerId]/route';
import {
  GET as getPartnersRoute,
  POST as createPartnerRoute
} from '@/app/api/v1/partners/route';

function createPartnerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'partner-1',
    name: 'Alice',
    relationship: '친구',
    birthDateTime: new Date('1988-11-21T18:30:00+09:00'),
    birthDate: '1988-11-21',
    birthTime: '18:30',
    isBirthTimeUnknown: false,
    birthCalendarType: 'SOLAR' as const,
    isLeapMonth: false,
    gender: 'FEMALE' as const,
    mbtiType: 'ENTP',
    createdAt: new Date('2026-03-06T12:00:00+09:00'),
    updatedAt: new Date('2026-03-06T12:30:00+09:00'),
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

describe('partner routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com'
    });
  });

  it('lists partners for the current user', async () => {
    prismaMock.partnerProfile.findMany.mockResolvedValue([
      createPartnerRecord(),
      createPartnerRecord({
        id: 'partner-2',
        name: 'Bob',
        relationship: null,
        isBirthTimeUnknown: true,
        birthTime: null,
        mbtiType: null
      })
    ]);

    const response = await getPartnersRoute(
      new NextRequest('http://localhost:4000/api/v1/partners')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.partners).toHaveLength(2);
    expect(json.partners[0]).toEqual(
      expect.objectContaining({
        id: 'partner-1',
        name: 'Alice',
        birthDate: '1988-11-21',
        birthTime: '18:30'
      })
    );
    expect(json.partners[1]).toEqual(
      expect.objectContaining({
        id: 'partner-2',
        name: 'Bob',
        birthTime: null
      })
    );
  });

  it('rejects invalid partner creation payloads', async () => {
    const response = await createPartnerRoute(
      createJsonRequest('http://localhost:4000/api/v1/partners', 'POST', {
        name: 'Alice',
        birthDate: '1988-11-21',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
    expect(prismaMock.partnerProfile.create).not.toHaveBeenCalled();
  });

  it('creates a partner profile', async () => {
    prismaMock.partnerProfile.create.mockResolvedValue(createPartnerRecord());

    const response = await createPartnerRoute(
      createJsonRequest('http://localhost:4000/api/v1/partners', 'POST', {
        name: 'Alice',
        relationship: '친구',
        birthDate: '1988-11-21',
        birthTime: '18:30',
        birthTimeUnknown: false,
        birthCalendarType: 'SOLAR',
        isLeapMonth: false,
        gender: 'FEMALE',
        mbtiType: 'ENTP'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.partner).toEqual(
      expect.objectContaining({
        id: 'partner-1',
        name: 'Alice',
        relationship: '친구'
      })
    );
    expect(prismaMock.partnerProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'user-1',
          birthPlace: '대한민국',
          mbtiType: 'ENTP'
        })
      })
    );
  });

  it('returns 404 when patching a missing partner', async () => {
    prismaMock.partnerProfile.findFirst.mockResolvedValue(null);

    const response = await PATCH(
      createJsonRequest(
        'http://localhost:4000/api/v1/partners/partner-1',
        'PATCH',
        { relationship: '직장동료' }
      ),
      {
        params: Promise.resolve({
          partnerId: 'partner-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('수정할 궁합 상대를 찾을 수 없습니다.');
  });

  it('updates a partner profile with partial payload', async () => {
    prismaMock.partnerProfile.findFirst.mockResolvedValue(
      createPartnerRecord()
    );
    prismaMock.partnerProfile.update.mockResolvedValue(
      createPartnerRecord({
        relationship: '직장동료',
        mbtiType: 'ISFP'
      })
    );

    const response = await PATCH(
      createJsonRequest(
        'http://localhost:4000/api/v1/partners/partner-1',
        'PATCH',
        {
          relationship: '직장동료',
          mbtiType: 'ISFP'
        }
      ),
      {
        params: Promise.resolve({
          partnerId: 'partner-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.partner).toEqual(
      expect.objectContaining({
        id: 'partner-1',
        relationship: '직장동료',
        mbtiType: 'ISFP'
      })
    );
    expect(prismaMock.partnerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'partner-1'
        },
        data: expect.objectContaining({
          relationship: '직장동료',
          mbtiType: 'ISFP'
        })
      })
    );
  });

  it('deletes a partner profile', async () => {
    prismaMock.partnerProfile.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new NextRequest('http://localhost:4000/api/v1/partners/partner-1', {
        method: 'DELETE'
      }),
      {
        params: Promise.resolve({
          partnerId: 'partner-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      partnerId: 'partner-1'
    });
  });
});
