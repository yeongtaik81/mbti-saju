/**
 * 기존 trading.db에 stocks 테이블을 추가하고 KRX 종목명을 채워넣는 스크립트.
 * KIS API 인증 불필요 — KRX 웹에서 종목명만 가져옴.
 *
 * 사용법:
 *   npx tsx apps/engine/src/scripts/add-stock-names.ts
 */
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/trading.db');

interface StockInfo {
  code: string;
  name: string;
  market: string;
}

function fetchStockList(marketType: string): StockInfo[] {
  const url = `http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType=${marketType}`;
  const html = execSync(
    `curl -sL '${url}' -H 'User-Agent: Mozilla/5.0' | iconv -f euc-kr -t utf-8`,
    { encoding: 'utf-8', timeout: 30000 }
  );

  // 패턴: <tr>\n<td>회사명</td>\n<td>시장구분</td>\n<td ...>종목코드</td>
  const pattern =
    /<tr>\s*<td>([^<]+)<\/td>\s*<td>[\s\S]*?<\/td>\s*<td[^>]*>\s*(\d{6})\s*<\/td>/g;
  const results: StockInfo[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const name = match[1]!.trim();
    const code = match[2]!;
    if (!seen.has(code)) {
      seen.add(code);
      results.push({ code, name, market: '' });
    }
  }

  // fallback
  if (results.length === 0) {
    const codes = html.match(/\d{6}/g) || [];
    for (const code of [...new Set(codes)]) {
      results.push({ code, name: code, market: '' });
    }
  }

  return results;
}

function main() {
  console.log('=== stocks 테이블 추가 ===\n');

  // 1. KRX 종목 목록
  console.log('1. KRX 종목 목록 조회...');
  const kospi = fetchStockList('stockMkt');
  console.log(`   KOSPI: ${kospi.length}종목`);
  kospi.forEach((s) => (s.market = 'KOSPI'));

  const kosdaq = fetchStockList('kosdaqMkt');
  console.log(`   KOSDAQ: ${kosdaq.length}종목`);
  kosdaq.forEach((s) => (s.market = 'KOSDAQ'));

  const all = [...kospi, ...kosdaq];
  console.log(`   합계: ${all.length}종목`);

  // 2. DB 열기
  console.log(`\n2. DB: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // 3. stocks 테이블 생성 (없으면)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      stock_code  TEXT PRIMARY KEY,
      stock_name  TEXT NOT NULL,
      market      TEXT NOT NULL DEFAULT '' CHECK (market IN ('', 'KOSPI', 'KOSDAQ'))
    );
    CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
  `);

  // 4. Upsert
  const upsert = db.prepare(
    `INSERT INTO stocks (stock_code, stock_name, market) VALUES (?, ?, ?)
     ON CONFLICT(stock_code) DO UPDATE SET stock_name = excluded.stock_name, market = excluded.market`
  );
  const tx = db.transaction((stocks: StockInfo[]) => {
    for (const s of stocks) {
      upsert.run(s.code, s.name, s.market);
    }
  });
  tx(all);

  const count = (
    db.prepare('SELECT COUNT(*) as c FROM stocks').get() as { c: number }
  ).c;
  console.log(`\n3. 완료: ${count}종목 저장`);

  // 5. 샘플 출력
  const samples = db
    .prepare('SELECT stock_code, stock_name, market FROM stocks LIMIT 5')
    .all() as {
    stock_code: string;
    stock_name: string;
    market: string;
  }[];
  console.log('\n   샘플:');
  for (const s of samples) {
    console.log(`   ${s.stock_code} ${s.stock_name} (${s.market})`);
  }

  db.close();
  console.log('\n완료. 이 DB 파일을 폰에 전송 후 앱에서 import 하세요.');
}

main();
