import { z } from 'zod';
import type { KisConfig, TrIdMap } from './config.js';
import { getTrIdMap } from './config.js';
import type { KisAuth } from './auth.js';
import type { TokenBucketThrottler } from './throttler.js';
import { KisApiError, KisRateLimitError } from './errors.js';
import {
  KisCurrentPriceResponseSchema,
  KisDailyCandleResponseSchema,
  KisMinuteCandleResponseSchema,
  KisBalanceResponseSchema,
  KisOrderResponseSchema,
  KisExecutionResponseSchema,
  KisOpenOrderResponseSchema
} from './types.js';
import type {
  KisCurrentPriceOutput,
  KisDailyCandleItem,
  KisMinuteCandleItem,
  KisBalanceItem,
  KisBalanceSummary,
  KisExecutionItem,
  KisOpenOrderItem
} from './types.js';
import type { OrderSide, OrderType } from '@trading/shared/types';

/** 지수 백오프 sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 개별 요청 타임아웃 (ms) */
const REQUEST_TIMEOUT_MS = 30_000;

/** 페이지네이션 최대 반복 */
const MAX_PAGES = 50;

/** 재시도 설정 */
const MAX_RETRIES = 3;

/**
 * KIS REST API 클라이언트
 */
export class KisRestClient {
  private readonly config: KisConfig;
  private readonly auth: KisAuth;
  private readonly throttler: TokenBucketThrottler;
  private readonly trIds: TrIdMap;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(
    config: KisConfig,
    auth: KisAuth,
    throttler: TokenBucketThrottler,
    fetchFn?: typeof globalThis.fetch
  ) {
    this.config = config;
    this.auth = auth;
    this.throttler = throttler;
    this.trIds = getTrIdMap(config.env);
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /** 공통 REST 요청 */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    trId: string,
    schema: z.ZodType<T>,
    options?: {
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    }
  ): Promise<T> {
    await this.throttler.acquire();

    let url = `${this.config.restBaseUrl}${path}`;
    if (options?.query) {
      const params = new URLSearchParams(options.query);
      url += `?${params.toString()}`;
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        // 재시도 시 토큰을 새로 가져옴 (401 후 갱신 대응)
        const token = await this.auth.getToken();
        const headers: Record<string, string> = {
          authorization: `Bearer ${token}`,
          appkey: this.config.appKey,
          appsecret: this.config.appSecret,
          tr_id: trId,
          'Content-Type': 'application/json; charset=utf-8',
          custtype: 'P'
        };

        const res = await this.fetchFn(url, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal as AbortSignal
        });

        clearTimeout(timeout);

        if (res.status === 429) {
          const retryAfter =
            Number(res.headers.get('Retry-After') || '5') * 1000;
          throw new KisRateLimitError('Rate limited', retryAfter);
        }

        // 401: 토큰 만료 → 강제 재발급 후 재시도
        if (res.status === 401) {
          await this.auth.issueToken();
          throw new KisApiError('Unauthorized', 401, '', 'Token expired', '1');
        }

        if (!res.ok && res.status >= 500) {
          throw new KisApiError(
            `Server error`,
            res.status,
            '',
            `HTTP ${res.status}`,
            '1'
          );
        }

        const json = (await res.json()) as Record<string, unknown>;

        if (json.rt_cd && json.rt_cd !== '0') {
          throw new KisApiError(
            (json.msg1 as string) || 'API error',
            res.status,
            (json.msg_cd as string) || '',
            (json.msg1 as string) || '',
            json.rt_cd as string
          );
        }

        return schema.parse(json);
      } catch (err) {
        clearTimeout(timeout);
        lastError = err as Error;
        if (err instanceof KisRateLimitError) {
          await sleep(err.retryAfterMs);
          continue;
        }
        if (
          err instanceof KisApiError &&
          err.statusCode < 500 &&
          err.statusCode !== 401
        ) {
          throw err;
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new KisApiError('Request failed', 0, '', '', '1');
  }

  /** 현재가 조회 */
  async getCurrentPrice(stockCode: string): Promise<KisCurrentPriceOutput> {
    const res = await this.request(
      'GET',
      '/uapi/domestic-stock/v1/quotations/inquire-price',
      this.trIds.currentPrice,
      KisCurrentPriceResponseSchema,
      {
        query: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: stockCode
        }
      }
    );
    return res.output;
  }

  /** 일봉 조회 (페이지네이션 포함) */
  async getDailyCandles(
    stockCode: string,
    startDate: string, // YYYYMMDD
    endDate: string // YYYYMMDD
  ): Promise<KisDailyCandleItem[]> {
    return this.requestAllPages<KisDailyCandleItem>(
      '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
      this.trIds.dailyCandle,
      {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: stockCode,
        FID_INPUT_DATE_1: startDate,
        FID_INPUT_DATE_2: endDate,
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0'
      },
      KisDailyCandleResponseSchema,
      'output2'
    );
  }

