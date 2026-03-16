import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { dbWrite } from '@/lib/db-write';
import { createAlgorithm } from '@/lib/lab-db';
import { createAlgorithmSchema } from '@/lib/validators/lab';

/** POST /api/lab/algorithms — 알고리즘 생성 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createAlgorithmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const id = randomUUID().slice(0, 8);
    createAlgorithm(dbWrite, {
      id,
      name: parsed.data.name,
      strategy_type: parsed.data.strategyType,
      description: parsed.data.description,
      hypothesis: parsed.data.hypothesis
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('Create algorithm error:', err);
    return NextResponse.json(
      {
        error: 'Failed to create algorithm',
        message: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
