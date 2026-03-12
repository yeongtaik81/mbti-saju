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
import { partnerCreateSchema, partnerPatchSchema } from '@/lib/validators/saju';
import {
  badRequest,
  notFound,
  serverError,
  unauthorized
} from '@/lib/utils/http';

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

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      partnerId: string;
    }>;
  }
): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const params = await context.params;
    const raw = (await request.json()) as unknown;
    const payload = partnerPatchSchema.parse(raw);

    const existing = await prisma.partnerProfile.findFirst({
      where: {
        id: params.partnerId,
        ownerUserId: sessionUser.userId
      }
    });

    if (!existing) {
      return notFound('수정할 궁합 상대를 찾을 수 없습니다.');
    }

    const merged = partnerCreateSchema.parse({
      name: payload.name ?? existing.name,
      relationship:
        payload.relationship === undefined
          ? (existing.relationship ?? undefined)
          : (payload.relationship ?? undefined),
      birthDate:
        payload.birthDate ??
        existing.birthDate ??
        toBirthDate(existing.birthDateTime),
      birthTime:
        payload.birthTime === undefined
          ? existing.isBirthTimeUnknown
            ? null
            : (existing.birthTime ?? toBirthTime(existing.birthDateTime))
          : payload.birthTime,
      birthTimeUnknown: payload.birthTimeUnknown ?? existing.isBirthTimeUnknown,
      birthCalendarType:
        payload.birthCalendarType ?? existing.birthCalendarType,
      isLeapMonth: payload.isLeapMonth ?? existing.isLeapMonth,
      gender: payload.gender ?? existing.gender,
      mbtiType:
        payload.mbtiType === null
          ? undefined
          : (payload.mbtiType ?? existing.mbtiType ?? undefined)
    });

    const birthDateTime = composeBirthDateTime(
      merged.birthDate,
      merged.birthTime,
      merged.birthTimeUnknown
    );

    const partner = await prisma.partnerProfile.update({
      where: { id: existing.id },
      data: {
        name: merged.name,
        relationship: merged.relationship ?? null,
        birthDateTime,
        birthDate: merged.birthDate,
        birthTime: merged.birthTimeUnknown ? null : (merged.birthTime ?? null),
        isBirthTimeUnknown: merged.birthTimeUnknown,
        birthCalendarType: merged.birthCalendarType,
        isLeapMonth:
          merged.birthCalendarType === 'SOLAR' ? false : merged.isLeapMonth,
        birthPlace: DEFAULT_BIRTH_PLACE,
        gender: merged.gender,
        mbtiType: merged.mbtiType ?? null
      }
    });

    return NextResponse.json({
      partner: mapPartner(partner)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      partnerId: string;
    }>;
  }
): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const params = await context.params;

    const deleted = await prisma.partnerProfile.deleteMany({
      where: {
        id: params.partnerId,
        ownerUserId: sessionUser.userId
      }
    });

    if (deleted.count === 0) {
      return notFound('삭제할 궁합 상대를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      partnerId: params.partnerId
    });
  } catch {
    return serverError();
  }
}
