import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type MbtiType } from '@prisma/client';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  buildCompatibilityReadingCacheKey,
  buildSelfReadingCacheKey,
  resolveReadingPeriodContext
} from '@/lib/saju/cache-key';
import {
  SajuGenerationFailureError,
  generateSajuContent
} from '@/lib/saju/generator';
import { toBirthDate, toBirthTime } from '@/lib/saju/datetime';
import {
  createSajuReadingSchema,
  readingListQuerySchema
} from '@/lib/validators/saju';
import type {
  CompatibilityRelationType,
  SelfSubjectType
} from '@/lib/saju/constants';
import {
  getLegacySubjectTypeFromCode,
  normalizeScenarioCode,
  type ScenarioCode
} from '@/lib/saju/scenarios';
import {
  badRequest,
  paymentRequired,
  serverError,
  unauthorized
} from '@/lib/utils/http';

class InsufficientItemError extends Error {}
const STANDARD_GENERATION_FAILURE_MESSAGE =
  '현재 해석기에 일시적인 이상이 있어 해석을 완료하지 못했습니다. 복은 차감되지 않았습니다. 잠시 후 다시 시도해 주세요.';

type ProfileReference =
  | {
      source: 'SELF';
    }
  | {
      source: 'PARTNER';
      partnerId: string;
    };

type ResolvedProfile = {
  source: 'SELF' | 'PARTNER';
  partnerId: string | null;
  name: string;
  birthDate: string;
  birthTime: string | null;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  mbtiType: MbtiType | null;
};

type CachedResult = {
  summary: string;
  sectionsJson: Prisma.InputJsonValue;
};

type NormalizedReadingPayload =
  | {
      readingType: 'SELF';
      scenarioCode: ScenarioCode;
      legacySubjectType: SelfSubjectType | CompatibilityRelationType;
      profile: ProfileReference;
    }
  | {
      readingType: 'COMPATIBILITY';
      scenarioCode: ScenarioCode;
      legacySubjectType: SelfSubjectType | CompatibilityRelationType;
      profileA: ProfileReference;
      profileB: ProfileReference;
    };

async function recordGenerationFailure(input: {
  userId: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  cacheKey?: string;
  periodScope?: 'STATIC' | 'YEARLY' | 'MONTHLY' | 'DAILY';
  periodKey?: string;
  stage:
    | 'RULE_DRAFT'
    | 'LLM_RENDER'
    | 'CODE_VALIDATE'
    | 'LLM_REVIEW'
    | 'FINAL_GUARD'
    | 'PERSIST';
  reasonCode: string;
  reasonMessage: string;
  detailJson?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.sajuGenerationFailure.create({
      data: {
        userId: input.userId,
        readingType: input.readingType,
        subjectType: input.subjectType,
        cacheKey: input.cacheKey,
        periodScope: input.periodScope,
        periodKey: input.periodKey,
        stage: input.stage,
        reasonCode: input.reasonCode,
        reasonMessage: input.reasonMessage,
        detailJson: input.detailJson
      }
    });
  } catch {
    // Swallow logging errors so user-facing behavior stays deterministic.
  }
}

function parseCachedResult(resultJson: Prisma.JsonValue): CachedResult | null {
  if (!resultJson || typeof resultJson !== 'object') {
    return null;
  }

  const target = resultJson as {
    summary?: unknown;
    sectionsJson?: unknown;
  };

  if (typeof target.summary !== 'string' || target.sectionsJson === undefined) {
    return null;
  }

  return {
    summary: target.summary,
    sectionsJson: target.sectionsJson as Prisma.InputJsonValue
  };
}

function collectRequestedPartnerIds(payload: {
  readingType: 'SELF' | 'COMPATIBILITY';
  profile?: ProfileReference;
  profileA?: ProfileReference;
  profileB?: ProfileReference;
}): string[] {
  const ids = new Set<string>();

  if (payload.readingType === 'SELF') {
    if (payload.profile?.source === 'PARTNER') {
      ids.add(payload.profile.partnerId);
    }
  } else {
    if (payload.profileA?.source === 'PARTNER') {
      ids.add(payload.profileA.partnerId);
    }
    if (payload.profileB?.source === 'PARTNER') {
      ids.add(payload.profileB.partnerId);
    }
  }

  return Array.from(ids);
}

