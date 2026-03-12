import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock, generateSajuContentMock } = vi.hoisted(
  () => ({
    prismaMock: {
      user: {
        findUnique: vi.fn()
      },
      partnerProfile: {
        findMany: vi.fn()
      },
      sajuReading: {
        findUnique: vi.fn()
      },
      sajuResultCache: {
        findUnique: vi.fn()
      },
      sajuItemWallet: {
        findUnique: vi.fn()
      },
      sajuGenerationFailure: {
        create: vi.fn()
      },
      $transaction: vi.fn()
    },
    getSessionUserMock: vi.fn(),
    generateSajuContentMock: vi.fn()
  })
);

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock
}));

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: getSessionUserMock
}));

vi.mock('@/lib/saju/generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/saju/generator')>(
    '@/lib/saju/generator'
  );

  return {
    ...actual,
    generateSajuContent: generateSajuContentMock
  };
});

import { POST } from '@/app/api/v1/saju/readings/route';
import { SajuGenerationFailureError } from '@/lib/saju/generator';
import { Prisma } from '@prisma/client';

function createUserRecord() {
  return {
    id: 'user-1',
    profile: {
      name: 'User',
      birthDate: '1984-03-05',
      birthDateTime: new Date('1984-03-05T12:00:00+09:00'),
      birthTime: '12:00',
      isBirthTimeUnknown: false,
      birthCalendarType: 'SOLAR' as const,
      isLeapMonth: false,
      gender: 'FEMALE' as const
    },
    mbtiProfile: {
      mbtiType: 'INFJ' as const
    },
    wallet: {
      balance: 3
    }
  };
}

function createRequest(payload: object): NextRequest {
  return new NextRequest('http://localhost:4000/api/v1/saju/readings', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json'
    }
  });
}

function createGeneratedContent() {
  return {
    summary: 'generated summary',
    sectionsJson: {
      overview: 'overview',
      coreSignal: 'core',
      caution: 'caution',
      actions: ['a', 'b', 'c'],
      reflectionQuestion: 'question'
    },
    metadata: {
      basisFeatures: {
        user: {
          strongElement: '목',
          weakElement: '금',
          ratioText: '목이 강하고 금이 약합니다.',
          currentDaewoonTheme: '확장'
        }
      },
      mbtiAppliedRules: [],
      templateVersion: 'test',
      subjectRuleSetVersion: 'test',
      weighting: {
        saju: 0.75,
        mbti: 0.25
      },
      periodContext: {
        scope: 'YEARLY' as const,
        periodKey: 'y:2026',
        referenceDate: '2026-03-06'
      },
      pipeline: {
        mode: 'rule-only' as const,
        llmRendered: false,
        llmReviewed: false
      }
    },
    resultJson: {
      summary: 'generated summary',
      sectionsJson: {
        overview: 'overview',
        coreSignal: 'core',
        caution: 'caution',
        actions: ['a', 'b', 'c'],
        reflectionQuestion: 'question'
      }
    },
    versions: {
      ruleVersion: 'rule-v1',
      templateVersion: 'template-v1',
      promptVersion: 'prompt-v1',
      modelVersion: 'model-v1'
    }
  };
}

function createPartnerRecord(
  id: string,
  name: string,
  mbtiType: 'ENTP' | 'ISFP' = 'ENTP'
) {
  return {
    id,
    name,
    birthDateTime: new Date('1988-11-21T18:30:00+09:00'),
    birthDate: '1988-11-21',
    birthTime: '18:30',
    isBirthTimeUnknown: false,
    birthCalendarType: 'SOLAR' as const,
    isLeapMonth: false,
    gender: 'MALE' as const,
    mbtiType
  };
}

