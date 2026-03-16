package com.trading.app.data.remote.kis

import com.trading.app.data.remote.kis.dto.KisTokenRequest
import com.trading.app.data.remote.kis.dto.KisTokenResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface KisAuthApi {
    @POST("/oauth2/tokenP")
    suspend fun issueToken(@Body request: KisTokenRequest): KisTokenResponse
}
