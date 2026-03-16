/**
 * 분봉 데이터 수집 스크립트
 *
 * KIS API는 당일(또는 최근 거래일) 분봉만 제공하므로,
 * 매일 장 마감 후 실행하여 분봉을 누적 수집한다.
 *
 * 사용법:
 *   pnpm --filter @trading/engine collect:minute
 *   pnpm --filter @trading/engine collect:minute -- --stocks 005930,000660
 *
 * 옵션:
 *   --stocks  종목코드 (쉼표 구분, 기본: 50종목)
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { loadKisConfig } from '../kis/config.js';
import { KisAuth } from '../kis/auth.js';
import { TokenBucketThrottler } from '../kis/throttler.js';
import { KisRestClient } from '../kis/rest-client.js';
import { CandleCollector } from '../data/candle-collector.js';
import { initDatabase } from '../db/init.js';

const DEFAULT_STOCKS = [
  // KOSPI 대형주
  '005930',
  '000660',
  '373220',
  '207940',
  '005380',
  '006400',
  '051910',
  '035420',
  '000270',
  '068270',
  '035720',
  '105560',
  '055550',
  '096770',
  '003670',
  '028260',
  '012330',
  '066570',
  '032830',
  '003550',
  // KOSPI 중대형주
  '086790',
  '034730',
  '000810',
  '009150',
  '316140',
  '034020',
  '003490',
  '047050',
  '259960',
  '042660',
  // KOSPI 중형주
  '267260',
  '329180',
  '326030',
  '010140',
  '352820',
  '017670',
  '036570',
  '011200',
  '128940',
  '010130',
  // KOSDAQ 대형주
  '247540',
  '086520',
  '403870',
  '196170',
  '377300',
  '323410',
  '263750',
  '293490',
  '041510',
  '145020'
];

function parseArgs(): { stocks: string[] } {
  const args = process.argv.slice(2);
  let stocks = DEFAULT_STOCKS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stocks' && args[i + 1]) {
      stocks = args[i + 1]!.split(',').map((s) => s.trim());
      i++;
    }
  }

  return { stocks };
}

async function main() {
  const { stocks } = parseArgs();

  console.log(`=== 분봉 데이터 수집 ===`);
  console.log(`종목: ${stocks.length}개`);
  console.log(`KIS API는 당일 분봉만 제공합니다.\n`);

  // 1. KIS 인증
  console.log('1. KIS 인증...');
  const config = loadKisConfig();
  const auth = new KisAuth(config);
  const token = await auth.issueToken();
  console.log(`   환경: ${config.env}, 토큰: ${token.slice(0, 20)}...\n`);

  const throttler = new TokenBucketThrottler(20);
  const client = new KisRestClient(config, auth, throttler);

  // 2. DB 초기화
  console.log('2. DB 초기화...');
  const db = initDatabase();
  const collector = new CandleCollector(db, client);

  // 3. 기존 분봉 현황
  const existingCount = (
    db.prepare('SELECT COUNT(*) as c FROM minute_candles').get() as {
      c: number;
    }
  ).c;
  const distinctDates = (
    db
      .prepare(
        'SELECT COUNT(DISTINCT substr(datetime, 1, 10)) as c FROM minute_candles'
      )
      .get() as { c: number }
  ).c;
  console.log(
    `   기존 분봉: ${existingCount.toLocaleString()}건 (${distinctDates}거래일)\n`
  );

  // 4. 종목별 수집
  console.log('3. 분봉 수집 시작...');
  let totalCandles = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const code = stocks[i]!;
    const progress = `[${i + 1}/${stocks.length}]`;

    try {
      const count = await collector.collectMinuteCandles(code);
      totalCandles += count;
      successCount++;
      console.log(`   ${progress} ${code}: ${count}건 수집`);
    } catch (err) {
      failCount++;
      console.error(`   ${progress} ${code}: 실패 - ${(err as Error).message}`);
    }
  }

  // 5. 결과 요약
  const finalCount = (
    db.prepare('SELECT COUNT(*) as c FROM minute_candles').get() as {
      c: number;
    }
  ).c;
  const finalDates = (
    db
      .prepare(
        'SELECT COUNT(DISTINCT substr(datetime, 1, 10)) as c FROM minute_candles'
      )
      .get() as { c: number }
  ).c;
  const latestDate = (
    db
      .prepare('SELECT MAX(substr(datetime, 1, 10)) as d FROM minute_candles')
      .get() as { d: string | null }
  )?.d;

  console.log(`\n=== 수집 완료 ===`);
  console.log(`성공: ${successCount}종목, 실패: ${failCount}종목`);
  console.log(`신규 수집: ${totalCandles}건`);
  console.log(
    `DB 총 분봉: ${finalCount.toLocaleString()}건 (${finalDates}거래일)`
  );
  if (latestDate) console.log(`최신 날짜: ${latestDate}`);

  db.close();
  auth.destroy();
}

main().catch((err) => {
  console.error(`\n실패: ${(err as Error).message}`);
  process.exit(1);
});
