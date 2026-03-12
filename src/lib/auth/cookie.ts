import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE_NAME = 'mbti_saju_access_token';
export const MBTI_VISITOR_COOKIE_NAME = 'mbti_saju_mbti_visitor';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MBTI_VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
}

export function setAccessTokenCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE_NAME,
    value: token,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    ...getCookieBaseOptions()
  });
  return response;
}

export function clearAccessTokenCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE_NAME,
    value: '',
    maxAge: 0,
    ...getCookieBaseOptions()
  });
  return response;
}

export function setMbtiVisitorCookie(
  response: NextResponse,
  visitorId: string
): NextResponse {
  response.cookies.set({
    name: MBTI_VISITOR_COOKIE_NAME,
    value: visitorId,
    maxAge: MBTI_VISITOR_MAX_AGE_SECONDS,
    ...getCookieBaseOptions()
  });
  return response;
}
