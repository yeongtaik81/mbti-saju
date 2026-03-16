import Database from 'better-sqlite3';
import { DEFAULT_FEE_RULES } from '@trading/shared/constants';

/** 비용 규칙 초기 데이터 */
export function seedFeeRules(db: Database.Database): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fee_rules (market, fee_type, rate, effective_from, effective_to)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const rule of DEFAULT_FEE_RULES) {
      stmt.run(
        rule.market,
        rule.feeType,
        rule.rate,
        rule.effectiveFrom,
        rule.effectiveTo
      );
    }
  });

  insertMany();
}

/**
 * 2026년 KRX 휴장일 캘린더
 * 주의: KRX 공식 발표 후 검증 필요
 * - 대체공휴일은 주말/공휴일 겹침 시 법규에 따라 추가
 * - 임시공휴일(선거일 등)은 확정 시 수동 추가
 * - 매년 초 KRX 휴장일 공고 확인 후 업데이트할 것
 */
const HOLIDAYS_2026 = [
  { date: '2026-01-01', type: 'HOLIDAY', description: '신정' },
  { date: '2026-01-27', type: 'HOLIDAY', description: '설날 연휴' },
  { date: '2026-01-28', type: 'HOLIDAY', description: '설날' },
  { date: '2026-01-29', type: 'HOLIDAY', description: '설날 연휴' },
  { date: '2026-03-01', type: 'HOLIDAY', description: '삼일절' },
  { date: '2026-05-01', type: 'HOLIDAY', description: '근로자의 날' },
  { date: '2026-05-05', type: 'HOLIDAY', description: '어린이날' },
  { date: '2026-05-24', type: 'HOLIDAY', description: '부처님 오신 날' },
  { date: '2026-06-06', type: 'HOLIDAY', description: '현충일' },
  { date: '2026-08-15', type: 'HOLIDAY', description: '광복절' },
  { date: '2026-09-24', type: 'HOLIDAY', description: '추석 연휴' },
  { date: '2026-09-25', type: 'HOLIDAY', description: '추석' },
  { date: '2026-09-26', type: 'HOLIDAY', description: '추석 연휴' },
  { date: '2026-10-03', type: 'HOLIDAY', description: '개천절' },
  { date: '2026-10-09', type: 'HOLIDAY', description: '한글날' },
  { date: '2026-12-25', type: 'HOLIDAY', description: '크리스마스' },
  { date: '2026-12-31', type: 'HOLIDAY', description: '연말 휴장' },
  // 수능일 (예상) - 지연개장
  {
    date: '2026-11-19',
    type: 'DELAYED_OPEN',
    openTime: '10:00',
    closeTime: '15:30',
    description: '수능 (지연개장)'
  }
] as const;

export function seedMarketCalendar(db: Database.Database): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO market_calendar (date, type, open_time, close_time, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const h of HOLIDAYS_2026) {
      const openTime = 'openTime' in h ? h.openTime : '09:00';
      const closeTime = 'closeTime' in h ? h.closeTime : '15:30';
      stmt.run(h.date, h.type, openTime, closeTime, h.description);
    }
  });

  insertMany();
}

/** 기본 전략 설정 */
export function seedDefaultStrategy(db: Database.Database): void {
  const exists = db
    .prepare('SELECT COUNT(*) as cnt FROM strategy_config')
    .get() as { cnt: number };
  if (exists.cnt > 0) return;

  db.prepare(
    `
    INSERT INTO strategy_config (name, enabled, params, risk_params, screening_params, version, effective_from)
    VALUES (?, ?, ?, ?, ?, ?, date('now', 'localtime'))
  `
  ).run(
    'volatility_breakout_composite',
    0,
    JSON.stringify({
      k: 0.5,
      shortMaPeriod: 5,
      longMaPeriod: 20,
      rsiPeriod: 14,
      rsiLow: 30,
      rsiHigh: 70,
      stopLossRate: -0.02,
      takeProfitRate: 0.05,
      closingTime: '15:15'
    }),
    JSON.stringify({
      maxPositions: 5,
      maxPositionWeight: 0.3,
      dailyLossLimit: -0.03,
      totalCapital: 10000000
    }),
    JSON.stringify({
      minMarketCap: 300000000000,
      minVolumeAmount: 5000000000,
      minPrice: 5000,
      maxPrice: 500000,
      maxCandidates: 20,
      markets: ['KOSPI', 'KOSDAQ']
    }),
    1
  );
}

/** 스윙 전략 설정 (듀얼 레짐) */
export function seedSwingStrategy(db: Database.Database): void {
  const exists = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM strategy_config WHERE name = 'swing_dual_regime'"
    )
    .get() as { cnt: number };
  if (exists.cnt > 0) return;

  db.prepare(
    `
    INSERT INTO strategy_config (name, enabled, params, risk_params, screening_params, version, effective_from)
    VALUES (?, ?, ?, ?, ?, ?, date('now', 'localtime'))
  `
  ).run(
    'swing_dual_regime',
    0,
    JSON.stringify({
      k: 0.4,
      shortMaPeriod: 10,
      longMaPeriod: 60,
      rsiPeriod: 14,
      rsiLow: 20,
      rsiHigh: 80,
      stopLossRate: -0.07,
      takeProfitRate: 0.1,
      closingTime: '15:15',
      strategyMode: 'swing',
      holdDays: 7,
      breadthBullThreshold: 0.5,
      breadthBearThreshold: 0.4,
      maSupportProximity: 0.02,
      volumeRatioThreshold: 2.0
    }),
    JSON.stringify({
      maxPositions: 5,
      maxPositionWeight: 0.3,
      dailyLossLimit: -0.03,
      totalCapital: 10_000_000
    }),
    JSON.stringify({
      minMarketCap: 300_000_000_000,
      minVolumeAmount: 30_000_000_000,
      minPrice: 5000,
      maxPrice: 500000,
      maxCandidates: 20,
      markets: ['KOSPI', 'KOSDAQ']
    }),
    1
  );
}

/** 모든 시드 데이터 실행 */
export function seedAll(db: Database.Database): void {
  seedFeeRules(db);
  seedMarketCalendar(db);
  seedDefaultStrategy(db);
  seedSwingStrategy(db);
}
