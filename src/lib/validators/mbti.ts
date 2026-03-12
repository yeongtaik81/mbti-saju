import { z } from 'zod';

export const mbtiTestAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  optionId: z.enum(['A', 'B'])
});

export const mbtiTestSubmitSchema = z.object({
  answers: z.array(mbtiTestAnswerSchema).min(1)
});

export const mbtiEngagementEventSchema = z.object({
  eventType: z.enum(['PAGE_VIEW', 'RESULT_VIEWED', 'RESULT_SAVED']),
  testType: z.enum(['MINI', 'FULL']).optional(),
  mbtiType: z
    .enum([
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
    ])
    .optional(),
  pagePath: z.string().trim().min(1).max(120).optional()
});
