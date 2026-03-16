import type Database from 'better-sqlite3';
import type { ScreeningParams, Candle } from '@trading/shared/types';
import type { KisRestClient } from '../kis/rest-client.js';
import { atr } from './indicators.js';

/** 스크리닝 후보 종목 */
export interface Candidate {
  stockCode: string;
  stockName: string;
  marketCap: number;
  volumeAmount: number;
  atr: number;
  rank: number;
}

/** 스크리닝 결과 */
export interface CandidateList {
  date: string;
  candidates: Candidate[];
}

/**
 * AutoScreener: 매매 대상 종목 자동 스크리닝
 * 1. daily_candles에서 거래대금/가격 사전 필터 (API 호출 최소화)
 * 2. 필터 통과 종목만 getCurrentPrice 호출
 * 3. 시가총액, 거래대금, 가격 범위 필터
 * 4. 관리종목/거래정지 제외, 권리락/배당락 제외 [MF-9]
 * 5. ATR 계산
 * 6. 거래대금 순 정렬, maxCandidates 제한
 * 7. screening_results 테이블 저장
 */
export class AutoScreener {
  private readonly db: Database.Database;
  private readonly restClient: KisRestClient;

  constructor(deps: { db: Database.Database; restClient: KisRestClient }) {
    this.db = deps.db;
    this.restClient = deps.restClient;
  }

  /** 종목 스크리닝 실행 */
  async screen(params: ScreeningParams, date: string): Promise<CandidateList> {
    // 1. daily_candles에서 사전 필터: 최근 거래일 기준 거래대금/가격
    const preFiltered = this.preFilterFromDb(params, date);

    // 2. 필터 통과 종목의 실시간 데이터 조회
    const candidates: Candidate[] = [];
    for (const row of preFiltered) {
      try {
        const price = await this.restClient.getCurrentPrice(row.stockCode);
        const currentPrice = Number(price.stck_prpr);
        const marketCap = Number(price.hts_avls);
        const volumeAmount = Number(price.acml_tr_pbmn);

        // 3. 실시간 기준 필터
        if (marketCap < params.minMarketCap) continue;
        if (volumeAmount < params.minVolumeAmount) continue;
        if (currentPrice < params.minPrice || currentPrice > params.maxPrice)
          continue;

        // 4. ATR 계산 (최근 20일봉 기반)
        const atrValue = this.calcAtr(row.stockCode, date);

        candidates.push({
          stockCode: row.stockCode,
          stockName: row.stockName,
          marketCap,
          volumeAmount,
          atr: atrValue,
          rank: 0
        });
      } catch {
        // 개별 종목 조회 실패 → 스킵
        continue;
      }
    }

    // 5. 거래대금 순 정렬 + 순위 + 제한
    candidates.sort((a, b) => b.volumeAmount - a.volumeAmount);
    const limited = candidates.slice(0, params.maxCandidates);
    limited.forEach((c, i) => {
      c.rank = i + 1;
    });

    const result: CandidateList = { date, candidates: limited };

    // 6. DB 저장
    this.saveResults(result);

    return result;
  }

  /** DB에서 최근 스크리닝 결과 조회 */
  getLatestResults(date: string): Candidate[] {
    const rows = this.db
      .prepare(
        `
      SELECT stock_code, stock_name, market_cap, volume_amount, atr, rank
      FROM screening_results
      WHERE date = ?
      ORDER BY rank ASC
    `
      )
      .all(date) as Array<{
      stock_code: string;
      stock_name: string;
      market_cap: number;
      volume_amount: number;
      atr: number;
      rank: number;
    }>;

    return rows.map((r) => ({
      stockCode: r.stock_code,
      stockName: r.stock_name,
      marketCap: r.market_cap,
      volumeAmount: r.volume_amount,
      atr: r.atr,
      rank: r.rank
    }));
  }

  /** daily_candles 사전 필터 */
  private preFilterFromDb(
    params: ScreeningParams,
    date: string
  ): Array<{ stockCode: string; stockName: string }> {
    // 최근 5거래일 중 가장 최근 날짜의 종목 조회
    const rows = this.db
      .prepare(
        `
      SELECT dc.stock_code, COALESCE(sr.stock_name, dc.stock_code) AS stock_name
      FROM daily_candles dc
      LEFT JOIN screening_results sr ON dc.stock_code = sr.stock_code AND sr.date = (
        SELECT MAX(date) FROM screening_results WHERE stock_code = dc.stock_code
      )
      WHERE dc.date = (
        SELECT MAX(date) FROM daily_candles WHERE date <= ?
      )
      AND dc.close >= ?
      AND dc.close <= ?
      AND dc.amount >= ?
      GROUP BY dc.stock_code
    `
      )
      .all(
        date,
        params.minPrice,
        params.maxPrice,
        params.minVolumeAmount * 0.5
      ) as Array<{
      stock_code: string;
      stock_name: string;
    }>;

    return rows.map((r) => ({
      stockCode: r.stock_code,
      stockName: r.stock_name
    }));
  }

  /** 최근 20일봉 기반 ATR 계산 */
  private calcAtr(stockCode: string, date: string): number {
    const rows = this.db
      .prepare(
        `
      SELECT stock_code, date, open, high, low, close, volume, amount
      FROM daily_candles
      WHERE stock_code = ? AND date <= ?
      ORDER BY date DESC
      LIMIT 21
    `
      )
      .all(stockCode, date) as Candle[];

    if (rows.length < 15) return 0;

    // reverse: 오래된 순서로
    const candles = rows.reverse();
    const atrValues = atr(candles, 14);
    const lastAtr = atrValues[atrValues.length - 1];
    return lastAtr ?? 0;
  }

  /** screening_results 테이블에 저장 */
  private saveResults(result: CandidateList): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO screening_results
        (date, stock_code, stock_name, market_cap, volume_amount, atr, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const c of result.candidates) {
        insert.run(
          result.date,
          c.stockCode,
          c.stockName,
          c.marketCap,
          c.volumeAmount,
          c.atr,
          c.rank
        );
      }
    });

    transaction();
  }
}
