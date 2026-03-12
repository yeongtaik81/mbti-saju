import { z } from 'zod';

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일은 YYYY-MM-DD 형식이어야 합니다.');

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '출생시각은 HH:mm 형식이어야 합니다.');

const mbtiTypes = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP'
] as const;

const birthCalendarTypeSchema = z.enum(['SOLAR', 'LUNAR']);

const onboardingCoreSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
  birthDate: dateSchema,
  birthTime: timeSchema.nullish(),
  birthTimeUnknown: z.boolean().default(false),
  birthCalendarType: birthCalendarTypeSchema.default('SOLAR'),
  isLeapMonth: z.boolean().default(false),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'])
});

function validateOnboardingBusinessRules(
  payload: z.infer<typeof onboardingCoreSchema>,
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

const onboardingPatchBaseSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  birthDate: dateSchema.optional(),
  birthTime: timeSchema.nullish().optional(),
  birthTimeUnknown: z.boolean().optional(),
  birthCalendarType: birthCalendarTypeSchema.optional(),
  isLeapMonth: z.boolean().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional()
});

export const onboardingCreateSchema = onboardingCoreSchema
  .extend({
    mbtiType: z.enum(mbtiTypes).optional()
  })
  .superRefine((payload, context) => {
    validateOnboardingBusinessRules(payload, context);
  });

export const onboardingResolvedSchema = onboardingCoreSchema.superRefine(
  (payload, context) => {
    validateOnboardingBusinessRules(payload, context);
  }
);

export const onboardingPatchSchema = onboardingPatchBaseSchema.extend({
  mbtiType: z.enum(mbtiTypes).optional()
});

export const mbtiDirectSchema = z.object({
  mbtiType: z.enum(mbtiTypes),
  sourceType: z.enum(['DIRECT', 'MINI_TEST', 'FULL_TEST']).default('DIRECT')
});
