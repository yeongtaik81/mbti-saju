package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisOrderRequest(
    @SerializedName("CANO") val cano: String,
    @SerializedName("ACNT_PRDT_CD") val acntPrdtCd: String,
    @SerializedName("PDNO") val pdno: String,                   // 종목코드
    @SerializedName("ORD_DVSN") val ordDvsn: String,            // 주문구분 (00=지정가, 01=시장가)
    @SerializedName("ORD_QTY") val ordQty: String,              // 주문수량
    @SerializedName("ORD_UNPR") val ordUnpr: String,            // 주문단가 (시장가=0)
)

data class KisOrderResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    val output: KisOrderOutput?,
)

data class KisOrderOutput(
    @SerializedName("KRX_FWDG_ORD_ORGNO") val krxFwdgOrdOrgno: String?,
    @SerializedName("ODNO") val odno: String?,                  // 주문번호
    @SerializedName("ORD_TMD") val ordTmd: String?,             // 주문시각
)

data class KisCancelRequest(
    @SerializedName("CANO") val cano: String,
    @SerializedName("ACNT_PRDT_CD") val acntPrdtCd: String,
    @SerializedName("KRX_FWDG_ORD_ORGNO") val krxFwdgOrdOrgno: String = "",
    @SerializedName("ORGN_ODNO") val orgnOdno: String,          // 원주문번호
    @SerializedName("ORD_DVSN") val ordDvsn: String = "00",
    @SerializedName("RVSE_CNCL_DVSN_CD") val rvseCnclDvsnCd: String = "02", // 02=취소
    @SerializedName("ORD_QTY") val ordQty: String,
    @SerializedName("ORD_UNPR") val ordUnpr: String = "0",
    @SerializedName("QTY_ALL_ORD_YN") val qtyAllOrdYn: String = "Y",
)
