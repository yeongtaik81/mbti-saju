import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyAccessTokenMock } = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn()
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: verifyAccessTokenMock
}));

import { ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/cookie';
import { middleware } from '../middleware';

describe('middleware /admin guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects anonymous admin requests to home', async () => {
    const request = new NextRequest('http://localhost:4000/admin');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:4000/');
  });

  it('redirects non-admin users to dashboard', async () => {
    verifyAccessTokenMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER'
    });

    const request = new NextRequest('http://localhost:4000/admin');
    request.cookies.set(ACCESS_TOKEN_COOKIE_NAME, 'token');

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:4000/dashboard'
    );
  });

  it('allows admin users through', async () => {
    verifyAccessTokenMock.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN'
    });

    const request = new NextRequest('http://localhost:4000/admin/readings');
    request.cookies.set(ACCESS_TOKEN_COOKIE_NAME, 'token');

    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});