function resolveProfile(
  profileRef: ProfileReference,
  input: {
    self: {
      name: string;
      birthDate: string;
      birthTime: string | null;
      birthTimeUnknown: boolean;
      birthCalendarType: 'SOLAR' | 'LUNAR';
      isLeapMonth: boolean;
      gender: 'MALE' | 'FEMALE' | 'OTHER';
      mbtiType: MbtiType | null;
    };
    partners: Map<
      string,
      {
        id: string;
        name: string;
        birthDateTime: Date;
        birthDate: string | null;
        birthTime: string | null;
        isBirthTimeUnknown: boolean;
        birthCalendarType: 'SOLAR' | 'LUNAR';
        isLeapMonth: boolean;
        gender: 'MALE' | 'FEMALE' | 'OTHER';
        mbtiType: MbtiType | null;
      }
    >;
  }
): ResolvedProfile | null {
  if (profileRef.source === 'SELF') {
    return {
      source: 'SELF',
      partnerId: null,
      name: input.self.name,
      birthDate: input.self.birthDate,
      birthTime: input.self.birthTime,
      birthTimeUnknown: input.self.birthTimeUnknown,
      birthCalendarType: input.self.birthCalendarType,
      isLeapMonth: input.self.isLeapMonth,
      gender: input.self.gender,
      mbtiType: input.self.mbtiType
    };
  }

  const partner = input.partners.get(profileRef.partnerId);
  if (!partner) {
    return null;
  }

  return {
    source: 'PARTNER',
    partnerId: partner.id,
    name: partner.name,
    birthDate: partner.birthDate ?? toBirthDate(partner.birthDateTime),
    birthTime: partner.isBirthTimeUnknown
      ? null
      : (partner.birthTime ?? toBirthTime(partner.birthDateTime)),
    birthTimeUnknown: partner.isBirthTimeUnknown,
    birthCalendarType: partner.birthCalendarType,
    isLeapMonth: partner.isLeapMonth,
    gender: partner.gender,
    mbtiType: partner.mbtiType
  };
}

function mapReadingListItem(reading: {
  id: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  chargeStatus: 'CHARGED' | 'SKIPPED_DUPLICATE';
  itemCost: number;
  cacheHit: boolean;
  createdAt: Date;
  firstPartner: {
    id: string;
    name: string;
    mbtiType: string | null;
  } | null;
  partner: {
    id: string;
    name: string;
    mbtiType: string | null;
  } | null;
  result: {
    summary: string;
  } | null;
  cache: {
    resultJson: Prisma.JsonValue;
  } | null;
}) {
  const fallbackSummary = reading.cache
    ? (parseCachedResult(reading.cache.resultJson)?.summary ?? null)
    : null;
  const firstLabel = reading.firstPartner?.name ?? '내 정보';
  const secondLabel = reading.partner?.name ?? '내 정보';
  const targetLabel =
    reading.readingType === 'SELF'
      ? firstLabel
      : `${firstLabel} · ${secondLabel}`;

  return {
    id: reading.id,
    readingType: reading.readingType,
    subjectType: reading.subjectType,
    chargeStatus: reading.chargeStatus,
    itemCost: reading.itemCost,
    cacheHit: reading.cacheHit,
    createdAt: reading.createdAt.toISOString(),
    targetLabel,
    summary: reading.result?.summary ?? fallbackSummary,
    firstPartner: reading.firstPartner
      ? {
          id: reading.firstPartner.id,
          name: reading.firstPartner.name,
          mbtiType: reading.firstPartner.mbtiType
        }
      : null,
    partner: reading.partner
      ? {
          id: reading.partner.id,
          name: reading.partner.name,
          mbtiType: reading.partner.mbtiType
        }
      : null
  };
}

function mapDuplicateResponse(reading: {
  id: string;
  readingType: 'SELF' | 'COMPATIBILITY';
  subjectType: string;
  cacheHit: boolean;
  createdAt: Date;
  result: {
    summary: string;
  } | null;
}) {
  return {
    duplicate: true,
    itemCharged: false,
    readingId: reading.id,
    readingType: reading.readingType,
    subjectType: reading.subjectType,
    cacheHit: reading.cacheHit,
    createdAt: reading.createdAt.toISOString(),
    summary: reading.result?.summary ?? null
  };
}

