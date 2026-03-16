import Database from 'better-sqlite3';
import path from 'node:path';

/**
 * SQLite 읽기 전용 싱글턴
 * globalThis 패턴으로 Next.js 핫 리로드에서 싱글턴 보장
 */
const g = globalThis as unknown as { __tradingDb?: Database.Database };

function createDb(): Database.Database {
  const dbPath =
    process.env.DB_PATH ||
    path.resolve(process.cwd(), '../engine/data/trading.db');
  return new Database(dbPath, { readonly: true });
}

export const db = g.__tradingDb ?? createDb();
g.__tradingDb = db;
