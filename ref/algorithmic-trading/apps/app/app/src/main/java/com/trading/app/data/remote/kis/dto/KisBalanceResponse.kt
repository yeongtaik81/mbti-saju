package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisBalanceResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    @SerializedName("ctx_area_fk100") val ctxAreaFk100: String?,
    @SerializedName("ctx_area_nk100") val ctxAreaNk100: String?,
    val output1: List<KisBalanceItem>?,
    val output2: List<KisBalanceSummary>?,
)

data class KisBalanceItem(
    @SerializedName("pdno") val pdno: String,                    // 종목코드
    @SerializedName("prdt_name") val prdtName: String,           // 종목명
    @SerializedName("hldg_qty") val hldgQty: String,             // 보유수량
    @SerializedName("pchs_avg_pric") val pchsAvgPric: String,   // 매입평균가
    @SerializedName("prpr") val prpr: String,                    // 현재가
    @SerializedName("evlu_pfls_amt") val evluPflsAmt: String,   // 평가손익금액
    @SerializedName("evlu_pfls_rt") val evluPflsRt: String?,    // 평가손익률
)

data class KisBalanceSummary(
    @SerializedName("dnca_tot_amt") val dncaTotAmt: String,           // 예수금총액
    @SerializedName("tot_evlu_amt") val totEvluAmt: String,           // 총평가금액
    @SerializedName("pchs_amt_smtl_amt") val pchsAmtSmtlAmt: String, // 매입금액합계
    @SerializedName("evlu_amt_smtl_amt") val evluAmtSmtlAmt: String,  // 평가금액합계
    @SerializedName("evlu_pfls_smtl_amt") val evluPflsSmtlAmt: String, // 평가손익합계
)
