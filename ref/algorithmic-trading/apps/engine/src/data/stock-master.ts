import type { KisRestClient } from '../kis/rest-client.js';

/** 종목 기본 정보 */
export interface StockBasicInfo {
  stockCode: string;
  price: number;
  volume: number;
  marketCap: number;
  upperLimit: number;
  lowerLimit: number;
}

/** 캐시 엔트리 */
interface CacheEntry {
  info: StockBasicInfo;
  expiresAt: number;
}

/** 캐시 TTL (5분) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 종목코드 패턴 (6자리 숫자) */
const STOCK_CODE_PATTERN = /^\d{6}$/;

/**
 * 종목 기본 정보 관리
 * - 종목코드 포맷 검증 (API 호출 없음)
 * - 현재가 기반 기본 정보 조회 (인메모리 캐시, TTL 5분)
 */
export class StockMasterSync {
  private readonly client: KisRestClient;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(client: KisRestClient) {
    this.client = client;
  }

  /** 종목코드 포맷 검증만 (6자리 숫자) */
  isValidStock(stockCode: string): boolean {
    return STOCK_CODE_PATTERN.test(stockCode);
  }

  /** 종목 기본 정보 조회 (5분 캐시) */
  async getStockInfo(stockCode: string): Promise<StockBasicInfo> {
    const cached = this.cache.get(stockCode);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.info;
    }

    const output = await this.client.getCurrentPrice(stockCode);
    const info: StockBasicInfo = {
      stockCode,
      price: Number(output.stck_prpr),
      volume: Number(output.acml_vol),
      marketCap: Number(output.hts_avls),
      upperLimit: Number(output.stck_mxpr),
      lowerLimit: Number(output.stck_llam)
    };

    this.cache.set(stockCode, {
      info,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return info;
  }

  /** 캐시 클리어 */
  clearCache(): void {
    this.cache.clear();
  }
}
