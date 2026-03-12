import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionAccountMock } = vi.hoisted(() => ({
  getSessionAccountMock: vi.fn()
}));

vi.mock('@/lib/auth/admin', () => ({
  getSessionAccount: getSessionAccountMock
}));

import { GET as getSessionRoute } from '@/app/api/v1/auth/session/route';
import { POST as signOutRoute } from '@/app/api/v1/auth/sign-out/route';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/cookie';

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an anonymous session payload when not authenticated', async () => {
    getSessionAccountMock.mockResolvedValue(null);

    const response = await getSessionRoute(
      new NextRequest('http://localhost:4000/api/v1/auth/session')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      authenticated: false,
      user: null
    });
  });

  it('returns the authenticated user when a session exists', async () => {
    getSessionAccountMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN'
    });

    const response = await getSessionRoute(
      new NextRequest('http://localhost:4000/api/v1/auth/session')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN'
      }
    });
  });

  it('clears the access token cookie on sign-out', async () => {
    const response = await signOutRoute();
    const json = await response.json();
    const setCookie = response.headers.get('set-cookie');

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(setCookie).toContain(`${ACCESS_TOKEN_COOKIE_NAME}=`);
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });
});
