import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCompareData } from '@/lib/lab-db';

/** GET /api/lab/algorithms/[id]/compare?runIds=a,b,c — 런 비교 데이터 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const runIdsParam = searchParams.get('runIds');

    if (!runIdsParam) {
      return NextResponse.json(
        { error: 'runIds parameter required' },
        { status: 400 }
      );
    }

    const runIds = [...new Set(runIdsParam.split(',').filter(Boolean))];
    if (runIds.length === 0 || runIds.length > 5) {
      return NextResponse.json(
        { error: 'runIds must contain 1-5 unique IDs' },
        { status: 400 }
      );
    }

    const rows = getCompareData(db, id, runIds);

    // JSON 필드 파싱 + trades_detail 제외 (크기 절약)
    const results = rows.map(({ trades_detail: _, ...row }) => ({
      ...row,
      params: JSON.parse(row.params),
      risk_params: JSON.parse(row.risk_params),
      cost_params: JSON.parse(row.cost_params),
      stock_codes: JSON.parse(row.stock_codes),
      equity_curve: JSON.parse(row.equity_curve)
    }));

    return NextResponse.json(results);
  } catch (err) {
    console.error('Compare error:', err);
    return NextResponse.json(
      {
        error: 'Failed to compare runs',
        message: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
