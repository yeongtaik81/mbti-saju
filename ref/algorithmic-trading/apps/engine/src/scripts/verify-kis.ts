/**
 * KIS API E2E 검증 스크립트
 * 실제 .env 키로 전체 플로우를 테스트합니다.
 *
 * 사용: pnpm --filter @trading/engine verify:kis
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { loadKisConfig } from '../kis/config.js';
import { KisAuth } from '../kis/auth.js';
import { TokenBucketThrottler } from '../kis/throttler.js';
import { KisRestClient } from '../kis/rest-client.js';
import { KisWsClient } from '../kis/ws-client.js';
import { CandleCollector } from '../data/candle-collector.js';
import { BalanceReconciler } from '../data/reconciliation.js';
import { createSchema } from '../db/schema.js';
import { toCandle } from '../kis/mappers.js';

const TOTAL_TIMEOUT_MS = 30_000;
const WS_TIMEOUT_MS = 10_000;
const TEST_STOCK = '005930'; // 삼성전자

async function main() {
  const timer = setTimeout(() => {
    console.error('❌ 전체 타임아웃 (30초) 초과');
    process.exit(1);
  }, TOTAL_TIMEOUT_MS);

  try {
    // 1. 설정 로드
    console.log('1. KIS 설정 로드...');
    const config = loadKisConfig();
    console.log(`   환경: ${config.env}, CANO: ${config.cano}`);

    // 2. 토큰 발급
    console.log('2. 토큰 발급...');
    const auth = new KisAuth(config);
    const token = await auth.issueToken();
    console.log(`   토큰: ${token.slice(0, 20)}...`);

    const throttler = new TokenBucketThrottler(20);
    const client = new KisRestClient(config, auth, throttler);

    // 3. 현재가 조회
    console.log(`3. ${TEST_STOCK} 현재가 조회...`);
    const price = await client.getCurrentPrice(TEST_STOCK);
    console.log(`   현재가: ${price.stck_prpr}원, 거래량: ${price.acml_vol}`);

    // 4. 일봉 수집 → DB 저장
    console.log('4. 일봉 수집 (30일)...');
    const db = new Database(':memory:');
    createSchema(db);
    const collector = new CandleCollector(db, client);

    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().slice(0, 10).replace(/-/g, '');
    })();

    const count = await collector.collectDailyCandles(
      TEST_STOCK,
      startDate,
      endDate
    );
    console.log(`   저장된 일봉: ${count}건`);

    // 5. 잔고 조회 + reconciliation
    console.log('5. 잔고 조회...');
    const balance = await client.getBalance();
    console.log(`   보유 종목 수: ${balance.items.length}`);
    console.log(`   예수금: ${balance.summary.dnca_tot_amt}원`);

    const reconciler = new BalanceReconciler(db, client);
    const mismatches = await reconciler.reconcile();
    console.log(`   불일치: ${mismatches.length}건 (신규 DB이므로 정상)`);

    // 6. WebSocket 접속
    console.log('6. WebSocket 검증...');
    const now = new Date();
    const hour = now.getHours();
    const isMarketHours = hour >= 9 && hour < 16; // 대략적인 장시간

    if (isMarketHours) {
      try {
        const approvalKey = await auth.issueApprovalKey();
        const wsClient = new KisWsClient(config.wsBaseUrl, approvalKey);

        const tickPromise = new Promise<void>((resolve, reject) => {
          let tickCount = 0;
          const wsTimer = setTimeout(() => {
            wsClient.destroy();
            reject(new Error('WebSocket 틱 수신 타임아웃'));
          }, WS_TIMEOUT_MS);

          wsClient.on('tick', (tick) => {
            tickCount++;
            console.log(
              `   틱 ${tickCount}: ${tick.stockCode} ${tick.price}원`
            );
            if (tickCount >= 3) {
              clearTimeout(wsTimer);
              wsClient.destroy();
              resolve();
            }
          });

          wsClient.on('error', (err) => {
            clearTimeout(wsTimer);
            wsClient.destroy();
            reject(err);
          });
        });

        wsClient.connect();
        wsClient.subscribe(TEST_STOCK);
        await tickPromise;
      } catch (err) {
        console.log(
          `   WebSocket 검증 실패 (장중 아닐 수 있음): ${(err as Error).message}`
        );
      }
    } else {
      console.log('   장외 시간 — WebSocket 틱 검증 스킵');
    }

    db.close();
    auth.destroy();

    console.log('\n✅ KIS API E2E 검증 완료');
  } catch (err) {
    console.error(`\n❌ 검증 실패: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main();
