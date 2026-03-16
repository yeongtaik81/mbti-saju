import type Database from 'better-sqlite3';
import { ensureLabSchema } from './lab-schema';
import type { LabBacktestResult } from '@trading/engine/strategy/lab';

// ── Schema Init (DB 인스턴스별 1회) ──

const g = globalThis as unknown as { __labSchemaInitSet?: WeakSet<object> };
if (!g.__labSchemaInitSet) g.__labSchemaInitSet = new WeakSet();

export function ensureLabReady(db: Database.Database): void {
  if (!g.__labSchemaInitSet!.has(db)) {
    // readonly DB에서는 CREATE TABLE이 실패하므로 무시
    try {
      ensureLabSchema(db);
    } catch {
      // readonly mode — 스키마가 이미 존재한다고 가정
    }
    g.__labSchemaInitSet!.add(db);
  }
}

// ── Algorithm CRUD ──

export interface AlgorithmRow {
  id: string;
  name: string;
  strategy_type: string;
  description: string;
  hypothesis: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AlgorithmWithBest extends AlgorithmRow {
  run_count: number;
  best_return: number | null;
  best_sharpe: number | null;
  best_mdd: number | null;
  last_run_at: string | null;
}

export function listAlgorithms(db: Database.Database): AlgorithmWithBest[] {
  ensureLabReady(db);
  return db
    .prepare(
      `
    SELECT a.*,
      COUNT(r.id) AS run_count,
      MAX(r.total_return) AS best_return,
      MAX(r.sharpe_ratio) AS best_sharpe,
      MIN(r.mdd) AS best_mdd,
      MAX(r.created_at) AS last_run_at
    FROM algorithms a
    LEFT JOIN lab_results r ON r.algorithm_id = a.id
    GROUP BY a.id
    ORDER BY a.updated_at DESC
  `
    )
    .all() as AlgorithmWithBest[];
}

export function getAlgorithm(
  db: Database.Database,
  id: string
): AlgorithmRow | undefined {
  ensureLabReady(db);
  return db.prepare('SELECT * FROM algorithms WHERE id = ?').get(id) as
    | AlgorithmRow
    | undefined;
}

export function createAlgorithm(
  db: Database.Database,
  data: {
    id: string;
    name: string;
    strategy_type: string;
    description?: string;
    hypothesis?: string;
  }
): void {
  ensureLabReady(db);
  db.prepare(
    `
    INSERT INTO algorithms (id, name, strategy_type, description, hypothesis)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(
    data.id,
    data.name,
    data.strategy_type,
    data.description ?? '',
    data.hypothesis ?? ''
  );
}

export function updateAlgorithm(
  db: Database.Database,
  id: string,
  data: {
    name?: string;
    description?: string;
    hypothesis?: string;
    status?: string;
  }
): boolean {
  ensureLabReady(db);
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    sets.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push('description = ?');
    values.push(data.description);
  }
  if (data.hypothesis !== undefined) {
    sets.push('hypothesis = ?');
    values.push(data.hypothesis);
  }
  if (data.status !== undefined) {
    sets.push('status = ?');
    values.push(data.status);
  }

  if (sets.length === 0) return false;

  sets.push("updated_at = datetime('now','localtime')");
  values.push(id);

  const result = db
    .prepare(`UPDATE algorithms SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values);
  return result.changes > 0;
}

export function deleteAlgorithm(db: Database.Database, id: string): boolean {
  ensureLabReady(db);
  const result = db.prepare('DELETE FROM algorithms WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Lab Results CRUD ──

export interface LabResultRow {
  id: number;
  run_id: string;
  algorithm_id: string;
  strategy_type: string;
  name: string;
  params: string;
  risk_params: string;
  cost_params: string;
  stock_codes: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  execution_model: string;
  total_return: number;
  cagr: number;
  mdd: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  total_trades: number;
  avg_hold_days: number;
  trades_detail: string;
  equity_curve: string;
  created_at: string;
}

export function listLabResults(
  db: Database.Database,
  algorithmId: string
): LabResultRow[] {
  ensureLabReady(db);
  return db
    .prepare(
      `
    SELECT * FROM lab_results
    WHERE algorithm_id = ?
    ORDER BY created_at DESC
  `
    )
    .all(algorithmId) as LabResultRow[];
}

export function getLabResult(
  db: Database.Database,
  runId: string
): LabResultRow | undefined {
  ensureLabReady(db);
  return db.prepare('SELECT * FROM lab_results WHERE run_id = ?').get(runId) as
    | LabResultRow
    | undefined;
}

export function saveLabResult(
  db: Database.Database,
  result: LabBacktestResult
): void {
  ensureLabReady(db);
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

export function getCompareData(
  db: Database.Database,
  algorithmId: string,
  runIds: string[]
): LabResultRow[] {
  ensureLabReady(db);
  const placeholders = runIds.map(() => '?').join(',');
  return db
    .prepare(
      `
    SELECT * FROM lab_results
    WHERE algorithm_id = ? AND run_id IN (${placeholders})
  `
    )
    .all(algorithmId, ...runIds) as LabResultRow[];
}