function normalizeReadingPayload(
  payload: ReturnType<typeof createSajuReadingSchema.parse>
): NormalizedReadingPayload | null {
  const scenarioCode =
    'scenarioCode' in payload
      ? normalizeScenarioCode(payload.readingType, payload.scenarioCode)
      : normalizeScenarioCode(payload.readingType, payload.subjectType);

  if (!scenarioCode) {
    return null;
  }

  const legacySubjectType = getLegacySubjectTypeFromCode(scenarioCode);
  if (!legacySubjectType) {
    return null;
  }

  if (payload.readingType === 'SELF') {
    return {
      readingType: 'SELF',
      scenarioCode,
      legacySubjectType,
      profile: payload.profile
    };
  }

  return {
    readingType: 'COMPATIBILITY',
    scenarioCode,
    legacySubjectType,
    profileA: payload.profileA,
    profileB: payload.profileB
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const query = readingListQuerySchema.parse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined
    });

    const readings = await prisma.sajuReading.findMany({
      where: {
        userId: sessionUser.userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: query.limit,
      include: {
        firstPartner: {
          select: {
            id: true,
            name: true,
            mbtiType: true
          }
        },
        partner: {
          select: {
            id: true,
            name: true,
            mbtiType: true
          }
        },
        result: {
          select: {
            summary: true
          }
        },
        cache: {
          select: {
            resultJson: true
          }
        }
      }
    });

    return NextResponse.json({
      readings: readings.map((reading) => mapReadingListItem(reading))
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    return serverError();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return unauthorized();
  }

  let cacheKey = '';
  let periodScope: 'STATIC' | 'YEARLY' | 'MONTHLY' | 'DAILY' | undefined;
  let periodKey: string | undefined;
  let readingTypeForError: 'SELF' | 'COMPATIBILITY' | undefined;
  let subjectTypeForError: string | undefined;

  try {
    const raw = (await request.json()) as unknown;
    const payload = createSajuReadingSchema.parse(raw);
    const normalizedPayload = normalizeReadingPayload(payload);
    if (!normalizedPayload) {
      return badRequest('선택한 해석 항목을 확인해 주세요.');
    }
    const periodContext = resolveReadingPeriodContext(
      normalizedPayload.legacySubjectType
    );
    periodScope = periodContext.scope;
    periodKey = periodContext.periodKey;
    readingTypeForError = normalizedPayload.readingType;
    subjectTypeForError = normalizedPayload.scenarioCode;

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

    if (!user.profile) {
      return badRequest('내 정보를 먼저 입력해 주세요.');
    }

    const selfProfile = {
      name: user.profile.name,
      birthDate:
        user.profile.birthDate ?? toBirthDate(user.profile.birthDateTime),
      birthTime: user.profile.isBirthTimeUnknown
        ? null
        : (user.profile.birthTime ?? toBirthTime(user.profile.birthDateTime)),
      birthTimeUnknown: user.profile.isBirthTimeUnknown,
      birthCalendarType: user.profile.birthCalendarType,
      isLeapMonth: user.profile.isLeapMonth,
      gender: user.profile.gender,
      mbtiType: user.mbtiProfile?.mbtiType ?? null
    };

    const requestedPartnerIds = collectRequestedPartnerIds(normalizedPayload);
    const partners = requestedPartnerIds.length
      ? await prisma.partnerProfile.findMany({
          where: {
            ownerUserId: sessionUser.userId,
            id: {
              in: requestedPartnerIds
            }
          },
          select: {
            id: true,
            name: true,
            birthDateTime: true,
            birthDate: true,
            birthTime: true,
            isBirthTimeUnknown: true,
            birthCalendarType: true,
            isLeapMonth: true,
            gender: true,
            mbtiType: true
          }
        })
      : [];

    if (partners.length !== requestedPartnerIds.length) {
      return badRequest('선택한 프로필을 찾을 수 없습니다.');
    }

    const partnerMap = new Map(
      partners.map((partner) => [partner.id, partner])
    );

    let firstProfile: ResolvedProfile | null = null;
    let secondProfile: ResolvedProfile | null = null;

    if (normalizedPayload.readingType === 'SELF') {
      firstProfile = resolveProfile(normalizedPayload.profile, {
        self: selfProfile,
        partners: partnerMap
      });

      if (!firstProfile) {
        return badRequest('선택한 프로필을 찾을 수 없습니다.');
      }

      cacheKey = buildSelfReadingCacheKey({
        readingType: 'SELF',
        subjectType: normalizedPayload.scenarioCode,
        period: {
          scope: periodContext.scope,
          periodKey: periodContext.periodKey
        },
        self: {
          birthDate: firstProfile.birthDate,
          birthTime: firstProfile.birthTime,
          birthTimeUnknown: firstProfile.birthTimeUnknown,
          birthCalendarType: firstProfile.birthCalendarType,
          isLeapMonth: firstProfile.isLeapMonth,
          gender: firstProfile.gender,
          mbtiType: firstProfile.mbtiType
        }
      });
    } else {
      firstProfile = resolveProfile(normalizedPayload.profileA, {
        self: selfProfile,
        partners: partnerMap
      });
      secondProfile = resolveProfile(normalizedPayload.profileB, {
        self: selfProfile,
        partners: partnerMap
      });

      if (!firstProfile || !secondProfile) {
        return badRequest('선택한 프로필을 찾을 수 없습니다.');
      }

      cacheKey = buildCompatibilityReadingCacheKey({
        readingType: 'COMPATIBILITY',
        subjectType: normalizedPayload.scenarioCode,
        period: {
          scope: periodContext.scope,
          periodKey: periodContext.periodKey
        },
        self: {
          birthDate: firstProfile.birthDate,
          birthTime: firstProfile.birthTime,
          birthTimeUnknown: firstProfile.birthTimeUnknown,
          birthCalendarType: firstProfile.birthCalendarType,
          isLeapMonth: firstProfile.isLeapMonth,
          gender: firstProfile.gender,
          mbtiType: firstProfile.mbtiType
        },
        partner: {
          birthDate: secondProfile.birthDate,
          birthTime: secondProfile.birthTime,
          birthTimeUnknown: secondProfile.birthTimeUnknown,
          birthCalendarType: secondProfile.birthCalendarType,
          isLeapMonth: secondProfile.isLeapMonth,
          gender: secondProfile.gender,
          mbtiType: secondProfile.mbtiType
        }
      });
    }

    const existingReading = await prisma.sajuReading.findUnique({
      where: {
        userId_cacheKey: {
          userId: sessionUser.userId,
          cacheKey
        }
      },
      include: {
        result: {
          select: {
            summary: true
          }
        }
      }
    });

    if (existingReading) {
      const wallet = await prisma.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      });

      return NextResponse.json({
        ...mapDuplicateResponse(existingReading),
        balance: wallet?.balance ?? 0
      });
    }

    const existingCache = await prisma.sajuResultCache.findUnique({
      where: { cacheKey }
    });
    const existingCachedResult = existingCache
      ? parseCachedResult(existingCache.resultJson)
      : null;
    const isReusableCache = Boolean(existingCachedResult);

    const generatedContent = existingCachedResult
      ? null
      : await generateSajuContent({
          cacheKey,
          periodContext,
          readingType: normalizedPayload.readingType,
          subjectType: normalizedPayload.legacySubjectType,
          scenarioCode: normalizedPayload.scenarioCode,
          userName: firstProfile?.name ?? user.profile.name,
          userMbtiType: firstProfile?.mbtiType ?? null,
          userBirthInfo: {
            birthDate: firstProfile?.birthDate ?? selfProfile.birthDate,
            birthTime: firstProfile?.birthTime ?? selfProfile.birthTime,
            birthTimeUnknown:
              firstProfile?.birthTimeUnknown ?? selfProfile.birthTimeUnknown,
            birthCalendarType:
              firstProfile?.birthCalendarType ?? selfProfile.birthCalendarType,
            isLeapMonth: firstProfile?.isLeapMonth ?? selfProfile.isLeapMonth,
            gender: firstProfile?.gender ?? selfProfile.gender
          },
          partnerName: secondProfile?.name,
          partnerMbtiType: secondProfile?.mbtiType ?? null,
          partnerBirthInfo: secondProfile
            ? {
                birthDate: secondProfile.birthDate,
                birthTime: secondProfile.birthTime,
                birthTimeUnknown: secondProfile.birthTimeUnknown,
                birthCalendarType: secondProfile.birthCalendarType,
                isLeapMonth: secondProfile.isLeapMonth,
                gender: secondProfile.gender
              }
            : undefined
        });

    const transactionResult = await prisma.$transaction(async (transaction) => {
      const duplicated = await transaction.sajuReading.findUnique({
        where: {
          userId_cacheKey: {
            userId: sessionUser.userId,
            cacheKey
          }
        },
        include: {
          result: {
            select: {
              summary: true
            }
          }
        }
      });

      if (duplicated) {
        const wallet = await transaction.sajuItemWallet.findUnique({
          where: { userId: sessionUser.userId }
        });

        return {
          duplicate: true as const,
          payload: {
            ...mapDuplicateResponse(duplicated),
            balance: wallet?.balance ?? 0
          }
        };
      }

      await transaction.sajuItemWallet.upsert({
        where: { userId: sessionUser.userId },
        update: {},
        create: {
          userId: sessionUser.userId,
          balance: 0
        }
      });

      const deducted = await transaction.sajuItemWallet.updateMany({
        where: {
          userId: sessionUser.userId,
          balance: {
            gte: 1
          }
        },
        data: {
          balance: {
            decrement: 1
          }
        }
      });

      if (deducted.count === 0) {
        throw new InsufficientItemError();
      }

      const persistedCache = await transaction.sajuResultCache.upsert({
        where: { cacheKey },
        update: isReusableCache
          ? {}
          : {
              resultJson:
                generatedContent?.resultJson ?? ({} as Prisma.InputJsonValue),
              scope: periodContext.scope,
              periodKey: periodContext.periodKey,
              metadataJson: generatedContent?.metadata as Prisma.InputJsonValue,
              ruleVersion:
                generatedContent?.versions.ruleVersion ?? 'rules-unknown',
              templateVersion:
                generatedContent?.versions.templateVersion ??
                'template-unknown',
              promptVersion:
                generatedContent?.versions.promptVersion ?? 'prompt-unknown',
              modelVersion:
                generatedContent?.versions.modelVersion ?? 'model-unknown'
            },
        create: {
          cacheKey,
          resultJson: isReusableCache
            ? ({
                summary: existingCachedResult!.summary,
                sectionsJson: existingCachedResult!.sectionsJson
              } as Prisma.InputJsonValue)
            : (generatedContent?.resultJson ?? ({} as Prisma.InputJsonValue)),
          scope: periodContext.scope,
          periodKey: periodContext.periodKey,
          metadataJson: isReusableCache
            ? (existingCache?.metadataJson as Prisma.InputJsonValue | undefined)
            : (generatedContent?.metadata as Prisma.InputJsonValue),
          ruleVersion: isReusableCache
            ? (existingCache?.ruleVersion ?? 'rules-unknown')
            : (generatedContent?.versions.ruleVersion ?? 'rules-unknown'),
          templateVersion: isReusableCache
            ? (existingCache?.templateVersion ?? 'template-unknown')
            : (generatedContent?.versions.templateVersion ??
              'template-unknown'),
          promptVersion: isReusableCache
            ? (existingCache?.promptVersion ?? 'prompt-unknown')
            : (generatedContent?.versions.promptVersion ?? 'prompt-unknown'),
          modelVersion: isReusableCache
            ? (existingCache?.modelVersion ?? 'model-unknown')
            : (generatedContent?.versions.modelVersion ?? 'model-unknown')
        }
      });

      if (isReusableCache) {
        await transaction.sajuResultCacheHit.upsert({
          where: { cacheKey },
          update: {
            hitCount: {
              increment: 1
            },
            lastHitAt: new Date()
          },
          create: {
            cacheKey,
            hitCount: 1
          }
        });
      } else {
        await transaction.sajuResultCacheHit.upsert({
          where: { cacheKey },
          update: {},
          create: {
            cacheKey,
            hitCount: 0
          }
        });
      }

      const reading = await transaction.sajuReading.create({
        data: {
          userId: sessionUser.userId,
          readingType: normalizedPayload.readingType,
          subjectType: normalizedPayload.scenarioCode,
          firstPartnerId:
            firstProfile?.source === 'PARTNER' ? firstProfile.partnerId : null,
          partnerId:
            normalizedPayload.readingType === 'COMPATIBILITY' &&
            secondProfile?.source === 'PARTNER'
              ? secondProfile.partnerId
              : null,
          cacheKey: persistedCache.cacheKey,
          cacheHit: isReusableCache,
          chargeStatus: 'CHARGED',
          itemCost: 1
        }
      });

      const summary = existingCachedResult
        ? existingCachedResult.summary
        : (generatedContent?.summary ?? '결과를 생성했습니다.');
      const sectionsJson: Prisma.InputJsonValue = existingCachedResult
        ? existingCachedResult.sectionsJson
        : ((generatedContent?.sectionsJson ?? {}) as Prisma.InputJsonValue);

      await transaction.sajuReadingResult.create({
        data: {
          readingId: reading.id,
          summary,
          sectionsJson
        }
      });

      const wallet = await transaction.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      });

      return {
        duplicate: false as const,
        payload: {
          duplicate: false,
          itemCharged: true,
          readingId: reading.id,
          readingType: reading.readingType,
          subjectType: reading.subjectType,
          cacheHit: reading.cacheHit,
          chargeStatus: reading.chargeStatus,
          itemCost: reading.itemCost,
          createdAt: reading.createdAt.toISOString(),
          balance: wallet?.balance ?? 0,
          summary
        }
      };
    });

    return NextResponse.json(transactionResult.payload, {
      status: transactionResult.duplicate ? 200 : 201
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest('입력값 검증에 실패했습니다.', error.flatten());
    }

    if (error instanceof SajuGenerationFailureError) {
      await recordGenerationFailure({
        userId: sessionUser.userId,
        readingType: readingTypeForError ?? 'SELF',
        subjectType: subjectTypeForError ?? 'BASIC',
        cacheKey: cacheKey || undefined,
        periodScope,
        periodKey,
        stage: error.stage,
        reasonCode: error.reasonCode,
        reasonMessage: error.message,
        detailJson: error.detail as Prisma.InputJsonValue | undefined
      });

      const wallet = await prisma.sajuItemWallet.findUnique({
        where: { userId: sessionUser.userId }
      });

      return NextResponse.json(
        {
          error: STANDARD_GENERATION_FAILURE_MESSAGE,
          balance: wallet?.balance ?? 0
        },
        { status: 503 }
      );
    }

    if (error instanceof InsufficientItemError) {
      return paymentRequired('복이 부족합니다. 충전 후 다시 시도해 주세요.');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      cacheKey
    ) {
      const existing = await prisma.sajuReading.findUnique({
        where: {
          userId_cacheKey: {
            userId: sessionUser.userId,
            cacheKey
          }
        },
        include: {
          result: {
            select: {
              summary: true
            }
          }
        }
      });

      if (existing) {
        const wallet = await prisma.sajuItemWallet.findUnique({
          where: { userId: sessionUser.userId }
        });

        return NextResponse.json({
          ...mapDuplicateResponse(existing),
          balance: wallet?.balance ?? 0
        });
      }
    }

    await recordGenerationFailure({
      userId: sessionUser.userId,
      readingType: readingTypeForError ?? 'SELF',
      subjectType: subjectTypeForError ?? 'BASIC',
      cacheKey: cacheKey || undefined,
      periodScope,
      periodKey,
      stage: 'PERSIST',
      reasonCode: 'UNEXPECTED_PERSIST_FAILURE',
      reasonMessage:
        error instanceof Error
          ? error.message
          : 'Unexpected persistence failure',
      detailJson:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? ({
              code: error.code,
              meta: error.meta ?? null
            } as Prisma.InputJsonValue)
          : undefined
    });

    const wallet = await prisma.sajuItemWallet.findUnique({
      where: { userId: sessionUser.userId }
    });

    return NextResponse.json(
      {
        error: STANDARD_GENERATION_FAILURE_MESSAGE,
        balance: wallet?.balance ?? 0
      },
      { status: 503 }
    );
  }
}
