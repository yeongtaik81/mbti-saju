package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisCurrentPriceResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    val output: KisCurrentPriceOutput?,
)

data class KisCurrentPriceOutput(
    @SerializedName("stck_prpr") val stckPrpr: String,      // 현재가
    @SerializedName("stck_oprc") val stckOprc: String,      // 시가
    @SerializedName("stck_hgpr") val stckHgpr: String,      // 고가
    @SerializedName("stck_lwpr") val stckLwpr: String,      // 저가
    @SerializedName("acml_vol") val acmlVol: String,        // 누적거래량
    @SerializedName("acml_tr_pbmn") val acmlTrPbmn: String, // 누적거래대금
    @SerializedName("hts_avls") val htsAvls: String?,       // 시가총액
    @SerializedName("stck_mxpr") val stckMxpr: String?,     // 상한가
    @SerializedName("stck_llam") val stckLlam: String?,     // 하한가
    @SerializedName("hts_kor_isnm") val htsKorIsnm: String?, // 종목명
)
