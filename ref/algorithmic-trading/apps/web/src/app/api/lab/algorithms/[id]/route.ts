import { NextResponse } from 'next/server';
import { dbWrite } from '@/lib/db-write';
import { updateAlgorithm, deleteAlgorithm } from '@/lib/lab-db';
import { updateAlgorithmSchema } from '@/lib/validators/lab';

/** PATCH /api/lab/algorithms/[id] — 알고리즘 수정 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAlgorithmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = updateAlgorithm(dbWrite, id, {
      name: parsed.data.name,
      description: parsed.data.description,
      hypothesis: parsed.data.hypothesis,
      status: parsed.data.status
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Algorithm not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Update algorithm error:', err);
    return NextResponse.json(
      {
        error: 'Failed to update algorithm',
        message: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/lab/algorithms/[id] — 알고리즘 삭제 (CASCADE) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteAlgorithm(dbWrite, id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Algorithm not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete algorithm error:', err);
    return NextResponse.json(
      {
        error: 'Failed to delete algorithm',
        message: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
