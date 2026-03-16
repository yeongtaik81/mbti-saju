package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisOpenOrderResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    @SerializedName("ctx_area_fk100") val ctxAreaFk100: String?,
    @SerializedName("ctx_area_nk100") val ctxAreaNk100: String?,
    val output: List<KisOpenOrderItem>?,
)

data class KisOpenOrderItem(
    @SerializedName("odno") val odno: String,                 // 주문번호
    @SerializedName("pdno") val pdno: String,                 // 종목코드
    @SerializedName("prdt_name") val prdtName: String?,       // 종목명
    @SerializedName("sll_buy_dvsn_cd") val sllBuyDvsnCd: String, // 01=매도, 02=매수
    @SerializedName("ord_qty") val ordQty: String,            // 주문수량
    @SerializedName("ord_unpr") val ordUnpr: String?,         // 주문단가
    @SerializedName("psbl_qty") val psblQty: String?,         // 정정/취소 가능 수량
)
