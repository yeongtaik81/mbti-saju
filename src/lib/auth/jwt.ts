import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();
const TOKEN_EXPIRES_IN = '7d';
export type AccessTokenRole = 'USER' | 'ADMIN';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return encoder.encode(secret);
}

export type AccessTokenPayload = {
  userId: string;
  email: string;
  role?: AccessTokenRole;
};

export async function issueAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRES_IN)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());

  const userId = payload.userId;
  const email = payload.email;
  const role = payload.role;

  if (typeof userId !== 'string' || typeof email !== 'string') {
    throw new Error('Invalid token payload.');
  }

  if (role !== undefined && role !== 'USER' && role !== 'ADMIN') {
    throw new Error('Invalid token payload.');
  }

  return {
    userId,
    email,
    ...(role ? { role } : {})
  };
}
