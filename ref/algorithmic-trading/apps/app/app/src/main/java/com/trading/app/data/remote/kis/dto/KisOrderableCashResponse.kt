package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisOrderableCashResponse(
    @SerializedName("rt_cd") val rtCd: String,
    @SerializedName("msg_cd") val msgCd: String?,
    @SerializedName("msg1") val msg1: String?,
    val output: KisOrderableCashOutput?,
)

data class KisOrderableCashOutput(
    @SerializedName("ord_psbl_cash") val ordPsblCash: String,       // 주문가능현금
    @SerializedName("ord_psbl_sbst") val ordPsblSbst: String?,      // 주문가능대용
    @SerializedName("ruse_psbl_amt") val rusePsblAmt: String?,       // 재사용가능금액
    @SerializedName("nrcvb_buy_amt") val nrcvbBuyAmt: String?,       // 미수없는매수금액
    @SerializedName("nrcvb_buy_qty") val nrcvbBuyQty: String?,       // 미수없는매수수량
    @SerializedName("max_buy_amt") val maxBuyAmt: String?,           // 최대매수금액
    @SerializedName("max_buy_qty") val maxBuyQty: String?,           // 최대매수수량
)
