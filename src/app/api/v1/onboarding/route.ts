import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  onboardingCreateSchema,
  onboardingPatchSchema,
  onboardingResolvedSchema
} from '@/lib/validators/onboarding';
import { badRequest, unauthorized, serverError } from '@/lib/utils/http';

const KOREA_COUNTRY_NAME = '대한민국';
const DEFAULT_BIRTH_PLACE = '대한민국';

function composeBirthDateTime(
  birthDate: string,
  birthTime: string | null | undefined,
  birthTimeUnknown: boolean
): Date {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = birthDate
    .split('-')
    .map((value) => Number(value));
  const effectiveTime = birthTimeUnknown ? '12:00' : (birthTime ?? '00:00');
  const [hour = Number.NaN, minute = Number.NaN] = effectiveTime
    .split(':')
    .map((value) => Number(value));

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function mapProfileToOnboarding(profile: {
  name: string;
  birthDateTime: Date;
  birthDate: string | null;
  birthTime: string | null;
  isBirthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  birthCountryType: 'KOREA' | 'OTHER';
  birthCountry: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
}) {
  const fallbackBirthDate = profile.birthDateTime.toISOString().slice(0, 10);
  const fallbackBirthTime = profile.birthDateTime.toISOString().slice(11, 16);

  return {
    name: profile.name,
    birthDateTime: profile.birthDateTime.toISOString(),
    birthDate: profile.birthDate ?? fallbackBirthDate,
    birthTime: profile.isBirthTimeUnknown
      ? null
      : (profile.birthTime ?? fallbackBirthTime),
    birthTimeUnknown: profile.isBirthTimeUnknown,
    birthCalendarType: profile.birthCalendarType,
    isLeapMonth: profile.isLeapMonth,
    birthCountryType: 'KOREA' as const,
    birthCountry: KOREA_COUNTRY_NAME,
    gender: profile.gender
  };
}

function normalizeOnboardingPayload(payload: {
  name: string;
  birthDate: string;
  birthTime?: string | null;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
}) {
  return {
    ...payload,
    birthTime: payload.birthTimeUnknown ? null : (payload.birthTime ?? null),
    isLeapMonth:
      payload.birthCalendarType === 'SOLAR' ? false : payload.isLeapMonth,
    birthCountryType: 'KOREA' as const,
    birthCountry: KOREA_COUNTRY_NAME
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      include: {
        profile: true,
        mbtiProfile: true,
        wallet: true
      }
    });

    if (!user) {
      return unauthorized();
    }

    return NextResponse.json({
      onboarding: user.profile ? mapProfileToOnboarding(user.profile) : null,
      mbti: user.mbtiProfile
        ? {
            mbtiType: user.mbtiProfile.mbtiType,
            sourceType: user.mbtiProfile.sourceType,
            decidedAt: user.mbtiProfile.decidedAt.toISOString()
          }
        : null,
      itemBalance: user.wallet?.balance ?? 0
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
    const payload = onboardingCreateSchema.parse(raw);
    const normalizedPayload = normalizeOnboardingPayload(payload);
    const validatedPayload = onboardingResolvedSchema.parse(normalizedPayload);
    const birthDateTime = composeBirthDateTime(
      validatedPayload.birthDate,
      validatedPayload.birthTime,
      validatedPayload.birthTimeUnknown
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.userProfile.upsert({
        where: { userId: sessionUser.userId },
        update: {
          name: validatedPayload.name,
          birthDateTime,
          birthDate: validatedPayload.birthDate,
          birthTime: validatedPayload.birthTime,
          isBirthTimeUnknown: validatedPayload.birthTimeUnknown,
          birthCalendarType: validatedPayload.birthCalendarType,
          isLeapMonth: validatedPayload.isLeapMonth,
          birthCountryType: 'KOREA',
          birthCountry: KOREA_COUNTRY_NAME,
          birthPlace: DEFAULT_BIRTH_PLACE,
          gender: validatedPayload.gender
        },
        create: {
          userId: sessionUser.userId,
          name: validatedPayload.name,
          birthDateTime,
          birthDate: validatedPayload.birthDate,
          birthTime: validatedPayload.birthTime,
          isBirthTimeUnknown: validatedPayload.birthTimeUnknown,
          birthCalendarType: validatedPayload.birthCalendarType,
          isLeapMonth: validatedPayload.isLeapMonth,
          birthCountryType: 'KOREA',
          birthCountry: KOREA_COUNTRY_NAME,
          birthPlace: DEFAULT_BIRTH_PLACE,
          gender: validatedPayload.gender
        }
      });

      if (payload.mbtiType) {
        await transaction.mbtiProfile.upsert({
          where: { userId: sessionUser.userId },
          update: {
            mbtiType: payload.mbtiType,
            sourceType: 'DIRECT'
          },
          create: {
            userId: sessionUser.userId,
            mbtiType: payload.mbtiType,
            sourceType: 'DIRECT'
          }
        });
      }
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const raw = (await request.json()) as unknown;
    const payload = onboardingPatchSchema.parse(raw);

    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: sessionUser.userId }
    });

    const existingOnboarding = existingProfile
      ? mapProfileToOnboarding(existingProfile)
      : null;

    const mergedPayload = normalizeOnboardingPayload({
      name: payload.name ?? existingOnboarding?.name ?? '',
      birthDate: payload.birthDate ?? existingOnboarding?.birthDate ?? '',
      birthTime:
        payload.birthTime === undefined
          ? (existingOnboarding?.birthTime ?? null)
          : payload.birthTime,
      birthTimeUnknown:
        payload.birthTimeUnknown ??
        existingOnboarding?.birthTimeUnknown ??
        false,
      birthCalendarType:
        payload.birthCalendarType ??
        existingOnboarding?.birthCalendarType ??
        'SOLAR',
      isLeapMonth:
        payload.isLeapMonth ?? existingOnboarding?.isLeapMonth ?? false,
      gender: payload.gender ?? existingOnboarding?.gender ?? 'FEMALE'
    });

    const validatedPayload = onboardingResolvedSchema.safeParse(mergedPayload);
    if (!validatedPayload.success) {
      return badRequest(
        '입력값 검증에 실패했습니다.',
        validatedPayload.error.flatten()
      );
    }

    const birthDateTime = composeBirthDateTime(
      validatedPayload.data.birthDate,
      validatedPayload.data.birthTime,
      validatedPayload.data.birthTimeUnknown
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.userProfile.upsert({
        where: { userId: sessionUser.userId },
        update: {
          name: validatedPayload.data.name,
          birthDateTime,
          birthDate: validatedPayload.data.birthDate,
          birthTime: validatedPayload.data.birthTime,
          isBirthTimeUnknown: validatedPayload.data.birthTimeUnknown,
          birthCalendarType: validatedPayload.data.birthCalendarType,
          isLeapMonth: validatedPayload.data.isLeapMonth,
          birthCountryType: 'KOREA',
          birthCountry: KOREA_COUNTRY_NAME,
          birthPlace: DEFAULT_BIRTH_PLACE,
          gender: validatedPayload.data.gender
        },
        create: {
          userId: sessionUser.userId,
          name: validatedPayload.data.name,
          birthDateTime,
          birthDate: validatedPayload.data.birthDate,
          birthTime: validatedPayload.data.birthTime,
          isBirthTimeUnknown: validatedPayload.data.birthTimeUnknown,
          birthCalendarType: validatedPayload.data.birthCalendarType,
          isLeapMonth: validatedPayload.data.isLeapMonth,
          birthCountryType: 'KOREA',
          birthCountry: KOREA_COUNTRY_NAME,
          birthPlace: DEFAULT_BIRTH_PLACE,
          gender: validatedPayload.data.gender
        }
      });

      if (payload.mbtiType) {
        await transaction.mbtiProfile.upsert({
          where: { userId: sessionUser.userId },
          update: {
            mbtiType: payload.mbtiType,
            sourceType: 'DIRECT'
          },
          create: {
            userId: sessionUser.userId,
            mbtiType: payload.mbtiType,
            sourceType: 'DIRECT'
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}
