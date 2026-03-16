import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // DB 연결 확인은 DB 파일이 존재할 때만
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1'
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: (err as Error).message },
      { status: 500 }
    );
  }
}