  /** 분봉 조회 (페이지네이션 포함, 당일 전체 분봉 수집) */
  async getMinuteCandles(
    stockCode: string,
    time: string = '155900' // HHMMSS (역순 조회 시작 시각)
  ): Promise<KisMinuteCandleItem[]> {
    const allItems: KisMinuteCandleItem[] = [];
    let currentTime = time;

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.request(
        'GET',
        '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice',
        this.trIds.minuteCandle,
        KisMinuteCandleResponseSchema,
        {
          query: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
            FID_INPUT_HOUR_1: currentTime,
            FID_ETC_CLS_CODE: ''
          }
        }
      );

      if (res.output2.length === 0) break;
      allItems.push(...res.output2);

      // 가장 이른 시각으로 다음 페이지 조회
      const earliest = res.output2[res.output2.length - 1]!;
      const earliestTime = earliest.stck_cntg_hour;

      // 장 시작(090000) 이전이면 종료
      if (earliestTime <= '090000') break;

      // 다음 페이지: 가장 이른 시각 직전부터 조회
      currentTime = earliestTime;
    }

    return allItems;
  }

  /** 잔고 조회 */
  async getBalance(): Promise<{
    items: KisBalanceItem[];
    summary: KisBalanceSummary;
  }> {
    const allItems: KisBalanceItem[] = [];
    let ctxAreaFk100 = '';
    let ctxAreaNk100 = '';
    let lastSummary: KisBalanceSummary | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query: Record<string, string> = {
        CANO: this.config.cano,
        ACNT_PRDT_CD: this.config.acntPrdtCd,
        AFHR_FLPR_YN: 'N',
        OFL_YN: '',
        INQR_DVSN: '02',
        UNPR_DVSN: '01',
        FUND_STTL_ICLD_YN: 'N',
        FNCG_AMT_AUTO_RDPT_YN: 'N',
        PRCS_DVSN: '01',
        CTX_AREA_FK100: ctxAreaFk100,
        CTX_AREA_NK100: ctxAreaNk100
      };

      const res = await this.request(
        'GET',
        '/uapi/domestic-stock/v1/trading/inquire-balance',
        this.trIds.balanceInquiry,
        KisBalanceResponseSchema,
        { query }
      );

      allItems.push(...res.output1);
      if (res.output2[0]) lastSummary = res.output2[0];

      ctxAreaFk100 = res.ctx_area_fk100 ?? '';
      ctxAreaNk100 = res.ctx_area_nk100 ?? '';

      if (!ctxAreaFk100 && !ctxAreaNk100) break;
      if (ctxAreaFk100.trim() === '' && ctxAreaNk100.trim() === '') break;
    }

    if (!lastSummary) {
      throw new KisApiError(
        'Balance summary not found',
        200,
        '',
        'No output2',
        '1'
      );
    }

    return {
      items: allItems,
      summary: lastSummary
    };
  }

  /** 현금 매수/매도 주문 */
  async placeOrder(params: {
    side: OrderSide;
    stockCode: string;
    orderType: OrderType;
    quantity: number;
    price: number; // MARKET일 때 0
  }): Promise<{ kisOrderNo: string; orderTime: string }> {
    const trId =
      params.side === 'buy' ? this.trIds.cashBuy : this.trIds.cashSell;
    // 주문구분: 00=지정가, 01=시장가
    const ordDvsnCd = params.orderType === 'MARKET' ? '01' : '00';

    const res = await this.request(
      'POST',
      '/uapi/domestic-stock/v1/trading/order-cash',
      trId,
      KisOrderResponseSchema,
      {
        body: {
          CANO: this.config.cano,
          ACNT_PRDT_CD: this.config.acntPrdtCd,
          PDNO: params.stockCode,
          ORD_DVSN: ordDvsnCd,
          ORD_QTY: String(params.quantity),
          ORD_UNPR: String(params.price)
        }
      }
    );

    return {
      kisOrderNo: res.output.ODNO,
      orderTime: res.output.ORD_TMD
    };
  }

  /** 주문 취소 */
  async cancelOrder(params: {
    orgOrderNo: string;
    stockCode: string;
    quantity: number;
  }): Promise<{ kisOrderNo: string }> {
    const res = await this.request(
      'POST',
      '/uapi/domestic-stock/v1/trading/order-rvsecncl',
      this.trIds.orderCancel,
      KisOrderResponseSchema,
      {
        body: {
          CANO: this.config.cano,
          ACNT_PRDT_CD: this.config.acntPrdtCd,
          KRX_FWDG_ORD_ORGNO: '',
          ORGN_ODNO: params.orgOrderNo,
          ORD_DVSN: '00',
          RVSE_CNCL_DVSN_CD: '02', // 02=취소
          ORD_QTY: String(params.quantity),
          ORD_UNPR: '0',
          QTY_ALL_ORD_YN: 'Y'
        }
      }
    );

    return { kisOrderNo: res.output.ODNO };
  }

  /** 주문 정정 */
  async modifyOrder(params: {
    orgOrderNo: string;
    stockCode: string;
    quantity: number;
    price: number;
  }): Promise<{ kisOrderNo: string }> {
    const res = await this.request(
      'POST',
      '/uapi/domestic-stock/v1/trading/order-rvsecncl',
      this.trIds.orderModify,
      KisOrderResponseSchema,
      {
        body: {
          CANO: this.config.cano,
          ACNT_PRDT_CD: this.config.acntPrdtCd,
          KRX_FWDG_ORD_ORGNO: '',
          ORGN_ODNO: params.orgOrderNo,
          ORD_DVSN: '00',
          RVSE_CNCL_DVSN_CD: '01', // 01=정정
          ORD_QTY: String(params.quantity),
          ORD_UNPR: String(params.price),
          QTY_ALL_ORD_YN: 'N'
        }
      }
    );

    return { kisOrderNo: res.output.ODNO };
  }

  /** 당일 체결 내역 조회 (페이지네이션 포함) */
  async getExecutions(): Promise<KisExecutionItem[]> {
    const allItems: KisExecutionItem[] = [];
    let ctxAreaFk100 = '';
    let ctxAreaNk100 = '';

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.request(
        'GET',
        '/uapi/domestic-stock/v1/trading/inquire-daily-ccld',
        this.trIds.executionInquiry,
        KisExecutionResponseSchema,
        {
          query: {
            CANO: this.config.cano,
            ACNT_PRDT_CD: this.config.acntPrdtCd,
            INQR_STRT_DT: this.todayYYYYMMDD(),
            INQR_END_DT: this.todayYYYYMMDD(),
            SLL_BUY_DVSN_CD: '00', // 전체
            INQR_DVSN: '00',
            PDNO: '',
            CCLD_DVSN: '01', // 체결
            ORD_GNO_BRNO: '',
            ODNO: '',
            INQR_DVSN_3: '00',
            INQR_DVSN_1: '',
            CTX_AREA_FK100: ctxAreaFk100,
            CTX_AREA_NK100: ctxAreaNk100
          }
        }
      );

      allItems.push(...res.output1);

      ctxAreaFk100 = res.ctx_area_fk100 ?? '';
      ctxAreaNk100 = res.ctx_area_nk100 ?? '';

      if (!ctxAreaFk100.trim() && !ctxAreaNk100.trim()) break;
      if (res.output1.length === 0) break;
    }

    return allItems;
  }

  /** 미체결 주문 조회 [SF-1] */
  async getOpenOrders(): Promise<KisOpenOrderItem[]> {
    const allItems: KisOpenOrderItem[] = [];
    let ctxAreaFk100 = '';
    let ctxAreaNk100 = '';

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.request(
        'GET',
        '/uapi/domestic-stock/v1/trading/inquire-psbl-rvsecncl',
        this.trIds.openOrderInquiry,
        KisOpenOrderResponseSchema,
        {
          query: {
            CANO: this.config.cano,
            ACNT_PRDT_CD: this.config.acntPrdtCd,
            CTX_AREA_FK100: ctxAreaFk100,
            CTX_AREA_NK100: ctxAreaNk100,
            INQR_DVSN_1: '0',
            INQR_DVSN_2: '0'
          }
        }
      );

      allItems.push(...res.output);

      ctxAreaFk100 = res.ctx_area_fk100 ?? '';
      ctxAreaNk100 = res.ctx_area_nk100 ?? '';

      if (!ctxAreaFk100.trim() && !ctxAreaNk100.trim()) break;
      if (res.output.length === 0) break;
    }

    return allItems;
  }

  /** 오늘 날짜 YYYYMMDD */
  private todayYYYYMMDD(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /** 페이지네이션 헬퍼 (연속키 기반) */
  private async requestAllPages<T>(
    path: string,
    trId: string,
    baseQuery: Record<string, string>,
    schema: z.ZodType<{
      rt_cd: string;
      msg_cd: string;
      msg1: string;
      output2: T[];
      ctx_area_fk100?: string;
      ctx_area_nk100?: string;
    }>,
    outputField: 'output2'
  ): Promise<T[]> {
    const allItems: T[] = [];
    let ctxAreaFk100 = '';
    let ctxAreaNk100 = '';

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = {
        ...baseQuery,
        CTX_AREA_FK100: ctxAreaFk100,
        CTX_AREA_NK100: ctxAreaNk100
      };

      const res = await this.request('GET', path, trId, schema, { query });
      const items = res[outputField];
      allItems.push(...items);

      ctxAreaFk100 = res.ctx_area_fk100 ?? '';
      ctxAreaNk100 = res.ctx_area_nk100 ?? '';

      if (!ctxAreaFk100.trim() && !ctxAreaNk100.trim()) break;
      if (items.length === 0) break;
    }

    return allItems;
  }
}
