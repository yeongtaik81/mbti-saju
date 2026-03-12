import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import { createSelfGenerationInput } from '../saju/fixtures';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    sajuReading: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

import { GET as getReadingListRoute } from '@/app/api/v1/saju/readings/route';
import {
  DELETE as deleteReadingDetailRoute,
  GET as getReadingDetailRoute
} from '@/app/api/v1/saju/readings/[readingId]/route';

describe('saju reading query routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com'
    });
  });

  it('maps list responses and falls back to the cached summary when result rows are missing', async () => {
    prismaMock.sajuReading.findMany.mockResolvedValue([
      {
        id: 'reading-1',
        readingType: 'SELF',
        subjectType: 'BASIC',
        chargeStatus: 'CHARGED',
        itemCost: 1,
        cacheHit: false,
        createdAt: new Date('2026-03-06T12:00:00+09:00'),
        firstPartner: null,
        partner: null,
        result: null,
        cache: {
          resultJson: {
            summary: 'cached summary',
            sectionsJson: {
              overview: 'cached overview'
            }
          }
        }
      },
      {
        id: 'reading-2',
        readingType: 'COMPATIBILITY',
        subjectType: 'LOVER',
        chargeStatus: 'CHARGED',
        itemCost: 1,
        cacheHit: true,
        createdAt: new Date('2026-03-06T12:10:00+09:00'),
        firstPartner: {
          id: 'partner-a',
          name: 'Alice',
          mbtiType: 'ENTP'
        },
        partner: {
          id: 'partner-b',
          name: 'Bob',
          mbtiType: 'ISFP'
        },
        result: {
          summary: 'stored summary'
        },
        cache: null
      }
    ]);

    const response = await getReadingListRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings?limit=2')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.readings).toHaveLength(2);
    expect(json.readings[0]).toEqual(
      expect.objectContaining({
        id: 'reading-1',
        targetLabel: '내 정보',
        summary: 'cached summary'
      })
    );
    expect(json.readings[1]).toEqual(
      expect.objectContaining({
        id: 'reading-2',
        targetLabel: 'Alice · Bob',
        summary: 'stored summary'
      })
    );
  });

  it('returns 400 when the list limit is invalid', async () => {
    const response = await getReadingListRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings?limit=999')
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
    expect(prismaMock.sajuReading.findMany).not.toHaveBeenCalled();
  });

  it('returns detail data and falls back to cached sections when the stored result is missing', async () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH'),
      'rule-only'
    );

    prismaMock.sajuReading.findFirst.mockResolvedValue({
      id: 'reading-1',
      readingType: 'SELF',
      subjectType: 'WEALTH',
      chargeStatus: 'CHARGED',
      itemCost: 1,
      cacheHit: true,
      cacheKey: 'cache-1',
      createdAt: new Date('2026-03-06T12:00:00+09:00'),
      firstPartner: null,
      partner: null,
      result: null,
      cache: {
        resultJson: {
          summary: 'cached summary',
          sectionsJson: {
            overview: 'cached overview',
            coreSignal: 'cached core'
          }
        },
        metadataJson: draft.internalMetadata,
        ruleVersion: 'rule-v1',
        templateVersion: 'template-v1',
        promptVersion: 'prompt-v1',
        modelVersion: 'model-v1'
      }
    });

    const response = await getReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/reading-1'),
      {
        params: Promise.resolve({
          readingId: 'reading-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reading).toEqual(
      expect.objectContaining({
        id: 'reading-1',
        targetLabel: '내 정보',
        summary: 'cached summary',
        sectionsJson: {
          overview: 'cached overview',
          coreSignal: 'cached core'
        },
        sajuData: expect.objectContaining({
          user: expect.objectContaining({
            pillars: expect.objectContaining({
              yearString: expect.any(String)
            }),
            dayMaster: expect.objectContaining({
              stem: expect.any(String),
              element: expect.any(String)
            })
          })
        }),
        versions: {
          ruleVersion: 'rule-v1',
          templateVersion: 'template-v1',
          promptVersion: 'prompt-v1',
          modelVersion: 'model-v1'
        }
      })
    );
  });

  it('returns null sajuData for older cached readings without structured metadata', async () => {
    prismaMock.sajuReading.findFirst.mockResolvedValue({
      id: 'reading-legacy',
      readingType: 'SELF',
      subjectType: 'BASIC',
      chargeStatus: 'CHARGED',
      itemCost: 1,
      cacheHit: true,
      cacheKey: 'cache-legacy',
      createdAt: new Date('2026-03-06T12:00:00+09:00'),
      firstPartner: null,
      partner: null,
      result: null,
      cache: {
        resultJson: {
          summary: 'legacy summary',
          sectionsJson: {
            overview: 'legacy overview'
          }
        },
        metadataJson: null,
        ruleVersion: 'rule-v1',
        templateVersion: 'template-v1',
        promptVersion: 'prompt-v1',
        modelVersion: 'model-v1'
      }
    });

    const response = await getReadingDetailRoute(
      new NextRequest(
        'http://localhost:4000/api/v1/saju/readings/reading-legacy'
      ),
      {
        params: Promise.resolve({
          readingId: 'reading-legacy'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reading.sajuData).toBeNull();
  });

  it('returns 404 when the reading detail does not exist', async () => {
    prismaMock.sajuReading.findFirst.mockResolvedValue(null);

    const response = await getReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/missing'),
      {
        params: Promise.resolve({
          readingId: 'missing'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('사주 결과를 찾을 수 없습니다.');
  });

  it('returns 401 when the session is missing', async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await getReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/reading-1'),
      {
        params: Promise.resolve({
          readingId: 'reading-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('deletes an owned reading', async () => {
    prismaMock.sajuReading.deleteMany.mockResolvedValue({
      count: 1
    });

    const response = await deleteReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/reading-1', {
        method: 'DELETE'
      }),
      {
        params: Promise.resolve({
          readingId: 'reading-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.sajuReading.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'reading-1',
        userId: 'user-1'
      }
    });
    expect(json).toEqual({
      success: true
    });
  });

  it('returns 404 when deleting a missing reading', async () => {
    prismaMock.sajuReading.deleteMany.mockResolvedValue({
      count: 0
    });

    const response = await deleteReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/missing', {
        method: 'DELETE'
      }),
      {
        params: Promise.resolve({
          readingId: 'missing'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('삭제할 사주 결과를 찾을 수 없습니다.');
  });

  it('returns 401 when deleting without a session', async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await deleteReadingDetailRoute(
      new NextRequest('http://localhost:4000/api/v1/saju/readings/reading-1', {
        method: 'DELETE'
      }),
      {
        params: Promise.resolve({
          readingId: 'reading-1'
        })
      }
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(prismaMock.sajuReading.deleteMany).not.toHaveBeenCalled();
  });
});
