/**
 * Lab DB 저장 모듈
 * CLI 스크립트에서 알고리즘 생성 + 결과 저장에 사용
 */
import type Database from 'better-sqlite3';
import type { LabBacktestResult } from './types.js';

/** 테이블 생성 (없으면) */
export function ensureLabSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS algorithms (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      strategy_type TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      hypothesis    TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'researching'
        CHECK (status IN ('researching','promising','adopted','abandoned')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS lab_results (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id          TEXT UNIQUE NOT NULL,
      algorithm_id    TEXT NOT NULL REFERENCES algorithms(id) ON DELETE CASCADE,
      strategy_type   TEXT NOT NULL,
      name            TEXT NOT NULL,
      params          TEXT NOT NULL DEFAULT '{}',
      risk_params     TEXT NOT NULL DEFAULT '{}',
      cost_params     TEXT NOT NULL DEFAULT '{}',
      stock_codes     TEXT NOT NULL DEFAULT '[]',
      start_date      TEXT NOT NULL,
      end_date        TEXT NOT NULL,
      initial_capital REAL NOT NULL,
      execution_model TEXT NOT NULL DEFAULT 'daily',
      total_return    REAL NOT NULL DEFAULT 0,
      cagr            REAL NOT NULL DEFAULT 0,
      mdd             REAL NOT NULL DEFAULT 0,
      win_rate        REAL NOT NULL DEFAULT 0,
      profit_factor   REAL NOT NULL DEFAULT 0,
      sharpe_ratio    REAL NOT NULL DEFAULT 0,
      total_trades    INTEGER NOT NULL DEFAULT 0,
      avg_hold_days   REAL NOT NULL DEFAULT 0,
      trades_detail   TEXT NOT NULL DEFAULT '[]',
      equity_curve    TEXT NOT NULL DEFAULT '[]',
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_lab_results_algo ON lab_results(algorithm_id);
    CREATE INDEX IF NOT EXISTS idx_lab_results_strategy ON lab_results(strategy_type);
    CREATE INDEX IF NOT EXISTS idx_algorithms_status ON algorithms(status);
  `);
}

/** 알고리즘 생성 (이미 있으면 무시) */
export function ensureAlgorithm(
  db: Database.Database,
  data: {
    id: string;
    name: string;
    strategyType: string;
    description?: string;
    hypothesis?: string;
  }
): void {
  db.prepare(
    `
    INSERT OR IGNORE INTO algorithms (id, name, strategy_type, description, hypothesis)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(
    data.id,
    data.name,
    data.strategyType,
    data.description ?? '',
    data.hypothesis ?? ''
  );
}

/** 알고리즘 상태 변경 */
export function updateAlgorithmStatus(
  db: Database.Database,
  id: string,
  status: 'researching' | 'promising' | 'adopted' | 'abandoned'
): void {
  db.prepare(
    `
    UPDATE algorithms SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?
  `
  ).run(status, id);
}

/** 백테스트 결과 저장 */
export function saveLabResult(
  db: Database.Database,
  result: LabBacktestResult
): void {
  db.prepare(
    `
    INSERT OR REPLACE INTO lab_results (
      run_id, algorithm_id, strategy_type, name,
      params, risk_params, cost_params, stock_codes,
      start_date, end_date, initial_capital, execution_model,
      total_return, cagr, mdd, win_rate, profit_factor, sharpe_ratio,
      total_trades, avg_hold_days, trades_detail, equity_curve, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    result.runId,
    result.algorithmId,
    result.strategyType,
    result.name,
    JSON.stringify(result.params),
    JSON.stringify(result.riskParams),
    JSON.stringify(result.costParams),
    JSON.stringify(result.stockCodes),
    result.startDate,
    result.endDate,
    result.initialCapital,
    result.executionModel,
    result.totalReturn,
    result.cagr,
    result.mdd,
    result.winRate,
    result.profitFactor,
    result.sharpeRatio,
    result.totalTrades,
    result.avgHoldDays,
    JSON.stringify(result.trades),
    JSON.stringify(result.equityCurve),
    result.createdAt
  );
}
