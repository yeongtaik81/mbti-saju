/**
 * KRX 전체 종목 일봉 데이터 수집
 *
 * 1. KRX에서 KOSPI/KOSDAQ 종목 코드 목록 가져오기
 * 2. KIS API로 1년 일봉 데이터 수집
 *
 * 사용법:
 *   npx tsx apps/engine/src/scripts/collect-all-stocks.ts
 *   npx tsx apps/engine/src/scripts/collect-all-stocks.ts --market KOSPI   # KOSPI만
 *   npx tsx apps/engine/src/scripts/collect-all-stocks.ts --skip 500       # 500개 건너뛰기 (이어서 수집)
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { loadKisConfig } from '../kis/config.js';
import { KisAuth } from '../kis/auth.js';
import { TokenBucketThrottler } from '../kis/throttler.js';
import { KisRestClient } from '../kis/rest-client.js';
import { CandleCollector } from '../data/candle-collector.js';
import { initDatabase } from '../db/init.js';

// ── KRX 종목 목록 가져오기 ──
interface StockInfo {
  code: string;
  name: string;
  market?: string;
}

function fetchStockList(marketType: string): StockInfo[] {
  const url = `http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType=${marketType}`;
  const html = execSync(
    `curl -sL '${url}' -H 'User-Agent: Mozilla/5.0' | iconv -f euc-kr -t utf-8`,
    { encoding: 'utf-8', timeout: 30000 }
  );

  // HTML 테이블에서 종목명 + 종목코드 추출
  // 패턴: <tr><td>회사명</td><td>시장구분</td><td>종목코드</td>
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
      results.push({ code, name });
    }
  }

  // fallback: 종목명 매칭 실패 시 코드만이라도 추출
  if (results.length === 0) {
    const codes = html.match(/\d{6}/g) || [];
    for (const code of [...new Set(codes)]) {
      results.push({ code, name: code });
    }
  }

  return results.sort((a, b) => a.code.localeCompare(b.code));
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let market: 'ALL' | 'KOSPI' | 'KOSDAQ' = 'ALL';
  let skip = 0;
  let days = 365;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--market' && args[i + 1]) {
      market = args[i + 1]!.toUpperCase() as typeof market;
      i++;
    } else if (args[i] === '--skip' && args[i + 1]) {
      skip = parseInt(args[i + 1]!, 10) || 0;
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1]!, 10) || 365;
      i++;
    }
  }

  return { market, skip, days };
}

async function main() {
  const { market, skip, days } = parseArgs();

  console.log('=== KRX 전체 종목 일봉 수집 ===\n');

  // 1. 종목 목록 가져오기
  console.log('1. KRX 종목 목록 조회 중...');
  let allStocks: StockInfo[] = [];

  if (market === 'ALL' || market === 'KOSPI') {
    const kospiStocks = fetchStockList('stockMkt');
    console.log(`   KOSPI: ${kospiStocks.length}종목`);
    allStocks.push(
      ...kospiStocks.map((s) => ({ ...s, market: 'KOSPI' as const }))
    );
  }
  if (market === 'ALL' || market === 'KOSDAQ') {
    const kosdaqStocks = fetchStockList('kosdaqMkt');
    console.log(`   KOSDAQ: ${kosdaqStocks.length}종목`);
    allStocks.push(
      ...kosdaqStocks.map((s) => ({ ...s, market: 'KOSDAQ' as const }))
    );
  }

  console.log(`   합계: ${allStocks.length}종목`);

  if (skip > 0) {
    allStocks = allStocks.slice(skip);
    console.log(`   건너뛰기: ${skip}개 → 남은: ${allStocks.length}종목`);
  }

  let allCodes = allStocks.map((s) => s.code);

  // 2. KIS 인증
  console.log('\n2. KIS 인증...');
  const config = loadKisConfig();
  const auth = new KisAuth(config);
  const token = await auth.issueToken();
  console.log(`   환경: ${config.env}, 토큰: ${token.slice(0, 20)}...`);

  const throttler = new TokenBucketThrottler(18); // 약간 보수적으로
  const client = new KisRestClient(config, auth, throttler);

  // 3. DB 초기화
  console.log('\n3. DB 초기화...');
  const db = initDatabase();
  const collector = new CandleCollector(db, client);

  // 3-1. stocks 테이블에 종목 마스터 저장
  console.log('   stocks 테이블 업데이트...');
  const upsertStock = db.prepare(
    `INSERT INTO stocks (stock_code, stock_name, market) VALUES (?, ?, ?)
     ON CONFLICT(stock_code) DO UPDATE SET stock_name = excluded.stock_name, market = excluded.market`
  );
  const insertStocksTransaction = db.transaction(
    (stocks: (StockInfo & { market?: string })[]) => {
      for (const s of stocks) {
        upsertStock.run(s.code, s.name, s.market ?? '');
      }
    }
  );
  insertStocksTransaction(allStocks);
  const masterCount = (
    db.prepare('SELECT COUNT(*) as c FROM stocks').get() as { c: number }
  ).c;
  console.log(`   stocks 테이블: ${masterCount}종목 저장 완료`);

  // 4. 기간 설정 (종목별 incremental)
  const endDate = formatDate(new Date());
  const defaultStartObj = new Date();
  defaultStartObj.setDate(defaultStartObj.getDate() - days);
  const defaultStartDate = formatDate(defaultStartObj);
  console.log(`   기본 기간: ${defaultStartDate} ~ ${endDate} (신규 종목용)\n`);

  function buildChunks(
    startStr: string,
    endStr: string
  ): { start: string; end: string }[] {
    const chunks: { start: string; end: string }[] = [];
    const CHUNK_DAYS = 90;
    const endObj = new Date(
      endStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    );
    const startObj = new Date(
      startStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    );

    let chunkEnd = new Date(endObj);
    while (chunkEnd > startObj) {
      const chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() - CHUNK_DAYS);
      if (chunkStart < startObj) chunkStart.setTime(startObj.getTime());
      chunks.push({ start: formatDate(chunkStart), end: formatDate(chunkEnd) });
      chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() - 1);
    }
    chunks.reverse();
    return chunks;
  }

  // 5. 수집
  console.log('4. 일봉 수집 시작...');
  const startTime = Date.now();
  let totalCandles = 0;
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < allCodes.length; i++) {
    const code = allCodes[i]!;
    const progress = `[${i + 1}/${allCodes.length}]`;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate =
      successCount > 0
        ? ((Date.now() - startTime) / successCount / 1000).toFixed(1)
        : '?';

    // incremental: 기존 데이터 마지막 날짜 확인 → 다음날부터만 수집
    const latest = collector.getLatestCachedDate(code);
    let stockStartDate = defaultStartDate;
    if (latest) {
      const latestDate = latest.replace(/-/g, '');
      // 최근 2일 이내면 스킵
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threshold = formatDate(twoDaysAgo);
      if (latestDate >= threshold) {
        skipCount++;
        if (i % 100 === 0) {
          process.stdout.write(
            `   ${progress} ${code}: 최신 (${latest}) - 스킵 [${elapsed}s, ${rate}s/건]\n`
          );
        }
        continue;
      }
      // 마지막 날짜 다음날부터 수집
      const nextDay = new Date(latest);
      nextDay.setDate(nextDay.getDate() + 1);
      stockStartDate = formatDate(nextDay);
    }

    const chunks = buildChunks(stockStartDate, endDate);

    try {
      let stockTotal = 0;
      for (const chunk of chunks) {
        const count = await collector.collectDailyCandles(
          code,
          chunk.start,
          chunk.end
        );
        stockTotal += count;
      }
      totalCandles += stockTotal;
      successCount++;

      if (i % 50 === 0 || stockTotal > 0) {
        process.stdout.write(
          `   ${progress} ${code}: ${stockTotal}건 [${elapsed}s, ${rate}s/건]\n`
        );
      }
    } catch (err) {
      failCount++;
      const msg = (err as Error).message;
      // API 에러는 조용히 처리 (상장폐지/관리종목 등)
      if (i % 100 === 0 || !msg.includes('no data')) {
        process.stdout.write(
          `   ${progress} ${code}: 실패 - ${msg.slice(0, 50)}\n`
        );
      }
      errors.push(`${code}: ${msg.slice(0, 80)}`);
    }
  }

  // 6. 결과
  const dbCount = (
    db.prepare('SELECT COUNT(*) as c FROM daily_candles').get() as { c: number }
  ).c;
  const stockCount = (
    db
      .prepare('SELECT COUNT(DISTINCT stock_code) as c FROM daily_candles')
      .get() as { c: number }
  ).c;
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log(`\n=== 수집 완료 (${totalTime}초) ===`);
  console.log(`성공: ${successCount}, 실패: ${failCount}, 스킵: ${skipCount}`);
  console.log(`수집된 일봉: ${totalCandles}건`);
  console.log(`DB 총 일봉: ${dbCount}건 (${stockCount}종목)`);

  if (errors.length > 0 && errors.length <= 20) {
    console.log(`\n실패 목록:`);
    for (const e of errors) console.log(`  ${e}`);
  } else if (errors.length > 20) {
    console.log(`\n실패 ${errors.length}건 (처음 10개):`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
  }

  db.close();
  auth.destroy();
}

main().catch((err) => {
  console.error(`\n실패: ${(err as Error).message}`);
  process.exit(1);
});
