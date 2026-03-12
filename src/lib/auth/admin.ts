import type { UserRole } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

export type SessionAccount = {
  userId: string;
  email: string;
  role: UserRole;
};

export async function getSessionAccount(
  request: NextRequest
): Promise<SessionAccount | null> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role
  };
}

export async function getAdminSessionAccount(
  request: NextRequest
): Promise<SessionAccount | null> {
  const account = await getSessionAccount(request);
  if (!account || account.role !== 'ADMIN') {
    return null;
  }

  return account;
}
