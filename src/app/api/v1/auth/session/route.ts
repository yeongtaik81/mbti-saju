import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionAccount(request);

  return NextResponse.json({
    authenticated: Boolean(sessionUser),
    user: sessionUser
      ? {
          id: sessionUser.userId,
          email: sessionUser.email,
          role: sessionUser.role
        }
      : null
  });
}
