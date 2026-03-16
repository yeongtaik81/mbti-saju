/**
 * 파라미터 스윕 러너
 * 파라미터 그리드의 모든 조합을 실행하고 결과를 반환한다.
 */
import type Database from 'better-sqlite3';
import type { LabBacktestConfig, LabBacktestResult } from './types.js';
import { runLabBacktest } from './run-lab-backtest.js';

export interface SweepConfig {
  /** 기본 설정 (params 제외한 공통 설정) */
  baseConfig: Omit<LabBacktestConfig, 'params'>;
  /** 파라미터 그리드: 각 키에 대해 시도할 값 배열 */
  paramGrid: Record<string, number[]>;
}

export interface SweepResult {
  configs: LabBacktestConfig[];
  results: LabBacktestResult[];
  /** totalReturn 내림차순으로 정렬된 인덱스 */
  ranking: number[];
}

/** 파라미터 그리드의 모든 조합 생성 */
function cartesian(grid: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(grid);
  if (keys.length === 0) return [{}];

  const combos: Record<string, number>[] = [];
  const values = keys.map((k) => grid[k]!);

  function recurse(idx: number, current: Record<string, number>) {
    if (idx === keys.length) {
      combos.push({ ...current });
      return;
    }
    for (const val of values[idx]!) {
      current[keys[idx]!] = val;
      recurse(idx + 1, current);
    }
  }
  recurse(0, {});
  return combos;
}

export function runSweep(
  db: Database.Database,
  config: SweepConfig
): SweepResult {
  const combos = cartesian(config.paramGrid);
  const configs: LabBacktestConfig[] = [];
  const results: LabBacktestResult[] = [];

  for (const params of combos) {
    const fullConfig: LabBacktestConfig = {
      ...config.baseConfig,
      params
    };
    configs.push(fullConfig);
    results.push(runLabBacktest(db, fullConfig));
  }

  // totalReturn 내림차순 랭킹
  const ranking = results
    .map((_, i) => i)
    .sort((a, b) => results[b]!.totalReturn - results[a]!.totalReturn);

  return { configs, results, ranking };
}
