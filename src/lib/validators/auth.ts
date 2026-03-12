import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;

export const emailSchema = z.string().trim().email().max(255);

const hasEnglishLetter = (value: string): boolean => /[A-Za-z]/.test(value);
const hasNumber = (value: string): boolean => /[0-9]/.test(value);
const hasSpecialCharacter = (value: string): boolean =>
  /[^A-Za-z0-9\s]/.test(value);
const hasWhitespace = (value: string): boolean => /\s/.test(value);

function countPasswordCharacterTypes(value: string): number {
  const checks = [
    hasEnglishLetter(value),
    hasNumber(value),
    hasSpecialCharacter(value)
  ];
  return checks.filter(Boolean).length;
}

export function getEmailLocalPart(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0];
  return localPart ?? '';
}

export type PasswordPolicyResult = {
  lengthInRange: boolean;
  noWhitespace: boolean;
  twoOrMoreCharacterTypes: boolean;
  noEmailLocalPart: boolean;
};

export function evaluatePasswordPolicy(
  password: string,
  email: string
): PasswordPolicyResult {
  const localPart = getEmailLocalPart(email);
  const normalizedPassword = password.toLowerCase();

  return {
    lengthInRange:
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH,
    noWhitespace: !hasWhitespace(password),
    twoOrMoreCharacterTypes: countPasswordCharacterTypes(password) >= 2,
    noEmailLocalPart:
      localPart.length === 0 ? true : !normalizedPassword.includes(localPart)
  };
}

export const signInPasswordSchema = z.string().min(1).max(100);

export const signUpPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`
  )
  .refine((value) => !hasWhitespace(value), {
    message: '비밀번호에 공백은 사용할 수 없습니다.'
  })
  .refine((value) => countPasswordCharacterTypes(value) >= 2, {
    message: '비밀번호는 영문/숫자/특수문자 중 2가지 이상을 포함해야 합니다.'
  });

export const signInRequestSchema = z.object({
  email: emailSchema,
  password: signInPasswordSchema
});

export const mbtiTypeSchema = z.enum([
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
]);

export const mbtiSourceTypeSchema = z.enum([
  'DIRECT',
  'MINI_TEST',
  'FULL_TEST'
]);

export const signUpMbtiPresetSchema = z.object({
  mbtiType: mbtiTypeSchema,
  sourceType: mbtiSourceTypeSchema
});

const signUpRequestBaseSchema = z.object({
  email: emailSchema,
  password: signUpPasswordSchema
});

function validateSignUpPasswordContainsEmail(
  payload: { email: string; password: string },
  context: z.RefinementCtx
): void {
  const { email, password } = payload;
  const localPart = getEmailLocalPart(email);
  if (localPart.length > 0 && password.toLowerCase().includes(localPart)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: '비밀번호에 이메일 아이디를 포함할 수 없습니다.'
    });
  }
}

export const signUpRequestSchema = signUpRequestBaseSchema.superRefine(
  ({ email, password }, context) => {
    validateSignUpPasswordContainsEmail({ email, password }, context);
  }
);

export const signUpWithMbtiRequestSchema = signUpRequestBaseSchema
  .extend({
    mbti: signUpMbtiPresetSchema.optional()
  })
  .superRefine(({ email, password }, context) => {
    validateSignUpPasswordContainsEmail({ email, password }, context);
  });

export const authRequestSchema = signInRequestSchema;
export const passwordSchema = signUpPasswordSchema;
