import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSchema } from './schema.js';
import { seedAll } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../data/trading.db');

/** DB 초기화 (스키마 생성 + 시드 데이터) */
export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || process.env['DB_PATH'] || DEFAULT_DB_PATH;
  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);
  createSchema(db);
  seedAll(db);
  return db;
}

// CLI 실행 시
const isCli =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('init.ts');

if (isCli) {
  const dbPath = process.env['DB_PATH'] || DEFAULT_DB_PATH;
  console.log(`Initializing database at ${dbPath}...`);
  const db = initDatabase(dbPath);
  console.log('Schema created.');
  console.log('Seed data inserted.');
  db.close();
  console.log('Database initialization complete.');
}
