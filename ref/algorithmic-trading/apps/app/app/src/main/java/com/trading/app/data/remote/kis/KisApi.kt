package com.trading.app.data.remote.kis

import com.trading.app.data.remote.kis.dto.*
import retrofit2.http.*

interface KisApi {

    // 주식현재가 시세
    @GET("/uapi/domestic-stock/v1/quotations/inquire-price")
    suspend fun getCurrentPrice(
        @Header("tr_id") trId: String,
        @Query("FID_COND_MRKT_DIV_CODE") marketCode: String = "J",
        @Query("FID_INPUT_ISCD") stockCode: String,
    ): KisCurrentPriceResponse

    // 국내주식기간별시세(일/주/월/년)
    @GET("/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice")
    suspend fun getDailyCandles(
        @Header("tr_id") trId: String,
        @Query("FID_COND_MRKT_DIV_CODE") marketCode: String = "J",
        @Query("FID_INPUT_ISCD") stockCode: String,
        @Query("FID_INPUT_DATE_1") startDate: String,
        @Query("FID_INPUT_DATE_2") endDate: String,
        @Query("FID_PERIOD_DIV_CODE") period: String = "D",
        @Query("FID_ORG_ADJ_PRC") adjPrc: String = "0",
    ): KisDailyCandleResponse

    // 주식잔고조회
    @GET("/uapi/domestic-stock/v1/trading/inquire-balance")
    suspend fun getBalance(
        @Header("tr_id") trId: String,
        @Query("CANO") cano: String,
        @Query("ACNT_PRDT_CD") acntPrdtCd: String,
        @Query("AFHR_FLPR_YN") afhrFlprYn: String = "N",
        @Query("OFL_YN") oflYn: String = "",
        @Query("INQR_DVSN") inqrDvsn: String = "02",
        @Query("UNPR_DVSN") unprDvsn: String = "01",
        @Query("FUND_STTL_ICLD_YN") fundSttlIcldYn: String = "N",
        @Query("FNCG_AMT_AUTO_RDPT_YN") fncgAmtAutoRdptYn: String = "N",
        @Query("PRCS_DVSN") prcsDvsn: String = "01",
        @Query("CTX_AREA_FK100") ctxAreaFk100: String = "",
        @Query("CTX_AREA_NK100") ctxAreaNk100: String = "",
    ): KisBalanceResponse

    // 주식 주문 (현금)
    @POST("/uapi/domestic-stock/v1/trading/order-cash")
    suspend fun placeOrder(
        @Header("tr_id") trId: String,
        @Body request: KisOrderRequest,
    ): KisOrderResponse

    // 주식 주문 정정/취소
    @POST("/uapi/domestic-stock/v1/trading/order-rvsecncl")
    suspend fun cancelOrder(
        @Header("tr_id") trId: String,
        @Body request: KisCancelRequest,
    ): KisOrderResponse

    // 주식일별주문체결조회
    @GET("/uapi/domestic-stock/v1/trading/inquire-daily-ccld")
    suspend fun getExecutions(
        @Header("tr_id") trId: String,
        @Query("CANO") cano: String,
        @Query("ACNT_PRDT_CD") acntPrdtCd: String,
        @Query("INQR_STRT_DT") startDate: String,
        @Query("INQR_END_DT") endDate: String,
        @Query("SLL_BUY_DVSN_CD") sllBuyDvsnCd: String = "00",
        @Query("INQR_DVSN") inqrDvsn: String = "00",
        @Query("PDNO") pdno: String = "",
        @Query("CCLD_DVSN") ccldDvsn: String = "01",
        @Query("ORD_GNO_BRNO") ordGnoBrno: String = "",
        @Query("ODNO") odno: String = "",
        @Query("INQR_DVSN_3") inqrDvsn3: String = "00",
        @Query("INQR_DVSN_1") inqrDvsn1: String = "",
        @Query("CTX_AREA_FK100") ctxAreaFk100: String = "",
        @Query("CTX_AREA_NK100") ctxAreaNk100: String = "",
    ): KisExecutionResponse

    // 매수가능조회
    @GET("/uapi/domestic-stock/v1/trading/inquire-psbl-order")
    suspend fun getOrderableCash(
        @Header("tr_id") trId: String,
        @Query("CANO") cano: String,
        @Query("ACNT_PRDT_CD") acntPrdtCd: String,
        @Query("PDNO") pdno: String = "",
        @Query("ORD_UNPR") ordUnpr: String = "0",
        @Query("ORD_DVSN") ordDvsn: String = "01",
        @Query("CMA_EVLU_AMT_ICLD_YN") cmaEvluAmtIcldYn: String = "N",
        @Query("OVRS_ICLD_YN") ovrsIcldYn: String = "N",
    ): KisOrderableCashResponse

    // 주식정정취소가능주문조회
    @GET("/uapi/domestic-stock/v1/trading/inquire-psbl-rvsecncl")
    suspend fun getOpenOrders(
        @Header("tr_id") trId: String,
        @Query("CANO") cano: String,
        @Query("ACNT_PRDT_CD") acntPrdtCd: String,
        @Query("CTX_AREA_FK100") ctxAreaFk100: String = "",
        @Query("CTX_AREA_NK100") ctxAreaNk100: String = "",
        @Query("INQR_DVSN_1") inqrDvsn1: String = "0",
        @Query("INQR_DVSN_2") inqrDvsn2: String = "0",
    ): KisOpenOrderResponse
}
