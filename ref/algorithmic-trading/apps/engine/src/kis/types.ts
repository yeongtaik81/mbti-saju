import { z } from 'zod';

/** 토큰 발급 응답 */
export const KisTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  access_token_token_expired: z.string().optional()
});
export type KisTokenResponse = z.infer<typeof KisTokenResponseSchema>;

/** WebSocket 접속키 발급 응답 */
export const KisApprovalResponseSchema = z.object({
  approval_key: z.string()
});
export type KisApprovalResponse = z.infer<typeof KisApprovalResponseSchema>;

/** 현재가 조회 응답 output */
export const KisCurrentPriceOutputSchema = z.object({
  stck_prpr: z.string(), // 현재가
  stck_oprc: z.string(), // 시가
  stck_hgpr: z.string(), // 고가
  stck_lwpr: z.string(), // 저가
  acml_vol: z.string(), // 누적 거래량
  acml_tr_pbmn: z.string(), // 누적 거래대금
  hts_avls: z.string(), // 시가총액
  stck_mxpr: z.string(), // 상한가
  stck_llam: z.string(), // 하한가
  per: z.string().optional(),
  pbr: z.string().optional()
});
export type KisCurrentPriceOutput = z.infer<typeof KisCurrentPriceOutputSchema>;

/** 현재가 API 전체 응답 */
export const KisCurrentPriceResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output: KisCurrentPriceOutputSchema
});

/** 일봉 캔들 아이템 */
export const KisDailyCandleItemSchema = z.object({
  stck_bsop_date: z.string(), // YYYYMMDD
  stck_oprc: z.string(), // 시가
  stck_hgpr: z.string(), // 고가
  stck_lwpr: z.string(), // 저가
  stck_clpr: z.string(), // 종가
  acml_vol: z.string(), // 거래량
  acml_tr_pbmn: z.string(), // 거래대금
  mod_yn: z.string().optional() // 분할 여부
});
export type KisDailyCandleItem = z.infer<typeof KisDailyCandleItemSchema>;

/** 일봉 API 전체 응답 */
export const KisDailyCandleResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output2: z.array(KisDailyCandleItemSchema),
  ctx_area_fk100: z.string().optional(),
  ctx_area_nk100: z.string().optional()
});

/** 분봉 캔들 아이템 */
export const KisMinuteCandleItemSchema = z.object({
  stck_bsop_date: z.string(), // YYYYMMDD
  stck_cntg_hour: z.string(), // HHMMSS
  stck_oprc: z.string(),
  stck_hgpr: z.string(),
  stck_lwpr: z.string(),
  stck_prpr: z.string(), // 현재가(종가)
  cntg_vol: z.string(), // 체결 거래량
  acml_vol: z.string().optional()
});
export type KisMinuteCandleItem = z.infer<typeof KisMinuteCandleItemSchema>;

/** 분봉 API 전체 응답 */
export const KisMinuteCandleResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output2: z.array(KisMinuteCandleItemSchema),
  ctx_area_fk100: z.string().optional(),
  ctx_area_nk100: z.string().optional()
});

/** 잔고 아이템 */
export const KisBalanceItemSchema = z.object({
  pdno: z.string(), // 종목코드
  prdt_name: z.string(), // 종목명
  hldg_qty: z.string(), // 보유수량
  pchs_avg_pric: z.string(), // 매입평균가
  prpr: z.string(), // 현재가
  evlu_pfls_amt: z.string(), // 평가손익금액
  evlu_pfls_rt: z.string(), // 평가손익율
  evlu_amt: z.string() // 평가금액
});
export type KisBalanceItem = z.infer<typeof KisBalanceItemSchema>;

/** 잔고 요약 */
export const KisBalanceSummarySchema = z.object({
  dnca_tot_amt: z.string(), // 예수금총금액
  tot_evlu_amt: z.string(), // 총평가금액
  pchs_amt_smtl_amt: z.string(), // 매입금액합계
  evlu_amt_smtl_amt: z.string(), // 평가금액합계
  evlu_pfls_smtl_amt: z.string() // 평가손익합계
});
export type KisBalanceSummary = z.infer<typeof KisBalanceSummarySchema>;

