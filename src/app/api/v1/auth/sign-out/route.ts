import { NextResponse } from 'next/server';
import { clearAccessTokenCookie } from '@/lib/auth/cookie';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  return clearAccessTokenCookie(response);
}
