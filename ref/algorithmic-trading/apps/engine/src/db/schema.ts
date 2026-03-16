import Database from 'better-sqlite3';

/** 전체 DDL을 실행하여 테이블 생성 */
export function createSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- 주문
    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        TEXT    NOT NULL UNIQUE,
      kis_order_no    TEXT,
      stock_code      TEXT    NOT NULL,
      stock_name      TEXT    NOT NULL,
      side            TEXT    NOT NULL CHECK (side IN ('buy', 'sell')),
      order_type      TEXT    NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT')),
      quantity        INTEGER NOT NULL CHECK (quantity > 0),
      price           REAL    NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','SUBMITTED','PENDING','PARTIAL_FILLED','FILLED','REJECTED','CANCEL_REQUESTED','CANCELLED')),
      filled_quantity INTEGER NOT NULL DEFAULT 0,
      filled_price    REAL    NOT NULL DEFAULT 0,
      reject_reason   TEXT,
      strategy        TEXT    NOT NULL,
      signal          TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 체결
    CREATE TABLE IF NOT EXISTS executions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT    NOT NULL REFERENCES orders(order_id),
      stock_code  TEXT    NOT NULL,
      side        TEXT    NOT NULL CHECK (side IN ('buy', 'sell')),
      quantity    INTEGER NOT NULL CHECK (quantity > 0),
      price       REAL    NOT NULL,
      amount      REAL    NOT NULL,
      fee         REAL    NOT NULL DEFAULT 0,
      tax         REAL    NOT NULL DEFAULT 0,
      executed_at TEXT    NOT NULL
    );

    -- 매매 기록 (매수-매도 쌍)
    CREATE TABLE IF NOT EXISTS trades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code    TEXT    NOT NULL,
      stock_name    TEXT    NOT NULL,
      buy_order_id  TEXT    NOT NULL REFERENCES orders(order_id),
      sell_order_id TEXT    NOT NULL REFERENCES orders(order_id),
      quantity      INTEGER NOT NULL,
      buy_price     REAL    NOT NULL,
      sell_price    REAL    NOT NULL,
      pnl           REAL    NOT NULL,
      pnl_rate      REAL    NOT NULL,
      fee_total     REAL    NOT NULL DEFAULT 0,
      strategy      TEXT    NOT NULL,
      signal        TEXT    NOT NULL,
      bought_at     TEXT    NOT NULL,
      sold_at       TEXT    NOT NULL
    );

    -- 보유 포지션
    CREATE TABLE IF NOT EXISTS positions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code    TEXT    NOT NULL UNIQUE,
      stock_name    TEXT    NOT NULL,
      quantity      INTEGER NOT NULL CHECK (quantity > 0),
      avg_price     REAL    NOT NULL,
      current_price REAL    NOT NULL DEFAULT 0,
      pnl           REAL    NOT NULL DEFAULT 0,
      pnl_rate      REAL    NOT NULL DEFAULT 0,
      bought_at     TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 포트폴리오 스냅샷 (일별)
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      date                TEXT    NOT NULL UNIQUE,
      total_value         REAL    NOT NULL,
      cash                REAL    NOT NULL,
      stock_value         REAL    NOT NULL,
      daily_pnl           REAL    NOT NULL DEFAULT 0,
      daily_pnl_rate      REAL    NOT NULL DEFAULT 0,
      cumulative_pnl_rate REAL    NOT NULL DEFAULT 0,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 주문 이벤트 로그
    CREATE TABLE IF NOT EXISTS order_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   TEXT NOT NULL REFERENCES orders(order_id),
      event_type TEXT NOT NULL,
      detail     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 리스크 이벤트 로그
    CREATE TABLE IF NOT EXISTS risk_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type   TEXT NOT NULL,
      detail       TEXT NOT NULL DEFAULT '{}',
      action_taken TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 감사 로그
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      actor      TEXT NOT NULL CHECK (actor IN ('system', 'user')),
      action     TEXT NOT NULL,
      detail     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 전략 설정 (버전 관리)
    CREATE TABLE IF NOT EXISTS strategy_config (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      enabled          INTEGER NOT NULL DEFAULT 0,
      params           TEXT    NOT NULL DEFAULT '{}',
      risk_params      TEXT    NOT NULL DEFAULT '{}',
      screening_params TEXT    NOT NULL DEFAULT '{}',
      version          INTEGER NOT NULL DEFAULT 1,
      effective_from   TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 스크리닝 결과
    CREATE TABLE IF NOT EXISTS screening_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,
      stock_code    TEXT    NOT NULL,
      stock_name    TEXT    NOT NULL,
      market_cap    REAL    NOT NULL DEFAULT 0,
      volume_amount REAL    NOT NULL DEFAULT 0,
      atr           REAL    NOT NULL DEFAULT 0,
      rank          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(date, stock_code)
    );

    -- 종목 마스터
    CREATE TABLE IF NOT EXISTS stocks (
      stock_code  TEXT PRIMARY KEY,
      stock_name  TEXT NOT NULL,
      market      TEXT NOT NULL DEFAULT '' CHECK (market IN ('', 'KOSPI', 'KOSDAQ'))
    );

    -- 일봉 캐시
    CREATE TABLE IF NOT EXISTS daily_candles (
      stock_code TEXT    NOT NULL,
      date       TEXT    NOT NULL,
      open       REAL    NOT NULL,
      high       REAL    NOT NULL,
      low        REAL    NOT NULL,
      close      REAL    NOT NULL,
      adj_close  REAL,
      volume     INTEGER NOT NULL DEFAULT 0,
      amount     REAL    NOT NULL DEFAULT 0,
      PRIMARY KEY (stock_code, date)
    );

    -- 분봉 캐시
    CREATE TABLE IF NOT EXISTS minute_candles (
      stock_code TEXT    NOT NULL,
      datetime   TEXT    NOT NULL,
      open       REAL    NOT NULL,
      high       REAL    NOT NULL,
      low        REAL    NOT NULL,
      close      REAL    NOT NULL,
      volume     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (stock_code, datetime)
    );

    -- 비용 규칙
    CREATE TABLE IF NOT EXISTS fee_rules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      market         TEXT NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ')),
      fee_type       TEXT NOT NULL CHECK (fee_type IN ('BROKER_BUY','BROKER_SELL','TAX','SPECIAL_TAX')),
      rate           REAL NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to   TEXT
    );

    -- 휴장일 캘린더
    CREATE TABLE IF NOT EXISTS market_calendar (
      date        TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK (type IN ('HOLIDAY', 'HALF_DAY', 'DELAYED_OPEN')),
      open_time   TEXT NOT NULL DEFAULT '09:00',
      close_time  TEXT NOT NULL DEFAULT '15:30',
      description TEXT NOT NULL DEFAULT ''
    );

    -- 백테스트 결과
    CREATE TABLE IF NOT EXISTS backtest_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id        TEXT UNIQUE,
      name          TEXT    NOT NULL,
      params        TEXT    NOT NULL DEFAULT '{}',
      cost_params   TEXT    NOT NULL DEFAULT '{}',
      start_date    TEXT    NOT NULL,
      end_date      TEXT    NOT NULL,
      total_return  REAL    NOT NULL DEFAULT 0,
      cagr          REAL    NOT NULL DEFAULT 0,
      mdd           REAL    NOT NULL DEFAULT 0,
      win_rate      REAL    NOT NULL DEFAULT 0,
      profit_factor REAL    NOT NULL DEFAULT 0,
      sharpe_ratio  REAL    NOT NULL DEFAULT 0,
      total_trades  INTEGER NOT NULL DEFAULT 0,
      trades_detail TEXT    NOT NULL DEFAULT '[]',
      equity_curve  TEXT    NOT NULL DEFAULT '[]',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_orders_stock_code     ON orders(stock_code);
    CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_executions_order_id   ON executions(order_id);
    CREATE INDEX IF NOT EXISTS idx_executions_executed_at ON executions(executed_at);
    CREATE INDEX IF NOT EXISTS idx_trades_stock_code     ON trades(stock_code);
    CREATE INDEX IF NOT EXISTS idx_trades_sold_at        ON trades(sold_at);
    CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_risk_events_type      ON risk_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_stocks_market          ON stocks(market);
    CREATE INDEX IF NOT EXISTS idx_screening_date        ON screening_results(date);
    CREATE INDEX IF NOT EXISTS idx_daily_candles_date    ON daily_candles(date);
    CREATE INDEX IF NOT EXISTS idx_daily_candles_date_close ON daily_candles(date, close);
    CREATE INDEX IF NOT EXISTS idx_minute_candles_dt     ON minute_candles(datetime);
    CREATE INDEX IF NOT EXISTS idx_fee_rules_market      ON fee_rules(market, fee_type);
    CREATE INDEX IF NOT EXISTS idx_orders_stock_side_status ON orders(stock_code, side, status);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_strategy_config_version ON strategy_config(version);
  `);
}
