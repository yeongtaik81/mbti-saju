import { z } from 'zod';
import { MBTI_TYPE_VALUES } from '@/lib/mbti/test-engine';
import {
  COMPATIBILITY_RELATION_TYPES,
  SELF_SUBJECT_TYPES
} from '@/lib/saju/constants';
import {
  COMPATIBILITY_SCENARIO_CODES,
  SELF_SCENARIO_CODES
} from '@/lib/saju/scenarios';

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일은 YYYY-MM-DD 형식이어야 합니다.');

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '출생시각은 HH:mm 형식이어야 합니다.');

const partnerCoreSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
  relationship: z
    .string()
    .trim()
    .min(1, '관계를 입력해 주세요.')
    .max(50)
    .optional(),
  birthDate: dateSchema,
  birthTime: timeSchema.nullish(),
  birthTimeUnknown: z.boolean().default(false),
  birthCalendarType: z.enum(['SOLAR', 'LUNAR']).default('SOLAR'),
  isLeapMonth: z.boolean().default(false),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  mbtiType: z.enum(MBTI_TYPE_VALUES).optional()
});

function validatePartnerRules(
  payload: z.infer<typeof partnerCoreSchema>,
  context: z.RefinementCtx
): void {
  if (!payload.birthTimeUnknown && !payload.birthTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birthTime'],
      message: '출생시각을 입력하거나 "모름"을 선택해 주세요.'
    });
  }

  if (payload.birthTimeUnknown && payload.birthTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birthTimeUnknown'],
      message: '"출생시각 모름" 선택 시 시각 입력은 비워주세요.'
    });
  }

  if (payload.birthCalendarType === 'SOLAR' && payload.isLeapMonth) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isLeapMonth'],
      message: '양력 선택 시 윤달을 선택할 수 없습니다.'
    });
  }
}

export const partnerCreateSchema = partnerCoreSchema.superRefine(
  (payload, context) => {
    validatePartnerRules(payload, context);
  }
);

export const partnerPatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  relationship: z.string().trim().min(1).max(50).nullable().optional(),
  birthDate: dateSchema.optional(),
  birthTime: timeSchema.nullish().optional(),
  birthTimeUnknown: z.boolean().optional(),
  birthCalendarType: z.enum(['SOLAR', 'LUNAR']).optional(),
  isLeapMonth: z.boolean().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  mbtiType: z.enum(MBTI_TYPE_VALUES).nullable().optional()
});

const profileReferenceSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('SELF')
  }),
  z.object({
    source: z.literal('PARTNER'),
    partnerId: z.string().trim().min(1, '프로필을 선택해 주세요.')
  })
]);

const selfReadingScenarioSchema = z.object({
  readingType: z.literal('SELF'),
  scenarioCode: z.enum(SELF_SCENARIO_CODES as [string, ...string[]]),
  profile: profileReferenceSchema
});

const selfReadingLegacySchema = z.object({
  readingType: z.literal('SELF'),
  subjectType: z.enum(SELF_SUBJECT_TYPES),
  profile: profileReferenceSchema
});

const compatibilityReadingScenarioSchema = z.object({
  readingType: z.literal('COMPATIBILITY'),
  scenarioCode: z.enum(COMPATIBILITY_SCENARIO_CODES as [string, ...string[]]),
  profileA: profileReferenceSchema,
  profileB: profileReferenceSchema
});

const compatibilityReadingLegacySchema = z.object({
  readingType: z.literal('COMPATIBILITY'),
  subjectType: z.enum(COMPATIBILITY_RELATION_TYPES),
  profileA: profileReferenceSchema,
  profileB: profileReferenceSchema
});

export const createSajuReadingSchema = z
  .union([
    selfReadingScenarioSchema,
    selfReadingLegacySchema,
    compatibilityReadingScenarioSchema,
    compatibilityReadingLegacySchema
  ])
  .superRefine((payload, context) => {
    if (payload.readingType !== 'COMPATIBILITY') {
      return;
    }

    const isBothSelf =
      payload.profileA.source === 'SELF' && payload.profileB.source === 'SELF';
    if (isBothSelf) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profileB'],
        message: '궁합은 서로 다른 두 사람을 선택해 주세요.'
      });
      return;
    }

    const isSamePartner =
      payload.profileA.source === 'PARTNER' &&
      payload.profileB.source === 'PARTNER' &&
      payload.profileA.partnerId === payload.profileB.partnerId;

    if (isSamePartner) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profileB'],
        message: '궁합은 서로 다른 두 사람을 선택해 주세요.'
      });
    }
  });

export const readingListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30)
});
