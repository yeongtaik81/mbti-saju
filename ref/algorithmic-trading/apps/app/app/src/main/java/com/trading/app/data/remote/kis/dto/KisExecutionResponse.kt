package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisExecutionResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    @SerializedName("ctx_area_fk100") val ctxAreaFk100: String?,
    @SerializedName("ctx_area_nk100") val ctxAreaNk100: String?,
    val output1: List<KisExecutionItem>?,
)

data class KisExecutionItem(
    @SerializedName("odno") val odno: String,                 // 주문번호
    @SerializedName("pdno") val pdno: String,                 // 종목코드
    @SerializedName("sll_buy_dvsn_cd") val sllBuyDvsnCd: String, // 01=매도, 02=매수
    @SerializedName("ord_qty") val ordQty: String,            // 주문수량
    @SerializedName("tot_ccld_qty") val totCcldQty: String,   // 총체결수량
    @SerializedName("avg_prvs") val avgPrvs: String?,         // 체결평균가
    @SerializedName("ord_tmd") val ordTmd: String?,           // 주문시각
)
