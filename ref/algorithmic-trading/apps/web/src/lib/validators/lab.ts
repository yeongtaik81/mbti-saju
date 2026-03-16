import { z } from 'zod';
import { ALGORITHM_STATUS, STRATEGY_TYPE } from '@trading/engine/strategy/lab';
import type { ParamFieldDef } from '@trading/engine/strategy/lab';

const strategyTypes = Object.values(STRATEGY_TYPE) as [string, ...string[]];
const algorithmStatuses = Object.values(ALGORITHM_STATUS) as [
  string,
  ...string[]
];

export const createAlgorithmSchema = z.object({
  name: z.string().min(1).max(100),
  strategyType: z.enum(strategyTypes),
  description: z.string().max(500).optional(),
  hypothesis: z.string().max(1000).optional()
});

export type CreateAlgorithmRequest = z.infer<typeof createAlgorithmSchema>;

export const updateAlgorithmSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  hypothesis: z.string().max(1000).optional(),
  status: z.enum(algorithmStatuses).optional()
});

export type UpdateAlgorithmRequest = z.infer<typeof updateAlgorithmSchema>;

export const labBacktestSchema = z
  .object({
    params: z.record(z.string(), z.number()),
    riskParams: z.object({
      stopLossRate: z.number().min(-0.3).max(0),
      takeProfitRate: z.number().min(0).max(1.0),
      maxHoldDays: z.number().int().min(1).max(252),
      maxPositions: z.number().int().min(1).max(20),
      maxWeight: z.number().min(0.01).max(1.0)
    }),
    costParams: z
      .object({
        slippageRate: z.number().min(0).max(0.01),
        feeRate: z.number().min(0).max(0.01),
        taxRate: z.number().min(0).max(0.01)
      })
      .optional(),
    stockCodes: z
      .array(z.string().regex(/^\d{6}$/))
      .min(1)
      .max(50),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    initialCapital: z.number().min(1_000_000).max(10_000_000_000)
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'startDate must be before or equal to endDate',
    path: ['endDate']
  });

export type LabBacktestRequest = z.infer<typeof labBacktestSchema>;

export const compareSchema = z.object({
  runIds: z.array(z.string()).min(1).max(5)
});

export type CompareRequest = z.infer<typeof compareSchema>;

/** 전략 paramSchema 기반으로 params 검증. 에러 메시지 배열 반환 (빈 배열 = 통과). */
export function validateStrategyParams(
  params: Record<string, number>,
  schema: ParamFieldDef[]
): string[] {
  const errors: string[] = [];
  const requiredKeys = new Set(schema.map((f) => f.key));

  // 필수 키 누락 체크
  for (const field of schema) {
    if (!(field.key in params)) {
      errors.push(`Missing required param: ${field.key}`);
      continue;
    }
    const v = params[field.key]!;
    // step=1 (또는 정수 step)이면 정수만 허용
    if (
      field.step != null &&
      field.step >= 1 &&
      field.step === Math.floor(field.step) &&
      !Number.isInteger(v)
    ) {
      errors.push(`${field.key}: ${v} must be an integer (step=${field.step})`);
    }
    if (field.min != null && v < field.min) {
      errors.push(`${field.key}: ${v} is below minimum ${field.min}`);
    }
    if (field.max != null && v > field.max) {
      errors.push(`${field.key}: ${v} exceeds maximum ${field.max}`);
    }
  }

  // 불필요한 키 체크
  for (const key of Object.keys(params)) {
    if (!requiredKeys.has(key)) {
      errors.push(`Unknown param: ${key}`);
    }
  }

  return errors;
}
