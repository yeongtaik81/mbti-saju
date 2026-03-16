import type { Market } from '../types/market.js';

/** 비용 유형 */
export const FeeType = {
  BROKER_BUY: 'BROKER_BUY',
  BROKER_SELL: 'BROKER_SELL',
  TAX: 'TAX',
  SPECIAL_TAX: 'SPECIAL_TAX' // 농어촌특별세 (코스피만)
} as const;
export type FeeType = (typeof FeeType)[keyof typeof FeeType];

/** 비용 규칙 */
export interface FeeRule {
  market: Market;
  feeType: FeeType;
  rate: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // null = 현재 적용 중
}

/** 기본 비용 규칙 (2024-01-01 ~) */
export const DEFAULT_FEE_RULES: FeeRule[] = [
  // 코스피
  {
    market: 'KOSPI',
    feeType: 'BROKER_BUY',
    rate: 0.00015,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  {
    market: 'KOSPI',
    feeType: 'BROKER_SELL',
    rate: 0.00015,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  {
    market: 'KOSPI',
    feeType: 'TAX',
    rate: 0.0018,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  {
    market: 'KOSPI',
    feeType: 'SPECIAL_TAX',
    rate: 0.0015,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  // 코스닥
  {
    market: 'KOSDAQ',
    feeType: 'BROKER_BUY',
    rate: 0.00015,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  {
    market: 'KOSDAQ',
    feeType: 'BROKER_SELL',
    rate: 0.00015,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  },
  {
    market: 'KOSDAQ',
    feeType: 'TAX',
    rate: 0.0018,
    effectiveFrom: '2024-01-01',
    effectiveTo: null
  }
];
