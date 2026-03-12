import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getSessionUserMock } = vi.hoisted(() => ({
  prismaMock: {
    sajuItemWallet: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    mockPaymentTransaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
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

import { GET as getBalanceRoute } from '@/app/api/v1/items/balance/route';
import { POST as mockCompleteRoute } from '@/app/api/v1/items/mock-complete/route';
import { GET as getOverviewRoute } from '@/app/api/v1/items/overview/route';
import { Prisma } from '@prisma/client';

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

describe('item routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com'
    });
  });

  it('returns wallet balance or zero when no wallet exists', async () => {
    prismaMock.sajuItemWallet.findUnique.mockResolvedValueOnce({ balance: 3 });
    let response = await getBalanceRoute(
      new NextRequest('http://localhost:4000/api/v1/items/balance')
    );
    let json = await response.json();

    expect(response.status).toBe(200);
    expect(json.balance).toBe(3);

    prismaMock.sajuItemWallet.findUnique.mockResolvedValueOnce(null);
    response = await getBalanceRoute(
      new NextRequest('http://localhost:4000/api/v1/items/balance')
    );
    json = await response.json();

    expect(response.status).toBe(200);
    expect(json.balance).toBe(0);
  });

  it('returns wallet overview with charge history', async () => {
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 2 });
    prismaMock.mockPaymentTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        amount: 1,
        createdAt: new Date('2026-03-06T12:00:00+09:00')
      }
    ]);

    const response = await getOverviewRoute(
      new NextRequest('http://localhost:4000/api/v1/items/overview')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.balance).toBe(2);
    expect(json.history).toEqual([
      {
        id: 'tx-1',
        amount: 1,
        createdAt: '2026-03-06T03:00:00.000Z'
      }
    ]);
  });

  it('rejects invalid mock payment payloads', async () => {
    const response = await mockCompleteRoute(
      createJsonRequest(
        'http://localhost:4000/api/v1/items/mock-complete',
        'POST',
        {
          amount: 0,
          idempotencyKey: 'short'
        }
      )
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('입력값 검증에 실패했습니다.');
  });

  it('returns duplicate success without recharging when the idempotency key already exists', async () => {
    prismaMock.mockPaymentTransaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      amount: 1
    });
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 4 });

    const response = await mockCompleteRoute(
      createJsonRequest(
        'http://localhost:4000/api/v1/items/mock-complete',
        'POST',
        {
          amount: 1,
          idempotencyKey: 'duplicate-key-123'
        }
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      duplicate: true,
      idempotencyKey: 'duplicate-key-123',
      balance: 4
    });
  });

  it('creates a mock payment and increments wallet balance', async () => {
    prismaMock.mockPaymentTransaction.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          mockPaymentTransaction: {
            create: vi.fn().mockResolvedValue({})
          },
          sajuItemWallet: {
            upsert: vi.fn().mockResolvedValue({
              balance: 5
            })
          }
        })
    );

    const response = await mockCompleteRoute(
      createJsonRequest(
        'http://localhost:4000/api/v1/items/mock-complete',
        'POST',
        {
          amount: 1,
          idempotencyKey: 'fresh-key-1234'
        }
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      duplicate: false,
      idempotencyKey: 'fresh-key-1234',
      balance: 5
    });
  });

  it('converts a P2002 race into duplicate success', async () => {
    prismaMock.mockPaymentTransaction.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate tx', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );
    prismaMock.sajuItemWallet.findUnique.mockResolvedValue({ balance: 6 });

    const response = await mockCompleteRoute(
      createJsonRequest(
        'http://localhost:4000/api/v1/items/mock-complete',
        'POST',
        {
          amount: 1,
          idempotencyKey: 'race-key-1234'
        }
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      duplicate: true,
      balance: 6
    });
  });
});
