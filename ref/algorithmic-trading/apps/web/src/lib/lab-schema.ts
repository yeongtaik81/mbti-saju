import type Database from 'better-sqlite3';

/**
 * Lab 전용 테이블 생성 (algorithms + lab_results)
 * 앱 시작 시 한 번 호출
 */
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
