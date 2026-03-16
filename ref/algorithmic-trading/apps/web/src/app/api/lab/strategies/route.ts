import { NextResponse } from 'next/server';
import { getAllStrategies } from '@trading/engine/strategy/lab';

/** GET /api/lab/strategies — 전략 목록 + paramSchema (클라이언트 폼용) */
export async function GET() {
  try {
    const strategies = getAllStrategies().map((s) => ({
      type: s.type,
      name: s.name,
      description: s.description,
      paramSchema: s.paramSchema
    }));

    return NextResponse.json(strategies);
  } catch (err) {
    console.error('List strategies error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}
