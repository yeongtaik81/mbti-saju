import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { DEFAULT_BIRTH_PLACE } from '@/lib/saju/constants';
import {
  composeBirthDateTime,
  toBirthDate,
  toBirthTime
} from '@/lib/saju/datetime';
import { partnerCreateSchema } from '@/lib/validators/saju';
import { badRequest, serverError, unauthorized } from '@/lib/utils/http';

function mapPartner(partner: {
  id: string;
  name: string;
  relationship: string | null;
  birthDateTime: Date;
  birthDate: string | null;
  birthTime: string | null;
  isBirthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mbtiType: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const fallbackBirthDate = toBirthDate(partner.birthDateTime);
  const fallbackBirthTime = toBirthTime(partner.birthDateTime);

  return {
    id: partner.id,
    name: partner.name,
    relationship: partner.relationship,
    birthDate: partner.birthDate ?? fallbackBirthDate,
    birthTime: partner.isBirthTimeUnknown
      ? null
      : (partner.birthTime ?? fallbackBirthTime),
    birthTimeUnknown: partner.isBirthTimeUnknown,
    birthCalendarType: partner.birthCalendarType,
    isLeapMonth: partner.isLeapMonth,
    gender: partner.gender,
    mbtiType: partner.mbtiType,
    createdAt: partner.createdAt.toISOString(),
    updatedAt: partner.updatedAt.toISOString()
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const partners = await prisma.partnerProfile.findMany({
      where: { ownerUserId: sessionUser.userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return NextResponse.json({
      partners: partners.map((partner) => mapPartner(partner))
    });
  } catch {
    return serverError();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const raw = (await request.json()) as unknown;
    const payload = partnerCreateSchema.parse(raw);
    const birthDateTime = composeBirthDateTime(
      payload.birthDate,
      payload.birthTime,
      payload.birthTimeUnknown
    );

    const partner = await prisma.partnerProfile.create({
      data: {
        ownerUserId: sessionUser.userId,
        name: payload.name,
        relationship: payload.relationship ?? null,
        birthDateTime,
        birthDate: payload.birthDate,
        birthTime: payload.birthTimeUnknown
          ? null
          : (payload.birthTime ?? null),
        isBirthTimeUnknown: payload.birthTimeUnknown,
        birthCalendarType: payload.birthCalendarType,
        isLeapMonth:
          payload.birthCalendarType === 'SOLAR' ? false : payload.isLeapMonth,
        birthPlace: DEFAULT_BIRTH_PLACE,
        gender: payload.gender,
        mbtiType: payload.mbtiType ?? null
      }
    });

    return NextResponse.json(
      {
        partner: mapPartner(partner)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}