/** 잔고 API 전체 응답 */
export const KisBalanceResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  ctx_area_fk100: z.string().optional(),
  ctx_area_nk100: z.string().optional(),
  output1: z.array(KisBalanceItemSchema),
  output2: z.array(KisBalanceSummarySchema)
});

/** 주문 응답 output */
export const KisOrderOutputSchema = z.object({
  ODNO: z.string(), // 주문번호
  ORD_TMD: z.string() // 주문시각 (HHMMSS)
});
export type KisOrderOutput = z.infer<typeof KisOrderOutputSchema>;

/** 주문 API 전체 응답 */
export const KisOrderResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output: KisOrderOutputSchema
});

/** 체결 내역 아이템 */
export const KisExecutionItemSchema = z.object({
  odno: z.string(), // 주문번호
  orgn_odno: z.string(), // 원주문번호
  pdno: z.string(), // 종목코드
  sll_buy_dvsn_cd: z.string(), // 매도매수구분 (01=매도, 02=매수)
  ord_qty: z.string(), // 주문수량
  tot_ccld_qty: z.string(), // 총체결수량
  tot_ccld_amt: z.string(), // 총체결금액
  pchs_avg_pric: z.string(), // 매입평균가
  ord_unpr: z.string(), // 주문단가
  ord_tmd: z.string(), // 주문시각
  ccld_cndt_name: z.string().optional() // 체결조건명
});
export type KisExecutionItem = z.infer<typeof KisExecutionItemSchema>;

/** 체결 내역 API 전체 응답 */
export const KisExecutionResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output1: z.array(KisExecutionItemSchema),
  ctx_area_fk100: z.string().optional(),
  ctx_area_nk100: z.string().optional()
});

/** 미체결 주문 아이템 */
export const KisOpenOrderItemSchema = z.object({
  odno: z.string(), // 주문번호
  pdno: z.string(), // 종목코드
  prdt_name: z.string(), // 종목명
  sll_buy_dvsn_cd: z.string(), // 매도매수구분 (01=매도, 02=매수)
  ord_qty: z.string(), // 주문수량
  ord_unpr: z.string(), // 주문단가
  tot_ccld_qty: z.string(), // 총체결수량
  rmn_qty: z.string(), // 잔여수량
  ord_tmd: z.string(), // 주문시각
  ord_dvsn_cd: z.string() // 주문구분코드 (00=지정가, 01=시장가)
});
export type KisOpenOrderItem = z.infer<typeof KisOpenOrderItemSchema>;

/** 미체결 주문 API 전체 응답 */
export const KisOpenOrderResponseSchema = z.object({
  rt_cd: z.string(),
  msg_cd: z.string(),
  msg1: z.string(),
  output: z.array(KisOpenOrderItemSchema),
  ctx_area_fk100: z.string().optional(),
  ctx_area_nk100: z.string().optional()
});

/** 실시간 체결 틱 (WebSocket) */
export interface KisRealtimeTick {
  stockCode: string;
  time: string; // HHMMSS
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  acmlVolume: number;
  acmlAmount: number;
}

/**
 * WebSocket 실시간 체결 데이터 파싱
 * 형식: 0|H0STCNT0|count|data (^ 구분자)
 * @see https://apiportal.koreainvestment.com/apiservice (실시간 시세)
 */
export function parseRealtimeTick(raw: string): KisRealtimeTick | null {
  const parts = raw.split('|');
  if (parts.length < 4) return null;

  const data = parts[3];
  if (!data) return null;
  const fields = data.split('^');
  if (fields.length < 15) return null;

  const price = Number(fields[2]);
  const volume = Number(fields[12]);
  if (Number.isNaN(price) || Number.isNaN(volume)) return null;

  return {
    stockCode: fields[0]!,
    time: fields[1]!,
    price,
    change: Number(fields[4]) || 0,
    changeRate: Number(fields[5]) || 0,
    volume,
    acmlVolume: Number(fields[13]) || 0,
    acmlAmount: Number(fields[14]) || 0
  };
}
