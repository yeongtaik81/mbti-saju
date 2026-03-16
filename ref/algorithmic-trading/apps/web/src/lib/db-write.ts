import Database from 'better-sqlite3';
import path from 'node:path';

/**
 * SQLite 쓰기 가능 싱글턴 (백테스트 결과 저장용)
 * WAL 모드 + busy_timeout으로 SQLITE_BUSY 방지
 */
const g = globalThis as unknown as { __tradingDbWrite?: Database.Database };

function createWriteDb(): Database.Database {
  const dbPath =
    process.env.DB_PATH ||
    path.resolve(process.cwd(), '../engine/data/trading.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

export const dbWrite = g.__tradingDbWrite ?? createWriteDb();
g.__tradingDbWrite = dbWrite;
