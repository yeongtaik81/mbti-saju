import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    mbtiProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn()
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

import { GET as getMbtiRoute } from '@/app/api/v1/mbti/route';
import { POST as postMbtiDirectRoute } from '@/app/api/v1/mbti/direct/route';
import {
  GET as getMiniMbtiRoute,
  POST as postMiniMbtiRoute
} from '@/app/api/v1/mbti/test/mini/route';
import {
  GET as getFullMbtiRoute,
  POST as postFullMbtiRoute
} from '@/app/api/v1/mbti/test/full/route';
import { getPublicMbtiQuestions } from '@/lib/mbti/test-engine';

function createJsonRequest(
  url: string,
  method: 'POST',
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

function allAnswersFor(type: 'MINI' | 'FULL') {
  return getPublicMbtiQuestions(type).map((question) => ({
    questionId: question.id,
    optionId: 'A' as const
  }));
}

describe('mbti routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com'
    });
  });

  it('returns the saved mbti or null', async () => {
    prismaMock.mbtiProfile.findUnique.mockResolvedValueOnce({
      mbtiType: 'INFJ',
      sourceType: 'DIRECT',
      decidedAt: new Date('2026-03-06T12:00:00+09:00')
    });
    let response = await getMbtiRoute(
      new NextRequest('http://localhost:4000/api/v1/mbti')
    );
    let json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mbti).toEqual({
      mbtiType: 'INFJ',
      sourceType: 'DIRECT',
      decidedAt: '2026-03-06T03:00:00.000Z'
    });

    prismaMock.mbtiProfile.findUnique.mockResolvedValueOnce(null);
    response = await getMbtiRoute(
      new NextRequest('http://localhost:4000/api/v1/mbti')
    );
    json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mbti).toBeNull();
  });

  it('rejects invalid direct mbti payloads', async () => {
    const response = await postMbtiDirectRoute(
      createJsonRequest('http://localhost:4000/api/v1/mbti/direct', 'POST', {
        mbtiType: 'XXXX'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });

  it('saves a direct mbti input', async () => {
    prismaMock.mbtiProfile.upsert.mockResolvedValue({
      mbtiType: 'ENFP',
      sourceType: 'DIRECT',
      decidedAt: new Date('2026-03-06T12:00:00+09:00')
    });

    const response = await postMbtiDirectRoute(
      createJsonRequest('http://localhost:4000/api/v1/mbti/direct', 'POST', {
        mbtiType: 'ENFP',
        sourceType: 'DIRECT'
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mbti).toEqual({
      mbtiType: 'ENFP',
      sourceType: 'DIRECT',
      decidedAt: '2026-03-06T03:00:00.000Z'
    });
  });

  it('returns mini and full public tests', async () => {
    let response = await getMiniMbtiRoute(
      new NextRequest('http://localhost:4000/api/v1/mbti/test/mini')
    );
    let json = await response.json();

    expect(response.status).toBe(200);
    expect(json.testType).toBe('MINI');
    expect(json.questions).toHaveLength(12);

    response = await getFullMbtiRoute(
      new NextRequest('http://localhost:4000/api/v1/mbti/test/full')
    );
    json = await response.json();

    expect(response.status).toBe(200);
    expect(json.testType).toBe('FULL');
    expect(json.questions).toHaveLength(36);
  });

  it('evaluates and saves mini test results', async () => {
    prismaMock.mbtiProfile.upsert.mockResolvedValue({
      mbtiType: 'ESTJ',
      sourceType: 'MINI_TEST',
      decidedAt: new Date('2026-03-06T12:00:00+09:00')
    });

    const response = await postMiniMbtiRoute(
      createJsonRequest('http://localhost:4000/api/v1/mbti/test/mini', 'POST', {
        answers: allAnswersFor('MINI')
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mbti).toEqual({
      mbtiType: 'ESTJ',
      sourceType: 'MINI_TEST',
      decidedAt: '2026-03-06T03:00:00.000Z'
    });
    expect(json.score).toEqual(
      expect.objectContaining({
        totalQuestions: 12,
        answeredQuestions: 12
      })
    );
  });

  it('evaluates and saves full test results', async () => {
    prismaMock.mbtiProfile.upsert.mockResolvedValue({
      mbtiType: 'ESTJ',
      sourceType: 'FULL_TEST',
      decidedAt: new Date('2026-03-06T12:00:00+09:00')
    });

    const response = await postFullMbtiRoute(
      createJsonRequest('http://localhost:4000/api/v1/mbti/test/full', 'POST', {
        answers: allAnswersFor('FULL')
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mbti).toEqual({
      mbtiType: 'ESTJ',
      sourceType: 'FULL_TEST',
      decidedAt: '2026-03-06T03:00:00.000Z'
    });
    expect(json.score).toEqual(
      expect.objectContaining({
        totalQuestions: 36,
        answeredQuestions: 36
      })
    );
  });

  it('rejects malformed mbti test submissions', async () => {
    const response = await postMiniMbtiRoute(
      createJsonRequest('http://localhost:4000/api/v1/mbti/test/mini', 'POST', {
        answers: []
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });
});
