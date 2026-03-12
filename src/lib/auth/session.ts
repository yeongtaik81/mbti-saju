import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/cookie';
import { verifyAccessToken } from '@/lib/auth/jwt';

export type SessionUser = {
  userId: string;
  email: string;
  role?: 'USER' | 'ADMIN';
};

export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const cookieToken = request.cookies
    .get(ACCESS_TOKEN_COOKIE_NAME)
    ?.value?.trim();
  const authorization = request.headers.get('authorization');
  const bearerToken =
    authorization && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : null;
  const token = cookieToken || bearerToken;
  if (!token) {
    return null;
  }

  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}
