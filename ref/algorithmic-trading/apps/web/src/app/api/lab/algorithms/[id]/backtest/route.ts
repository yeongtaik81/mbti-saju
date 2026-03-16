import { NextResponse } from 'next/server';
import {
  runLabBacktest,
  STRATEGY_TYPE,
  getStrategy
} from '@trading/engine/strategy/lab';
import { db } from '@/lib/db';
import { dbWrite } from '@/lib/db-write';
import { getAlgorithm, saveLabResult } from '@/lib/lab-db';
import {
  labBacktestSchema,
  validateStrategyParams
} from '@/lib/validators/lab';

export const maxDuration = 300;

/** POST /api/lab/algorithms/[id]/backtest — 백테스트 실행 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 알고리즘 존재 확인
    const algorithm = getAlgorithm(db, id);
    if (!algorithm) {
      return NextResponse.json(
        { error: 'Algorithm not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = labBacktestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // strategy_type 유효성 검증 + paramSchema 매칭
    const validTypes = Object.values(STRATEGY_TYPE) as string[];
    if (!validTypes.includes(algorithm.strategy_type)) {
      return NextResponse.json(
        { error: `Invalid strategy type: ${algorithm.strategy_type}` },
        { status: 400 }
      );
    }

    const strategy = getStrategy(
      algorithm.strategy_type as Parameters<
        typeof runLabBacktest
      >[1]['strategyType']
    );
    if (strategy) {
      const paramErrors = validateStrategyParams(
        parsed.data.params,
        strategy.paramSchema
      );
      if (paramErrors.length > 0) {
        return NextResponse.json(
          { error: 'Invalid strategy params', details: paramErrors },
          { status: 400 }
        );
      }
    }

    const config = {
      algorithmId: id,
      strategyType: algorithm.strategy_type as Parameters<
        typeof runLabBacktest
      >[1]['strategyType'],
      name: algorithm.name,
      params: parsed.data.params,
      riskParams: parsed.data.riskParams,
      costParams: parsed.data.costParams,
      stockCodes: parsed.data.stockCodes,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      initialCapital: parsed.data.initialCapital
    };

    // 읽기 전용 DB로 백테스트 실행
    const result = runLabBacktest(db, config);

    // 쓰기 DB로 결과 저장
    saveLabResult(dbWrite, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Lab backtest error:', err);
    return NextResponse.json(
      {
        error: 'Backtest failed',
        message: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
