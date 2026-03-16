import { z } from 'zod';

export const strategyParamsSchema = z.object({
  k: z.number().min(0.3).max(0.7),
  shortMaPeriod: z.number().int().min(3).max(10),
  longMaPeriod: z.number().int().min(15).max(60),
  rsiPeriod: z.number().int().min(7).max(21),
  rsiLow: z.number().min(20).max(40),
  rsiHigh: z.number().min(60).max(80),
  stopLossRate: z.number().min(-0.05).max(-0.01),
  takeProfitRate: z.number().min(0.02).max(0.1),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/)
});

export const riskParamsSchema = z.object({
  maxPositions: z.number().int().min(1).max(10),
  maxPositionWeight: z.number().min(0.05).max(0.5),
  dailyLossLimit: z.number().min(-0.1).max(-0.01),
  totalCapital: z.number().min(1_000_000)
});

export const screeningParamsSchema = z.object({
  minMarketCap: z.number().min(0),
  minVolumeAmount: z.number().min(0),
  minPrice: z.number().min(0),
  maxPrice: z.number().min(0),
  maxCandidates: z.number().int().min(1).max(30),
  markets: z.array(z.enum(['KOSPI', 'KOSDAQ'])).min(1)
});

export const strategyConfigSchema = z
  .object({
    currentVersion: z.number().int(),
    params: strategyParamsSchema,
    riskParams: riskParamsSchema,
    screeningParams: screeningParamsSchema
  })
  .refine((data) => data.params.shortMaPeriod < data.params.longMaPeriod, {
    message: '단기 MA는 장기 MA보다 작아야 합니다.',
    path: ['params', 'longMaPeriod']
  });

export type StrategyConfigInput = z.infer<typeof strategyConfigSchema>;
