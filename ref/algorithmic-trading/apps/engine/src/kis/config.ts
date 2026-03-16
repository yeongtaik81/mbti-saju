import { z } from 'zod';

/** KIS 환경 구분 */
export const KisEnv = {
  VIRTUAL: 'virtual',
  PRODUCTION: 'production'
} as const;
export type KisEnv = (typeof KisEnv)[keyof typeof KisEnv];

/** 환경변수 스키마 */
const envSchema = z.object({
  KIS_ENV: z.enum(['virtual', 'production']).default('virtual'),
  KIS_PROD_APP_KEY: z.string().min(1).optional(),
  KIS_PROD_APP_SECRET: z.string().min(1).optional(),
  KIS_PROD_ACCOUNT_NO: z.string().min(8).optional(),
  KIS_VIRTUAL_APP_KEY: z.string().min(1).optional(),
  KIS_VIRTUAL_APP_SECRET: z.string().min(1).optional(),
  KIS_VIRTUAL_ACCOUNT_NO: z.string().min(8).optional()
});

/** KIS 설정 */
export interface KisConfig {
  env: KisEnv;
  appKey: string;
  appSecret: string;
  accountNo: string;
  /** 계좌번호 앞 8자리 */
  cano: string;
  /** 계좌상품코드 (뒤 2자리, 기본 "01") */
  acntPrdtCd: string;
  restBaseUrl: string;
  /** KIS WebSocket은 ws://만 지원 (KIS 사양) */
  wsBaseUrl: string;
  approvalUrl: string;
}

/** TR_ID 매핑 */
export interface TrIdMap {
  /** 현금 매수 */
  cashBuy: string;
  /** 현금 매도 */
  cashSell: string;
  /** 주문 정정 */
  orderModify: string;
  /** 주문 취소 */
  orderCancel: string;
  /** 잔고 조회 */
  balanceInquiry: string;
  /** 현재가 조회 (환경 공통) */
  currentPrice: string;
  /** 일봉 조회 (환경 공통) */
  dailyCandle: string;
  /** 분봉 조회 (환경 공통) */
  minuteCandle: string;
  /** 체결 내역 조회 */
  executionInquiry: string;
  /** 미체결 주문 조회 */
  openOrderInquiry: string;
}

/** 환경별 도메인 */
const DOMAIN_MAP = {
  production: {
    rest: 'https://openapi.koreainvestment.com:9443',
    // KIS WebSocket은 ws://만 지원. wss:// 지원 확인 시 전환 필요.
    ws: 'ws://ops.koreainvestment.com:21000',
    approval: 'https://openapi.koreainvestment.com:9443'
  },
  virtual: {
    rest: 'https://openapivts.koreainvestment.com:29443',
    ws: 'ws://ops.koreainvestment.com:31000',
    approval: 'https://openapivts.koreainvestment.com:29443'
  }
} as const;

/**
 * 환경별 TR_ID 매핑
 * @see https://apiportal.koreainvestment.com/apiservice
 */
const TR_ID_MAP = {
  production: {
    cashBuy: 'TTTC0802U',
    cashSell: 'TTTC0801U',
    orderModify: 'TTTC0803U',
    orderCancel: 'TTTC0803U',
    balanceInquiry: 'TTTC8434R',
    currentPrice: 'FHKST01010100',
    dailyCandle: 'FHKST03010100',
    minuteCandle: 'FHKST03010200',
    executionInquiry: 'TTTC8001R',
    openOrderInquiry: 'TTTC8036R'
  },
  virtual: {
    cashBuy: 'VTTC0802U',
    cashSell: 'VTTC0801U',
    orderModify: 'VTTC0803U',
    orderCancel: 'VTTC0803U',
    balanceInquiry: 'VTTC8434R',
    currentPrice: 'FHKST01010100',
    dailyCandle: 'FHKST03010100',
    minuteCandle: 'FHKST03010200',
    executionInquiry: 'VTTC8001R',
    openOrderInquiry: 'VTTC8036R'
  }
} as const satisfies Record<KisEnv, TrIdMap>;

/**
 * 환경변수에서 KIS 설정 로드
 * @throws 필수 환경변수 누락 시 에러
 */
export function loadKisConfig(
  env?: Record<string, string | undefined>
): KisConfig {
  const raw = env ?? process.env;
  const parsed = envSchema.parse(raw);
  const kisEnv = parsed.KIS_ENV;

  const prefix = kisEnv === 'production' ? 'KIS_PROD' : 'KIS_VIRTUAL';
  const appKey = raw[`${prefix}_APP_KEY`];
  const appSecret = raw[`${prefix}_APP_SECRET`];
  const accountNo = raw[`${prefix}_ACCOUNT_NO`];

  if (!appKey) throw new Error(`${prefix}_APP_KEY is required`);
  if (!appSecret) throw new Error(`${prefix}_APP_SECRET is required`);
  if (!accountNo) throw new Error(`${prefix}_ACCOUNT_NO is required`);
  if (accountNo.length < 8)
    throw new Error(`${prefix}_ACCOUNT_NO must be at least 8 characters`);

  const cano = accountNo.slice(0, 8);
  const acntPrdtCd = accountNo.length >= 10 ? accountNo.slice(8, 10) : '01';
  const domain = DOMAIN_MAP[kisEnv];

  return {
    env: kisEnv,
    appKey,
    appSecret,
    accountNo,
    cano,
    acntPrdtCd,
    restBaseUrl: domain.rest,
    wsBaseUrl: domain.ws,
    approvalUrl: domain.approval
  };
}

/** 환경에 맞는 TR_ID 맵 반환 */
export function getTrIdMap(env: KisEnv): TrIdMap {
  return TR_ID_MAP[env];
}
