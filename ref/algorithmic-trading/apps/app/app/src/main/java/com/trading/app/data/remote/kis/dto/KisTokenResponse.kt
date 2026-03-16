package com.trading.app.data.remote.kis.dto

import com.google.gson.annotations.SerializedName

data class KisTokenRequest(
    @SerializedName("grant_type") val grantType: String = "client_credentials",
    val appkey: String,
    val appsecret: String,
)

data class KisTokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String?,
    @SerializedName("expires_in") val expiresIn: Long,
)
