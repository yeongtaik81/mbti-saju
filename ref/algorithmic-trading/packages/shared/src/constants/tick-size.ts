/** KRX 호가 단위 테이블 */
const TICK_SIZE_TABLE: { maxPrice: number; tickSize: number }[] = [
  { maxPrice: 2_000, tickSize: 1 },
  { maxPrice: 5_000, tickSize: 5 },
  { maxPrice: 20_000, tickSize: 10 },
  { maxPrice: 50_000, tickSize: 50 },
  { maxPrice: 200_000, tickSize: 100 },
  { maxPrice: 500_000, tickSize: 500 },
  { maxPrice: Infinity, tickSize: 1_000 }
];

/** 주가에 해당하는 호가 단위를 반환 (KRX 규칙: 경계값은 하위 구간에 포함) */
export function getTickSize(price: number): number {
  if (price <= 0) {
    throw new Error('Price must be positive');
  }
  for (const row of TICK_SIZE_TABLE) {
    if (price <= row.maxPrice) {
      return row.tickSize;
    }
  }
  return 1_000;
}

/** 매수 호가 보정 (내림) */
export function adjustBuyPrice(price: number): number {
  const tick = getTickSize(price);
  return Math.floor(price / tick) * tick;
}

/** 매도 호가 보정 (올림) */
export function adjustSellPrice(price: number): number {
  const tick = getTickSize(price);
  return Math.ceil(price / tick) * tick;
}
