package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisDailyCandleResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    val output2: List<KisDailyCandleItem>?,
)

data class KisDailyCandleItem(
    @SerializedName("stck_bsop_date") val stckBsopDate: String,  // 날짜 YYYYMMDD
    @SerializedName("stck_oprc") val stckOprc: String,           // 시가
    @SerializedName("stck_hgpr") val stckHgpr: String,           // 고가
    @SerializedName("stck_lwpr") val stckLwpr: String,           // 저가
    @SerializedName("stck_clpr") val stckClpr: String,           // 종가
    @SerializedName("acml_vol") val acmlVol: String,             // 거래량
    @SerializedName("acml_tr_pbmn") val acmlTrPbmn: String?,    // 거래대금
    @SerializedName("mod_yn") val modYn: String?,                // 수정주가 여부
)