describe('POST /api/v1/saju/readings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSessionUserMock.mockResolvedValue({ userId: 'user-1' });
    prismaMock.user.findUnique.mockResolvedValue(createUserRecord());
    prismaMock.partnerProfile.findMany.mockResolvedValue([]);
    prismaMock.sajuReading.findUnique.mockResolvedValue(null);
    prismaMock.sajuResultCache.findUnique.mockResolvedValue(null);
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 3 });
    prismaMock.sajuGenerationFailure.create.mockResolvedValue({});
    prismaMock.$transaction.mockResolvedValue(null);
    generateSajuContentMock.mockReset();
  });

  it('returns the existing reading without charging again when the request is duplicated', async () => {
    prismaMock.sajuReading.findUnique.mockResolvedValueOnce({
      id: 'reading-1',
      readingType: 'SELF',
      subjectType: 'BASIC',
      cacheHit: true,
      createdAt: new Date('2026-03-06T12:00:00+09:00'),
      result: {
        summary: 'existing summary'
      }
    });
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 7 });

    const response = await POST(
      createRequest({
        readingType: 'SELF',
        subjectType: 'BASIC',
        profile: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(json.itemCharged).toBe(false);
    expect(json.balance).toBe(7);
    expect(generateSajuContentMock).not.toHaveBeenCalled();
    expect(prismaMock.sajuGenerationFailure.create).not.toHaveBeenCalled();
  });

  it('returns a standardized failure response and records the failure when generation fails', async () => {
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 5 });
    generateSajuContentMock.mockRejectedValue(
      new SajuGenerationFailureError({
        stage: 'LLM_RENDER',
        reasonCode: 'LLM_RENDER_FAILED',
        message: 'render failed',
        detail: ['bad output']
      })
    );

    const response = await POST(
      createRequest({
        readingType: 'SELF',
        subjectType: 'WEALTH',
        profile: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toBe(
      '현재 해석기에 일시적인 이상이 있어 해석을 완료하지 못했습니다. 복은 차감되지 않았습니다. 잠시 후 다시 시도해 주세요.'
    );
    expect(json.balance).toBe(5);
    expect(prismaMock.sajuGenerationFailure.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.sajuGenerationFailure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          readingType: 'SELF',
          subjectType: 'SELF_WEALTH_GENERAL',
          stage: 'LLM_RENDER',
          reasonCode: 'LLM_RENDER_FAILED'
        })
      })
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 402 when the user has no bok left', async () => {
    generateSajuContentMock.mockResolvedValue(createGeneratedContent());
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          sajuReading: {
            findUnique: vi.fn().mockResolvedValue(null)
          },
          sajuItemWallet: {
            upsert: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 0 })
          }
        })
    );

    const response = await POST(
      createRequest({
        readingType: 'SELF',
        subjectType: 'BASIC',
        profile: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(402);
    expect(json.error).toBe('복이 부족합니다. 충전 후 다시 시도해 주세요.');
    expect(prismaMock.sajuGenerationFailure.create).not.toHaveBeenCalled();
  });

  it('returns a duplicate response when a P2002 race happens during persistence', async () => {
    generateSajuContentMock.mockResolvedValue(createGeneratedContent());
    prismaMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate reading', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );
    prismaMock.sajuReading.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'reading-race',
        readingType: 'SELF',
        subjectType: 'BASIC',
        cacheHit: false,
        createdAt: new Date('2026-03-06T12:00:00+09:00'),
        result: {
          summary: 'race summary'
        }
      });
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 2 });

    const response = await POST(
      createRequest({
        readingType: 'SELF',
        subjectType: 'BASIC',
        profile: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(json.itemCharged).toBe(false);
    expect(json.readingId).toBe('reading-race');
    expect(json.balance).toBe(2);
    expect(prismaMock.sajuGenerationFailure.create).not.toHaveBeenCalled();
  });

  it('returns a standardized failure response and records persist failures', async () => {
    generateSajuContentMock.mockResolvedValue(createGeneratedContent());
    prismaMock.$transaction.mockRejectedValue(new Error('db down'));
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 4 });

    const response = await POST(
      createRequest({
        readingType: 'SELF',
        subjectType: 'CAREER',
        profile: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toBe(
      '현재 해석기에 일시적인 이상이 있어 해석을 완료하지 못했습니다. 복은 차감되지 않았습니다. 잠시 후 다시 시도해 주세요.'
    );
    expect(json.balance).toBe(4);
    expect(prismaMock.sajuGenerationFailure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          readingType: 'SELF',
          subjectType: 'SELF_CAREER_GENERAL',
          stage: 'PERSIST',
          reasonCode: 'UNEXPECTED_PERSIST_FAILURE'
        })
      })
    );
  });

  it('rejects invalid compatibility payloads before any persistence work', async () => {
    const response = await POST(
      createRequest({
        readingType: 'COMPATIBILITY',
        subjectType: 'LOVER',
        profileA: {
          source: 'SELF'
        },
        profileB: {
          source: 'SELF'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
    expect(generateSajuContentMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates a compatibility reading when both partner profiles resolve correctly', async () => {
    generateSajuContentMock.mockResolvedValue(createGeneratedContent());
    prismaMock.partnerProfile.findMany.mockResolvedValue([
      createPartnerRecord('partner-a', 'Alice'),
      createPartnerRecord('partner-b', 'Bob', 'ISFP')
    ]);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          sajuReading: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'reading-compat',
              readingType: 'COMPATIBILITY',
              subjectType: 'LOVER',
              cacheHit: false,
              chargeStatus: 'CHARGED',
              itemCost: 1,
              createdAt: new Date('2026-03-06T12:00:00+09:00')
            })
          },
          sajuItemWallet: {
            upsert: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ balance: 2 })
          },
          sajuResultCache: {
            upsert: vi.fn().mockResolvedValue({
              cacheKey: 'compat-cache'
            })
          },
          sajuResultCacheHit: {
            upsert: vi.fn().mockResolvedValue({})
          },
          sajuReadingResult: {
            create: vi.fn().mockResolvedValue({})
          }
        })
    );

    const response = await POST(
      createRequest({
        readingType: 'COMPATIBILITY',
        subjectType: 'LOVER',
        profileA: {
          source: 'PARTNER',
          partnerId: 'partner-a'
        },
        profileB: {
          source: 'PARTNER',
          partnerId: 'partner-b'
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.duplicate).toBe(false);
    expect(json.itemCharged).toBe(true);
    expect(json.readingType).toBe('COMPATIBILITY');
    expect(generateSajuContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readingType: 'COMPATIBILITY',
        subjectType: 'LOVER',
        userName: 'Alice',
        partnerName: 'Bob'
      })
    );
  });
});
