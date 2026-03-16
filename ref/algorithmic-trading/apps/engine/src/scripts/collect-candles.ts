/**
 * 일봉 데이터 수집 스크립트
 *
 * 사용법:
 *   pnpm --filter @trading/engine collect:candles
 *   pnpm --filter @trading/engine collect:candles -- --stocks 005930,000660 --days 180
 *
 * 옵션:
 *   --stocks  종목코드 (쉼표 구분, 기본: KOSPI 대형주 20종)
 *   --days    수집 기간 (기본: 90일)
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 프로젝트 루트의 .env 로드
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { loadKisConfig } from '../kis/config.js';
import { KisAuth } from '../kis/auth.js';
import { TokenBucketThrottler } from '../kis/throttler.js';
import { KisRestClient } from '../kis/rest-client.js';
import { CandleCollector } from '../data/candle-collector.js';
import { initDatabase } from '../db/init.js';

// 알고리즘 매매 대상 50종 (KOSPI/KOSDAQ 유동성·시총 기준)
const DEFAULT_STOCKS = [
  // === KOSPI 대형주 (시총 상위, 고유동성) ===
  '005930', // 삼성전자
  '000660', // SK하이닉스
  '373220', // LG에너지솔루션
  '207940', // 삼성바이오로직스
  '005380', // 현대차
  '006400', // 삼성SDI
  '051910', // LG화학
  '035420', // NAVER
  '000270', // 기아
  '068270', // 셀트리온
  '035720', // 카카오
  '105560', // KB금융
  '055550', // 신한지주
  '096770', // SK이노베이션
  '003670', // 포스코퓨처엠
  '028260', // 삼성물산
  '012330', // 현대모비스
  '066570', // LG전자
  '032830', // 삼성생명
  '003550', // LG

  // === KOSPI 중대형주 (거래대금 활발) ===
  '086790', // 하나금융지주
  '034730', // SK
  '000810', // 삼성화재
  '009150', // 삼성전기
  '316140', // 우리금융지주
  '034020', // 두산에너빌리티
  '003490', // 대한항공
  '047050', // 포스코인터내셔널
  '259960', // 크래프톤
  '042660', // 한화오션

  // === KOSPI 중형주 (변동성·유동성 양호) ===
  '267260', // HD현대일렉트릭
  '329180', // HD현대중공업
  '326030', // SK바이오팜
  '010140', // 삼성중공업
  '352820', // 하이브
  '017670', // SK텔레콤
  '036570', // 엔씨소프트
  '011200', // HMM
  '128940', // 한미약품
  '010130', // 고려아연

  // === KOSDAQ 대형주 (고유동성, 높은 변동성) ===
  '247540', // 에코프로비엠
  '086520', // 에코프로
  '403870', // HPSP
  '196170', // 알테오젠
  '377300', // 카카오페이
  '323410', // 카카오뱅크
  '263750', // 펄어비스
  '293490', // 카카오게임즈
  '041510', // 에스엠
  '145020' // 휴젤
];

function parseArgs(): { stocks: string[]; days: number } {
  const args = process.argv.slice(2);
  let stocks = DEFAULT_STOCKS;
  let days = 90;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stocks' && args[i + 1]) {
      stocks = args[i + 1]!.split(',').map((s) => s.trim());
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      days = Math.max(1, Math.min(parseInt(args[i + 1]!, 10) || 90, 365));
      i++;
    }
  }

  return { stocks, days };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function main() {
  const { stocks, days } = parseArgs();

  console.log(`=== 일봉 데이터 수집 ===`);
  console.log(`종목: ${stocks.length}개`);
  console.log(`기간: ${days}일\n`);

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

  // 3. 기간 설정
  const endDate = formatDate(new Date());
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - days);
  const startDate = formatDate(startDateObj);
  console.log(`   기간: ${startDate} ~ ${endDate}\n`);

  // 4. 기간 분할 (KIS API 1회 100건 제한 → 90일 단위 분할)
  const CHUNK_DAYS = 90;
  const dateChunks: { start: string; end: string }[] = [];
  {
    const endObj = new Date();
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);

    let chunkEnd = new Date(endObj);
    while (chunkEnd > startObj) {
      const chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() - CHUNK_DAYS);
      if (chunkStart < startObj) chunkStart.setTime(startObj.getTime());
      dateChunks.push({
        start: formatDate(chunkStart),
        end: formatDate(chunkEnd)
      });
      chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() - 1);
    }
    dateChunks.reverse();
  }
  console.log(
    `   기간 분할: ${dateChunks.length}개 청크 (${CHUNK_DAYS}일 단위)\n`
  );

  // 5. 종목별 수집
  console.log('3. 일봉 수집 시작...');
  let totalCandles = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < stocks.length; i++) {
    const code = stocks[i]!;
    const progress = `[${i + 1}/${stocks.length}]`;

    try {
      let stockTotal = 0;
      for (const chunk of dateChunks) {
        const count = await collector.collectDailyCandles(
          code,
          chunk.start,
          chunk.end
        );
        stockTotal += count;
      }
      totalCandles += stockTotal;
      successCount++;
      console.log(`   ${progress} ${code}: ${stockTotal}건 수집`);
    } catch (err) {
      failCount++;
      console.error(`   ${progress} ${code}: 실패 - ${(err as Error).message}`);
    }
  }

  // 5. 결과 요약
  const dbCount = (
    db.prepare('SELECT COUNT(*) as c FROM daily_candles').get() as { c: number }
  ).c;

  console.log(`\n=== 수집 완료 ===`);
  console.log(`성공: ${successCount}종목, 실패: ${failCount}종목`);
  console.log(`수집된 일봉: ${totalCandles}건`);
  console.log(`DB 총 일봉: ${dbCount}건`);

  db.close();
  auth.destroy();
}

main().catch((err) => {
  console.error(`\n실패: ${(err as Error).message}`);
  process.exit(1);
});
